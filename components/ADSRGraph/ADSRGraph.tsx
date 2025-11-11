
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import './ADSRGraph.css';

// Define constants for the visual range of each envelope stage.
const MAX_ATTACK = 2; // seconds
const MAX_DECAY = 2; // seconds
const MAX_RELEASE = 4; // seconds
const SUSTAIN_VISUAL_TIME = 1; // A fixed time for visualizing the sustain portion in the graph.

/**
 * An interactive graphical editor for an ADSR (Attack, Decay, Sustain, Release) envelope.
 * Allows users to modify envelope parameters by dragging points on a graph or by text input.
 */
const ADSRGraph = ({ envelope, onEnvelopeChange }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    // Refs for each draggable handle to attach specific listeners.
    const attackHandleRef = useRef<SVGCircleElement>(null);
    const decaySustainHandleRef = useRef<SVGCircleElement>(null);
    const releaseHandleRef = useRef<SVGCircleElement>(null);

    const draggingPointRef = useRef<string | null>(null);
    // State for the text input fields, kept separate from the main envelope state.
    const [inputValues, setInputValues] = useState({
        attack: (envelope.attack * 1000).toFixed(0),
        decay: (envelope.decay * 1000).toFixed(0),
        sustain: envelope.sustain.toFixed(2),
        release: (envelope.release * 1000).toFixed(0),
    });

    // Sync input fields when the external envelope prop changes.
    useEffect(() => {
        setInputValues({
            attack: (envelope.attack * 1000).toFixed(0),
            decay: (envelope.decay * 1000).toFixed(0),
            sustain: envelope.sustain.toFixed(2),
            release: (envelope.release * 1000).toFixed(0),
        });
    }, [envelope]);


    // Calculate the total time represented on the graph's X-axis.
    const totalTime = MAX_ATTACK + MAX_DECAY + SUSTAIN_VISUAL_TIME + MAX_RELEASE;
    const viewBoxWidth = 1000;
    const viewBoxHeight = 250;
    const padding = 20;

    // --- Coordinate Conversion Functions (Memoized for performance) ---

    /** Converts a time value (in seconds) to an X coordinate in the SVG viewBox. */
    const timeToX = useCallback((time) => {
        return padding + (time / totalTime) * (viewBoxWidth - 2 * padding);
    }, [totalTime, viewBoxWidth, padding]);

    /** Converts a level value (0-1) to a Y coordinate in the SVG viewBox. */
    const levelToY = useCallback((level) => {
        return padding + (1 - level) * (viewBoxHeight - 2 * padding);
    }, [viewBoxHeight, padding]);
    
    /** Converts an X coordinate from the SVG viewBox back to a time value. */
    const xToTime = useCallback((x) => {
         return ((x - padding) / (viewBoxWidth - 2 * padding)) * totalTime;
    }, [totalTime, viewBoxWidth, padding]);
    
    /** Converts a Y coordinate from the SVG viewBox back to a level value. */
    const yToLevel = useCallback((y) => {
        return 1 - ((y - padding) / (viewBoxHeight - 2 * padding));
    }, [viewBoxHeight, padding]);

    /** Gets the mouse/touch coordinates relative to the SVG's viewBox. */
    const getSVGCoordinates = useCallback((e: MouseEvent | TouchEvent) => {
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
    
        // Fallback for browsers that might not have a perfect CTM implementation.
        const rect = svg.getBoundingClientRect();
        const svgX = (clientX - rect.left) * (viewBoxWidth / rect.width);
        const svgY = (clientY - rect.top) * (viewBoxHeight / rect.height);
        return { x: svgX, y: svgY };
    }, [viewBoxWidth, viewBoxHeight]);

    // Calculate the coordinates of the five points of the ADSR envelope.
    const points = useMemo(() => {
        const p0 = { x: timeToX(0), y: levelToY(0) }; // Start
        const p1 = { x: timeToX(envelope.attack), y: levelToY(1) }; // Attack Peak
        const p2 = { x: timeToX(envelope.attack + envelope.decay), y: levelToY(envelope.sustain) }; // Decay End
        const p3 = { x: timeToX(envelope.attack + envelope.decay + SUSTAIN_VISUAL_TIME), y: levelToY(envelope.sustain) }; // Sustain End
        const p4 = { x: timeToX(envelope.attack + envelope.decay + SUSTAIN_VISUAL_TIME + envelope.release), y: levelToY(0) }; // Release End
        return { p0, p1, p2, p3, p4 };
    }, [envelope, timeToX, levelToY]);

    // The 'd' attribute for the SVG path element.
    const pathData = `M ${points.p0.x},${points.p0.y} L ${points.p1.x},${points.p1.y} L ${points.p2.x},${points.p2.y} L ${points.p3.x},${points.p3.y} L ${points.p4.x},${points.p4.y}`;

    /**
     * Handles the mouse/touch move event during a drag, updating the envelope state.
     */
    const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!draggingPointRef.current) return;
        // Prevent page scrolling on touch devices.
        if ('touches' in e) {
            e.preventDefault();
        }
        
        let { x, y } = getSVGCoordinates(e);
        // Clamp coordinates within the padded area of the graph.
        x = Math.max(padding, Math.min(viewBoxWidth - padding, x));
        y = Math.max(padding, Math.min(viewBoxHeight - padding, y));

        const time = xToTime(x);
        const level = yToLevel(y);
        let newEnvelope = { ...envelope };

        // Update the envelope based on which point is being dragged.
        switch (draggingPointRef.current) {
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
    }, [envelope, onEnvelopeChange, getSVGCoordinates, xToTime, yToLevel, padding, viewBoxWidth]);

    /**
     * Cleans up drag-related event listeners from the document.
     */
    const handleDragEnd = useCallback(() => {
        draggingPointRef.current = null;
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove as EventListener);
        document.removeEventListener('touchend', handleDragEnd);
    }, [handleDragMove]);

    /**
     * Attaches drag event listeners to the document.
     */
    const setupDragListeners = useCallback((pointName: string, isTouch: boolean) => {
        draggingPointRef.current = pointName;
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('touchmove', handleDragMove as EventListener, { passive: false });
        document.addEventListener('touchend', handleDragEnd);
    }, [handleDragMove, handleDragEnd]);

    const handleMouseDown = useCallback((pointName: string) => (e: React.MouseEvent) => {
        e.preventDefault();
        setupDragListeners(pointName, false);
    }, [setupDragListeners]);

    // This effect adds non-passive touch listeners directly to the SVG handle elements.
    // This is crucial for preventing the browser's default touch behaviors (like scrolling)
    // while allowing smooth dragging of the envelope points.
    useEffect(() => {
        const handles = [
            { ref: attackHandleRef, name: 'attack' },
            { ref: decaySustainHandleRef, name: 'decaySustain' },
            { ref: releaseHandleRef, name: 'release' },
        ];

        const cleanupFns: Array<() => void> = [];

        handles.forEach(({ ref, name }) => {
            const element = ref.current;
            if (element) {
                const handleTouchStart = (e: TouchEvent) => {
                    e.preventDefault();
                    setupDragListeners(name, true);
                };
                element.addEventListener('touchstart', handleTouchStart, { passive: false });
                cleanupFns.push(() => element.removeEventListener('touchstart', handleTouchStart));
            }
        });

        // Return a cleanup function to remove listeners when the component unmounts.
        return () => {
            cleanupFns.forEach(fn => fn());
        };
    }, [setupDragListeners]);

    const handleInputChange = (param: 'attack' | 'decay' | 'sustain' | 'release', value: string) => {
        setInputValues(prev => ({ ...prev, [param]: value }));
    };

    /**
     * Validates and commits the value from a text input field on blur.
     */
    const handleInputCommit = (param: 'attack' | 'decay' | 'sustain' | 'release') => {
        let numericValue = parseFloat(inputValues[param]);
        if (isNaN(numericValue)) {
            // Revert on invalid input.
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
    
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, param: 'attack' | 'decay' | 'sustain' | 'release') => {
        if (e.key === 'Enter') {
            handleInputCommit(param);
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
            // Revert changes and blur.
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
                <circle cx={points.p1.x} cy={points.p1.y} r="12" className="adsr-point-handle" ref={attackHandleRef} onMouseDown={handleMouseDown('attack')} />
                <circle cx={points.p1.x} cy={points.p1.y} r="8" className="adsr-point attack" />
                
                <circle cx={points.p2.x} cy={points.p2.y} r="12" className="adsr-point-handle" ref={decaySustainHandleRef} onMouseDown={handleMouseDown('decaySustain')} />
                <circle cx={points.p2.x} cy={points.p2.y} r="8" className="adsr-point decay" />

                <circle cx={points.p4.x} cy={points.p4.y} r="12" className="adsr-point-handle" ref={releaseHandleRef} onMouseDown={handleMouseDown('release')} />
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
