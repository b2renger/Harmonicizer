import React, { useState, useEffect, useMemo } from 'react';
import { rootNotes, chordTypes, getDisplayChordName, invertChord, randomlyInvertChord } from '../../theory/chords';
import { getSuggestionsForChord, getPatternSuggestionsForChord } from '../../theory/analysis';
import { getDiatonicChords, getBorrowedChords } from '../../theory/harmony';
import type { Chord } from '../../modes/composer/Composer';
import type { Player } from '../../audio/player';
import { Chord as TonalChord } from 'tonal';
import ChordGraph from '../ChordGraph/ChordGraph';
import CollapsibleSection from '../CollapsibleSection/CollapsibleSection';
import './ChordSelector.css';

interface ChordSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (chord: Omit<Chord, 'id'>) => void;
    onAddPattern: (patternChords: string[]) => void;
    chord: Partial<Chord> | null;
    musicalKey: string;
    musicalMode: string;
    contextualChord: Chord | null;
    nextChord: Chord | null;
    player: Player | null;
}

const SuggestionGrid: React.FC<{ title: string; chords: string[]; onChordClick: (name: string) => void; currentSelection: string }> = ({ title, chords, onChordClick, currentSelection }) => {
    if (!chords || chords.length === 0) return null;
    return (
        <div className="modal-subsection">
            <h4>{title}</h4>
            <div className="button-grid">
                {chords.map((name) => (
                    <button key={name} className={currentSelection === name ? 'active' : ''} onClick={() => onChordClick(name)}>
                        {getDisplayChordName(name)}
                    </button>
                ))}
            </div>
        </div>
    );
};

