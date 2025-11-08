import { Chord } from 'tonal';

/**
 * Calculates a consonance score between two chords by counting their common notes.
 * @param chordName1 The name of the first chord (e.g., 'Cmaj7')
 * @param chordName2 The name of the second chord (e.g., 'Am7')
 * @returns The number of common notes.
 */
export function calculateConsonance(chordName1: string, chordName2: string): number {
    if (!chordName1 || chordName1 === 'Rest' || !chordName2 || chordName2 === 'Rest') {
        return 0;
    }

    const notes1 = Chord.get(chordName1).notes;
    const notes2 = Chord.get(chordName2).notes;

    if (!notes1 || !notes2 || notes1.length === 0 || notes2.length === 0) {
        return 0;
    }

    const set1 = new Set(notes1);
    const set2 = new Set(notes2);

    let commonNotes = 0;
    for (const note of set1) {
        if (set2.has(note)) {
            commonNotes++;
        }
    }
    return commonNotes;
}
