
import React, { useRef, useCallback, memo, useState, useEffect } from 'react';
import './Knob.css';

/**
 * A reusable, draggable knob component for controlling numerical values.
 * It supports mouse and touch input, as well as direct text entry.
 */
const Knob = ({
    label,
    value,
    min,
    max,
    step = 1,
    onChange,
    unit = ''
}) => {
    const knobWrapperRef = useRef<HTMLDivElement>(null);
    const initialDragState = useRef({ value: 0, mouseY: 0 });
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(String(value));

    // Effect to synchronize the displayed input value with the external `value` prop.
    // This runs only when not in editing mode to avoid interrupting user input.
    useEffect(() => {
        if (!isEditing) {
            setInputValue(getFormattedValue(value));
        }
    }, [value, isEditing]);

    /**
     * Formats a numerical value for display, considering the step and unit.
     */
    const getFormattedValue = useCallback((val) => {
        if (unit === 'ms' || unit === 'Hz') {
            return val.toFixed(0);
        }
        if (Number.isInteger(step) && step >= 1) {
            return val.toFixed(0);
        }
        const fixedPoints = step < 1 ? (String(step).split('.')[1]?.length || 2) : 1;
        // Use parseFloat to remove trailing zeros from toFixed
        return String(parseFloat(val.toFixed(fixedPoints)));
    }, [step, unit]);

    /**
     * Converts a value from the min/max range to a rotation angle for the knob indicator.
     */
    const valueToRotation = useCallback((val) => {
        const range = max - min;
        if (range === 0) return -135;
        const normalizedValue = (val - min) / range;
        const totalRotation = 270; // The knob turns 270 degrees (-135 to +135)
        return normalizedValue * totalRotation - 135;
    }, [min, max]);

    /**
     * Handles mouse/touch move events to update the knob's value.
     */
    const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
        // Prevent page scrolling on touch devices during a knob drag.
        if ('touches' in e) {
            e.preventDefault(); 
        }

        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const { value: initialValue, mouseY: initialMouseY } = initialDragState.current;
        const deltaY = initialMouseY - clientY; // Inverted for a natural "drag up to increase" feel.
        const sensitivity = (max - min) / 200; // Dragging 200px covers the entire value range.
        let newValue = initialValue + deltaY * sensitivity;

        // Snap to the nearest step.
        if (step !== 0) {
           newValue = Math.round(newValue / step) * step;
        }

        // Clamp the value within the min/max bounds.
        newValue = Math.max(min, Math.min(max, newValue));
        
        onChange(newValue);
    }, [min, max, step, onChange]);

    /**
     * Cleans up event listeners when a drag interaction ends.
     */
    const handleInteractionEnd = useCallback(() => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleInteractionEnd);
        document.removeEventListener('touchmove', handleMouseMove as EventListener);
        document.removeEventListener('touchend', handleInteractionEnd);
        document.body.style.cursor = 'default';
    }, [handleMouseMove]);

    /**
     * Sets up the necessary event listeners for a drag interaction.
     * @param startY The initial vertical coordinate of the mouse/touch.
     * @param isTouch A boolean indicating if the interaction is from a touch event.
     */
    const setupInteractionListeners = useCallback((startY: number, isTouch: boolean) => {
        initialDragState.current = { value, mouseY: startY };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleInteractionEnd);
        document.addEventListener('touchmove', handleMouseMove as EventListener, { passive: false });
        document.addEventListener('touchend', handleInteractionEnd);
        
        if (!isTouch) {
            document.body.style.cursor = 'ns-resize'; 
        }
    }, [value, handleMouseMove, handleInteractionEnd]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault(); // Prevent text selection.
        setupInteractionListeners(e.clientY, false);
    }, [setupInteractionListeners]);

    // Use a useEffect to add a non-passive touchstart listener directly to the DOM element.
    // This is the recommended way to prevent default browser actions like scrolling
    // for specific, targeted interactions, which improves performance and avoids console warnings.
    useEffect(() => {
        const element = knobWrapperRef.current;
        if (!element) return;

        const handleTouchStart = (e: TouchEvent) => {
            e.preventDefault(); // Crucial for preventing scrolling while dragging the knob.
            setupInteractionListeners(e.touches[0].clientY, true);
        };

        element.addEventListener('touchstart', handleTouchStart, { passive: false });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
        };
    }, [setupInteractionListeners]);

    const handleValueClick = () => {
        setIsEditing(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    /**
     * Validates and commits the value from the text input field.
     */
    const commitValue = () => {
        let numericValue = parseFloat(inputValue);
        if (isNaN(numericValue)) {
            // Revert if the input is not a valid number.
            setInputValue(getFormattedValue(value));
        } else {
            // Clamp and snap the new value to the defined constraints.
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

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            commitValue();
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
            setInputValue(getFormattedValue(value)); // Revert to original value
            setIsEditing(false);
            (e.target as HTMLInputElement).blur();
        }
    };

    const rotation = valueToRotation(value);

    return (
        <div className="knob-control" aria-label={`${label}: ${getFormattedValue(value)}${unit}`}>
            <div
                className="knob-wrapper"
                ref={knobWrapperRef}
                onMouseDown={handleMouseDown}
                role="slider"
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={value}
            >
                 <div className="knob-ticks">
                    {Array.from({ length: 11 }).map((_, i) => (
                        <div key={i} className="knob-tick" style={{ transform: `rotate(${i * 27 - 135}deg)` }} />
                    ))}
                </div>
                <div className="knob-body">
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
