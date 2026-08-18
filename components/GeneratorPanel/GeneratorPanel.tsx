import React from 'react';
import ParameterDials from '../ParameterDials/ParameterDials.tsx';
import { HARMONY_PARAMS, type ParamName, type Params } from '../../params/store.js';
import './GeneratorPanel.css';

/** Whether generating replaces the current part or extends it. */
export type GenerateMode = 'replace' | 'append';

interface GeneratorPanelProps {
    params: Params;
    onParamChange: (name: ParamName, value: number) => void;
    onParamReset: () => void;
    bars: number;
    onBarsChange: (bars: number) => void;
    mode: GenerateMode;
    onModeChange: (mode: GenerateMode) => void;
    onGenerate: () => void;
    musicalKey: string;
    musicalMode: string;
}

const BAR_CHOICES = [2, 4, 8];

/**
 * Generates harmony with the brick grammar, with the dials that shape it in the same place.
 *
 * Deliberately explicit: it generates in the key and mode already set, and the length and
 * whether it replaces or extends are choices rather than inferred from whether the part
 * happens to be empty.
 */
const GeneratorPanel: React.FC<GeneratorPanelProps> = ({
    params, onParamChange, onParamReset,
    bars, onBarsChange, mode, onModeChange, onGenerate,
    musicalKey, musicalMode,
}) => (
    <div className="generator-panel">
        <ParameterDials
            params={params}
            names={HARMONY_PARAMS}
            onChange={onParamChange}
            onReset={onParamReset}
            hint="These shape what the generator writes."
        />

        <div className="generator-controls">
            <div className="generator-control">
                <label className="generator-label">Length</label>
                <div className="generator-buttons">
                    {BAR_CHOICES.map(choice => (
                        <button
                            key={choice}
                            className={bars === choice ? 'active' : ''}
                            onClick={() => onBarsChange(choice)}
                            aria-pressed={bars === choice}
                        >
                            {choice} bars
                        </button>
                    ))}
                </div>
            </div>

            <div className="generator-control">
                <label className="generator-label">Result</label>
                <div className="generator-buttons">
                    <button
                        className={mode === 'replace' ? 'active' : ''}
                        onClick={() => onModeChange('replace')}
                        aria-pressed={mode === 'replace'}
                        title="Discard this part and generate a new one"
                    >
                        Replace
                    </button>
                    <button
                        className={mode === 'append' ? 'active' : ''}
                        onClick={() => onModeChange('append')}
                        aria-pressed={mode === 'append'}
                        title="Add to the end of this part"
                    >
                        Append
                    </button>
                </div>
            </div>
        </div>

        <button className="generator-go" onClick={onGenerate}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M19,3H5C3.89,3 3,3.89 3,5V19C3,20.11 3.9,21 5,21H19C20.11,21 21,20.11 21,19V5C21,3.89 20.1,3 19,3M6,8.5C6,7.67 6.67,7 7.5,7S9,7.67 9,8.5C9,9.33 8.33,10 7.5,10S6,9.33 6,8.5M15,15.5C15,14.67 15.67,14 16.5,14S18,14.67 18,15.5C18,16.33 17.33,17 16.5,17S15,16.33 15,15.5M10.5,12C10.5,11.17 11.17,10.5 12,10.5S13.5,11.17 13.5,12C13.5,12.83 12.83,13.5 12,13.5S10.5,12.83 10.5,12M15,8.5C15,7.67 15.67,7 16.5,7S18,7.67 18,8.5C18,9.33 17.33,10 16.5,10S15,9.33 15,8.5M6,15.5C6,14.67 6.67,14 7.5,14S9,14.67 9,15.5C9,16.33 8.33,17 7.5,17S6,16.33 6,15.5Z"/></svg>
            Generate in {musicalKey} {musicalMode}
        </button>

        <p className="generator-note">
            Generates in the key and mode set above the chord grid. Change those to generate
            somewhere else.
        </p>
    </div>
);

export default React.memo(GeneratorPanel);
