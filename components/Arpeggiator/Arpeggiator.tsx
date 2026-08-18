import React, { useMemo } from 'react';
import Knob from '../Knob/Knob.tsx';
import { permutationAt, permutationCount, presetIndex } from '../../theory/arpeggio/permutations.js';
import { arpeggioSequence } from '../../theory/arpeggio/sequence.js';
import {
    STEP_CHOICES, OCTAVE_CHOICES, TIMING_CHOICES, type ArpeggioSettings,
} from '../../theory/arpeggio/types.js';
import './Arpeggiator.css';

interface ArpeggiatorProps {
    settings: ArpeggioSettings;
    onChange: (patch: Partial<ArpeggioSettings>) => void;
    /** The chord the preview is drawn from, so the shape shows real notes. */
    previewNotes: string[];
}

/**
 * A small grid showing the shape: one column per step, the dot's height being which note of
 * the figure sounds at that point. This is the whole point of addressing shapes by index —
 * you can see what 17 of 24 looks like without playing it.
 */
const ShapePreview: React.FC<{ order: number[] }> = ({ order }) => {
    const steps = order.length;
    if (steps === 0) return null;

    const cell = 12;
    const size = steps * cell;

    return (
        <svg
            className="arp-shape"
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            role="img"
            aria-label={`Shape: ${order.map(i => i + 1).join('-')}`}
        >
            {order.map((note, position) => (
                <rect
                    key={position}
                    x={position * cell + 1.5}
                    // Invert so a higher note of the figure sits higher on screen.
                    y={(steps - 1 - note) * cell + 1.5}
                    width={cell - 3}
                    height={cell - 3}
                    rx={1.5}
                />
            ))}
        </svg>
    );
};

const Arpeggiator: React.FC<ArpeggiatorProps> = ({ settings, onChange, previewNotes }) => {
    const { active, steps, style, looped, octaves, gate, timing, repeats } = settings;

    const total = permutationCount(steps);
    const normalizedStyle = ((style % total) + total) % total;
    const order = useMemo(() => permutationAt(steps, normalizedStyle), [steps, normalizedStyle]);

    const preview = useMemo(
        () => arpeggioSequence(previewNotes, settings),
        [previewNotes, settings],
    );

    const step = (delta: number) => onChange({ style: normalizedStyle + delta });

    return (
        <div className={`arpeggiator ${active ? '' : 'inactive'}`}>
            <label className="arp-toggle">
                <input type="checkbox" checked={active} onChange={() => onChange({ active: !active })} />
                <span>Arpeggiator</span>
            </label>

            <div className="arp-row">
                <div className="arp-control">
                    <span className="arp-label">Steps</span>
                    <div className="arp-buttons">
                        {STEP_CHOICES.map(choice => (
                            <button
                                key={choice}
                                className={steps === choice ? 'active' : ''}
                                onClick={() => onChange({ steps: choice })}
                                aria-pressed={steps === choice}
                            >
                                {choice}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="arp-control">
                    <span className="arp-label">Octaves</span>
                    <div className="arp-buttons">
                        {OCTAVE_CHOICES.map(choice => (
                            <button
                                key={choice}
                                className={octaves === choice ? 'active' : ''}
                                onClick={() => onChange({ octaves: choice })}
                                aria-pressed={octaves === choice}
                            >
                                {choice}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="arp-control">
                    <span className="arp-label">Rate</span>
                    <select value={timing} onChange={e => onChange({ timing: e.target.value })}>
                        {TIMING_CHOICES.map(choice => (
                            <option key={choice} value={choice}>{choice}</option>
                        ))}
                    </select>
                </div>

                <div className="arp-control">
                    <span className="arp-label">Repeats</span>
                    <input
                        className="arp-number"
                        type="number"
                        min={1}
                        placeholder="all"
                        value={Number.isFinite(repeats) ? repeats : ''}
                        onChange={e => onChange({
                            repeats: e.target.value === ''
                                ? Infinity
                                : Math.max(1, parseInt(e.target.value, 10) || 1),
                        })}
                    />
                </div>
            </div>

            <div className="arp-shape-row">
                <div className="arp-control">
                    <span className="arp-label">Shape</span>
                    <div className="arp-shape-picker">
                        <button onClick={() => step(-1)} aria-label="Previous shape">&#8249;</button>
                        <ShapePreview order={order} />
                        <button onClick={() => step(1)} aria-label="Next shape">&#8250;</button>
                    </div>
                    <span className="arp-shape-index">
                        {normalizedStyle + 1} of {total} &middot; {order.map(i => i + 1).join('-')}
                    </span>
                </div>

                <div className="arp-control">
                    <span className="arp-label">Presets</span>
                    <div className="arp-buttons">
                        <button onClick={() => onChange({ style: presetIndex.up() })}>Up</button>
                        <button onClick={() => onChange({ style: presetIndex.down(steps) })}>Down</button>
                        <button onClick={() => onChange({ style: presetIndex.converging(steps) })}>
                            Outside&#8209;in
                        </button>
                        <button onClick={() => onChange({ style: Math.floor(Math.random() * total) })}>
                            Random
                        </button>
                    </div>
                    <label className="arp-inline-toggle">
                        <input type="checkbox" checked={looped} onChange={() => onChange({ looped: !looped })} />
                        <span>Loop back down</span>
                    </label>
                </div>

                <Knob
                    label="Gate"
                    value={gate}
                    min={0.05}
                    max={1}
                    step={0.01}
                    onChange={(value: number) => onChange({ gate: value })}
                />
            </div>

            <p className="arp-preview">
                {preview.length > 0
                    ? <>Plays: <span className="arp-preview-notes">{preview.join(' ')}</span></>
                    : 'Select a chord to preview the figure.'}
            </p>
        </div>
    );
};

export default React.memo(Arpeggiator);
