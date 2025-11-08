import React, { useState, useRef, useCallback } from 'react';
import type { EnvelopeSettings, SynthType } from '../../audio/player';
import * as Tone from 'tone';
import './GraphicalEnvelopeEditor.css';

interface GraphicalEnvelopeEditorProps {
    envelope: EnvelopeSettings;
    onEnvelopeChange: (envelope: EnvelopeSettings) => void;
    masterGain: number;
    onMasterGainChange: (gain: number) => void;
    reverbWet: number;
    onReverbWetChange: (wet: number) => void;
    reverbTime: number;
    onReverbTimeChange: (time: number) => void;
    synthType: SynthType; // Added synthType prop
    onSynthChange: (synth: SynthType) => void; // Added onSynthChange prop
    isArpeggiatorActive: boolean;
    onArpeggiatorToggle: () => void;
    arpeggiatorTiming: Tone.Unit.Time;
    onArpeggiatorTimingChange: (timing: Tone.Unit.Time) => void;
    arpeggiatorRepeats: number;
    onArpeggiatorRepeatsChange: (repeats: number) => void;
}

type DraggablePoint = 'attack' | 'decaySustain' | 'release';

const MAX_ATTACK = 5; // Increased from 2 to 5 for more range and better editing feel
const MAX_DECAY = 2;
const MAX_RELEASE = 4;
const TOTAL_TIME = MAX_ATTACK + MAX_DECAY + MAX_RELEASE;

