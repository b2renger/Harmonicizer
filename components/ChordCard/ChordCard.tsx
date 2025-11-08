import React from 'react';
import './ChordCard.css';

interface ChordCardProps {
    chordId: string;
    name: string;
    duration: number;
    onClick: () => void;
    isPlaying?: boolean;
    onRemove?: (id: string) => void;
}

const ChordCard: React.FC<ChordCardProps> = ({ chordId, name, duration, onClick, isPlaying, onRemove }) => {
    const className = `chord-card ${isPlaying ? 'playing' : ''}`;
    
    return (
        <div className={className} role="button" tabIndex={0} onClick={onClick}>
            {onRemove && (
                <button 
                    className="remove-chord-button" 
                    onClick={(e) => { e.stopPropagation(); onRemove(chordId); }}
                    aria-label={`Remove ${name} chord`}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            )}
            <div className="chord-name">{name}</div>
            <div className="chord-duration">{name === 'Rest' ? '' : `${duration} beats`}</div>
        </div>
    );
};

export default ChordCard;