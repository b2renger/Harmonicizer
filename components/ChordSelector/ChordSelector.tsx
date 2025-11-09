import React, { useState, useEffect, useMemo } from 'react';
import { rootNotes, chordTypes, getAbbreviatedChordName, getDisplayChordName } from '../../theory/chords';
import { getSuggestionsForChord, getPatternSuggestionsForChord } from '../../theory/analysis';
import { getDiatonicChords, getBorrowedChords } from '../../theory/harmony';
import type { Chord } from '../../modes/composer/Composer';
import { Chord as TonalChord } from 'tonal';
import ChordGraph from '../ChordGraph/ChordGraph';
import CollapsibleSection from '../CollapsibleSection/CollapsibleSection';
import './ChordSelector.css';

interface ChordSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (chord: Omit<Chord, 'id' | 'octave'> & { octave: number }) => void;
    onAddPattern: (patternChords: string[]) => void;
    chord: Partial<Chord> | null;
    musicalKey: string;
    musicalMode: string;
    contextualChord: Chord | null;
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

const ChordSelector: React.FC<ChordSelectorProps> = ({ isOpen, onClose, onSave, onAddPattern, chord, musicalKey, musicalMode, contextualChord }) => {
    const [selectedRoot, setSelectedRoot] = useState('C');
    const [selectedType, setSelectedType] = useState('maj7');
    const [selectedDuration, setSelectedDuration] = useState(4);
    const [selectedOctave, setSelectedOctave] = useState(4);
    const [isRest, setIsRest] = useState(false);

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
        if (chord?.name) {
            if (chord.name === 'Rest') {
                setIsRest(true);
            } else {
                const { root, type } = parseChordName(chord.name);
                if (root) setSelectedRoot(root);
                if (type) setSelectedType(type === 'M' ? 'maj' : type);
                setIsRest(false);
            }
        } else {
            setSelectedRoot(musicalKey || 'C');
            setSelectedType('maj7');
            setIsRest(false);
        }
        setSelectedDuration(chord?.duration || 4);
        setSelectedOctave(chord?.octave || 4);
    }, [chord, musicalKey, isOpen]);

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
        if (isRest) {
            onSave({ name: 'Rest', duration: selectedDuration, octave: selectedOctave });
        } else {
            const chordName = `${selectedRoot}${selectedType}`;
            onSave({ name: chordName, duration: selectedDuration, octave: selectedOctave });
        }
    };

    const handleSuggestionClick = (name: string) => {
        const { root, type } = parseChordName(name);
        if (root) setSelectedRoot(root);
        if (type) setSelectedType(type === 'M' ? 'maj' : type);
        setIsRest(false);
    };

    const handleAddPattern = (pattern: { name: string, chords: string[] }) => {
        const contextualChordIndex = pattern.chords.findIndex(c => c === contextualChord!.name);
        const chordsToAdd = pattern.chords.slice(contextualChordIndex + 1);
        onAddPattern(chordsToAdd);
    };

    if (!isOpen) return null;

    const currentChordSymbol = isRest ? 'Rest' : `${selectedRoot}${selectedType}`;
    const displaySelection = getDisplayChordName(currentChordSymbol, selectedOctave);

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
                                            <span className="pattern-chords">
                                                {pattern.chords.map(c => getDisplayChordName(c)).join(' → ')}
                                            </span>
                                        </div>
                                        <button className="add-pattern-button" onClick={() => handleAddPattern(pattern)}>Add</button>
                                    </li>
                                ))}
                            </ul>
                        </CollapsibleSection>
                    )}

                    <CollapsibleSection title={`Suggested Chords ${contextualChord ? `after ${getDisplayChordName(contextualChord.name, contextualChord.octave)}` : ''}`}>
                        <SuggestionGrid title="Coherent" chords={suggestions.coherent} onChordClick={handleSuggestionClick} currentSelection={currentChordSymbol} />
                        <SuggestionGrid title="Inventive (Modal Mixture)" chords={suggestions.inventive} onChordClick={handleSuggestionClick} currentSelection={currentChordSymbol} />
                        <SuggestionGrid title="Jazzy" chords={suggestions.jazzy} onChordClick={handleSuggestionClick} currentSelection={currentChordSymbol} />
                        <SuggestionGrid title="Classical" chords={suggestions.classical} onChordClick={handleSuggestionClick} currentSelection={currentChordSymbol} />
                    </CollapsibleSection>
                    
                    <CollapsibleSection title="Harmonic Hints">
                        <div className="modal-subsection">
                            <h4>Diatonic Chords in {musicalKey} {musicalMode}</h4>
                            <div className="button-grid">
                                {diatonicChords.map(({ name, roman }) => (
                                    <button key={name} className={currentChordSymbol === name ? 'active' : ''} onClick={() => handleSuggestionClick(name)}>
                                        {getDisplayChordName(name)} <span className="roman-numeral">{roman}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                         <div className="modal-subsection">
                            <h4>Borrowed Chords</h4>
                            <div className="button-grid">
                                {borrowedChords.map(({ name, roman }) => (
                                    <button key={name} className={currentChordSymbol === name ? 'active' : ''} onClick={() => handleSuggestionClick(name)}>
                                        {getDisplayChordName(name)} <span className="roman-numeral">{roman}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CollapsibleSection>

                    {contextualChord && contextualChord.name !== 'Rest' && currentChordSymbol !== 'Rest' && !TonalChord.get(currentChordSymbol).empty && (
                         <CollapsibleSection title="Note Visualization" defaultOpen>
                            <ChordGraph
                                chord1Name={contextualChord.name}
                                chord2Name={currentChordSymbol}
                            />
                        </CollapsibleSection>
                    )}

                    <CollapsibleSection title="Chromatic (Advanced)">
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
