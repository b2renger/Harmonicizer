import { describe, it, expect } from 'vitest';
import { getChordFromRomanNumeral } from '../harmony.js';

describe('getChordFromRomanNumeral', () => {
    // Regression cases. Each of these was wrong before the numeral parser landed:
    // the old implementation resolved a numeral to a scale-degree index and returned
    // whatever Mode.seventhChords held there, discarding the numeral's own quality.
    describe('minor-key dominants (the authentic-cadence bug)', () => {
        it('V is a major triad, not the diatonic minor v', () => {
            expect(getChordFromRomanNumeral('V', 'C', 'minor')).toBe('G');
        });
        it('V7 is a dominant seventh — previously returned Gm7', () => {
            expect(getChordFromRomanNumeral('V7', 'C', 'minor')).toBe('G7');
        });
        it('v7 is still available when a minor dominant is what is wanted', () => {
            expect(getChordFromRomanNumeral('v7', 'C', 'minor')).toBe('Gm7');
        });
    });

    describe('minor uses harmonic minor as the degree reference', () => {
        it('vii°7 is the leading-tone chord — previously returned Bb7', () => {
            expect(getChordFromRomanNumeral('vii°7', 'C', 'minor')).toBe('Bdim7');
        });
        it('the subtonic needs an explicit flat', () => {
            expect(getChordFromRomanNumeral('bVII7', 'C', 'minor')).toBe('Bb7');
        });
        it('other degrees match natural minor', () => {
            expect(getChordFromRomanNumeral('VI', 'C', 'minor')).toBe('Ab');
            expect(getChordFromRomanNumeral('iv', 'C', 'minor')).toBe('Fm');
            expect(getChordFromRomanNumeral('i', 'C', 'minor')).toBe('Cm');
        });
    });

    describe('triads are reachable', () => {
        it('IV is a plain triad — previously always returned FMaj7', () => {
            expect(getChordFromRomanNumeral('IV', 'C', 'major')).toBe('F');
        });
        it('sevenths require asking for them', () => {
            expect(getChordFromRomanNumeral('IVmaj7', 'C', 'major')).toBe('Fmaj7');
            expect(getChordFromRomanNumeral('ii7', 'C', 'major')).toBe('Dm7');
        });
    });

    describe('markers and accidentals', () => {
        it.each([
            ['I',      'C', 'major', 'C'],
            ['V7',     'C', 'major', 'G7'],
            ['viiø7',  'C', 'major', 'Bm7b5'],
            ['vii°',   'C', 'major', 'Bdim'],
            ['bII',    'C', 'major', 'Db'],
            ['bVI',    'C', 'major', 'Ab'],
            ['III+',   'C', 'minor', 'Ebaug'],
            ['ii°7',   'C', 'minor', 'Ddim7'],
        ])('%s in %s %s → %s', (roman, key, mode, expected) => {
            expect(getChordFromRomanNumeral(roman, key, mode)).toBe(expected);
        });
    });

    describe('other modes count degrees against their own scale', () => {
        // The characteristic altered degree of a mode is already in its scale, so it needs
        // no accidental: mixolydian's seventh is Bb and phrygian's second is Db outright.
        it.each([
            ['IV7',  'C', 'mixolydian', 'F7'],
            ['VII',  'C', 'mixolydian', 'Bb'],
            ['II7',  'C', 'lydian',     'D7'],
            ['II',   'C', 'phrygian',   'Db'],
        ])('%s in %s %s → %s', (roman, key, mode, expected) => {
            expect(getChordFromRomanNumeral(roman, key, mode)).toBe(expected);
        });

        // An accidental is applied on top of that scale degree, not on top of major.
        it.each([
            ['bVII', 'C', 'lydian',     'Bb'],   // lydian's seventh is B; flatten it
            ['bVII', 'C', 'mixolydian', 'Bbb'],  // already flat; flattening again is double-flat
        ])('%s in %s %s → %s', (roman, key, mode, expected) => {
            expect(getChordFromRomanNumeral(roman, key, mode)).toBe(expected);
        });
    });

    describe('rejects bad input', () => {
        it.each(['', 'H7', 'xyz', 'iio7q'])('returns null for "%s"', (bad) => {
            expect(getChordFromRomanNumeral(bad, 'C', 'major')).toBeNull();
        });
        it('returns null for an unknown mode', () => {
            expect(getChordFromRomanNumeral('I', 'C', 'not-a-mode')).toBeNull();
        });
    });
});
