import { describe, it, expect, vi } from 'vitest';
import {
    ParamStore, clampParams, DEFAULT_PARAMS, WIRED_PARAMS, HARMONY_PARAMS, VOICING_PARAMS,
    PARAM_LABELS, type ParamName,
} from '../store.js';
import { paramsToVoicing } from '../toVoicing.js';
import { DEFAULT_VOICING_PARAMS } from '../../theory/voicing/types.js';

describe('clampParams', () => {
    it('fills missing values from the defaults', () => {
        expect(clampParams({})).toEqual(DEFAULT_PARAMS);
        expect(clampParams(null)).toEqual(DEFAULT_PARAMS);
    });

    it('clamps to 0..1 and rejects non-numbers', () => {
        const p = clampParams({ register: 5, rootless: -2, swing: NaN, brightness: 'loud' });
        expect(p.register).toBe(1);
        expect(p.rootless).toBe(0);
        expect(p.swing).toBe(0);
        expect(p.brightness).toBe(DEFAULT_PARAMS.brightness);
    });

    it('ignores unknown keys', () => {
        expect(clampParams({ nonsense: 0.5 })).toEqual(DEFAULT_PARAMS);
    });
});

describe('ParamStore', () => {
    it('returns a reference-stable snapshot until something changes', () => {
        const store = new ParamStore();
        expect(store.get()).toBe(store.get());

        const before = store.get();
        store.set('register', 0.9);
        expect(store.get()).not.toBe(before);
    });

    it('notifies subscribers on change', () => {
        const store = new ParamStore();
        const listener = vi.fn();
        store.subscribe(listener);

        store.set('register', 0.9);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not notify when the value is unchanged', () => {
        const store = new ParamStore();
        const listener = vi.fn();
        store.subscribe(listener);

        store.set('register', DEFAULT_PARAMS.register);
        expect(listener).not.toHaveBeenCalled();
    });

    it('stops notifying after unsubscribe', () => {
        const store = new ParamStore();
        const listener = vi.fn();
        store.subscribe(listener)();

        store.set('register', 0.9);
        expect(listener).not.toHaveBeenCalled();
    });

    it('clamps on write', () => {
        const store = new ParamStore();
        store.set('rootless', 42);
        expect(store.get().rootless).toBe(1);
    });

    it('round-trips through setAll and reset', () => {
        const store = new ParamStore();
        store.setAll({ register: 0.8, rootless: 1 });
        expect(store.get().register).toBe(0.8);

        store.reset();
        expect(store.get()).toEqual(DEFAULT_PARAMS);
    });

    it('exposes get and subscribe as bound methods, for useSyncExternalStore', () => {
        const store = new ParamStore();
        const { get, subscribe } = store;
        expect(() => subscribe(() => {})).not.toThrow();
        expect(get()).toEqual(DEFAULT_PARAMS);
    });
});

describe('paramsToVoicing', () => {
    // The point of the chosen ranges: adding dials must not change how anything sounds.
    it('reproduces the voicing defaults from the parameter defaults', () => {
        expect(paramsToVoicing(DEFAULT_PARAMS)).toEqual(DEFAULT_VOICING_PARAMS);
    });

    it('opens and closes the voicing', () => {
        const closed = paramsToVoicing({ ...DEFAULT_PARAMS, voicingOpenness: 0 });
        const open = paramsToVoicing({ ...DEFAULT_PARAMS, voicingOpenness: 1 });
        expect(closed.targetSpread).toBeLessThan(open.targetSpread);
    });

    it('shifts the register window without changing its width', () => {
        const low = paramsToVoicing({ ...DEFAULT_PARAMS, register: 0 });
        const high = paramsToVoicing({ ...DEFAULT_PARAMS, register: 1 });
        expect(low.low).toBeLessThan(high.low);
        expect(high.low - low.low).toBe(high.high - low.high);
        expect(low.high - low.low).toBe(high.high - high.low);
    });

    it('passes rootless through and scales the voice-leading weight', () => {
        expect(paramsToVoicing({ ...DEFAULT_PARAMS, rootless: 1 }).preferRootless).toBe(1);
        expect(paramsToVoicing({ ...DEFAULT_PARAMS, motionWeight: 0 }).wMotion).toBe(0);
        expect(paramsToVoicing({ ...DEFAULT_PARAMS, motionWeight: 1 }).wMotion)
            .toBeGreaterThan(DEFAULT_VOICING_PARAMS.wMotion);
    });

    it('leaves the fixed "do not sound bad" weights alone', () => {
        const extreme = paramsToVoicing({ ...DEFAULT_PARAMS, register: 1, voicingOpenness: 1, motionWeight: 1 });
        expect(extreme.wInterval).toBe(DEFAULT_VOICING_PARAMS.wInterval);
        expect(extreme.wSpread).toBe(DEFAULT_VOICING_PARAMS.wSpread);
        expect(extreme.wTop).toBe(DEFAULT_VOICING_PARAMS.wTop);
    });
});

describe('parameter surface', () => {
    it('surfaces the harmony and voicing groups, and nothing else', () => {
        expect(HARMONY_PARAMS).toEqual([
            'brightness', 'chromaticism', 'modulationRate', 'harmonicRhythm', 'cadencePressure',
        ]);
        expect(VOICING_PARAMS).toEqual(['voicingOpenness', 'register', 'rootless', 'motionWeight']);
        expect(WIRED_PARAMS).toEqual([...HARMONY_PARAMS, ...VOICING_PARAMS]);
    });

    it('keeps the groups disjoint', () => {
        for (const name of HARMONY_PARAMS) expect(VOICING_PARAMS).not.toContain(name);
    });

    // These need the rhythm patterns of design step 5; surfacing them now would give the
    // user a dial that moves and does nothing.
    it('does not yet surface the rhythm dials', () => {
        expect(WIRED_PARAMS).not.toContain('density');
        expect(WIRED_PARAMS).not.toContain('swing');
    });

    it('labels every declared parameter, wired or not', () => {
        for (const name of Object.keys(DEFAULT_PARAMS) as ParamName[]) {
            expect(PARAM_LABELS[name]).toBeTruthy();
        }
    });
});
