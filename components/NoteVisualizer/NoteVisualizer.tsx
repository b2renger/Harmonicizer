import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import './NoteVisualizer.css';
import { Note, Scale, Mode, Chord } from 'tonal';

// Props interface for clarity
interface NoteVisualizerProps {
    chordId: string;
    notes: string[];
    musicalKey: string;
    musicalMode: string;
    onChordNotesUpdate: (id: string, newNotes: string[]) => void;
}

const MIN_MIDI = 48; // C3
const MAX_MIDI = 83; // B5

const NoteVisualizer: React.FC<NoteVisualizerProps> = ({ notes, musicalKey, musicalMode, onChordNotesUpdate, chordId }) => {
    const visualizerRef = useRef<HTMLDivElement>(null);
    const isInteractive = !!onChordNotesUpdate;

    // A ref to hold all state related to the drag interaction, preventing re-renders.
    const dragState = useRef({
        isDragging: false,
        wasDragged: false,
        startX: 0,
        scrollLeft: 0,
    });
    
    const scaleInfo = useMemo(() => {
        const scaleNotes = Scale.get(`${musicalKey} ${musicalMode}`).notes;
        const pitchClassSet = new Set(scaleNotes);
        const triads = Mode.triads(musicalMode, musicalKey);
        const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        const romanNumerals = triads.map((triadSymbol, index) => {
            const quality = Chord.get(triadSymbol).quality;
            let roman = numerals[index];
            if (quality === 'Minor' || quality === 'Diminished') {
                roman = roman.toLowerCase();
            }
            if (quality === 'Diminished') {
                roman += '°';
            } else if (quality === 'Augmented') {
                roman += '+';
            }
            return roman;
        });

        return { scaleNotes, pitchClassSet, romanNumerals };
    }, [musicalKey, musicalMode]);

    const chordNotesInfo = useMemo(() => {
        if (notes.length === 0) {
            return { noteMidiSet: new Set(), rootNoteMidi: null };
        }
        const sortedNotes = notes.slice().sort((a,b) => (Note.midi(a) || 0) - (Note.midi(b) || 0));
        return {
            noteMidiSet: new Set(sortedNotes.map(n => Note.midi(n)).filter(Boolean)),
            rootNoteMidi: Note.midi(sortedNotes[0]),
        };
    }, [notes]);

    const allDisplayNotes = useMemo(() => {
        const displayNotes = [];
        for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
            displayNotes.push({ midi, noteInfo: Note.get(Note.fromMidi(midi)) });
        }
        return displayNotes;
    }, []);

    const handleNoteInteractionEnd = useCallback((midi: number) => {
        // A "click" is only registered if a drag did not occur.
        if (!isInteractive || dragState.current.wasDragged) return;

        const originalMidi = notes.map(n => Note.midi(n)).filter(Boolean);
        const newMidiSet = new Set(originalMidi);

        if (newMidiSet.has(midi)) {
            newMidiSet.delete(midi);
        } else {
            newMidiSet.add(midi);
        }

        const newNotes = Array.from(newMidiSet).sort((a, b) => (a as number) - (b as number)).map(m => Note.fromMidi(m as number));
        onChordNotesUpdate(chordId, newNotes);
    }, [isInteractive, notes, chordId, onChordNotesUpdate]);

    // --- Drag-to-scroll Logic ---
    // This effect encapsulates all drag-and-drop logic for both mouse and touch events.
    useEffect(() => {
        const element = visualizerRef.current;
        if (!element) return;

        const handleDragMove = (e: MouseEvent | TouchEvent) => {
            if (!dragState.current.isDragging) return;
            
            // For touch events, we must prevent the default action (scrolling the page)
            // once we've determined the user is dragging horizontally.
            if ('touches' in e) {
                e.preventDefault();
            }

            const currentX = 'touches' in e ? e.touches[0].pageX : e.pageX;
            // Set a flag that a drag has occurred if movement exceeds a small threshold.
            // This prevents a small jiggle from disabling a click.
            if (!dragState.current.wasDragged && Math.abs(currentX - dragState.current.startX) > 5) {
                dragState.current.wasDragged = true;
            }

            const walk = currentX - dragState.current.startX;
            element.scrollLeft = dragState.current.scrollLeft - walk;
        };
        
        const handleDragEnd = () => {
            if (!dragState.current.isDragging) return;

            dragState.current.isDragging = false;
            element.classList.remove('is-dragging');
            
            // Clean up global listeners
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
            document.removeEventListener('touchmove', handleDragMove);
            document.removeEventListener('touchend', handleDragEnd);

            // Use a timeout to reset the 'wasDragged' flag. This ensures the 'onMouseUp'/'onTouchEnd' event,
            // which fires before this, can correctly check if a drag happened.
            setTimeout(() => {
                dragState.current.wasDragged = false;
            }, 0);
        };
        
        const handleDragStart = (e: MouseEvent | TouchEvent) => {
             // We don't prevent default on the start event, as that would block clicks.
             // We'll prevent it on the move event instead if a drag is detected.
            dragState.current.isDragging = true;
            dragState.current.wasDragged = false; // Reset on new drag
            
            const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
            dragState.current.startX = pageX;
            dragState.current.scrollLeft = element.scrollLeft;
            
            // Add global listeners to the document to handle dragging outside the element
            document.addEventListener('mousemove', handleDragMove);
            document.addEventListener('mouseup', handleDragEnd);
            document.addEventListener('touchmove', handleDragMove, { passive: false });
            document.addEventListener('touchend', handleDragEnd);

            // Add visual feedback
            element.classList.add('is-dragging');
        };

        // Attach the start listeners to the component's element.
        element.addEventListener('mousedown', handleDragStart);
        // The '{ passive: false }' option is necessary to allow 'preventDefault' to work in the touch listener.
        element.addEventListener('touchstart', handleDragStart, { passive: false });

        // Cleanup function to remove all listeners when the component unmounts.
        return () => {
            element.removeEventListener('mousedown', handleDragStart);
            element.removeEventListener('touchstart', handleDragStart);
            // Just in case the component unmounts mid-drag, remove document listeners too.
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
            document.removeEventListener('touchmove', handleDragMove);
            document.removeEventListener('touchend', handleDragEnd);
        };
    }, []); // Empty dependency array means this effect runs only once on mount.


    return (
        <div 
            ref={visualizerRef}
            className={`note-visualizer ${isInteractive ? 'interactive' : ''}`}
            aria-label={`Interactive note visualizer, draggable for scrolling`}
        >
            {allDisplayNotes.map(({ midi, noteInfo }) => {
                const isInChord = chordNotesInfo.noteMidiSet.has(midi);
                const isRoot = midi === chordNotesInfo.rootNoteMidi;
                const isAccidental = noteInfo.acc === '#' || noteInfo.acc === 'b';
                const isInScale = scaleInfo.pitchClassSet.has(noteInfo.pc);
                
                const classNames = [
                    'note-column',
                    isInChord ? 'active' : '',
                    isRoot ? 'is-root' : '',
                    isAccidental ? 'is-accidental' : '',
                    isInScale ? 'is-in-scale' : '',
                    (isInteractive && isInScale && !isInChord) ? 'suggestion-highlight' : ''
                ].filter(Boolean).join(' ');

                const degreeIndex = scaleInfo.scaleNotes.indexOf(noteInfo.pc);
                const romanNumeral = degreeIndex !== -1 ? scaleInfo.romanNumerals[degreeIndex] : '';

                return (
                    <div 
                        key={midi} 
                        className={classNames} 
                        title={noteInfo.name}
                        onMouseUp={() => handleNoteInteractionEnd(midi)}
                        onTouchEnd={() => handleNoteInteractionEnd(midi)}
                    >
                        <span className="note-root-indicator">{isRoot ? 'R' : ''}</span>
                        <span className="note-name-octave">{noteInfo.name}</span>
                        <span className="scale-degree-roman">{romanNumeral}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default React.memo(NoteVisualizer);