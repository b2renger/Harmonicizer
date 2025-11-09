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
    onUndo: () => void;
    onFeelLucky: () => void;
    canUndo: boolean;
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
    onClearProgression,
    onUndo,
    onFeelLucky,
    canUndo
}) => {
    return (
        <div className="transport-controls">
            <div className="transport-controls-left">
                <div className="playback-controls">
                    <button 
                        className="control-button" 
                        aria-label="Undo last action" 
                        onClick={onUndo} 
                        disabled={!canUndo}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                        </svg>
                    </button>
                    <button className="control-button clear-button" aria-label="Clear Progression" onClick={onClearProgression}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                    <button 
                        className="control-button lucky-button" 
                        aria-label="I feel lucky" 
                        onClick={onFeelLucky}
                        title="Generate Random Progression"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19,3H5C3.89,3 3,3.89 3,5V19C3,20.11 3.9,21 5,21H19C20.11,21 21,20.11 21,19V5C21,3.89 20.1,3 19,3M6,8.5C6,7.67 6.67,7 7.5,7S9,7.67 9,8.5C9,9.33 8.33,10 7.5,10S6,9.33 6,8.5M15,15.5C15,14.67 15.67,14 16.5,14S18,14.67 18,15.5C18,16.33 17.33,17 16.5,17S15,16.33 15,15.5M10.5,12C10.5,11.17 11.17,10.5 12,10.5S13.5,11.17 13.5,12C13.5,12.83 12.83,13.5 12,13.5S10.5,12.83 10.5,12M15,8.5C15,7.67 15.67,7 16.5,7S18,7.67 18,8.5C18,9.33 17.33,10 16.5,10S15,9.33 15,8.5M6,15.5C6,14.67 6.67,14 7.5,14S9,14.67 9,15.5C9,16.33 8.33,17 7.5,17S6,16.33 6,15.5Z"/>
                        </svg>
                    </button>
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
        </div>
    );
};

export default TransportControls;