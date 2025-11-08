import React from 'react';
import ChordCard from '../ChordCard/ChordCard';
import './ChordGrid.css';
import type { Chord } from '../../modes/composer/Composer';

interface ChordGridProps {
    progression: Chord[];
    onCardClick: (chord: Partial<Chord> | null) => void;
    currentlyPlayingChordId: string | null;
    onRemoveChord: (id: string) => void;
}

const ChordGrid: React.FC<ChordGridProps> = ({ progression, onCardClick, currentlyPlayingChordId, onRemoveChord }) => {
    return (
        <div className="chord-grid">
            {progression.map(chord => (
                <ChordCard 
                    key={chord.id} 
                    chordId={chord.id}
                    name={chord.name} 
                    duration={chord.duration} 
                    onClick={() => onCardClick(chord)}
                    isPlaying={currentlyPlayingChordId === chord.id}
                    onRemove={onRemoveChord}
                />
            ))}
            <button className="add-card" onClick={() => onCardClick(null)}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                </svg>
                <span>Add Chord</span>
            </button>
        </div>
    );
};

export default ChordGrid;