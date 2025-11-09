import React, { useMemo } from 'react';
import { Chord, Note } from 'tonal';
import './VerticalNoteVisualizer.css';
import { getChordNotesWithOctaves } from '../../theory/chords';

interface VerticalNoteVisualizerProps {
    chordName: string;
    chordOctave: number;
    noteRange: { minMidi: number; maxMidi: number };
}

const VerticalNoteVisualizer: React.FC<VerticalNoteVisualizerProps> = ({ chordName, chordOctave, noteRange }) => {
    
    const chordNotesInfo = useMemo(() => {
        if (chordName === 'Rest') {
            return { noteMidiSet: new Set<number>(), rootNoteMidi: null };
        }
        const notesWithOctaves = getChordNotesWithOctaves(chordName, chordOctave);
        if (notesWithOctaves.length === 0) {
            return { noteMidiSet: new Set<number>(), rootNoteMidi: null };
        }
        return {
            noteMidiSet: new Set(notesWithOctaves.map(n => Note.midi(n)).filter(Boolean) as number[]),
            rootNoteMidi: Note.midi(notesWithOctaves[0]), // First note is the bass/root of the voicing
        };
    }, [chordName, chordOctave]);

    const yAxisNotes = useMemo(() => {
        const PADDING = 2; // Add a couple of semitones padding
        const min = noteRange.minMidi - PADDING;
        const max = noteRange.maxMidi + PADDING;
        const notes = [];
        // Loop from highest to lowest so notes render top-to-bottom in the DOM
        for (let midi = max; midi >= min; midi--) {
            notes.push({ midi, noteInfo: Note.get(Note.fromMidi(midi)) });
        }
        return notes;
    }, [noteRange]);

    return (
        <div className="vertical-note-visualizer" aria-label={`Note visualization for ${chordName}`}>
            {yAxisNotes.map(({ midi, noteInfo }) => {
                const isInChord = chordNotesInfo.noteMidiSet.has(midi);
                const isRoot = midi === chordNotesInfo.rootNoteMidi;
                const isAccidental = noteInfo.acc === '#' || noteInfo.acc === 'b';
                
                const classNames = [
                    'note-row',
                    isInChord ? 'active' : '',
                    isRoot ? 'is-root' : '',
                    isAccidental ? 'is-accidental' : ''
                ].filter(Boolean).join(' ');

                // Display note name, maybe with octave for C notes to provide context
                const displayName = noteInfo.letter === 'C' ? noteInfo.name : noteInfo.pc.replace('#', '♯');

                return (
                    <div key={midi} className={classNames} title={noteInfo.name}>
                        <span className="note-name">{displayName}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default VerticalNoteVisualizer;