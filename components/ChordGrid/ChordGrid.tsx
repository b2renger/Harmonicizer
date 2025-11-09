import React, { useState } from 'react';
import ChordCard from '../ChordCard/ChordCard';
import VerticalNoteVisualizer from '../VerticalNoteVisualizer/VerticalNoteVisualizer';
import './ChordGrid.css';
import type { Chord } from '../../modes/composer/Composer';

interface ChordGridProps {
    progression: Chord[];
    onEditChord: (chord: Partial<Chord> | null) => void;
    onSelectChord: (chordId: string) => void;
    selectedChordId: string | null;
    currentlyPlayingChordId: string | null;
    onRemoveChord: (id: string) => void;
    onReorderProgression: (newProgression: Chord[]) => void;
    isNoteVisualizerVisible: boolean;
    noteRange: { minMidi: number; maxMidi: number } | null;
}

const ChordGrid: React.FC<ChordGridProps> = ({ 
    progression, 
    onEditChord,
    onSelectChord,
    selectedChordId,
    currentlyPlayingChordId, 
    onRemoveChord, 
    onReorderProgression,
    isNoteVisualizerVisible,
    noteRange,
}) => {
    const [draggedChordId, setDraggedChordId] = useState<string | null>(null);
    const [dragOverChordId, setDragOverChordId] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, chordId: string) => {
        setDraggedChordId(chordId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            (e.currentTarget.parentNode as HTMLElement).classList.add('is-dragging-wrapper');
        }, 0);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, chordId: string) => {
        e.preventDefault();
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
            cleanupDragState();
            return;
        }

        const draggedChord = progression.find(c => c.id === draggedChordId);
        if (!draggedChord) {
            cleanupDragState();
            return;
        };

        const remainingChords = progression.filter(c => c.id !== draggedChordId);
        let targetIndex = remainingChords.findIndex(c => c.id === targetChordId);

        // If dropping on the dragged item's original wrapper, target index can be tricky.
        // A better way is to find the index of the drop target in the original array.
        const originalTargetIndex = progression.findIndex(c => c.id === targetChordId);
        const originalDraggedIndex = progression.findIndex(c => c.id === draggedChordId);

        const newProgression = [...progression];
        const [removed] = newProgression.splice(originalDraggedIndex, 1);
        newProgression.splice(originalTargetIndex, 0, removed);
        
        onReorderProgression(newProgression);
        cleanupDragState();
    };

    const cleanupDragState = () => {
        document.querySelectorAll('.is-dragging-wrapper').forEach(el => el.classList.remove('is-dragging-wrapper'));
        setDraggedChordId(null);
        setDragOverChordId(null);
    }
    
    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
       cleanupDragState();
    };


    return (
        <div className="chord-grid">
            {progression.map(chord => (
                <div 
                    key={chord.id}
                    className={`chord-grid-item ${dragOverChordId === chord.id && draggedChordId !== chord.id ? 'drag-over-wrapper' : ''}`}
                    onDragOver={(e) => handleDragOver(e, chord.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, chord.id)}
                >
                    <ChordCard 
                        chordId={chord.id}
                        name={chord.name} 
                        duration={chord.duration}
                        octave={chord.octave}
                        onEdit={() => onEditChord(chord)}
                        onSelect={onSelectChord}
                        isSelected={selectedChordId === chord.id}
                        isPlaying={currentlyPlayingChordId === chord.id}
                        onRemove={onRemoveChord}
                        // Drag and Drop props
                        onDragStart={(e) => handleDragStart(e, chord.id)}
                        onDragEnd={handleDragEnd}
                    />
                    {isNoteVisualizerVisible && chord.name !== 'Rest' && noteRange && (
                        <VerticalNoteVisualizer 
                            chordName={chord.name}
                            chordOctave={chord.octave}
                            noteRange={noteRange}
                        />
                    )}
                </div>
            ))}
            <button className="add-card" onClick={() => onEditChord(null)}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                </svg>
                <span>Add Chord</span>
            </button>
        </div>
    );
};

export default ChordGrid;