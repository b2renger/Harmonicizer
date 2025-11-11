
import React from 'react';
import './ChordCard.css';
import { getAbbreviatedNameFromNotes } from '../../theory/chords.js';

/**
 * Interface for ChordCard props.
 */
interface ChordCardProps {
    chordId: string;
    notes: string[];
    duration: number;
    onEdit: () => void;
    onSelect: (id: string) => void;
    isSelected: boolean;
    isPlaying: boolean;
    onRemove: (id: string) => void;
    onNextInvert: () => void;
    onPreviousInvert: () => void;
    onPermute: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
    isDragOver: boolean;
}

/**
 * A card component that displays information about a single chord in the progression.
 * It handles its own display state (playing, selected) and delegates actions to parent.
 * @param {ChordCardProps} props - The props for the component.
 */
const ChordCard: React.FC<ChordCardProps> = ({ 
    chordId, 
    notes,
    duration, 
    onEdit, 
    onSelect,
    isSelected,
    isPlaying, 
    onRemove,
    onNextInvert,
    onPreviousInvert,
    onPermute,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    isDragOver
}) => {
    
    const isRest = notes.length === 0;

    // Dynamically build class names based on component state.
    const classNames = [
        'chord-card',
        isPlaying ? 'playing' : '',
        isSelected ? 'selected' : '',
        isDragOver ? 'drag-over' : '',
        isRest ? 'is-rest' : ''
    ].filter(Boolean).join(' ');
    
    const displayName = getAbbreviatedNameFromNotes(notes);

    return (
        <div 
            className={classNames} 
            onClick={() => onSelect(chordId)}
            draggable="true"
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
        >
            <div className="chord-card-buttons-top">
                <button 
                    className="edit-chord-button" 
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    aria-label={`Edit ${displayName} chord`}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                </button>
                {onRemove && (
                    <button 
                        className="remove-chord-button" 
                        onClick={(e) => { e.stopPropagation(); onRemove(chordId); }}
                        aria-label={`Remove ${displayName} chord`}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                )}
            </div>
            
            <div className="chord-card-main-content">
                <div className="chord-name-wrapper">
                    <span className="chord-name">{displayName}</span>
                </div>
                <div className="chord-duration">{duration} {duration === 1 ? 'beat' : 'beats'}</div>
            </div>

            <div className="chord-card-buttons-bottom">
                 <button 
                    className="voicing-button" 
                    aria-label="Previous chord inversion"
                    disabled={isRest}
                    onClick={(e) => { e.stopPropagation(); onPreviousInvert(); }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                </button>
                 <button 
                    className="voicing-button" 
                    aria-label="Permute chord voicing"
                    disabled={isRest}
                    onClick={(e) => { e.stopPropagation(); onPermute(); }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.4c1.3 0 2.5.6 3.3 1.7l6.1 8.6c.7 1.1 2 1.7 3.3 1.7H22"/><path d="m18 22-4-4 4-4"/></svg>
                </button>
                <button 
                    className="voicing-button" 
                    aria-label="Next chord inversion"
                    disabled={isRest}
                    onClick={(e) => { e.stopPropagation(); onNextInvert(); }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/></svg>
                </button>
            </div>
            
        </div>
    );
};

export default React.memo(ChordCard);
