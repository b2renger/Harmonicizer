import React from 'react';
import Knob from '../Knob/Knob.tsx';
import { PARAM_LABELS, type ParamName, type Params } from '../../params/store.js';
import './ParameterDials.css';

interface ParameterDialsProps {
    params: Params;
    /** Which dials to show. Callers pass a group from the store. */
    names: ParamName[];
    onChange: (name: ParamName, value: number) => void;
    onReset: () => void;
    /** Explanatory line above the dials. */
    hint?: React.ReactNode;
    /** Optional on/off switch for the engine these dials feed. */
    toggle?: { label: string; checked: boolean; onChange: () => void };
}

/**
 * A group of live parameter dials.
 *
 * Only the names the caller passes are shown. The bus declares more than this so external
 * controllers have a stable contract, but a dial that moves and changes nothing reads as a
 * bug, so each is surfaced only once the engine behind it lands.
 */
const ParameterDials: React.FC<ParameterDialsProps> = ({ params, names, onChange, onReset, hint, toggle }) => (
    <div className={`parameter-dials ${toggle && !toggle.checked ? 'inactive' : ''}`}>
        {toggle && (
            <label className="voicing-toggle">
                <input type="checkbox" checked={toggle.checked} onChange={toggle.onChange} />
                <span className="voicing-toggle-label">{toggle.label}</span>
            </label>
        )}
        {hint && <p className="parameter-dials-hint">{hint}</p>}
        <div className="parameter-dials-row">
            {names.map(name => (
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
