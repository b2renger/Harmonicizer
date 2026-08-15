import { describe, it, expect } from 'vitest';
import { parseRomanNumeral } from '../romanNumeral.js';

describe('parseRomanNumeral', () => {
    const cases: Array<[string, ReturnType<typeof parseRomanNumeral>]> = [
        ['I',      { degree: 0, accidental: 0,  case: 'upper', marker: '',  suffix: '' }],
        ['v',      { degree: 4, accidental: 0,  case: 'lower', marker: '',  suffix: '' }],
        ['V7',     { degree: 4, accidental: 0,  case: 'upper', marker: '',  suffix: '7' }],
        ['bVI',    { degree: 5, accidental: -1, case: 'upper', marker: '',  suffix: '' }],
        ['#iv°',   { degree: 3, accidental: 1,  case: 'lower', marker: '°', suffix: '' }],
        ['viiø7',  { degree: 6, accidental: 0,  case: 'lower', marker: 'ø', suffix: '7' }],
        ['III+',   { degree: 2, accidental: 0,  case: 'upper', marker: '+', suffix: '' }],
        ['vii°7',  { degree: 6, accidental: 0,  case: 'lower', marker: '°', suffix: '7' }],
        ['Imaj7',  { degree: 0, accidental: 0,  case: 'upper', marker: '',  suffix: 'maj7' }],
        ['bII',    { degree: 1, accidental: -1, case: 'upper', marker: '',  suffix: '' }],
        ['ii7',    { degree: 1, accidental: 0,  case: 'lower', marker: '',  suffix: '7' }],
        ['iv',     { degree: 3, accidental: 0,  case: 'lower', marker: '',  suffix: '' }],
        ['iii',    { degree: 2, accidental: 0,  case: 'lower', marker: '',  suffix: '' }],
        ['VII',    { degree: 6, accidental: 0,  case: 'upper', marker: '',  suffix: '' }],
    ];

    for (const [input, expected] of cases) {
        it(`parses "${input}"`, () => {
            expect(parseRomanNumeral(input)).toEqual(expected);
        });
    }

    // 'o' is the conventional ASCII stand-in for '°' and must normalize to it.
    // The bug this guards: theory/analysis.ts spelled the diminished supertonic
    // 'iio', which silently resolved to null and dropped the suggestion.
    it('accepts "o" as an ASCII alias for the diminished marker', () => {
        expect(parseRomanNumeral('iio')).toEqual({
            degree: 1, accidental: 0, case: 'lower', marker: '°', suffix: '',
        });
    });

    for (const bad of ['', 'H7', 'xyz', '8', 'b', '##V']) {
        it(`rejects "${bad}"`, () => {
            expect(parseRomanNumeral(bad)).toBeNull();
        });
    }
});
