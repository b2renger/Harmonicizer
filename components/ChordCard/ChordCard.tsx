import React from 'react';
import './ChordCard.css';
import { getDisplayChordName } from '../../theory/chords';

interface ChordCardProps {
    chordId: string;
    name: string;
    duration: number;
    octave: number;
    onClick: () => void;
    isPlaying?: boolean;
    onRemove?: (id: string) => void;
    onInvert?: (direction: 'up' | 'down') => void;
    onPermute?: () => void;
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
    onClick, 
    isPlaying, 
    onRemove,
    onInvert,
    onPermute,
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
        isDragOver ? 'drag-over' : '',
        name === 'Rest' ? 'is-rest' : ''
    ].filter(Boolean).join(' ');
    
    const displayName = getDisplayChordName(name, octave);
    const canBeVoiced = name !== 'Rest' && onInvert && onPermute;

    return (
        <div 
            className={classNames} 
            role="button" 
            tabIndex={0} 
            onClick={onClick}
            draggable="true"
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
        >
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
            <div className="chord-name-wrapper">
                <span className="chord-name">{displayName}</span>
            </div>
            <div className="chord-duration">{duration} {duration === 1 ? 'beat' : 'beats'}</div>
            {canBeVoiced && (
                 <div className="card-actions">
                    <button 
                        className="action-button" 
                        onClick={(e) => { e.stopPropagation(); onInvert('down'); }}
                        aria-label="Previous Inversion"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                    </button>
                    <button 
                        className="action-button" 
                        onClick={(e) => { e.stopPropagation(); onPermute(); }}
                        aria-label="Random Inversion"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.4c1.3 0 2.5.6 3.3 1.7l6.1 8.6c.7 1.1 2 1.7 3.3 1.7H22"/><path d="m18 22-4-4 4-4"/></svg>
                    </button>
                    <button 
                        className="action-button" 
                        onClick={(e) => { e.stopPropagation(); onInvert('up'); }}
                        aria-label="Next Inversion"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ChordCard;