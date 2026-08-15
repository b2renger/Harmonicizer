import { describe, it, expect } from 'vitest';
import { Chord, Note } from 'tonal';
import { getRomanNumeralForChord, getChordFromRomanNumeral, getDiatonicChords } from '../harmony.js';
import { rootNotes, modes } from '../chords.js';

/** Pitch-class chroma set, so enharmonic spellings compare equal (Ab === G#). */
const chromaSet = (symbol: string): string => {
    const notes = Chord.get(symbol).notes;
    return [...new Set(notes.map(n => Note.chroma(n)))].sort((a, b) => (a ?? 0) - (b ?? 0)).join(',');
};

describe('getRomanNumeralForChord', () => {
    it.each([
        ['Cmaj7', 'C', 'major', 'Imaj7'],
        ['G7',    'C', 'major', 'V7'],
        ['Am7',   'C', 'major', 'vi7'],     // lower case already carries the minor third
        ['Bm7b5', 'C', 'major', 'viiø7'],   // half-diminished, not fully diminished
        ['C',     'C', 'major', 'I'],
        ['Dm',    'C', 'major', 'ii'],
        ['Cdim7', 'C', 'major', 'i°7'],
        ['Caug',  'C', 'major', 'I+'],
        ['Cm7',   'C', 'minor', 'i7'],
        ['G7',    'C', 'minor', 'V7'],
        ['Abmaj7','C', 'minor', 'VImaj7'],
        ['Bb7',   'C', 'minor', 'bVII7'],   // subtonic is chromatic against harmonic minor
        ['Bdim7', 'C', 'minor', 'vii°7'],
        ['Dm7b5', 'C', 'minor', 'iiø7'],
    ])('%s in %s %s → %s', (chord, key, mode, expected) => {
        expect(getRomanNumeralForChord(chord, key, mode)).toBe(expected);
    });

    // Regression: `chordInfo.type` is prose, so numerals used to render as "Imajor seventh".
    it('never emits prose chord types', () => {
        for (const mode of modes) {
            for (const { roman } of getDiatonicChords('C', mode)) {
                expect(roman).not.toMatch(/seventh|major |minor |diminished/i);
            }
        }
    });
});

describe('numerals round-trip across every key and mode', () => {
    const failures: string[] = [];

    for (const key of rootNotes) {
        for (const mode of modes) {
            for (const { name } of getDiatonicChords(key, mode)) {
                const roman = getRomanNumeralForChord(name, key, mode);
                const back = roman ? getChordFromRomanNumeral(roman, key, mode) : null;
                if (!back || chromaSet(back) !== chromaSet(name)) {
                    failures.push(`${key} ${mode}: ${name} → "${roman}" → ${back}`);
                }
            }
        }
    }

    it('produces no round-trip failures', () => {
        expect(failures).toEqual([]);
    });

    it('covers every diatonic chord in all 12 keys and 7 modes', () => {
        expect(rootNotes.length * modes.length * 7).toBe(12 * 7 * 7);
    });
});
