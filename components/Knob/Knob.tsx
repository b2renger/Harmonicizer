import React, { useRef, useCallback, memo, useState, useEffect } from 'react';
import './Knob.css';

const Knob = ({
    label,
    value,
    min,
    max,
    step = 1,
    onChange,
    unit = ''
}) => {
    const knobRef = useRef(null);
    const initialDragState = useRef({ value: 0, mouseY: 0 });
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(String(value));

    useEffect(() => {
        // Sync input value with prop value if not currently editing
        if (!isEditing) {
            setInputValue(getFormattedValue(value));
        }
    }, [value, isEditing]);

    const getFormattedValue = (val) => {
        if (unit === 'ms' || unit === 'Hz') {
            return val.toFixed(0);
        }
        if (Number.isInteger(step) && step >= 1) {
            return val.toFixed(0);
        }
        const fixedPoints = step < 1 ? (String(step).split('.')[1]?.length || 2) : 1;
        // Use parseFloat to remove trailing zeros from toFixed
        return String(parseFloat(val.toFixed(fixedPoints)));
    };

    const valueToRotation = useCallback((val) => {
        const range = max - min;
        if (range === 0) return -135;
        const normalizedValue = (val - min) / range;
        const totalRotation = 270; // e.g., from -135deg to +135deg
        return normalizedValue * totalRotation - 135;
    }, [min, max]);

    const handleMouseMove = useCallback((e) => {
        const { value: initialValue, mouseY: initialMouseY } = initialDragState.current;
        const deltaY = initialMouseY - e.clientY; // Inverted for natural "up is more" feel
        const sensitivity = (max - min) / 200; // Drag 200px to cover the entire range
        let newValue = initialValue + deltaY * sensitivity;

        if (step !== 0) {
           newValue = Math.round(newValue / step) * step;
        }

        newValue = Math.max(min, Math.min(max, newValue));
        
        onChange(newValue);
    }, [min, max, step, onChange]);

    const handleMouseUp = useCallback(() => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'default';
    }, [handleMouseMove]);

    const handleMouseDown = (e) => {
        e.preventDefault();
        initialDragState.current = { value, mouseY: e.clientY };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'ns-resize';
    };

    const handleValueClick = () => {
        setIsEditing(true);
    };

    const handleInputChange = (e) => {
        setInputValue(e.target.value);
    };

    const commitValue = () => {
        let numericValue = parseFloat(inputValue);
        if (isNaN(numericValue)) {
            // Revert if not a number
            setInputValue(getFormattedValue(value));
        } else {
            // Clamp and step the new value
            numericValue = Math.max(min, Math.min(max, numericValue));
            if (step !== 0) {
                numericValue = Math.round(numericValue / step) * step;
            }
            onChange(numericValue);
            setInputValue(getFormattedValue(numericValue));
        }
        setIsEditing(false);
    };

    const handleInputBlur = () => {
        commitValue();
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            commitValue();
            (e.target).blur();
        } else if (e.key === 'Escape') {
            setInputValue(getFormattedValue(value));
            setIsEditing(false);
            (e.target).blur();
        }
    };

    const rotation = valueToRotation(value);

    return (
        <div className="knob-control" aria-label={`${label}: ${getFormattedValue(value)}${unit}`}>
            <div className="knob-wrapper" onMouseDown={handleMouseDown} role="slider" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}>
                 <div className="knob-ticks">
                    {Array.from({ length: 11 }).map((_, i) => (
                        <div key={i} className="knob-tick" style={{ transform: `rotate(${i * 27 - 135}deg)` }} />
                    ))}
                </div>
                <div className="knob-body" ref={knobRef}>
                     <div className="knob-indicator" style={{ transform: `rotate(${rotation}deg)` }} />
                </div>
            </div>
            <label className="knob-label">{label}</label>
            {isEditing ? (
                <input
                    type="text"
                    className="knob-value-input"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    onKeyDown={handleInputKeyDown}
                    autoFocus
                    onFocus={(e) => e.target.select()}
                />
            ) : (
                <div className="knob-value" onClick={handleValueClick}>
                    {getFormattedValue(value)}{unit}
                </div>
            )}
        </div>
    );
};

export default memo(Knob);