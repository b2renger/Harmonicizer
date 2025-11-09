import React from 'react';
import './ChordCard.css';
import { getDisplayChordName } from '../../theory/chords';

interface ChordCardProps {
    chordId: string;
    name: string;
    duration: number;
    octave: number;
    onEdit: () => void;
    onSelect: (chordId: string) => void;
    isSelected?: boolean;
    isPlaying?: boolean;
    onRemove?: (id: string) => void;
    // Drag & Drop event handlers
    onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
    onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
    isDragOver?: boolean;
}

const ChordCard: React.FC<ChordCardProps> = ({ 
    chordId, 
    name, 
    duration, 
    octave,
    onEdit, 
    onSelect,
    isSelected,
    isPlaying, 
    onRemove,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    isDragOver
}) => {
    
    const classNames = [
        'chord-card',
        isPlaying ? 'playing' : '',
        isSelected ? 'selected' : '',
        isDragOver ? 'drag-over' : '',
        name === 'Rest' ? 'is-rest' : ''
    ].filter(Boolean).join(' ');
    
    const displayName = getDisplayChordName(name, octave);

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

            <div className="chord-name-wrapper">
                <span className="chord-name">{displayName}</span>
            </div>
            <div className="chord-duration">{duration} {duration === 1 ? 'beat' : 'beats'}</div>
            
        </div>
    );
};

export default ChordCard;