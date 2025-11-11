
import React from 'react';
import './TransportControls.css';

/**
 * Interface for TransportControls props.
 */
interface TransportControlsProps {
    isPlaying: boolean;
    tempo: number;
    isLooping: boolean;
    onPlayToggle: () => void;
    onTempoChange: (newTempo: number) => void;
    onLoopToggle: () => void;
}

/**
 * A presentational component for the main playback controls.
 * It receives its state and callbacks from a parent component.
 * @param {TransportControlsProps} props - The props for the component.
 */
const TransportControls: React.FC<TransportControlsProps> = ({
    isPlaying,
    tempo,
    isLooping,
    onPlayToggle,
    onTempoChange,
    onLoopToggle,
}) => {
    return (
        <div className="transport-controls">
            <div className="playback-controls">
                <button className="control-button" aria-label={isPlaying ? "Pause" : "Play"} onClick={onPlayToggle}>
                    {isPlaying ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z"/>
                        </svg>
                    ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 5V19L19 12L8 5Z"/>
                        </svg>
                    )}
                </button>
                 <button className={`control-button ${isLooping ? 'active' : ''}`} aria-label="Toggle Loop" onClick={onLoopToggle}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 1l4 4-4 4"/>
                        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                        <path d="M7 23l-4-4 4-4"/>
                        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                    </svg>
                </button>
            </div>
            <div className="tempo-control">
                <label htmlFor="tempo">Tempo: {tempo} BPM</label>
                <input 
                    type="range" 
                    id="tempo" 
                    name="tempo" 
                    min="40" 
                    max="240" 
                    value={tempo}
                    onChange={(e) => onTempoChange(parseInt(e.target.value, 10))}
                />
            </div>
        </div>
    );
};

// Memoize the component to prevent re-renders if props haven't changed.
export default React.memo(TransportControls);
