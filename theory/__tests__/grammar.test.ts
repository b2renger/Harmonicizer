import { describe, it, expect } from 'vitest';
import { Chord } from 'tonal';
import { generate, selectType, selectBrick, selectKey } from '../grammar/generate.js';
import { TYPE_TRANSITIONS, TERMINATING_TYPES, BRICK_TYPES } from '../grammar/transitions.js';
import { BRICK_DICTIONARY } from '../bricks/dictionary.js';
import { DEFAULT_PARAMS, type Params } from '../../params/store.js';
import { rootNotes } from '../chords.js';
import type { GeneratorState } from '../grammar/types.js';

/** Deterministic RNG (mulberry32), so every assertion below is reproducible. */
const seeded = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const p = (over: Partial<Params> = {}): Params => ({ ...DEFAULT_PARAMS, ...over });
const state = (over: Partial<GeneratorState> = {}): GeneratorState =>
    ({ key: 'C', mode: 'Major', lastType: null, ...over });

const runs = (n: number, fn: (rng: () => number, i: number) => void) => {
    for (let i = 0; i < n; i++) fn(seeded(i * 7919 + 13), i);
};

describe('the transition matrix', () => {
    it('gives every state somewhere to go', () => {
        for (const [from, row] of Object.entries(TYPE_TRANSITIONS)) {
            const total = Object.values(row).reduce((s, w) => s + (w ?? 0), 0);
            expect(total, `row ${from}`).toBeGreaterThan(0);
        }
    });

    it('only names real brick types', () => {
        for (const [from, row] of Object.entries(TYPE_TRANSITIONS)) {
            for (const type of Object.keys(row)) {
                expect(BRICK_TYPES, `${from} -> ${type}`).toContain(type);
            }
        }
    });

    it('can reach a terminating type from every state', () => {
        // Either directly, or via one hop. Anything further would be a dead end in practice.
        for (const from of Object.keys(TYPE_TRANSITIONS) as Array<keyof typeof TYPE_TRANSITIONS>) {
            const row = TYPE_TRANSITIONS[from];
            const direct = TERMINATING_TYPES.some(t => (row[t] ?? 0) > 0);
            const viaOneHop = Object.keys(row).some(next =>
                TERMINATING_TYPES.some(t => (TYPE_TRANSITIONS[next as keyof typeof TYPE_TRANSITIONS][t] ?? 0) > 0));
            expect(direct || viaOneHop, `row ${from}`).toBe(true);
        }
    });

    it('has a brick available for every type it can select', () => {
        const available = new Set(BRICK_DICTIONARY.map(b => b.type));
        for (const row of Object.values(TYPE_TRANSITIONS)) {
            for (const type of Object.keys(row)) expect(available).toContain(type);
        }
    });
});

describe('selectType', () => {
    it('leans toward resolution as cadence pressure rises', () => {
        const countCadences = (pressure: number) => {
            let cadences = 0;
            runs(300, rng => {
                const type = selectType('Dropback', p({ cadencePressure: pressure }), rng);
                if (type && TERMINATING_TYPES.includes(type)) cadences++;
            });
            return cadences;
        };
        expect(countCadences(1)).toBeGreaterThan(countCadences(0));
    });

    it('returns only terminating types when forced to end', () => {
        runs(100, rng => {
            const type = selectType('Dropback', p(), rng, true);
            expect(type && TERMINATING_TYPES.includes(type)).toBe(true);
        });
    });
});

describe('selectBrick', () => {
    it('excludes bricks that leave the key when chromaticism is closed', () => {
        runs(200, rng => {
            const brick = selectBrick('Cadence', state(), p({ chromaticism: 0 }), rng);
            if (brick) expect(brick.diatonic).toBe(true);
        });
    });

    it('admits them when chromaticism is open', () => {
        let chromatic = 0;
        runs(300, rng => {
            const brick = selectBrick('Cadence', state(), p({ chromaticism: 1 }), rng);
            if (brick && !brick.diatonic) chromatic++;
        });
        expect(chromatic).toBeGreaterThan(0);
    });

    it('mostly picks bricks of the current mode', () => {
        let minor = 0;
        let total = 0;
        runs(300, rng => {
            const brick = selectBrick('Cadence', state({ mode: 'Minor' }), p(), rng);
            if (brick) { total++; if (brick.mode === 'Minor') minor++; }
        });
        expect(minor / total).toBeGreaterThan(0.6);
    });

    it('returns null for a type nothing satisfies', () => {
        expect(selectBrick('Cadence', state(), p(), seeded(1), [])).toBeNull();
    });
});

describe('selectKey', () => {
    it('never modulates at rate 0', () => {
        runs(200, rng => {
            expect(selectKey(state(), p({ modulationRate: 0 }), rng)).toBe('C');
        });
    });

    it('usually modulates at rate 1', () => {
        let moved = 0;
        runs(200, rng => {
            if (selectKey(state(), p({ modulationRate: 1 }), rng) !== 'C') moved++;
        });
        expect(moved).toBeGreaterThan(100);
    });

    it('only ever lands on a key the app knows', () => {
        runs(400, rng => {
            expect(rootNotes).toContain(selectKey(state(), p({ modulationRate: 1 }), rng));
        });
    });
});