const ChordSelector: React.FC<ChordSelectorProps> = ({ isOpen, onClose, onSave, onAddPattern, chord, musicalKey, musicalMode, contextualChord, nextChord, player }) => {
    const [selectedRoot, setSelectedRoot] = useState('C');
    const [selectedType, setSelectedType] = useState('maj7');
    const [selectedDuration, setSelectedDuration] = useState(4);
    const [selectedOctave, setSelectedOctave] = useState(4);
    const [isRest, setIsRest] = useState(false);
    const [selectedChordName, setSelectedChordName] = useState('Cmaj7');


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
            const initialName = chord?.name || `${musicalKey || 'C'}maj7`;
            setSelectedChordName(initialName);
            if (initialName === 'Rest') {
                setIsRest(true);
            } else {
                setIsRest(false);
                const { root, type } = parseChordName(initialName);
                if (root) setSelectedRoot(root);
                if (type) setSelectedType(type === 'M' ? 'maj' : type);
            }
            setSelectedDuration(chord?.duration || 4);
            setSelectedOctave(chord?.octave || 4);
        }
    }, [isOpen, chord, musicalKey]);

    const suggestions = useMemo(() => {
        return getSuggestionsForChord(contextualChord?.name || null, musicalKey, musicalMode);
    }, [contextualChord, musicalKey, musicalMode]);

    const patternSuggestions = useMemo(() => {
        if (!contextualChord || contextualChord.name === 'Rest') return [];
        return getPatternSuggestionsForChord(contextualChord.name, musicalKey, musicalMode);
    }, [contextualChord, musicalKey, musicalMode]);

    const diatonicChords = useMemo(() => getDiatonicChords(musicalKey, musicalMode), [musicalKey, musicalMode]);
    const borrowedChords = useMemo(() => getBorrowedChords(musicalKey, musicalMode), [musicalKey, musicalMode]);

    const handleSave = () => {
        onSave({
            name: isRest ? 'Rest' : selectedChordName,
            duration: selectedDuration,
            octave: selectedOctave,
        });
    };

    const handleSuggestionClick = (name: string) => {
        setSelectedChordName(name);
        const { root, type } = parseChordName(name);
        if (root) setSelectedRoot(root);
        if (type) setSelectedType(type === 'M' ? 'maj' : type);
        setIsRest(false);
    };

    // FIX: Updated handler to work with the new `chordsToAdd` property from `getPatternSuggestionsForChord`.
    const handleAddPattern = (pattern: { name: string, chordsToAdd: string[] }) => {
        onAddPattern(pattern.chordsToAdd);
    };

    const handleInvert = (direction: 'up' | 'down') => {
        if (isRest || !selectedChordName) return;
        const newName = invertChord(selectedChordName, direction);
        setSelectedChordName(newName);
        player?.playOneShot(newName, selectedOctave);
    };

    const handlePermute = () => {
        if (isRest || !selectedChordName) return;
        const newName = randomlyInvertChord(selectedChordName);
        setSelectedChordName(newName);
        player?.playOneShot(newName, selectedOctave);
    };

    const handleRootChange = (newRoot: string) => {
        setSelectedRoot(newRoot);
        // Rebuild the chord name, which resets any inversion. This is the desired behavior
        // when the user explicitly changes the root note.
        setSelectedChordName(`${newRoot}${selectedType}`);
    };
    
    const handleTypeChange = (newType: string) => {
        setSelectedType(newType);
        // Rebuild the chord name, which resets any inversion. This is the desired behavior
        // when the user explicitly changes the chord type.
        setSelectedChordName(`${selectedRoot}${newType}`);
    };


    if (!isOpen) return null;

    const displaySelection = getDisplayChordName(isRest ? 'Rest' : selectedChordName, selectedOctave);
    
    const selectedChordIsValid = !isRest && !TonalChord.get(selectedChordName).empty;
    const prevChordIsValid = contextualChord && contextualChord.name !== 'Rest';
    const nextChordIsValid = nextChord && nextChord.name !== 'Rest';
    const showVisualization = selectedChordIsValid && (prevChordIsValid || nextChordIsValid);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <h2>{chord?.name ? 'Edit Chord' : 'Add Chord'}</h2>
                    <div className="current-selection-display">
                        {displaySelection}
                        {' for '} 
                        {selectedDuration} beats
                    </div>
                </header>

                <div className="modal-sections-wrapper">
                     <div className="static-section">
                        <div className="section-header-static">
                            <h3>Basics</h3>
                        </div>
                        <div className="section-content-inner">
                            <div className="basics-controls">
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
                                <button className={`rest-button ${isRest ? 'active' : ''}`} onClick={() => setIsRest(!isRest)}>
                                    {isRest ? 'Set Chord' : 'Set Rest'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {patternSuggestions.length > 0 && (
                        <CollapsibleSection title="Suggested Patterns">
                            <ul className="pattern-list">
                                {patternSuggestions.map(pattern => (
                                    <li key={pattern.name} className="pattern-item">
                                        <div className="pattern-info">
                                            <span className="pattern-name">{pattern.name}</span>
                                            {/* FIX: Use `chordsToAdd` property which exists on the pattern object. */}
                                            <span className="pattern-chords">
                                                {pattern.chordsToAdd.map(c => getDisplayChordName(c)).join(' → ')}
                                            </span>
                                        </div>
                                        {/* FIX: The call is now valid because `handleAddPattern` has been updated to accept the correct type. */}
                                        <button className="add-pattern-button" onClick={() => handleAddPattern(pattern)}>Add</button>
                                    </li>
                                ))}
                            </ul>
                        </CollapsibleSection>
                    )}

                    <CollapsibleSection title={`Suggested Chords ${contextualChord ? `after ${getDisplayChordName(contextualChord.name, contextualChord.octave)}` : ''}`}>
                        <SuggestionGrid title="Coherent" chords={suggestions.coherent} onChordClick={handleSuggestionClick} currentSelection={selectedChordName} />
                        <SuggestionGrid title="Inventive (Modal Mixture)" chords={suggestions.inventive} onChordClick={handleSuggestionClick} currentSelection={selectedChordName} />
                        <SuggestionGrid title="Jazzy" chords={suggestions.jazzy} onChordClick={handleSuggestionClick} currentSelection={selectedChordName} />
                        <SuggestionGrid title="Classical" chords={suggestions.classical} onChordClick={handleSuggestionClick} currentSelection={selectedChordName} />
                    </CollapsibleSection>
                    
                    <CollapsibleSection title="Harmonic Hints">
                        <div className="modal-subsection">
                            <h4>Diatonic Chords in {musicalKey} {musicalMode}</h4>
                            <div className="button-grid">
                                {diatonicChords.map(({ name, roman }) => (
                                    <button key={name} className={selectedChordName === name ? 'active' : ''} onClick={() => handleSuggestionClick(name)}>
                                        {getDisplayChordName(name)} <span className="roman-numeral">{roman}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                         <div className="modal-subsection">
                            <h4>Borrowed Chords</h4>
                            <div className="button-grid">
                                {borrowedChords.map(({ name, roman }) => (
                                    <button key={name} className={selectedChordName === name ? 'active' : ''} onClick={() => handleSuggestionClick(name)}>
                                        {getDisplayChordName(name)} <span className="roman-numeral">{roman}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CollapsibleSection>
                    
                    {showVisualization && (
                         <CollapsibleSection title="Note Visualization" defaultOpen>
                            <div className="chord-graph-dual-view">
                                {prevChordIsValid && (
                                    <ChordGraph
                                        chord1Name={contextualChord.name}
                                        chord2Name={selectedChordName}
                                        title={`From ${getDisplayChordName(contextualChord.name)}`}
                                    />
                                )}
                                {nextChordIsValid && (
                                    <ChordGraph
                                        chord1Name={selectedChordName}
                                        chord2Name={nextChord.name}
                                        title={`To ${getDisplayChordName(nextChord.name)}`}
                                    />
                                )}
                            </div>
                        </CollapsibleSection>
                    )}


                    <CollapsibleSection title="Chromatic (Advanced)">
                        <div className={`chromatic-controls ${isRest ? 'disabled' : ''}`}>
                             <div className="modal-subsection">
                                <h4>Root Note</h4>
                                <div className="button-grid">
                                    {rootNotes.map(note => (
                                        <button key={note} className={selectedRoot === note ? 'active' : ''} onClick={() => handleRootChange(note)}>
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
                                            onClick={() => handleTypeChange(type)}>
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CollapsibleSection>
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