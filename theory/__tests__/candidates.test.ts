import { describe, it, expect } from 'vitest';
import { Note } from 'tonal';
import { generateCandidates, CANDIDATE_CAP } from '../voicing/candidates.js';
import { DEFAULT_VOICING_PARAMS } from '../voicing/types.js';

const p = DEFAULT_VOICING_PARAMS;
const chromas = (midis: number[]) => new Set(midis.map(m => m % 12));

describe('generateCandidates', () => {
    it('returns nothing for an unparseable symbol', () => {
        expect(generateCandidates('not-a-chord', p)).toEqual([]);
        expect(generateCandidates('', p)).toEqual([]);
    });

    it('keeps every voice inside the register window', () => {
        for (const c of generateCandidates('Cmaj7', p)) {
            for (const midi of c.midis) {
                expect(midi).toBeGreaterThanOrEqual(p.low);
                expect(midi).toBeLessThanOrEqual(p.high);
            }
        }
    });

    it('respects the maximum spread', () => {
        for (const c of generateCandidates('Cmaj7', p)) {
            expect(Math.max(...c.midis) - Math.min(...c.midis)).toBeLessThanOrEqual(p.maxSpread);
        }
    });

    it('emits strictly ascending, distinct notes', () => {
        for (const c of generateCandidates('Cmaj7', p)) {
            const sorted = [...c.midis].sort((a, b) => a - b);
            expect(c.midis).toEqual(sorted);
            expect(new Set(c.midis).size).toBe(c.midis.length);
        }
    });

    it('offers every inversion of a triad', () => {
        // Across all candidates for C major, each chord tone should appear in the bass
        // of at least one of them.
        const basses = new Set(generateCandidates('C', p).map(c => c.midis[0] % 12));
        expect(basses).toEqual(new Set(['C', 'E', 'G'].map(n => Note.chroma(n))));
    });

    it('rootless candidates omit the root and shell candidates keep three notes', () => {
        const cands = generateCandidates('Cmaj7', p);
        const rootChroma = Note.chroma('C');

        const rootless = cands.filter(c => c.subset === 'rootless');
        expect(rootless.length).toBeGreaterThan(0);
        for (const c of rootless) expect(chromas(c.midis).has(rootChroma!)).toBe(false);

        const shell = cands.filter(c => c.subset === 'shell');
        expect(shell.length).toBeGreaterThan(0);
        // Shell is root, third and seventh: C, E, B.
        for (const c of shell) {
            expect(c.midis).toHaveLength(3);
            expect(chromas(c.midis)).toEqual(new Set(['C', 'E', 'B'].map(n => Note.chroma(n))));
        }
    });

    it('does not offer rootless or shell subsets for a plain triad', () => {
        const subsets = new Set(generateCandidates('C', p).map(c => c.subset));
        expect(subsets).toEqual(new Set(['full']));
    });

    it('stays within the candidate cap and is deterministic', () => {
        const a = generateCandidates('C13', p);
        const b = generateCandidates('C13', p);
        expect(a.length).toBeLessThanOrEqual(CANDIDATE_CAP);
        expect(a).toEqual(b);
    });

    // Regression: the cap used to truncate a concatenated list, so 'full' consumed every
    // slot for extended chords and a 13th could never be voiced rootless.
    it('keeps every subset represented even when the cap bites', () => {
        const cands = generateCandidates('C13', p);
        expect(cands.length).toBe(CANDIDATE_CAP);
        expect(new Set(cands.map(c => c.subset))).toEqual(new Set(['full', 'rootless', 'shell']));
    });

    it('produces a usable number of candidates for a seventh chord', () => {
        const n = generateCandidates('Cmaj7', p).length;
        expect(n).toBeGreaterThan(20);
        expect(n).toBeLessThanOrEqual(CANDIDATE_CAP);
    });
});