describe('generate', () => {
    it('fills the requested beats exactly', () => {
        for (const beats of [8, 16, 24, 32, 12]) {
            runs(30, rng => {
                const { chords } = generate({ beats, key: 'C', mode: 'major' }, p(), rng);
                const total = chords.reduce((s, c) => s + c.durationBeats, 0);
                expect(total).toBeCloseTo(beats, 6);
            });
        }
    });

    it('always terminates and always produces chords', () => {
        runs(100, rng => {
            const { chords } = generate({ beats: 32, key: 'C', mode: 'major' }, p(), rng);
            expect(chords.length).toBeGreaterThan(0);
        });
    });

    // The cadence reserve is held back from the free loop, so this is a guarantee rather
    // than a tendency: a long brick can no longer eat the beats meant for the resolution.
    it('always ends on a resolution', () => {
        runs(80, rng => {
            const { bricks } = generate({ beats: 32, key: 'C', mode: 'major' }, p(), rng);
            const last = bricks[bricks.length - 1];
            expect(last, 'produced no bricks').toBeDefined();
            expect(TERMINATING_TYPES, bricks.map(b => b.name).join(' -> ')).toContain(last.type);
        });
    });

    it('produces chords Tonal can parse', () => {
        runs(60, rng => {
            for (const c of generate({ beats: 32, key: 'C', mode: 'major' }, p(), rng).chords) {
                expect(Chord.get(c.symbol).empty, c.symbol).toBe(false);
            }
        });
    });

    it('is reproducible for a given seed', () => {
        const once = generate({ beats: 32, key: 'C', mode: 'major' }, p(), seeded(42));
        const twice = generate({ beats: 32, key: 'C', mode: 'major' }, p(), seeded(42));
        expect(once).toEqual(twice);
    });

    // The point of the whole exercise: generateRandomProgression could manage two outcomes.
    it('produces many distinct progressions', () => {
        const seen = new Set<string>();
        runs(80, rng => {
            const { chords } = generate({ beats: 32, key: 'C', mode: 'major' }, p(), rng);
            seen.add(chords.map(c => c.symbol).join(' '));
        });
        expect(seen.size).toBeGreaterThan(40);
    });

    it('stays diatonic when chromaticism is closed and modulation is off', () => {
        runs(40, rng => {
            const { bricks } = generate(
                { beats: 32, key: 'C', mode: 'major' },
                p({ chromaticism: 0, modulationRate: 0 }),
                rng,
            );
            for (const b of bricks) expect(b.key).toBe('C');
        });
    });

    it('moves through keys when modulation is open', () => {
        let modulated = 0;
        runs(40, rng => {
            const { bricks } = generate(
                { beats: 48, key: 'C', mode: 'major' },
                p({ modulationRate: 0.8 }),
                rng,
            );
            if (new Set(bricks.map(b => b.key)).size > 1) modulated++;
        });
        expect(modulated).toBeGreaterThan(30);
    });

    it('moves harmony faster at high harmonic rhythm', () => {
        const countChords = (rhythm: number) => {
            let total = 0;
            runs(40, rng => {
                total += generate({ beats: 32, key: 'C', mode: 'major' }, p({ harmonicRhythm: rhythm }), rng).chords.length;
            });
            return total;
        };
        expect(countChords(1)).toBeGreaterThan(countChords(0));
    });

    it('respects a minor key', () => {
        // Aggregated across runs on purpose. A single run places only two or three bricks,
        // so a per-run ratio is dominated by whether one borrowing happened to occur; the
        // claim worth testing is that minor bricks dominate overall.
        let minor = 0;
        let total = 0;
        runs(40, rng => {
            for (const b of generate({ beats: 32, key: 'C', mode: 'minor' }, p(), rng).bricks) {
                total++;
                if (BRICK_DICTIONARY.find(x => x.name === b.name)?.mode === 'Minor') minor++;
            }
        });
        expect(total).toBeGreaterThan(80);
        expect(minor / total).toBeGreaterThan(0.7);
    });

    it('returns nothing rather than throwing for a zero-length request', () => {
        expect(generate({ beats: 0, key: 'C', mode: 'major' }, p(), seeded(1)).chords).toEqual([]);
    });
});

describe('output hygiene', () => {
    // Bricks butt against each other, so a turnaround ending on G7 followed by a cadence
    // starting on G7 used to emit "G7 G7" — one held chord written as two.
    it('never emits the same chord twice in a row', () => {
        runs(80, rng => {
            const { chords } = generate({ beats: 32, key: 'C', mode: 'major' }, p(), rng);
            for (let i = 1; i < chords.length; i++) {
                expect(chords[i].symbol, chords.map(c => c.symbol).join(' '))
                    .not.toBe(chords[i - 1].symbol);
            }
        });
    });

    // Borrowing from the parallel mode needs an accidental, so a closed chromaticism dial
    // must keep the harmony in one mode rather than drifting major to minor mid-phrase.
    it('stays in one mode when chromaticism is closed', () => {
        for (const [mode, expected] of [['major', 'Major'], ['minor', 'Minor']] as const) {
            runs(40, rng => {
                const { bricks } = generate(
                    { beats: 32, key: 'C', mode },
                    p({ chromaticism: 0, modulationRate: 0 }),
                    rng,
                );
                for (const b of bricks) {
                    const found = BRICK_DICTIONARY.find(x => x.name === b.name);
                    expect(found?.mode, `${b.name} in ${mode}`).toBe(expected);
                }
            });
        }
    });

    it('still borrows when chromaticism is open', () => {
        let borrowed = 0;
        runs(60, rng => {
            const { bricks } = generate({ beats: 32, key: 'C', mode: 'major' }, p({ chromaticism: 1 }), rng);
            if (bricks.some(b => BRICK_DICTIONARY.find(x => x.name === b.name)?.mode === 'Minor')) borrowed++;
        });
        expect(borrowed).toBeGreaterThan(0);
    });
});
