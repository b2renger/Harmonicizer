import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { rootNotes, chordTypes, getDisplayChordName, getChordNotesWithOctaves, detectChordFromNotes, getAbbreviatedNameFromNotes, getNextInversion, getPreviousInversion, getPermutedVoicing } from '../../theory/chords';
import type { Chord } from '../../modes/composer/Composer';
import type { Player } from '../../audio/player';
import { Chord as TonalChord, Note } from 'tonal';
import ChordTransitionVisualizer from '../ChordTransitionVisualizer/ChordTransitionVisualizer';
import VerticalNoteVisualizer from '../VerticalNoteVisualizer/VerticalNoteVisualizer';
import CollapsibleSection from '../CollapsibleSection/CollapsibleSection';
import './ChordSelector.css';

interface ChordSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (chord: { notes: string[], duration: number }) => void;
    chord: Partial<Chord> | null;
    musicalKey: string;
    musicalMode: string;
    contextualChord: Chord | null;
    nextChord: Chord | null;
    player: Player | null;
}

const ChordSelector: React.FC<ChordSelectorProps> = ({ isOpen, onClose, onSave, chord, musicalKey, musicalMode, contextualChord, nextChord, player }) => {
    const [selectedRoot, setSelectedRoot] = useState('C');
    const [selectedType, setSelectedType] = useState('maj7');
    const [selectedDuration, setSelectedDuration] = useState(4);
    const [selectedOctave, setSelectedOctave] = useState(4);
    const [isRest, setIsRest] = useState(false);
    const [selectedNotes, setSelectedNotes] = useState<string[]>([]);


    const parseChordName = (name: string | undefined) => {
        if (!name || name === 'Rest') {
            return { root: null, type: null };
        }
        const chordInfo = TonalChord.get(name);
        if (chordInfo.empty) {
            const match = name.match(/^([A-G]#?b?)(.*)$/i); // Case-insensitive match
            if (match) return { root: match[1], type: match[2] || 'maj' };
            return { root: null, type: null };
        }
        return { root: chordInfo.tonic, type: chordInfo.type };
    }

    useEffect(() => {
        if (isOpen) {
            const initialNotes = chord?.notes && chord.notes.length > 0
                ? chord.notes
                : getChordNotesWithOctaves(`${musicalKey || 'C'}maj7`, 4);
            
            setSelectedNotes(initialNotes);
            setSelectedDuration(chord?.duration || 4);

            if (!chord?.notes || chord.notes.length === 0) {
                 setIsRest(true);
            } else {
                 setIsRest(false);
            }

            // Update controls based on notes
            const detectedName = detectChordFromNotes(initialNotes);
            if (detectedName) {
                const { root, type } = parseChordName(detectedName);
                if (root) setSelectedRoot(root);
                if (type) setSelectedType(type === 'M' ? 'maj' : type);
            }
            
            if (initialNotes.length > 0) {
                const bassNote = initialNotes.slice().sort((a,b) => (Note.midi(a) || 0) - (Note.midi(b) || 0))[0];
                setSelectedOctave(Note.octave(bassNote) || 4);
            } else {
                setSelectedOctave(4);
            }
        }
    }, [isOpen, chord, musicalKey]);

    const updateNotesFromControls = useCallback(() => {
        if (isRest) {
            setSelectedNotes([]);
            return;
        }
        const newName = `${selectedRoot}${selectedType}`;
        const newNotes = getChordNotesWithOctaves(newName, selectedOctave);
        setSelectedNotes(newNotes);
        player?.playOneShot(newNotes);
    }, [selectedRoot, selectedType, selectedOctave, isRest, player]);

    const handleSave = () => {
        onSave({
            notes: isRest ? [] : selectedNotes,
            duration: selectedDuration,
        });
    };

    const handleInvert = (direction: 'up' | 'down') => {
        if (isRest || selectedNotes.length < 2) return;
        const newNotes = direction === 'up' 
            ? getNextInversion(selectedNotes) 
            : getPreviousInversion(selectedNotes);
        setSelectedNotes(newNotes);
        player?.playOneShot(newNotes);
    };

    const handlePermute = () => {
        if (isRest || selectedNotes.length < 3) return;
        const newNotes = getPermutedVoicing(selectedNotes);
        setSelectedNotes(newNotes);
        player?.playOneShot(newNotes);
    };

    useEffect(() => {
        // This effect runs when root, type, or octave changes to update notes
        updateNotesFromControls();
    }, [selectedRoot, selectedType, selectedOctave, isRest]);

    const handleSelectedChordNotesUpdate = (newNotes: string[]) => {
        setSelectedNotes(newNotes);
        const newChordName = detectChordFromNotes(newNotes);
        if (newChordName) {
            const { root, type } = parseChordName(newChordName);
            if (root) setSelectedRoot(root);
            if (type) setSelectedType(type === 'M' ? 'maj' : type);
        }
        player?.playOneShot(newNotes);
    };

    if (!isOpen) return null;

    const displaySelection = getAbbreviatedNameFromNotes(selectedNotes);
    
    const selectedChordIsValid = selectedNotes.length > 0;
    const prevChordIsValid = contextualChord && contextualChord.notes.length > 0;
    const nextChordIsValid = nextChord && nextChord.notes.length > 0;
    const showVisualization = selectedChordIsValid;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <h2>{chord?.notes ? 'Edit Chord' : 'Add Chord'}</h2>
                    <div className="current-selection-display">
                        {displaySelection}
                        {' for '} 
                        {selectedDuration} beats
                    </div>
                </header>

                <div className="modal-sections-wrapper">
                     <div className="static-section">
                        <div className="section-header-static">
                            <h3>Chord Properties</h3>
                        </div>
                        <div className="section-content-inner">
                            <div className="basics-controls">
                                <button className={`rest-button ${isRest ? 'active' : ''}`} onClick={() => setIsRest(!isRest)}>
                                    {isRest ? 'Set Chord' : 'Set Rest'}
                                </button>
                                <div className="duration-selector">
                                    <label>Duration:</label>
                                    <div className="duration-buttons">
                                        {[1, 2, 3, 4, 6, 8].map(duration => (
                                            <button key={duration} className={selectedDuration === duration ? 'active' : ''} onClick={() => setSelectedDuration(duration)}>
                                                {duration}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className={`octave-selector ${isRest ? 'disabled' : ''}`}>
                                    <label>Octave:</label>
                                    <div className="octave-buttons">
                                        {[2, 3, 4, 5, 6].map(octave => (
                                            <button key={octave} className={selectedOctave === octave ? 'active' : ''} onClick={() => setSelectedOctave(octave)}>
                                                {octave}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className={`voicing-selector ${isRest ? 'disabled' : ''}`}>
                                    <label>Voicing:</label>
                                    <div className="voicing-buttons">
                                        <button onClick={() => handleInvert('down')} aria-label="Previous Inversion">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                                        </button>
                                        <button onClick={handlePermute} aria-label="Random Inversion">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.4c1.3 0 2.5.6 3.3 1.7l6.1 8.6c.7 1.1 2 1.7 3.3 1.7H22"/><path d="m18 22-4-4 4-4"/></svg>
                                        </button>
                                        <button onClick={() => handleInvert('up')} aria-label="Next Inversion">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                        </button>
                                    </div>
                                </div>
                                <div className={`chromatic-controls ${isRest ? 'disabled' : ''}`}>
                                     <div className="modal-subsection">
                                        <h4>Root Note</h4>
                                        <div className="button-grid">
                                            {rootNotes.map(note => (
                                                <button key={note} className={selectedRoot === note ? 'active' : ''} onClick={() => setSelectedRoot(note)}>
                                                    {note}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="modal-subsection">
                                        <h4>Chord Type</h4>
                                        <div className="button-grid">
                                            {chordTypes.map(type => (
                                                <button 
                                                    key={type} 
                                                    className={selectedType === type ? 'active' : ''}
                                                    onClick={() => setSelectedType(type)}>
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {showVisualization && (
                         <CollapsibleSection title="Note Visualization" defaultOpen>
                            <div className="chord-visualization-container">
                                {prevChordIsValid && (
                                    <ChordTransitionVisualizer
                                        fromNotes={contextualChord.notes}
                                        toNotes={selectedNotes}
                                        title={`From ${getAbbreviatedNameFromNotes(contextualChord.notes)}`}
                                        onToChordNotesChange={handleSelectedChordNotesUpdate}
                                        musicalKey={musicalKey}
                                        musicalMode={musicalMode}
                                    />
                                )}

                                <div className="current-chord-visualizer-container">
                                    <h4 className="current-chord-visualizer-title">
                                        {getAbbreviatedNameFromNotes(selectedNotes)}
                                    </h4>
                                    <VerticalNoteVisualizer
                                        notes={selectedNotes}
                                        onNotesChange={handleSelectedChordNotesUpdate}
                                        musicalKey={musicalKey}
                                        musicalMode={musicalMode}
                                    />
                                </div>

                                {nextChordIsValid && (
                                    <ChordTransitionVisualizer
                                        fromNotes={selectedNotes}
                                        toNotes={nextChord.notes}
                                        title={`To ${getAbbreviatedNameFromNotes(nextChord.notes)}`}
                                        musicalKey={musicalKey}
                                        musicalMode={musicalMode}
                                    />
                                )}
                            </div>
                        </CollapsibleSection>
                    )}
                </div>


                <div className="modal-actions">
                    <button onClick={onClose} className="cancel-button">Cancel</button>
                    <button onClick={handleSave} className="save-button">Save</button>
                </div>
            </div>
        </div>
    );
};

export default ChordSelector;