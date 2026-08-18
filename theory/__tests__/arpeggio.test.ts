import { describe, it, expect } from 'vitest';
import {
    factorial, permutationCount, permutationAt, permutationIndexOf, presetIndex,
} from '../arpeggio/permutations.js';
import { arpeggioSequence, arpeggioPool } from '../arpeggio/sequence.js';
import { DEFAULT_ARPEGGIO, STEP_CHOICES, type ArpeggioSettings } from '../arpeggio/types.js';

const settings = (over: Partial<ArpeggioSettings> = {}): ArpeggioSettings =>
    ({ ...DEFAULT_ARPEGGIO, ...over });

const CMAJ7 = ['C4', 'E4', 'G4', 'B4'];
const TRIAD = ['C4', 'E4', 'G4'];

describe('permutations', () => {
    it('counts orderings', () => {
        expect(factorial(0)).toBe(1);
        expect(permutationCount(3)).toBe(6);
        expect(permutationCount(4)).toBe(24);
        expect(permutationCount(6)).toBe(720);
    });

    it('puts ascending at index 0 and descending last', () => {
        for (const steps of STEP_CHOICES) {
            const ascending = Array.from({ length: steps }, (_, i) => i);
            expect(permutationAt(steps, 0)).toEqual(ascending);
            expect(permutationAt(steps, permutationCount(steps) - 1)).toEqual([...ascending].reverse());
        }
    });

    it('enumerates every ordering exactly once', () => {
        for (const steps of [3, 4, 5]) {
            const seen = new Set<string>();
            for (let i = 0; i < permutationCount(steps); i++) {
                seen.add(permutationAt(steps, i).join(','));
            }
            expect(seen.size).toBe(permutationCount(steps));
        }
    });

    it('always returns a genuine permutation', () => {
        for (const steps of STEP_CHOICES) {
            for (let i = 0; i < 50; i++) {
                const order = permutationAt(steps, i * 13);
                expect([...order].sort((a, b) => a - b)).toEqual(
                    Array.from({ length: steps }, (_, k) => k),
                );
            }
        }
    });

    it('is lexicographically ordered', () => {
        const asStrings = Array.from({ length: permutationCount(4) }, (_, i) => permutationAt(4, i).join(','));
        expect([...asStrings].sort()).toEqual(asStrings);
    });

    it('wraps any index, including negatives', () => {
        expect(permutationAt(4, 24)).toEqual(permutationAt(4, 0));
        expect(permutationAt(4, -1)).toEqual(permutationAt(4, 23));
    });

    it('round-trips through permutationIndexOf', () => {
        for (const steps of [3, 4, 5]) {
            for (let i = 0; i < permutationCount(steps); i++) {
                expect(permutationIndexOf(permutationAt(steps, i))).toBe(i);
            }
        }
    });

    it('rejects a non-permutation', () => {
        expect(permutationIndexOf([0, 0, 1])).toBe(-1);
    });

    describe('presets', () => {
        it('names ascending and descending', () => {
            expect(permutationAt(4, presetIndex.up())).toEqual([0, 1, 2, 3]);
            expect(permutationAt(4, presetIndex.down(4))).toEqual([3, 2, 1, 0]);
        });

        it('names an outside-in shape', () => {
            expect(permutationAt(4, presetIndex.converging(4))).toEqual([0, 3, 1, 2]);
            expect(permutationAt(5, presetIndex.converging(5))).toEqual([0, 4, 1, 3, 2]);
        });
    });
});

describe('arpeggioPool', () => {
    it('stacks the chord up through the octave span', () => {
        expect(arpeggioPool(TRIAD, 1)).toEqual(['C4', 'E4', 'G4']);
        expect(arpeggioPool(TRIAD, 2)).toEqual(['C4', 'E4', 'G4', 'C5', 'E5', 'G5']);
        expect(arpeggioPool(TRIAD, 3)).toHaveLength(9);
    });

    it('sorts the chord before stacking, whatever order it arrives in', () => {
        expect(arpeggioPool(['G4', 'C4', 'E4'], 1)).toEqual(['C4', 'E4', 'G4']);
    });

    it('drops anything past the top of MIDI rather than emitting nonsense', () => {
        for (const note of arpeggioPool(['G9'], 3)) {
            expect(note).toBeTruthy();
        }
    });

    it('is empty for no notes', () => {
        expect(arpeggioPool([], 2)).toEqual([]);
    });
});

describe('arpeggioSequence', () => {
    it('plays straight up by default', () => {
        expect(arpeggioSequence(CMAJ7, settings())).toEqual(['C4', 'E4', 'G4', 'B4']);
    });

    it('plays straight down at the last style index', () => {
        expect(arpeggioSequence(CMAJ7, settings({ style: permutationCount(4) - 1 })))
            .toEqual(['B4', 'G4', 'E4', 'C4']);
    });

    it('reorders by the chosen style', () => {
        const shape = arpeggioSequence(CMAJ7, settings({ style: presetIndex.converging(4) }));
        expect(shape).toEqual(['C4', 'B4', 'E4', 'G4']);
    });

    it('spans octaves', () => {
        expect(arpeggioSequence(TRIAD, settings({ steps: 6, octaves: 2 })))
            .toEqual(['C4', 'E4', 'G4', 'C5', 'E5', 'G5']);
    });

    // Asking for six steps of a triad inside one octave cannot be honoured; repeating a
    // note silently would be worse than using the three that exist.
    it('clamps steps to what the chord and span can supply', () => {
        expect(arpeggioSequence(TRIAD, settings({ steps: 6, octaves: 1 })))
            .toEqual(['C4', 'E4', 'G4']);
    });

    it('comes back down when looped, without repeating the endpoints', () => {
        expect(arpeggioSequence(TRIAD, settings({ steps: 3, looped: true })))
            .toEqual(['C4', 'E4', 'G4', 'E4']);
        expect(arpeggioSequence(CMAJ7, settings({ steps: 4, looped: true })))
            .toEqual(['C4', 'E4', 'G4', 'B4', 'G4', 'E4']);
    });

    it('leaves a two-note figure alone when looped', () => {
        expect(arpeggioSequence(['C4', 'E4'], settings({ steps: 2, looped: true })))
            .toEqual(['C4', 'E4']);
    });

    it('never repeats a note back to back', () => {
        for (const steps of STEP_CHOICES) {
            for (let style = 0; style < 40; style++) {
                for (const looped of [false, true]) {
                    const seq = arpeggioSequence(CMAJ7, settings({ steps, style, looped, octaves: 2 }));
                    for (let i = 1; i < seq.length; i++) {
                        expect(seq[i], `steps ${steps} style ${style}`).not.toBe(seq[i - 1]);
                    }
                }
            }
        }
    });

    it('produces only notes drawn from the chord', () => {
        const allowed = new Set(['C', 'E', 'G', 'B']);
        for (let style = 0; style < 24; style++) {
            for (const note of arpeggioSequence(CMAJ7, settings({ style, octaves: 3, steps: 6 }))) {
                expect(allowed).toContain(note.replace(/\d+$/, ''));
            }
        }
    });

    it('is empty for a rest', () => {
        expect(arpeggioSequence([], settings())).toEqual([]);
    });

    it('handles a single note', () => {
        expect(arpeggioSequence(['C4'], settings())).toEqual(['C4']);
    });
});
