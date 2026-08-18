import React from 'react';
import Knob from '../Knob/Knob.tsx';
import { WIRED_PARAMS, PARAM_LABELS, type ParamName, type Params } from '../../params/store.js';
import './ParameterDials.css';

interface ParameterDialsProps {
    params: Params;
    onChange: (name: ParamName, value: number) => void;
    onReset: () => void;
    /** The dials shape the voicing engine, which only runs when this is on. */
    isActive: boolean;
    onToggleActive: () => void;
}

/**
 * The live parameter surface.
 *
 * Only parameters in WIRED_PARAMS are shown. The rest of the bus exists so that external
 * controllers have a stable contract, but a dial that moves and changes nothing reads as
 * a bug, so they stay hidden until the engine stage behind them lands.
 */
const ParameterDials: React.FC<ParameterDialsProps> = ({ params, onChange, onReset, isActive, onToggleActive }) => (
    <div className={`parameter-dials ${isActive ? '' : 'inactive'}`}>
        <label className="voicing-toggle">
            <input type="checkbox" checked={isActive} onChange={onToggleActive} />
            <span className="voicing-toggle-label">Auto voice leading</span>
        </label>
        <p className="parameter-dials-hint">
            {isActive
                ? 'Chords are re-voiced for smooth movement. Your hand-made voicings are kept and restored when this is off.'
                : 'Off: chords play exactly as entered. Turn this on for the dials below to do anything.'}
        </p>
        <div className="parameter-dials-row">
            {WIRED_PARAMS.map(name => (
                <Knob
                    key={name}
                    label={PARAM_LABELS[name]}
                    value={params[name]}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(value: number) => onChange(name, value)}
                />
            ))}
        </div>
        <button className="control-button parameter-dials-reset" onClick={onReset} title="Reset dials to defaults">
            Reset
        </button>
    </div>
);

export default React.memo(ParameterDials);
