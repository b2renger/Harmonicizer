import React, { useState } from 'react';
import ChordCard from '../ChordCard/ChordCard';
import './ChordGrid.css';
import type { Chord } from '../../modes/composer/Composer';

interface ChordGridProps {
    progression: Chord[];
    onCardClick: (chord: Partial<Chord> | null) => void;
    currentlyPlayingChordId: string | null;
    onRemoveChord: (id: string) => void;
    onReorderProgression: (newProgression: Chord[]) => void;
    onInvertChord: (chordId: string, direction: 'up' | 'down') => void;
    onPermuteChord: (chordId: string) => void;
}

const ChordGrid: React.FC<ChordGridProps> = ({ 
    progression, 
    onCardClick, 
    currentlyPlayingChordId, 
    onRemoveChord, 
    onReorderProgression,
    onInvertChord,
    onPermuteChord
}) => {
    const [draggedChordId, setDraggedChordId] = useState<string | null>(null);
    const [dragOverChordId, setDragOverChordId] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, chordId: string) => {
        setDraggedChordId(chordId);
        e.dataTransfer.effectAllowed = 'move';
        // Use a timeout to allow the browser to render the component update (e.g., opacity change)
        // before creating the drag image.
        setTimeout(() => {
            e.currentTarget.classList.add('is-dragging');
        }, 0);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, chordId: string) => {
        e.preventDefault(); // Necessary to allow dropping
        if (chordId !== dragOverChordId) {
            setDragOverChordId(chordId);
        }
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        setDragOverChordId(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetChordId: string) => {
        e.preventDefault();
        if (!draggedChordId || draggedChordId === targetChordId) {
            return;
        }

        const draggedChord = progression.find(c => c.id === draggedChordId);
        if (!draggedChord) return;

        const remainingChords = progression.filter(c => c.id !== draggedChordId);
        const targetIndex = remainingChords.findIndex(c => c.id === targetChordId);

        if (targetIndex !== -1) {
            remainingChords.splice(targetIndex, 0, draggedChord);
            onReorderProgression(remainingChords);
        }
        
        cleanupDragState();
    };

    const cleanupDragState = () => {
        // Find all dragging elements and remove the class
        document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
        setDraggedChordId(null);
        setDragOverChordId(null);
    }
    
    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
       cleanupDragState();
    };


    return (
        <div className="chord-grid">
            {progression.map(chord => (
                <ChordCard 
                    key={chord.id} 
                    chordId={chord.id}
                    name={chord.name} 
                    duration={chord.duration}
                    octave={chord.octave}
                    onClick={() => onCardClick(chord)}
                    isPlaying={currentlyPlayingChordId === chord.id}
                    onRemove={onRemoveChord}
                    onInvert={(direction) => onInvertChord(chord.id, direction)}
                    onPermute={() => onPermuteChord(chord.id)}
                    // Drag and Drop props
                    onDragStart={(e) => handleDragStart(e, chord.id)}
                    onDragOver={(e) => handleDragOver(e, chord.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, chord.id)}
                    onDragEnd={handleDragEnd}
                    isDragOver={dragOverChordId === chord.id && draggedChordId !== chord.id}
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