import React from 'react';
import { Chord, Note } from 'tonal';
import './ChordGraph.css';
import { getDisplayChordName } from '../../theory/chords';

interface ChordGraphProps {
    chord1Name: string | null;
    chord2Name: string | null;
}

const ChordGraph: React.FC<ChordGraphProps> = ({ chord1Name, chord2Name }) => {
    // Only render if we have a "from" chord to compare against.
    if (!chord1Name || chord1Name === 'Rest' || !chord2Name || chord2Name === 'Rest') {
        return null;
    }
    
    // Get notes and handle potential empty chords gracefully
    const chord1 = Chord.get(chord1Name);
    const chord2 = Chord.get(chord2Name);

    if (chord1.empty || chord2.empty) {
        return null; // Don't render if one of the chords is invalid
    }

    const chord1Notes = chord1.notes;
    const chord2Notes = chord2.notes;
    
    // Find the notes they have in common
    const commonNotesSet = new Set(chord1Notes.filter(note => chord2Notes.includes(note)));
    
    // Get a sorted list of all unique notes from both chords
    const allNotes = [...new Set([...chord1Notes, ...chord2Notes])];
    const sortedNotes = allNotes.sort((a, b) => {
        const chromaA = Note.chroma(a) ?? -1;
        const chromaB = Note.chroma(b) ?? -1;
        return chromaA - chromaB;
    });

    return (
        <div className="chord-graph-container">
            <div className="chord-graph">
                {/* Headers */}
                <div className="graph-header from-chord">{getDisplayChordName(chord1Name)}</div>
                <div className="graph-header to-chord">{getDisplayChordName(chord2Name)}</div>
                
                {/* Grid Body */}
                {sortedNotes.map(note => (
                    <React.Fragment key={note}>
                        <div className={`note-cell ${chord1Notes.includes(note) ? '' : 'empty'} ${commonNotesSet.has(note) ? 'common' : ''}`}>
                            {chord1Notes.includes(note) ? note : '—'}
                        </div>
                        <div className={`note-cell ${chord2Notes.includes(note) ? '' : 'empty'} ${commonNotesSet.has(note) ? 'common' : ''}`}>
                            {chord2Notes.includes(note) ? note : '—'}
                        </div>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default ChordGraph;
