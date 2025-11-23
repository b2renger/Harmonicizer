
import React, { useState } from 'react';
import './SongStructure.css';

interface SongStructureProps {
    structure: Array<{ id: string, progressionId: string }>;
    onStructureChange: (newStructure: Array<{ id: string, progressionId: string }>) => void;
    progressionIds: string[];
    currentlyPlayingPartId?: string | null;
}

const SongPartCard: React.FC<{
    partId: string;
    progressionId: string;
    onRemove: (id: string) => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
    isPlaying: boolean;
}> = ({ partId, progressionId, onRemove, onDragStart, onDragEnd, isPlaying }) => {
    return (
        <div
            className={`song-part-card ${isPlaying ? 'is-playing' : ''}`}
            draggable="true"
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        >
            <span className="part-card-name">Part {progressionId}</span>
            <button
                className="part-card-remove"
                onClick={() => onRemove(partId)}
                aria-label={`Remove this instance of Part ${progressionId}`}
            >
                &times;
            </button>
        </div>
    );
};

const SongStructure: React.FC<SongStructureProps> = ({ structure, onStructureChange, progressionIds, currentlyPlayingPartId }) => {
    const [draggedPartId, setDraggedPartId] = useState<string | null>(null);
    const [dragOverPartId, setDragOverPartId] = useState<string | null>(null);

    const handleAddPart = (progressionId: string) => {
        const newPart = { id: crypto.randomUUID(), progressionId };
        onStructureChange([...structure, newPart]);
    };
    
    const handleRemovePart = (idToRemove: string) => {
        onStructureChange(structure.filter(part => part.id !== idToRemove));
    };

    const handleClearStructure = () => {
        onStructureChange([]);
    }

    // Drag and Drop Handlers
    const handleDragStart = (e: React.DragEvent, partId: string) => {
        setDraggedPartId(partId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            (e.currentTarget as HTMLElement).classList.add('is-dragging');
        }, 0);
    };

    const handleDragOver = (e: React.DragEvent, partId: string) => {
        e.preventDefault();
        if (partId !== dragOverPartId) {
            setDragOverPartId(partId);
        }
    };

    const handleDragLeave = () => {
        setDragOverPartId(null);
    };

    const handleDrop = (e: React.DragEvent, targetPartId: string) => {
        e.preventDefault();
        if (!draggedPartId || draggedPartId === targetPartId) {
            cleanupDragState();
            return;
        }

        const originalTargetIndex = structure.findIndex(p => p.id === targetPartId);
        const originalDraggedIndex = structure.findIndex(p => p.id === draggedPartId);
        if (originalDraggedIndex === -1 || originalTargetIndex === -1) {
            cleanupDragState();
            return;
        }

        const newStructure = [...structure];
        const [removed] = newStructure.splice(originalDraggedIndex, 1);
        newStructure.splice(originalTargetIndex, 0, removed);
        
        onStructureChange(newStructure);
        cleanupDragState();
    };

    const cleanupDragState = () => {
        document.querySelectorAll('.song-part-card.is-dragging').forEach(el => el.classList.remove('is-dragging'));
        setDraggedPartId(null);
        setDragOverPartId(null);
    };
    
    const handleDragEnd = () => {
       cleanupDragState();
    };


    return (
        <div className="song-structure">
            <div className="structure-controls">
                <div className="add-parts-buttons">
                    {progressionIds.map(id => (
                        <button key={id} onClick={() => handleAddPart(id)}>
                            + Add Part {id}
                        </button>
                    ))}
                </div>
                <div className="structure-actions">
                     <button className="structure-action-btn clear-btn" onClick={handleClearStructure} disabled={structure.length === 0}>Clear</button>
                </div>
            </div>
            <div className="structure-timeline">
                {structure.map(part => (
                     <div 
                        key={part.id}
                        className={`part-card-wrapper ${dragOverPartId === part.id && draggedPartId !== part.id ? 'drag-over' : ''}`}
                        onDragOver={(e) => handleDragOver(e, part.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, part.id)}
                    >
                        <SongPartCard
                            partId={part.id}
                            progressionId={part.progressionId}
                            onRemove={handleRemovePart}
                            onDragStart={(e) => handleDragStart(e, part.id)}
                            onDragEnd={handleDragEnd}
                            isPlaying={part.id === currentlyPlayingPartId}
                        />
                    </div>
                ))}
                 {structure.length === 0 && (
                    <div className="empty-structure-placeholder">
                        <p>Your song structure is empty.</p>
                        <span>Use the buttons above to add parts.</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(SongStructure);
