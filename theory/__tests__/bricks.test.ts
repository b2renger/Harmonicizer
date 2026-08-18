import { describe, it, expect } from 'vitest';
import { Chord, Note } from 'tonal';
import { expandBrick } from '../bricks/expand.js';
import { BRICK_DICTIONARY, findBrick } from '../bricks/dictionary.js';
import { rootNotes } from '../chords.js';
import type { Brick } from '../bricks/types.js';

const brick = (name: string): Brick => {
    const b = findBrick(name);
    if (!b) throw new Error(`missing brick ${name}`);
    return b;
};

const symbols = (name: string, key: string, beats: number) =>
    expandBrick(brick(name), key, beats).map(c => c.symbol);

describe('expandBrick', () => {
    it('expands a flat brick in its written key', () => {
        expect(symbols('Perfect-Cadence', 'C', 8)).toEqual(['G7', 'C']);
        expect(symbols('Turnaround', 'C', 8)).toEqual(['Cmaj7', 'A7', 'Dm7', 'G7']);
    });

    it('transposes to the target key', () => {
        expect(symbols('Perfect-Cadence', 'Eb', 8)).toEqual(['Bb7', 'Eb']);
        expect(symbols('Minor-Approach', 'A', 8)).toEqual(['Bm7b5', 'E7']);
    });

    it('fills exactly the requested number of beats', () => {
        for (const b of BRICK_DICTIONARY) {
            for (const beats of [4, 8, 12, 16, 7]) {
                const total = expandBrick(b, 'C', beats).reduce((s, c) => s + c.durationBeats, 0);
                expect(total).toBeCloseTo(beats, 6);
            }
        }
    });

    it('divides beats by relative weight', () => {
        // Full-Cadence is [Straight-Approach weight 2, Cmaj7 weight 2], and the nested
        // approach splits its half evenly: 4 + 4 + 8 over 16 beats.
        const out = expandBrick(brick('Full-Cadence'), 'C', 16);
        expect(out.map(c => c.symbol)).toEqual(['Dm7', 'G7', 'Cmaj7']);
        expect(out.map(c => c.durationBeats)).toEqual([4, 4, 8]);
    });

    it('expands nested bricks and attributes each chord to its own brick', () => {
        const out = expandBrick(brick('Full-Cadence'), 'C', 16);
        expect(out.map(c => c.brick)).toEqual(['Straight-Approach', 'Straight-Approach', 'Full-Cadence']);
    });

    it('transposes a nested brick along with its parent', () => {
        expect(symbols('Full-Cadence', 'Eb', 16)).toEqual(['Fm7', 'Bb7', 'Ebmaj7']);
    });

    it('produces chords Tonal can parse, in every key', () => {
        for (const b of BRICK_DICTIONARY) {
            for (const key of rootNotes) {
                for (const { symbol } of expandBrick(b, key, b.defaultBeats)) {
                    expect(Chord.get(symbol).empty, `${b.name} in ${key}: ${symbol}`).toBe(false);
                }
            }
        }
    });

    it('preserves each brick’s interval structure under transposition', () => {
        for (const b of BRICK_DICTIONARY) {
            const inC = expandBrick(b, 'C', b.defaultBeats).map(c => Note.chroma(Chord.get(c.symbol).tonic!)!);
            for (const key of rootNotes) {
                const shifted = expandBrick(b, key, b.defaultBeats).map(c => Note.chroma(Chord.get(c.symbol).tonic!)!);
                const offset = (shifted[0] - inC[0] + 12) % 12;
                shifted.forEach((chroma, i) => {
                    expect((chroma - offset + 12) % 12, `${b.name} in ${key}`).toBe(inC[i]);
                });
            }
        }
    });

    it('refuses a self-referential brick rather than recursing forever', () => {
        const loop: Brick = {
            name: 'Loop', type: 'Cadence', mode: 'Major', key: 'C',
            blocks: [{ kind: 'brick', name: 'Loop', key: 'C', dur: 1 }],
            defaultBeats: 8, weight: 1, diatonic: true, description: '',
        };
        expect(() => expandBrick(loop, 'C', 8, () => loop)).not.toThrow();
        expect(expandBrick(loop, 'C', 8, () => loop)).toEqual([]);
    });

    it('drops sub-blocks referring to bricks that do not exist', () => {
        const dangling: Brick = {
            name: 'Dangling', type: 'Cadence', mode: 'Major', key: 'C',
            blocks: [
                { kind: 'brick', name: 'Nope', key: 'C', dur: 1 },
                { kind: 'chord', symbol: 'C', dur: 1 },
            ],
            defaultBeats: 8, weight: 1, diatonic: true, description: '',
        };
        const out = expandBrick(dangling, 'C', 8);
        expect(out.map(c => c.symbol)).toEqual(['C']);
        // The surviving chord still fills the whole span.
        expect(out[0].durationBeats).toBeCloseTo(8, 6);
    });

    it('returns nothing for a non-positive span', () => {
        expect(expandBrick(brick('Perfect-Cadence'), 'C', 0)).toEqual([]);
        expect(expandBrick(brick('Perfect-Cadence'), 'C', -4)).toEqual([]);
    });
});

describe('the dictionary itself', () => {
    it('has unique names', () => {
        const names = BRICK_DICTIONARY.map(b => b.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it('gives every brick a positive weight, length and description', () => {
        for (const b of BRICK_DICTIONARY) {
            expect(b.weight, b.name).toBeGreaterThan(0);
            expect(b.defaultBeats, b.name).toBeGreaterThan(0);
            expect(b.description, b.name).toBeTruthy();
            expect(b.blocks.length, b.name).toBeGreaterThan(0);
        }
    });

    it('writes every brick in C', () => {
        for (const b of BRICK_DICTIONARY) expect(b.key).toBe('C');
    });

    it('covers both modes and the cadence/approach/turnaround/dropback families', () => {
        expect(new Set(BRICK_DICTIONARY.map(b => b.mode))).toEqual(new Set(['Major', 'Minor']));
        for (const required of ['Cadence', 'Approach', 'Turnaround', 'Dropback']) {
            expect(BRICK_DICTIONARY.some(b => b.type === required), required).toBe(true);
        }
    });
});

describe('mode coverage', () => {
    // The grammar chooses a brick *type* and then a brick of that type. If a type exists in
    // only one mode, generating in the other mode is forced to borrow every time.
    it('offers every type in both modes', () => {
        const types = new Set(BRICK_DICTIONARY.map(b => b.type));
        for (const type of types) {
            for (const mode of ['Major', 'Minor'] as const) {
                const found = BRICK_DICTIONARY.some(b => b.type === type && b.mode === mode);
                expect(found, `${type} in ${mode}`).toBe(true);
            }
        }
    });
});
