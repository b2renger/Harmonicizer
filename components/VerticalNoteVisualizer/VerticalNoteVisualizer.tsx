import React, { useMemo } from 'react';
import { Note, Scale, Mode, Chord } from 'tonal';
import './VerticalNoteVisualizer.css';

const MIN_MIDI = 48; // C3
const MAX_MIDI = 83; // B5

const VerticalNoteVisualizer = ({ notes, musicalKey, musicalMode, onNotesChange }) => {
    const isInteractive = !!onNotesChange;
    
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
            rootNoteMidi: Note.midi(sortedNotes[0]), // First note in sorted array is the bass/root of the voicing
        };
    }, [notes]);

    const yAxisNotes = useMemo(() => {
        const notes = [];
        for (let midi = MAX_MIDI; midi >= MIN_MIDI; midi--) {
            notes.push({ midi, noteInfo: Note.get(Note.fromMidi(midi)) });
        }
        return notes;
    }, []);

    const handleClick = (midi) => {
        if (!isInteractive) return;

        const originalMidi = notes.map(n => Note.midi(n)).filter(Boolean);
        
        const newMidiSet = new Set(originalMidi);

        if (newMidiSet.has(midi)) {
            newMidiSet.delete(midi);
        } else {
            newMidiSet.add(midi);
        }

        // FIX: Cast sort parameters to number to fix TypeScript error
        const newNotes = Array.from(newMidiSet).sort((a, b) => (a as number) - (b as number)).map(m => Note.fromMidi(m as number));
        onNotesChange?.(newNotes);
    };

    return (
        <div 
            className={`vertical-note-visualizer ${isInteractive ? 'interactive' : ''}`}
            aria-label={`Interactive note visualizer`}
        >
            {yAxisNotes.map(({ midi, noteInfo }) => {
                const isInChord = chordNotesInfo.noteMidiSet.has(midi);
                const isRoot = midi === chordNotesInfo.rootNoteMidi;
                const isAccidental = noteInfo.acc === '#' || noteInfo.acc === 'b';
                const isInScale = scaleInfo.pitchClassSet.has(noteInfo.pc);
                
                const classNames = [
                    'note-row',
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
                        onClick={isInteractive ? () => handleClick(midi) : undefined}
                    >
                        <span className="scale-degree-roman">{romanNumeral}</span>
                        <span className="note-name-octave">{noteInfo.name}</span>
                        <span className="note-root-indicator">{isRoot ? 'R' : ''}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default VerticalNoteVisualizer;