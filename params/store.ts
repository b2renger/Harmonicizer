/**
 * The live parameter bus.
 *
 * Every value is normalized to 0..1 and addressed by name, so that a screen dial, a MIDI
 * CC, an OSC message or a sensor reading are all the same kind of write. The store lives
 * outside React deliberately: an external controller can `set` into it without going
 * through a component.
 */

export type ParamName =
    // Harmony generation — inert until the brick grammar lands (design step 3).
    | 'brightness'
    | 'chromaticism'
    | 'modulationRate'
    | 'harmonicRhythm'
    | 'cadencePressure'
    // Voicing — wired.
    | 'voicingOpenness'
    | 'register'
    | 'rootless'
    | 'motionWeight'
    // Rhythm — inert until the style patterns land (design step 5).
    | 'density'
    | 'swing';

export type Params = Record<ParamName, number>;

/**
 * Defaults chosen so that the mapped voicing parameters equal DEFAULT_VOICING_PARAMS.
 * Turning nothing changes nothing.
 */
export const DEFAULT_PARAMS: Params = {
    brightness: 0.5,
    chromaticism: 0.2,
    modulationRate: 0.1,
    harmonicRhythm: 0.5,
    cadencePressure: 0.5,

    voicingOpenness: 0.5,
    register: 0.5,
    rootless: 0,
    motionWeight: 0.5,

    density: 0.5,
    swing: 0,
};

/**
 * The parameters that currently drive something audible.
 *
 * The rest of `ParamName` is declared so the contract is stable for MIDI/OSC mapping, but
 * they are not surfaced as dials: a control that visibly moves and changes nothing reads
 * as a bug. They are added here as each engine stage lands.
 */
export const WIRED_PARAMS: ParamName[] = [
    'voicingOpenness',
    'register',
    'rootless',
    'motionWeight',
];

export const PARAM_LABELS: Record<ParamName, string> = {
    brightness: 'Brightness',
    chromaticism: 'Chromaticism',
    modulationRate: 'Modulation',
    harmonicRhythm: 'Harmonic rhythm',
    cadencePressure: 'Resolve',
    voicingOpenness: 'Openness',
    register: 'Register',
    rootless: 'Rootless',
    motionWeight: 'Voice leading',
    density: 'Density',
    swing: 'Swing',
};

const clamp01 = (n: number): number => {
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
};

/** Clamps every value to 0..1 and fills anything missing from the defaults. */
export const clampParams = (partial: Partial<Record<string, unknown>> | null | undefined): Params => {
    const out = { ...DEFAULT_PARAMS };
    if (!partial) return out;

    for (const name of Object.keys(DEFAULT_PARAMS) as ParamName[]) {
        const value = partial[name];
        if (typeof value === 'number') out[name] = clamp01(value);
    }
    return out;
};

type Listener = () => void;

/** A minimal observable store: one immutable snapshot, replaced on write. */
export class ParamStore {
    private snapshot: Params;
    private listeners = new Set<Listener>();

    constructor(initial: Partial<Params> = {}) {
        this.snapshot = clampParams(initial);
        // Bound so they can be handed straight to useSyncExternalStore.
        this.get = this.get.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    /** The current snapshot. Stable by reference until something changes. */
    get(): Params {
        return this.snapshot;
    }

    set(name: ParamName, value: number): void {
        const next = clamp01(value);
        if (this.snapshot[name] === next) return;   // no-op writes must not notify
        this.snapshot = { ...this.snapshot, [name]: next };
        this.emit();
    }

    setAll(partial: Partial<Record<string, unknown>>): void {
        const next = clampParams({ ...this.snapshot, ...partial });
        if ((Object.keys(next) as ParamName[]).every(k => next[k] === this.snapshot[k])) return;
        this.snapshot = next;
        this.emit();
    }

    reset(): void {
        this.setAll(DEFAULT_PARAMS);
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    private emit(): void {
        for (const listener of this.listeners) listener();
    }
}

/** The application-wide bus. */
export const paramStore = new ParamStore();
