import React, { useMemo } from 'react';
import { Note, Scale, Mode, Chord } from 'tonal';
import './ChordTransitionVisualizer.css';

interface ChordTransitionVisualizerProps {
    fromNotes: string[];
    toNotes: string[];
    musicalKey: string;
    musicalMode: string;
    title: string;
    onToChordNotesChange?: (notes: string[]) => void;
}

const MIN_MIDI = 48; // C3
const MAX_MIDI = 83; // B5

const ChordTransitionVisualizer: React.FC<ChordTransitionVisualizerProps> = ({
    fromNotes,
    toNotes,
    musicalKey,
    musicalMode,
    title,
    onToChordNotesChange,
}) => {
    const isInteractive = !!onToChordNotesChange;

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

    const { fromMidiSet, toMidiSet, toRootMidi } = useMemo(() => {
        const sortedToNotes = toNotes.slice().sort((a,b) => (Note.midi(a) || 0) - (Note.midi(b) || 0));
        return {
            fromMidiSet: new Set(fromNotes.map(n => Note.midi(n)).filter(Boolean) as number[]),
            toMidiSet: new Set(sortedToNotes.map(n => Note.midi(n)).filter(Boolean) as number[]),
            toRootMidi: sortedToNotes.length > 0 ? Note.midi(sortedToNotes[0]) : null,
        };
    }, [fromNotes, toNotes]);

    const yAxisNotes = useMemo(() => {
        const notes = [];
        for (let midi = MAX_MIDI; midi >= MIN_MIDI; midi--) {
            notes.push({ midi, noteInfo: Note.get(Note.fromMidi(midi)) });
        }
        return notes;
    }, []);

    const handleClick = (midi: number) => {
        if (!isInteractive) return;

        const originalToMidi = toNotes.map(n => Note.midi(n)).filter(Boolean) as number[];
        
        const newMidiSet = new Set(originalToMidi);

        if (newMidiSet.has(midi)) {
            newMidiSet.delete(midi);
        } else {
            newMidiSet.add(midi);
        }

        const newNotes = Array.from(newMidiSet).sort((a,b) => a - b).map(m => Note.fromMidi(m));
        onToChordNotesChange?.(newNotes);
    };

    return (
        <div className="chord-transition-visualizer-container">
            <h4 className="chord-transition-visualizer-title">{title}</h4>
            <div 
                className={`chord-transition-visualizer ${isInteractive ? 'interactive' : ''}`}
            >
                {yAxisNotes.map(({ midi, noteInfo }) => {
                    const isFromNote = fromMidiSet.has(midi);
                    const isToNote = toMidiSet.has(midi);
                    const isCommonNote = isFromNote && isToNote;
                    const isRoot = midi === toRootMidi; // Only applies to the 'to' chord
                    const isAccidental = noteInfo.acc === '#' || noteInfo.acc === 'b';
                    const isInScale = scaleInfo.pitchClassSet.has(noteInfo.pc);

                    const classNames = [
                        'note-row-transition',
                        isCommonNote ? 'common' : isToNote ? 'to-note' : isFromNote ? 'from-note' : '',
                        isRoot ? 'is-root' : '',
                        isAccidental ? 'is-accidental' : '',
                        isInScale ? 'is-in-scale' : '',
                        (isInteractive && isInScale && !isToNote) ? 'suggestion-highlight' : ''
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
                            <span className="scale-degree-roman-transition">{romanNumeral}</span>
                            <span className="note-name-octave-transition">{noteInfo.name}</span>
                            <span className="note-root-indicator-transition">{isRoot ? 'R' : ''}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ChordTransitionVisualizer;