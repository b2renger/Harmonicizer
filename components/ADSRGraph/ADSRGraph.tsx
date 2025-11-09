import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import './ADSRGraph.css';

interface EnvelopeSettings {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
}

interface ADSRGraphProps {
    envelope: EnvelopeSettings;
    onEnvelopeChange: (newEnvelope: EnvelopeSettings) => void;
}

const MAX_ATTACK = 2; // seconds
const MAX_DECAY = 2; // seconds
const MAX_RELEASE = 4; // seconds
const SUSTAIN_VISUAL_TIME = 1; // a fixed time for the sustain portion in the graph

const ADSRGraph: React.FC<ADSRGraphProps> = ({ envelope, onEnvelopeChange }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [draggingPoint, setDraggingPoint] = useState<string | null>(null);
    const [inputValues, setInputValues] = useState({
        attack: (envelope.attack * 1000).toFixed(0),
        decay: (envelope.decay * 1000).toFixed(0),
        sustain: envelope.sustain.toFixed(2),
        release: (envelope.release * 1000).toFixed(0),
    });

    useEffect(() => {
        setInputValues({
            attack: (envelope.attack * 1000).toFixed(0),
            decay: (envelope.decay * 1000).toFixed(0),
            sustain: envelope.sustain.toFixed(2),
            release: (envelope.release * 1000).toFixed(0),
        });
    }, [envelope]);


    const totalTime = MAX_ATTACK + MAX_DECAY + SUSTAIN_VISUAL_TIME + MAX_RELEASE;
    const viewBoxWidth = 1000;
    const viewBoxHeight = 250;
    const padding = 20;

    const timeToX = useCallback((time: number) => {
        return padding + (time / totalTime) * (viewBoxWidth - 2 * padding);
    }, [totalTime, viewBoxWidth, padding]);

    const levelToY = useCallback((level: number) => {
        return padding + (1 - level) * (viewBoxHeight - 2 * padding);
    }, [viewBoxHeight, padding]);
    
    const xToTime = useCallback((x: number) => {
         return ((x - padding) / (viewBoxWidth - 2 * padding)) * totalTime;
    }, [totalTime, viewBoxWidth, padding]);
    
    const yToLevel = useCallback((y: number) => {
        return 1 - ((y - padding) / (viewBoxHeight - 2 * padding));
    }, [viewBoxHeight, padding]);

    const getSVGCoordinates = useCallback((e: MouseEvent | TouchEvent): { x: number, y: number } => {
        const svg = svgRef.current;
        if (!svg) return { x: 0, y: 0 };

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const ctm = svg.getScreenCTM();
        if (ctm) {
            const pt = svg.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            const svgP = pt.matrixTransform(ctm.inverse());
            return { x: svgP.x, y: svgP.y };
        }
    
        const rect = svg.getBoundingClientRect();
        const svgX = (clientX - rect.left) * (viewBoxWidth / rect.width);
        const svgY = (clientY - rect.top) * (viewBoxHeight / rect.height);
        return { x: svgX, y: svgY };
    }, [viewBoxWidth, viewBoxHeight]);

    const points = useMemo(() => {
        const p0 = { x: timeToX(0), y: levelToY(0) }; // Start
        const p1 = { x: timeToX(envelope.attack), y: levelToY(1) }; // Attack Peak
        const p2 = { x: timeToX(envelope.attack + envelope.decay), y: levelToY(envelope.sustain) }; // Decay End
        const p3 = { x: timeToX(envelope.attack + envelope.decay + SUSTAIN_VISUAL_TIME), y: levelToY(envelope.sustain) }; // Sustain End
        const p4 = { x: timeToX(envelope.attack + envelope.decay + SUSTAIN_VISUAL_TIME + envelope.release), y: levelToY(0) }; // Release End
        return { p0, p1, p2, p3, p4 };
    }, [envelope, timeToX, levelToY]);

    const pathData = `M ${points.p0.x},${points.p0.y} L ${points.p1.x},${points.p1.y} L ${points.p2.x},${points.p2.y} L ${points.p3.x},${points.p3.y} L ${points.p4.x},${points.p4.y}`;

    const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!draggingPoint) return;
        if ('touches' in e) {
            e.preventDefault();
        }
        
        let { x, y } = getSVGCoordinates(e);
        x = Math.max(padding, Math.min(viewBoxWidth - padding, x));
        y = Math.max(padding, Math.min(viewBoxHeight - padding, y));

        const time = xToTime(x);
        const level = yToLevel(y);
        let newEnvelope = { ...envelope };

        switch (draggingPoint) {
            case 'attack':
                newEnvelope.attack = Math.max(0.01, Math.min(MAX_ATTACK, time));
                break;
            case 'decaySustain':
                const attackTime = newEnvelope.attack;
                newEnvelope.decay = Math.max(0.01, Math.min(MAX_DECAY, time - attackTime));
                newEnvelope.sustain = Math.max(0, Math.min(1, level));
                break;
            case 'release':
                const sustainEndTime = newEnvelope.attack + newEnvelope.decay + SUSTAIN_VISUAL_TIME;
                newEnvelope.release = Math.max(0.01, Math.min(MAX_RELEASE, time - sustainEndTime));
                break;
        }

        onEnvelopeChange(newEnvelope);
    }, [draggingPoint, envelope, onEnvelopeChange, getSVGCoordinates, xToTime, yToLevel, padding, viewBoxWidth]);

    const handleDragEnd = useCallback(() => {
        setDraggingPoint(null);
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove);
        document.removeEventListener('touchend', handleDragEnd);
    }, [handleDragMove]);

    const handleDragStart = (pointName: string) => (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setDraggingPoint(pointName);
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('touchmove', handleDragMove, { passive: false });
        document.addEventListener('touchend', handleDragEnd);
    };

    const handleInputChange = (param: keyof EnvelopeSettings, value: string) => {
        setInputValues(prev => ({ ...prev, [param]: value }));
    };

    const handleInputCommit = (param: keyof EnvelopeSettings) => {
        let numericValue = parseFloat(inputValues[param]);
        if (isNaN(numericValue)) {
            // Revert on invalid input
            setInputValues({
                attack: (envelope.attack * 1000).toFixed(0),
                decay: (envelope.decay * 1000).toFixed(0),
                sustain: envelope.sustain.toFixed(2),
                release: (envelope.release * 1000).toFixed(0),
            });
            return;
        }

        let newEnvelope = { ...envelope };
        switch (param) {
            case 'attack':
                newEnvelope.attack = Math.max(0.01, Math.min(MAX_ATTACK, numericValue / 1000));
                break;
            case 'decay':
                newEnvelope.decay = Math.max(0.01, Math.min(MAX_DECAY, numericValue / 1000));
                break;
            case 'sustain':
                newEnvelope.sustain = Math.max(0, Math.min(1, numericValue));
                break;
            case 'release':
                newEnvelope.release = Math.max(0.01, Math.min(MAX_RELEASE, numericValue / 1000));
                break;
        }
        onEnvelopeChange(newEnvelope);
    };
    
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, param: keyof EnvelopeSettings) => {
        if (e.key === 'Enter') {
            handleInputCommit(param);
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
            // Revert changes and blur
             setInputValues({
                attack: (envelope.attack * 1000).toFixed(0),
                decay: (envelope.decay * 1000).toFixed(0),
                sustain: envelope.sustain.toFixed(2),
                release: (envelope.release * 1000).toFixed(0),
            });
            (e.target as HTMLInputElement).blur();
        }
    }

    return (
        <div className="adsr-graph-container">
            <svg ref={svgRef} viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="adsr-svg">
                <path d={pathData} className="adsr-path" />
                <circle cx={points.p1.x} cy={points.p1.y} r="12" className="adsr-point-handle" onMouseDown={handleDragStart('attack')} onTouchStart={handleDragStart('attack')} />
                <circle cx={points.p1.x} cy={points.p1.y} r="8" className="adsr-point attack" />
                
                <circle cx={points.p2.x} cy={points.p2.y} r="12" className="adsr-point-handle" onMouseDown={handleDragStart('decaySustain')} onTouchStart={handleDragStart('decaySustain')} />
                <circle cx={points.p2.x} cy={points.p2.y} r="8" className="adsr-point decay" />

                <circle cx={points.p4.x} cy={points.p4.y} r="12" className="adsr-point-handle" onMouseDown={handleDragStart('release')} onTouchStart={handleDragStart('release')} />
                <circle cx={points.p4.x} cy={points.p4.y} r="8" className="adsr-point release" />
            </svg>
            <div className="adsr-labels">
                <div className="adsr-label">
                    <span>Attack</span>
                    <div>
                        <input type="text" className="adsr-input" value={inputValues.attack} onChange={(e) => handleInputChange('attack', e.target.value)} onBlur={() => handleInputCommit('attack')} onKeyDown={e => handleInputKeyDown(e, 'attack')} />
                        <span>ms</span>
                    </div>
                </div>
                 <div className="adsr-label">
                    <span>Decay</span>
                    <div>
                        <input type="text" className="adsr-input" value={inputValues.decay} onChange={(e) => handleInputChange('decay', e.target.value)} onBlur={() => handleInputCommit('decay')} onKeyDown={e => handleInputKeyDown(e, 'decay')} />
                        <span>ms</span>
                    </div>
                </div>
                 <div className="adsr-label">
                    <span>Sustain</span>
                    <div>
                        <input type="text" className="adsr-input" value={inputValues.sustain} onChange={(e) => handleInputChange('sustain', e.target.value)} onBlur={() => handleInputCommit('sustain')} onKeyDown={e => handleInputKeyDown(e, 'sustain')} />
                    </div>
                </div>
                 <div className="adsr-label">
                    <span>Release</span>
                    <div>
                        <input type="text" className="adsr-input" value={inputValues.release} onChange={(e) => handleInputChange('release', e.target.value)} onBlur={() => handleInputCommit('release')} onKeyDown={e => handleInputKeyDown(e, 'release')} />
                        <span>ms</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ADSRGraph;