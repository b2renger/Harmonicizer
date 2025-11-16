
import React, { useState } from 'react';
import ChordCard from '../ChordCard/ChordCard.tsx';
import NoteVisualizer from '../NoteVisualizer/NoteVisualizer.tsx';
import './ChordGrid.css';

/**
 * Interface for ChordGrid props.
 */
interface ChordGridProps {
    progression: any[];
    onEditChord: (chord: any) => void;
    onSelectChord: (id: string) => void;
    selectedChordId: string | null;
    currentlyPlayingChordId: string | null;
    onRemoveChord: (id: string) => void;
    onReorderProgression: (newProgression: any[]) => void;
    onNextInvertChord: (id: string) => void;
    onPreviousInvertChord: (id: string) => void;
    onPermuteChord: (id: string) => void;
    isNoteVisualizerVisible: boolean;
    onChordNotesUpdate: (id: string, newNotes: string[]) => void;
    musicalKey: string;
    musicalMode: string;
}

/**
 * Renders the grid of chord cards and handles drag-and-drop reordering.
 * @param {ChordGridProps} props - The props for the component.
 */
const ChordGrid: React.FC<ChordGridProps> = ({ 
    progression, 
    onEditChord,
    onSelectChord,
    selectedChordId,
    currentlyPlayingChordId, 
    onRemoveChord, 
    onReorderProgression,
    onNextInvertChord,
    onPreviousInvertChord,
    onPermuteChord,
    isNoteVisualizerVisible,
    onChordNotesUpdate,
    musicalKey,
    musicalMode,
}) => {
    const [draggedChordId, setDraggedChordId] = useState(null);
    const [dragOverChordId, setDragOverChordId] = useState(null);

    /**
     * Handles the start of a drag operation.
     * @param e The drag event.
     * @param chordId The ID of the chord being dragged.
     */
    const handleDragStart = (e, chordId) => {
        setDraggedChordId(chordId);
        e.dataTransfer.effectAllowed = 'move';
        // Use a timeout to allow the browser to generate the drag preview
        // before applying the 'is-dragging' class to the original element.
        setTimeout(() => {
            (e.currentTarget.parentNode.parentNode).classList.add('is-dragging-wrapper');
        }, 0);
    };

    /**
     * Handles when a dragged item is over another chord card.
     * @param e The drag event.
     * @param chordId The ID of the chord being dragged over.
     */
    const handleDragOver = (e, chordId) => {
        e.preventDefault(); // Necessary to allow dropping
        if (chordId !== dragOverChordId) {
            setDragOverChordId(chordId);
        }
    };
    
    /**
     * Handles when a dragged item leaves the area of another chord card.
     */
    const handleDragLeave = (e) => {
        setDragOverChordId(null);
    };

    /**
     * Handles the drop event to reorder the progression.
     * @param e The drop event.
     * @param targetChordId The ID of the chord where the dragged chord was dropped.
     */
    const handleDrop = (e, targetChordId) => {
        e.preventDefault();
        if (!draggedChordId || draggedChordId === targetChordId) {
            cleanupDragState();
            return;
        }

        const originalTargetIndex = progression.findIndex(c => c.id === targetChordId);
        const originalDraggedIndex = progression.findIndex(c => c.id === draggedChordId);

        if (originalDraggedIndex === -1 || originalTargetIndex === -1) {
            cleanupDragState();
            return;
        }

        const newProgression = [...progression];
        const [removed] = newProgression.splice(originalDraggedIndex, 1);
        newProgression.splice(originalTargetIndex, 0, removed);
        
        onReorderProgression(newProgression);
        cleanupDragState();
    };

    /**
     * Resets all drag-related state and removes visual classes.
     */
    const cleanupDragState = () => {
        document.querySelectorAll('.is-dragging-wrapper').forEach(el => el.classList.remove('is-dragging-wrapper'));
        setDraggedChordId(null);
        setDragOverChordId(null);
    }
    
    /**
     * Handles the end of a drag operation (e.g., if dropped outside a valid target).
     */
    const handleDragEnd = (e) => {
       cleanupDragState();
    };


    return (
        <div className={`chord-grid ${isNoteVisualizerVisible ? 'visualizer-mode-active' : ''}`}>
            {progression.map(chord => (
                <div 
                    key={chord.id}
                    className={`chord-grid-item ${dragOverChordId === chord.id && draggedChordId !== chord.id ? 'drag-over-wrapper' : ''}`}
                    onDragOver={(e) => handleDragOver(e, chord.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, chord.id)}
                >
                    <div className="chord-card-container">
                        <ChordCard 
                            chordId={chord.id}
                            notes={chord.notes}
                            duration={chord.duration}
                            onEdit={() => onEditChord(chord)}
                            onSelect={onSelectChord}
                            isSelected={selectedChordId === chord.id}
                            isPlaying={currentlyPlayingChordId === chord.id}
                            onRemove={onRemoveChord}
                            onNextInvert={() => onNextInvertChord(chord.id)}
                            onPreviousInvert={() => onPreviousInvertChord(chord.id)}
                            onPermute={() => onPermuteChord(chord.id)}
                            onDragStart={(e) => handleDragStart(e, chord.id)}
                            onDragEnd={handleDragEnd}
                        />
                    </div>
                    {isNoteVisualizerVisible && (
                        <div className="note-visualizer-container">
                            <NoteVisualizer
                                notes={chord.notes}
                                musicalKey={musicalKey}
                                musicalMode={musicalMode}
                                onChordNotesUpdate={onChordNotesUpdate}
                                chordId={chord.id}
                            />
                        </div>
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

export default React.memo(ChordGrid);