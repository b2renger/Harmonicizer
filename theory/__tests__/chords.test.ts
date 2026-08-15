import { describe, it, expect } from 'vitest';
import {
    getChordInfo,
    detectChordFromNotes,
    getAbbreviatedNameFromNotes,
    getNextInversion,
    getAbbreviatedChordName,
} from '../chords.js';

describe('getChordInfo', () => {
    // Tonal 4.10's Chord.get returns empty for every slash form, even 'C/E', although
    // Chord.detect happily produces those names.
    it.each(['C/E', 'Cmaj7/E', 'Cmaj7/B', 'Dm7/A', 'G7/B'])('parses the slash chord %s', (symbol) => {
        const info = getChordInfo(symbol);
        expect(info.empty).toBe(false);
        expect(info.tonic).toBeTruthy();
        expect(info.root).toBe(symbol.split('/')[1]);
    });

    it('still parses plain symbols', () => {
        expect(getChordInfo('Cmaj7').tonic).toBe('C');
        expect(getChordInfo('nonsense').empty).toBe(true);
    });

    it('leaves a non-slash chord with no root override', () => {
        expect(getChordInfo('Cmaj7').root).toBeFalsy();
    });
});

describe('inversions keep their name', () => {
    // Regression: every inversion used to display as a raw note list, so pressing
    // "next inversion" on Cmaj7 turned the chord card into "E-G-B-C".
    it('names all four inversions of a seventh chord', () => {
        let notes = ['C4', 'E4', 'G4', 'B4'];
        const names: string[] = [];

        for (let i = 0; i < 4; i++) {
            names.push(getAbbreviatedNameFromNotes(notes));
            notes = getNextInversion(notes);
        }

        for (const name of names) {
            expect(name).not.toMatch(/-/);          // not a fallback note list
            expect(name.startsWith('Cmaj7')).toBe(true);
        }
        expect(names[0]).toBe('Cmaj7');
    });

    it('detects an inverted triad', () => {
        expect(detectChordFromNotes(['E4', 'G4', 'C5'])).toBe('C/E');
    });
});

describe('canonical chord symbols', () => {
    it.each([
        ['CMaj7', 'Cmaj7'],
        ['Cmaj7', 'Cmaj7'],
        ['CM7',   'Cmaj7'],
        ['C',     'C'],
        ['CM',    'C'],
        ['Dm',    'Dm'],
        ['G7',    'G7'],
        ['Bm7b5', 'Bm7b5'],
    ])('%s → %s', (input, expected) => {
        expect(getAbbreviatedChordName(input)).toBe(expected);
    });
});
