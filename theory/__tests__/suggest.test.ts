import { describe, it, expect } from 'vitest';
import { suggestBricks, type SlotContext } from '../bricks/suggest.js';
import { BRICK_DICTIONARY } from '../bricks/dictionary.js';

const ctx = (over: Partial<SlotContext> = {}): SlotContext =>
    ({ prev: null, next: null, key: 'C', mode: 'major', ...over });

const scoreOf = (name: string, context: SlotContext): number => {
    const found = suggestBricks(context).find(s => s.brick.name === name);
    if (!found) throw new Error(`no suggestion for ${name}`);
    return found.score;
};

const rankOf = (name: string, context: SlotContext): number =>
    suggestBricks(context).findIndex(s => s.brick.name === name);

describe('suggestBricks', () => {
    it('scores every brick between 0 and 1', () => {
        for (const s of suggestBricks(ctx({ prev: 'Cmaj7', next: 'G7' }))) {
            expect(s.score).toBeGreaterThanOrEqual(0);
            expect(s.score).toBeLessThanOrEqual(1);
        }
    });

    it('is deterministic and covers the whole dictionary', () => {
        const a = suggestBricks(ctx({ prev: 'Cmaj7' }));
        const b = suggestBricks(ctx({ prev: 'Cmaj7' }));
        expect(a).toEqual(b);
        expect(a).toHaveLength(BRICK_DICTIONARY.length);
    });

    it('respects the limit', () => {
        expect(suggestBricks(ctx({ prev: 'Cmaj7' }), { limit: 4 })).toHaveLength(4);
    });

    it('gives every suggestion at least one reason', () => {
        for (const s of suggestBricks(ctx({ prev: 'Dm7', next: 'Cmaj7' }))) {
            expect(s.reasons.length).toBeGreaterThan(0);
        }
    });

    describe('looking back', () => {
        // Root motion of zero is the weakest move, so a brick that simply restates the
        // chord before it must not be the best answer.
        it('does not lead with a brick that repeats the previous chord', () => {
            const best = suggestBricks(ctx({ prev: 'Cmaj7', next: 'Cmaj7' }))[0];
            expect(best.chords[0]).not.toBe('Cmaj7');
        });

        it('prefers a predominant after the tonic', () => {
            const context = ctx({ prev: 'Cmaj7', next: 'Cmaj7' });
            expect(scoreOf('Straight-Approach', context))
                .toBeGreaterThan(scoreOf('Dropback', context));
        });

        it('rates the same brick higher after a chord it idiomatically follows', () => {
            // ii7 to V7 is a textbook move; V7 to V7 is not.
            expect(scoreOf('Perfect-Cadence', ctx({ prev: 'Dm7', next: 'Cmaj7' })))
                .toBeGreaterThan(scoreOf('Perfect-Cadence', ctx({ prev: 'G7', next: 'Cmaj7' })));
        });
    });

    describe('looking ahead', () => {
        it('rates a brick ending on the dominant higher when the tonic follows', () => {
            expect(scoreOf('Straight-Approach', ctx({ prev: 'Cmaj7', next: 'Cmaj7' })))
                .toBeGreaterThan(scoreOf('Straight-Approach', ctx({ prev: 'Cmaj7', next: 'G7' })));
        });

        it('changes its ranking when only the following chord changes', () => {
            const toTonic = suggestBricks(ctx({ prev: 'Cmaj7', next: 'Cmaj7' })).map(s => s.brick.name);
            const toDominant = suggestBricks(ctx({ prev: 'Cmaj7', next: 'G7' })).map(s => s.brick.name);
            expect(toTonic).not.toEqual(toDominant);
        });

        it('explains the forward fit in its reasons', () => {
            const s = suggestBricks(ctx({ prev: 'Cmaj7', next: 'Cmaj7' }))
                .find(x => x.brick.name === 'Straight-Approach')!;
            expect(s.reasons.join(' ')).toContain('leads into Cmaj7');
        });
    });

    describe('with an empty slot at the edges', () => {
        it('favours opening bricks when nothing precedes', () => {
            expect(rankOf('Opening-Vamp', ctx())).toBeLessThan(4);
        });

        it('favours bricks that land home when nothing follows', () => {
            const context = ctx({ prev: 'Dm7' });
            expect(scoreOf('Perfect-Cadence', context))
                .toBeGreaterThan(scoreOf('Straight-Approach', context));
        });
    });

    describe('key and mode', () => {
        it('prefers minor bricks in a minor key', () => {
            const context = ctx({ key: 'C', mode: 'minor', prev: 'Fm7', next: 'Cm7' });
            expect(scoreOf('Minor-Cadence', context))
                .toBeGreaterThan(scoreOf('Perfect-Cadence', context));
        });

        it('marks bricks borrowed from the other mode', () => {
            const s = suggestBricks(ctx({ key: 'C', mode: 'minor' }))
                .find(x => x.brick.mode === 'Major')!;
            expect(s.reasons.join(' ')).toContain('borrowed from major');
        });

        it('penalises leaving the key, all else equal', () => {
            const context = ctx({ prev: 'Dm7', next: 'Cmaj7' });
            expect(scoreOf('Perfect-Cadence', context))
                .toBeGreaterThan(scoreOf('Tritone-Cadence', context));
        });

        it('expands suggestions into the requested key', () => {
            const s = suggestBricks(ctx({ key: 'Eb' })).find(x => x.brick.name === 'Perfect-Cadence')!;
            expect(s.chords).toEqual(['Bb7', 'Eb']);
        });
    });

    it('survives an unparseable neighbour', () => {
        const out = suggestBricks(ctx({ prev: 'not-a-chord', next: 'also-nonsense' }));
        expect(out).toHaveLength(BRICK_DICTIONARY.length);
        for (const s of out) expect(Number.isFinite(s.score)).toBe(true);
    });
});

describe('tie-breaking', () => {
    it('separates bricks the context cannot, by prominence rather than array order', () => {
        // With no neighbours, the join scores are coarse and many bricks land together.
        const scores = suggestBricks(ctx()).map(s => s.score);
        const distinct = new Set(scores.map(n => n.toFixed(6)));
        expect(distinct.size).toBeGreaterThan(3);
    });

    it('prefers the more prominent of two otherwise equal bricks', () => {
        const context = ctx();
        // Both land on the tonic and stay in key; Perfect-Cadence is the commoner device.
        expect(scoreOf('Perfect-Cadence', context))
            .toBeGreaterThan(scoreOf('Plagal-Cadence', context));
    });
});
