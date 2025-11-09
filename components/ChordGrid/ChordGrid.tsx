import React, { useState } from 'react';
import ChordCard from '../ChordCard/ChordCard.js';
import VerticalNoteVisualizer from '../VerticalNoteVisualizer/VerticalNoteVisualizer.js';
import './ChordGrid.css';

const ChordGrid = ({ 
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

    const handleDragStart = (e, chordId) => {
        setDraggedChordId(chordId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            (e.currentTarget.parentNode).classList.add('is-dragging-wrapper');
        }, 0);
    };

    const handleDragOver = (e, chordId) => {
        e.preventDefault();
        if (chordId !== dragOverChordId) {
            setDragOverChordId(chordId);
        }
    };
    
    const handleDragLeave = (e) => {
        setDragOverChordId(null);
    };

    const handleDrop = (e, targetChordId) => {
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
    
    const handleDragEnd = (e) => {
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
                        // Drag and Drop props
                        onDragStart={(e) => handleDragStart(e, chord.id)}
                        onDragEnd={handleDragEnd}
                        // FIX: Pass missing required drag-and-drop props
                        onDragOver={(e) => handleDragOver(e, chord.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, chord.id)}
                        isDragOver={dragOverChordId === chord.id && draggedChordId !== chord.id}
                    />
                    {isNoteVisualizerVisible && (
                        <VerticalNoteVisualizer 
                            notes={chord.notes}
                            onNotesChange={(newNotes) => onChordNotesUpdate(chord.id, newNotes)}
                            musicalKey={musicalKey}
                            musicalMode={musicalMode}
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