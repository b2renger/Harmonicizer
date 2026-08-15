import { describe, it, expect } from 'vitest';
import { Chord } from 'tonal';
import { getDiatonicChords } from '../harmony.js';

describe('test harness', () => {
    it('can import tonal', () => {
        expect(Chord.get('Cmaj7').notes).toEqual(['C', 'E', 'G', 'B']);
    });

    // The project imports .ts modules through .js specifiers (bundler resolution).
    // This asserts Vitest resolves them the same way Vite does.
    it('resolves .js specifiers to .ts sources', () => {
        const chords = getDiatonicChords('C', 'major');
        expect(chords).toHaveLength(7);
        expect(chords[0].name).toBe('Cmaj7');
    });
});
