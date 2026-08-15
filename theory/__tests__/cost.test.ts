import { describe, it, expect } from 'vitest';
import { voicingCost } from '../voicing/cost.js';
import { DEFAULT_VOICING_PARAMS, type VoicingParams } from '../voicing/types.js';

const p = DEFAULT_VOICING_PARAMS;
const withParams = (o: Partial<VoicingParams>): VoicingParams => ({ ...p, ...o });

// C major triads at various placements
const cMid = [60, 64, 67];
const cHigh = [72, 76, 79];

describe('voicingCost', () => {
    it('is finite with no previous voicing', () => {
        const cost = voicingCost(cMid, null, p);
        expect(Number.isFinite(cost)).toBe(true);
        expect(cost).toBeGreaterThanOrEqual(0);
    });

    it('charges no motion for repeating the same voicing', () => {
        const onlyMotion = withParams({ wRange: 0, wSpread: 0, wInterval: 0, wOpen: 0, wTop: 0 });
        expect(voicingCost(cMid, cMid, onlyMotion)).toBe(0);
    });

    it('charges more motion the further the voicing moves', () => {
        const onlyMotion = withParams({ wRange: 0, wSpread: 0, wInterval: 0, wOpen: 0, wTop: 0 });
        const near = voicingCost([60, 64, 67], [59, 62, 67], onlyMotion);
        const far = voicingCost([72, 76, 79], [59, 62, 67], onlyMotion);
        expect(far).toBeGreaterThan(near);
    });

    it('penalises voices outside the register window', () => {
        const onlyRange = withParams({ wMotion: 0, wSpread: 0, wInterval: 0, wOpen: 0, wTop: 0 });
        const inside = voicingCost(cMid, null, onlyRange);
        const below = voicingCost([36, 40, 43], null, onlyRange);
        expect(inside).toBe(0);
        expect(below).toBeGreaterThan(0);
    });

    it('penalises close intervals low down but not high up', () => {
        const onlyInterval = withParams({ wMotion: 0, wRange: 0, wSpread: 0, wOpen: 0, wTop: 0 });
        // A major second at the bottom of the range vs the same interval an octave up.
        const low = voicingCost([52, 54, 59], null, onlyInterval);
        const high = voicingCost([64, 66, 71], null, onlyInterval);
        expect(low).toBeGreaterThan(0);
        expect(high).toBe(0);
    });

    it('prefers a spread near the target', () => {
        const onlyOpen = withParams({ wMotion: 0, wRange: 0, wSpread: 0, wInterval: 0, wTop: 0 });
        const atTarget = voicingCost([60, 67, 60 + p.targetSpread], null, onlyOpen);
        const cramped = voicingCost([60, 62, 64], null, onlyOpen);
        expect(atTarget).toBeLessThan(cramped);
    });

    it('penalises the top voice leaping', () => {
        const onlyTop = withParams({ wMotion: 0, wRange: 0, wSpread: 0, wInterval: 0, wOpen: 0 });
        const held = voicingCost([60, 64, 67], [57, 60, 67], onlyTop);
        const leapt = voicingCost([60, 64, 79], [57, 60, 67], onlyTop);
        expect(leapt).toBeGreaterThan(held);
    });

    it('handles an empty voicing without throwing', () => {
        expect(Number.isFinite(voicingCost([], null, p))).toBe(true);
        expect(Number.isFinite(voicingCost([], cMid, p))).toBe(true);
        expect(Number.isFinite(voicingCost(cHigh, [], p))).toBe(true);
    });
});
