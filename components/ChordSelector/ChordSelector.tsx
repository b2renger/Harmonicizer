import React, { useState, useEffect, useMemo } from 'react';
import { rootNotes, chordTypes } from '../../theory/chords';
import { calculateConsonance } from '../../theory/consonance';
import type { Chord } from '../../modes/composer/Composer';
import './ChordSelector.css';

interface ChordSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (chord: Omit<Chord, 'id'>) => void;
    chord: Partial<Chord> | null;
    previousChord?: Chord | null;
}

const ChordSelector: React.FC<ChordSelectorProps> = ({ isOpen, onClose, onSave, chord, previousChord }) => {
    const [selectedRoot, setSelectedRoot] = useState('C');
    const [selectedType, setSelectedType] = useState('maj7');
    const [selectedDuration, setSelectedDuration] = useState(4);
    const [isRest, setIsRest] = useState(false);

    useEffect(() => {
        if (chord?.name && chord.name !== 'Rest') {
            const match = chord.name.match(/^([A-G]#?b?)(.*)$/);
            if (match) {
                setSelectedRoot(match[1]);
                setSelectedType(match[2]);
            }
            setIsRest(false);
        } else if (chord?.name === 'Rest') {
            setIsRest(true);
        } else {
             // Default for new chord
            setSelectedRoot('C');
            setSelectedType('maj7');
            setIsRest(false);
        }

        if (chord?.duration) {
            setSelectedDuration(chord.duration);
        } else {
            setSelectedDuration(4);
        }
    }, [chord]);

    const consonanceScores = useMemo(() => {
        if (!previousChord) {
            return null;
        }

        const scores = new Map<string, number>();
        for (const type of chordTypes) {
            const currentChordName = `${selectedRoot}${type}`;
            const score = calculateConsonance(previousChord.name, currentChordName);
            scores.set(type, score);
        }
        return scores;

    }, [previousChord, selectedRoot]);

    const handleSave = () => {
        if (isRest) {
            onSave({ name: 'Rest', duration: selectedDuration });
        } else {
            onSave({ name: `${selectedRoot}${selectedType}`, duration: selectedDuration });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{chord?.name ? 'Edit Chord' : 'Add Chord'}</h2>
                
                <div className="modal-section">
                    <button 
                        className={`rest-button ${isRest ? 'active' : ''}`}
                        onClick={() => setIsRest(!isRest)}
                    >
                        {isRest ? 'Select a Chord' : 'Make it a Rest'}
                    </button>
                </div>

                {!isRest && (
                    <>
                        <div className="modal-section">
                            <h3>Root Note</h3>
                            <div className="button-grid">
                                {rootNotes.map(note => (
                                    <button key={note} className={selectedRoot === note ? 'active' : ''} onClick={() => setSelectedRoot(note)}>
                                        {note}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="modal-section">
                            <h3>Chord Type</h3>
                            <div className="button-grid">
                                {chordTypes.map(type => {
                                    const score = consonanceScores?.get(type) || 0;
                                    const consonanceClass = score > 0 ? `consonant-${Math.min(score, 4)}` : '';
                                    return (
                                        <button 
                                            key={type} 
                                            className={`${selectedType === type ? 'active' : ''} ${consonanceClass}`}
                                            onClick={() => setSelectedType(type)}>
                                            {type}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                <div className="modal-section">
                    <h3>Duration (beats)</h3>
                    <div className="button-grid">
                        {[1, 2, 3, 4, 8].map(duration => (
                            <button key={duration} className={selectedDuration === duration ? 'active' : ''} onClick={() => setSelectedDuration(duration)}>
                                {duration}
                            </button>
                        ))}
                    </div>
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