const GraphicalEnvelopeEditor: React.FC<GraphicalEnvelopeEditorProps> = ({ 
    envelope, 
    onEnvelopeChange,
    masterGain,
    onMasterGainChange,
    reverbWet,
    onReverbWetChange,
    reverbTime,
    onReverbTimeChange,
    synthType, // Destructure synthType
    onSynthChange, // Destructure onSynthChange
    isArpeggiatorActive,
    onArpeggiatorToggle,
    arpeggiatorTiming,
    onArpeggiatorTimingChange,
    arpeggiatorRepeats,
    onArpeggiatorRepeatsChange,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [draggingPoint, setDraggingPoint] = useState<DraggablePoint | null>(null);

    const getSVGPoint = (evt: MouseEvent | TouchEvent): { x: number; y: number } => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const pt = svgRef.current.createSVGPoint();

        if ('touches' in evt && evt.touches.length > 0) { // Touch event
            pt.x = evt.touches[0].clientX;
            pt.y = evt.touches[0].clientY;
        } else { // Mouse event
            pt.x = (evt as MouseEvent).clientX;
            pt.y = (evt as MouseEvent).clientY;
        }
        const svgPoint = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
        return { x: svgPoint.x, y: svgPoint.y };
    };

    const handleStartDrag = (point: DraggablePoint, e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault(); // Prevent default browser behavior (scrolling, zooming)
        setDraggingPoint(point);
    };

    const handleMoveDrag = useCallback((e: MouseEvent | TouchEvent) => {
        if (!draggingPoint || !svgRef.current) return;
        
        e.preventDefault(); // Prevent default touch behavior (scrolling) during drag

        const { x, y } = getSVGPoint(e);
        const { width, height } = svgRef.current.viewBox.baseVal;

        let newEnvelope = { ...envelope };

        const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

        if (draggingPoint === 'attack') {
            const newAttack = clamp((x / width) * TOTAL_TIME, 0.01, MAX_ATTACK);
            newEnvelope.attack = newAttack;
        } else if (draggingPoint === 'decaySustain') {
            const attackX = (envelope.attack / TOTAL_TIME) * width;
            // Decay is time-based, Sustain is amplitude-based
            const newDecay = clamp(((x - attackX) / width) * TOTAL_TIME, 0.01, MAX_DECAY);
            const newSustain = clamp(1 - y / height, 0, 1);
            newEnvelope.decay = newDecay;
            newEnvelope.sustain = newSustain;
        } else if (draggingPoint === 'release') {
            // Calculate current X position for the end of decay/sustain for relative release calculation
            const decayEndX = ((envelope.attack + envelope.decay) / TOTAL_TIME) * width;
            const newRelease = clamp(((x - decayEndX) / width) * TOTAL_TIME, 0.01, MAX_RELEASE);
            newEnvelope.release = newRelease;
        }

        onEnvelopeChange(newEnvelope);

    }, [draggingPoint, envelope, onEnvelopeChange]);

    const handleEndDrag = useCallback(() => {
        setDraggingPoint(null);
    }, []);

    React.useEffect(() => {
        if (draggingPoint) {
            window.addEventListener('mousemove', handleMoveDrag);
            window.addEventListener('mouseup', handleEndDrag);
            window.addEventListener('touchmove', handleMoveDrag, { passive: false });
            window.addEventListener('touchend', handleEndDrag);
        } else {
            window.removeEventListener('mousemove', handleMoveDrag);
            window.removeEventListener('mouseup', handleEndDrag);
            window.removeEventListener('touchmove', handleMoveDrag);
            window.removeEventListener('touchend', handleEndDrag);
        }

        return () => {
            window.removeEventListener('mousemove', handleMoveDrag);
            window.removeEventListener('mouseup', handleEndDrag);
            window.removeEventListener('touchmove', handleMoveDrag);
            window.removeEventListener('touchend', handleEndDrag);
        };
    }, [draggingPoint, handleMoveDrag, handleEndDrag]);

    const viewBoxWidth = 1000;
    const viewBoxHeight = 200;

    // Calculate X coordinates for attack, decay, and release points
    const attackX = (envelope.attack / TOTAL_TIME) * viewBoxWidth;
    const decayX = attackX + (envelope.decay / TOTAL_TIME) * viewBoxWidth;
    // Sustain phase X position is conceptually a continuation of decay before release, often shown as flat.
    // For drag purposes, decaySustain controls decay duration and sustain level.
    // The release starts after decay/sustain phase.
    const releaseX = decayX + (envelope.release / TOTAL_TIME) * viewBoxWidth;

    const sustainY = (1 - envelope.sustain) * viewBoxHeight;

    // The points for the polyline path
    const points = `0,${viewBoxHeight} ${attackX},0 ${decayX},${sustainY} ${releaseX},${viewBoxHeight}`;

    return (
        <div className="graphical-envelope-editor" aria-label="ADSR Envelope Editor">
            <div className="synth-selector"> {/* Moved synth selector here */}
                <label htmlFor="synth">Synth:</label>
                <select 
                    id="synth" 
                    name="synth" 
                    value={synthType}
                    onChange={(e) => onSynthChange(e.target.value as SynthType)}
                >
                    <option value="Rhodes">Rhodes EP</option>
                    <option value="FMSynth">FM Synth</option>
                    <option value="AMSynth">AM Synth</option>
                    <option value="Synth">Basic Synth</option>
                </select>
            </div>

            <div className="arpeggiator-controls">
                <label className="arpeggiator-toggle-label">Arpeggiator:</label>
                <button
                    className={`arpeggiator-toggle-button ${isArpeggiatorActive ? 'active' : ''}`}
                    onClick={onArpeggiatorToggle}
                    aria-pressed={isArpeggiatorActive}
                    aria-label="Toggle Arpeggiator"
                >
                    {isArpeggiatorActive ? 'ON' : 'OFF'}
                </button>

                <label htmlFor="arpeggiatorTiming">Timing:</label>
                <select
                    id="arpeggiatorTiming"
                    name="arpeggiatorTiming"
                    value={arpeggiatorTiming as string}
                    onChange={(e) => onArpeggiatorTimingChange(e.target.value as Tone.Unit.Time)}
                    aria-label="Arpeggiator Timing"
                    disabled={!isArpeggiatorActive}
                >
                    <option value="4n">1/4 note</option>
                    <option value="8n">1/8 note</option>
                    <option value="8t">1/8 triplet</option>
                    <option value="16n">1/16 note</option>
                    <option value="16t">1/16 triplet</option>
                    <option value="32n">1/32 note</option>
                </select>

                <label htmlFor="arpeggiatorRepeats">Repeats:</label>
                <input
                    id="arpeggiatorRepeats"
                    type="number"
                    className="arpeggiator-input"
                    value={isFinite(arpeggiatorRepeats) ? arpeggiatorRepeats : ''}
                    onChange={(e) => {
                        const value = e.target.value;
                        onArpeggiatorRepeatsChange(value === '' ? Infinity : Math.max(1, parseInt(value, 10) || 1));
                    }}
                    placeholder="∞"
                    min="1"
                    step="1"
                    disabled={!isArpeggiatorActive}
                    aria-label="Arpeggiator Repeats"
                />
            </div>

            <svg 
                ref={svgRef} 
                viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} 
                className="envelope-svg" 
                preserveAspectRatio="none"
            >
                <polyline
                    fill="rgba(0, 190, 255, 0.2)"
                    stroke="cyan"
                    strokeWidth="4"
                    points={points}
                />
                <circle 
                    cx={attackX} 
                    cy="0" 
                    r="12" 
                    className="control-point" 
                    onMouseDown={(e) => handleStartDrag('attack', e)} 
                    onTouchStart={(e) => handleStartDrag('attack', e)}
                    aria-label={`Attack time: ${(envelope.attack * 1000).toFixed(0)} milliseconds`}
                />
                <circle 
                    cx={decayX} 
                    cy={sustainY} 
                    r="12" 
                    className="control-point" 
                    onMouseDown={(e) => handleStartDrag('decaySustain', e)} 
                    onTouchStart={(e) => handleStartDrag('decaySustain', e)}
                    aria-label={`Decay time: ${(envelope.decay * 1000).toFixed(0)} milliseconds, Sustain level: ${envelope.sustain.toFixed(2)}`}
                />
                <circle 
                    cx={releaseX} 
                    cy={viewBoxHeight} 
                    r="12" 
                    className="control-point" 
                    onMouseDown={(e) => handleStartDrag('release', e)} 
                    onTouchStart={(e) => handleStartDrag('release', e)}
                    aria-label={`Release time: ${(envelope.release * 1000).toFixed(0)} milliseconds`}
                />
            </svg>
            <div className="envelope-values">
                <div className="value-display">
                    <span className="label">Attack</span>
                    <span className="value">{(envelope.attack * 1000).toFixed(0)} ms</span>
                </div>
                <div className="value-display">
                    <span className="label">Decay</span>
                    <span className="value">{(envelope.decay * 1000).toFixed(0)} ms</span>
                </div>
                 <div className="value-display">
                    <span className="label">Sustain</span>
                    <span className="value">{envelope.sustain.toFixed(2)}</span>
                </div>
                <div className="value-display">
                    <span className="label">Release</span>
                    <span className="value">{(envelope.release * 1000).toFixed(0)} ms</span>
                </div>
            </div>

            <div className="effect-controls">
                <div className="control-group">
                    <label htmlFor="masterGain">Gain: {masterGain.toFixed(2)}</label>
                    <input 
                        type="range" 
                        id="masterGain" 
                        min="0" 
                        max="2" 
                        step="0.01" 
                        value={masterGain} 
                        onChange={(e) => onMasterGainChange(parseFloat(e.target.value))} 
                        aria-label="Master Gain"
                    />
                </div>
                <div className="control-group">
                    <label htmlFor="reverbWet">Reverb Mix: {(reverbWet * 100).toFixed(0)}%</label>
                    <input 
                        type="range" 
                        id="reverbWet" 
                        min="0" 
                        max="1" 
                        step="0.01" 
                        value={reverbWet} 
                        onChange={(e) => onReverbWetChange(parseFloat(e.target.value))} 
                        aria-label="Reverb Wet/Dry Mix"
                    />
                </div>
                <div className="control-group">
                    <label htmlFor="reverbTime">Reverb Time: {reverbTime.toFixed(1)}s</label>
                    <input 
                        type="range" 
                        id="reverbTime" 
                        min="0.5" 
                        max="10" 
                        step="0.1" 
                        value={reverbTime} 
                        onChange={(e) => onReverbTimeChange(parseFloat(e.target.value))} 
                        aria-label="Reverb Decay Time"
                    />
                </div>
            </div>
        </div>
    );
};

export default GraphicalEnvelopeEditor;