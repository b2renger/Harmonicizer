/**
 * Harmonic "bricks": named, composable units of harmony.
 *
 * This follows Impro-Visor's brick dictionary, which implements Conrad Cork's
 * *Harmony with LEGO Bricks*. A brick is five things — a name, a type, a mode, a key, and
 * an ordered list of sub-blocks that are either literal chords or other bricks.
 *
 * Two deliberate departures from Impro-Visor's format:
 *
 *  - **No `*` duration.** Theirs means "absorb the remainder", which is unambiguous in a
 *    fixed-length leadsheet but not when a brick must stretch to fill an arbitrary span.
 *    Durations here are pure relative weights, which express the same shapes ([1, 1, 2] is
 *    two half-bar chords then a whole-bar tonic) and are unambiguous at any length.
 *  - **Chords are written absolutely, in C.** Transposition happens at expansion time.
 */

export type BrickType =
    | 'Opening'
    | 'Approach'
    | 'Cadence'
    | 'Turnaround'
    | 'Dropback'
    | 'OnOff'
    | 'Ending';

export type SubBlock =
    /** A literal chord, spelled in the brick's key. `dur` is a relative weight. */
    | { kind: 'chord'; symbol: string; dur: number }
    /** Another brick, in a key relative to this one's. `dur` is a relative weight. */
    | { kind: 'brick'; name: string; key: string; dur: number };

export type Brick = {
    name: string;
    type: BrickType;
    mode: 'Major' | 'Minor';
    /** The key the sub-blocks are written in. Every dictionary entry uses 'C'. */
    key: string;
    blocks: SubBlock[];
    /** Natural length in beats, used when a brick is inserted on its own. */
    defaultBeats: number;
    /**
     * Base selection weight for the generator. Derived from Impro-Visor's parse costs,
     * inverted: they use cost to find the cheapest *analysis* of a progression, we use
     * the inverse to bias *generation*.
     */
    weight: number;
    /** False means the brick leaves the key and needs the chromaticism dial open. */
    diatonic: boolean;
    /** One line, shown in the UI. */
    description: string;
};

/** A chord produced by expanding a brick. */
export type ExpandedChord = {
    symbol: string;
    durationBeats: number;
    /** The brick this chord came from, for display and later analysis. */
    brick: string;
};

/** Guards against a brick that references itself, directly or through others. */
export const MAX_BRICK_DEPTH = 3;
