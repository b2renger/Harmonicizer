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
}

/**
 * The live parameter surface.
 *
 * Only parameters in WIRED_PARAMS are shown. The rest of the bus exists so that external
 * controllers have a stable contract, but a dial that moves and changes nothing reads as
 * a bug, so they stay hidden until the engine stage behind them lands.
 */
const ParameterDials: React.FC<ParameterDialsProps> = ({ params, onChange, onReset, isActive }) => (
    <div className={`parameter-dials ${isActive ? '' : 'inactive'}`}>
        {!isActive && (
            <p className="parameter-dials-hint">
                These shape the voicing engine. Turn on <strong>Auto voice leading</strong> in the
                progression controls to hear them.
            </p>
        )}
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
