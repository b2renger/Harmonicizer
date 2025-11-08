import React from 'react';
import './TransportControls.css';
import { SynthType } from '../../audio/player';

interface TransportControlsProps {
    isPlaying: boolean;
    tempo: number;
    // Removed synthType and onSynthChange as they are moving
    isLooping: boolean;
    onPlayToggle: () => void;
    onTempoChange: (tempo: number) => void;
    // Removed onSynthChange
    onLoopToggle: () => void;
    onClearProgression: () => void;
}

const TransportControls: React.FC<TransportControlsProps> = ({
    isPlaying,
    tempo,
    // Removed synthType
    isLooping,
    onPlayToggle,
    onTempoChange,
    // Removed onSynthChange
    onLoopToggle,
    onClearProgression
}) => {
    return (
        <div className="transport-controls">
            {/* Synth selector removed from here */}
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
                <button className="control-button clear-button" aria-label="Clear Progression" onClick={onClearProgression}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
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

export default TransportControls;