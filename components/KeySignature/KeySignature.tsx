import React from 'react';
import './KeySignature.css';

interface KeySignatureProps {
    currentKey: string;
    currentMode: string;
    onKeyChange: (key: string) => void;
    onModeChange: (mode: string) => void;
    rootNotes: string[];
    modes: string[];
}

const KeySignature: React.FC<KeySignatureProps> = ({
    currentKey,
    currentMode,
    onKeyChange,
    onModeChange,
    rootNotes,
    modes
}) => {
    return (
        <div className="key-signature-controls">
            <div className="key-selector">
                <label htmlFor="key-note">Key:</label>
                <select
                    id="key-note"
                    name="key-note"
                    value={currentKey}
                    onChange={(e) => onKeyChange(e.target.value)}
                >
                    {rootNotes.map(note => (
                        <option key={note} value={note}>{note}</option>
                    ))}
                </select>
            </div>
            <div className="mode-selector">
                 <label htmlFor="key-mode">Mode:</label>
                <select
                    id="key-mode"
                    name="key-mode"
                    value={currentMode}
                    onChange={(e) => onModeChange(e.target.value)}
                >
                    {modes.map(mode => (
                        <option key={mode} value={mode}>
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default KeySignature;
