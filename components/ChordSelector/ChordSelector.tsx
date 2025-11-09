import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { rootNotes, chordTypes, getChordNotesWithOctaves, detectChordFromNotes, getAbbreviatedNameFromNotes } from '../../theory/chords.js';
import { getDiatonicChords, getBorrowedChords, getRomanNumeralForNote } from '../../theory/harmony.js';
import { Chord as TonalChord, Note } from 'tonal';
import ChordTransitionVisualizer from '../ChordTransitionVisualizer/ChordTransitionVisualizer.tsx';
import VerticalNoteVisualizer from '../VerticalNoteVisualizer/VerticalNoteVisualizer.tsx';
import CollapsibleSection from '../CollapsibleSection/CollapsibleSection.tsx';
import './ChordSelector.css';

const ChordSelector = ({ isOpen, onClose, onSave, chord, musicalKey, musicalMode, contextualChord, nextChord, player }) => {
    const [selectedRoot, setSelectedRoot] = useState('C');
    const [selectedType, setSelectedType] = useState('maj7');
    const [selectedDuration, setSelectedDuration] = useState(4);
    const [selectedOctave, setSelectedOctave] = useState(4);
    const [isRest, setIsRest] = useState(false);
    const [selectedNotes, setSelectedNotes] = useState([]);


    const parseChordName = (name) => {
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

    useEffect(() => {
        // This effect runs when root, type, or octave changes to update notes
        updateNotesFromControls();
    }, [selectedRoot, selectedType, selectedOctave, isRest]);

    const handleSelectedChordNotesUpdate = (newNotes) => {
        setSelectedNotes(newNotes);
        const newChordName = detectChordFromNotes(newNotes);
        if (newChordName) {
            const { root, type } = parseChordName(newChordName);
            if (root) setSelectedRoot(root);
            if (type) setSelectedType(type === 'M' ? 'maj' : type);
        }
        player?.playOneShot(newNotes);
    };

    const keyContext = useMemo(() => {
        const diatonicChords = getDiatonicChords(musicalKey, musicalMode);
        const borrowedChords = getBorrowedChords(musicalKey, musicalMode);
        
        const diatonicNoteSet = new Set();
        diatonicChords.forEach(c => {
            const tonic = TonalChord.get(c.name).tonic;
            if (tonic) diatonicNoteSet.add(tonic);
        });
    
        const borrowedNoteSet = new Set();
        borrowedChords.forEach(c => {
            const tonic = TonalChord.get(c.name).tonic;
            if (tonic) borrowedNoteSet.add(tonic);
        });
    
        return { diatonicNoteSet, borrowedNoteSet };
    }, [musicalKey, musicalMode]);

    const typeContext = useMemo(() => {
        if (!selectedRoot) return { diatonicType: null, borrowedType: null };

        const diatonicChordForRoot = getDiatonicChords(musicalKey, musicalMode).find(c => TonalChord.get(c.name).tonic === selectedRoot);
        const borrowedChordForRoot = getBorrowedChords(musicalKey, musicalMode).find(c => TonalChord.get(c.name).tonic === selectedRoot);

        return {
            diatonicType: diatonicChordForRoot ? TonalChord.get(diatonicChordForRoot.name).type : null,
            borrowedType: borrowedChordForRoot ? TonalChord.get(borrowedChordForRoot.name).type : null,
        }
    }, [selectedRoot, musicalKey, musicalMode]);

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
                    <div className="modal-header-top-row">
                        <button onClick={onClose} className="cancel-button header-action-button">Cancel</button>
                        <h2>{chord?.notes ? 'Edit Chord' : 'Add Chord'}</h2>
                        <button onClick={handleSave} className="save-button header-action-button">Save</button>
                    </div>
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
                            </div>

                            <CollapsibleSection title="Customization" defaultOpen={true}>
                                <div className={`customization-controls ${isRest ? 'disabled' : ''}`}>
                                    <div className="chromatic-controls">
                                        <div className="modal-subsection">
                                            <h4>Root Note</h4>
                                            <div className="button-grid">
                                                {rootNotes.map(note => {
                                                    const isDiatonic = keyContext.diatonicNoteSet.has(note);
                                                    const isBorrowed = keyContext.borrowedNoteSet.has(note);
                                                    const romanNumeral = getRomanNumeralForNote(note, musicalKey, musicalMode);
                                                    
                                                    const classNames = [
                                                        selectedRoot === note ? 'active' : '',
                                                        isDiatonic ? 'diatonic' : '',
                                                        isBorrowed ? 'borrowed' : ''
                                                    ].filter(Boolean).join(' ');

                                                    return (
                                                        <button key={note} className={classNames} onClick={() => setSelectedRoot(note)}>
                                                            {note}
                                                            <span className="roman-numeral">{romanNumeral}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="modal-subsection">
                                            <h4>Chord Type</h4>
                                            <div className="button-grid chord-type-grid">
                                                {chordTypes.map(type => {
                                                    const isDiatonic = typeContext.diatonicType === type;
                                                    const isBorrowed = typeContext.borrowedType === type;

                                                    const classNames = [
                                                        selectedType === type ? 'active' : '',
                                                        isDiatonic ? 'diatonic' : '',
                                                        isBorrowed ? 'borrowed' : ''
                                                    ].filter(Boolean).join(' ');

                                                    const qualities = ['maj', 'm', 'dim', 'aug', 'sus'];
                                                    const matchedQuality = qualities.find(q => type.startsWith(q));
                                                    let quality = '';
                                                    let ornament = '';
                                                    if (matchedQuality) {
                                                        quality = matchedQuality;
                                                        ornament = type.substring(quality.length);
                                                    } else {
                                                        ornament = type;
                                                    }

                                                    return (
                                                        <button 
                                                            key={type} 
                                                            className={classNames}
                                                            onClick={() => setSelectedType(type)}>
                                                            {quality}
                                                            {ornament && <span className="chord-type-ornament">{ornament}</span>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CollapsibleSection>
                        </div>
                    </div>

                    {showVisualization && (
                         <CollapsibleSection title="Note Visualization" defaultOpen={true}>
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
                                        onToChordNotesChange={() => {}}
                                    />
                                )}
                            </div>
                        </CollapsibleSection>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChordSelector;