import React from 'react';
import { Chord, Note } from 'tonal';
import './VerticalNoteVisualizer.css';

// Chromatic scale ordered to be displayed C at the bottom, B at the top
const VERTICAL_CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface VerticalNoteVisualizerProps {
    chordName: string;
}

const VerticalNoteVisualizer: React.FC<VerticalNoteVisualizerProps> = ({ chordName }) => {
    const chordInfo = Chord.get(chordName);
    if (chordInfo.empty) {
        return null;
    }

    const chordNotes = new Set(chordInfo.notes.map(note => Note.pitchClass(note)));
    const rootNote = Note.pitchClass(chordInfo.tonic || '');

    return (
        <div className="vertical-note-visualizer" aria-label={`Note visualization for ${chordName}`}>
            {VERTICAL_CHROMATIC_SCALE.map(note => {
                const isInChord = chordNotes.has(note);
                const isRoot = note === rootNote;

                const classNames = [
                    'note-row',
                    isInChord ? 'active' : '',
                    isRoot ? 'is-root' : ''
                ].filter(Boolean).join(' ');

                return (
                    <div key={note} className={classNames} title={note}>
                        <span className="note-name">{note.replace('#', '♯')}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default VerticalNoteVisualizer;