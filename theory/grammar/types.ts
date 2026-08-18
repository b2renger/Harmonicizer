import type { BrickType, ExpandedChord } from '../bricks/types.js';

/**
 * The harmony generator: a two-level weighted grammar over the brick dictionary.
 *
 * Level one chooses what *kind* of gesture comes next, as a first-order Markov chain over
 * brick types. Level two chooses which brick of that kind, weighted by `brick.weight`.
 * Duration is consumed rather than divided — the loop subtracts each brick's length from a
 * budget — which is how cadences land on bar lines instead of drifting.
 *
 * This follows the semantics of Impro-Visor's melody grammars, whose productions recurse on
 * a remaining duration, without their Lisp.
 */

/** What the generator carries between bricks. */
export type GeneratorState = {
    key: string;
    mode: 'Major' | 'Minor';
    lastType: BrickType | null;
};

export type GenerateRequest = {
    /** Beats to fill, exactly. */
    beats: number;
    key: string;
    mode: string;
};

/** A generated chord, tagged with the key it was generated in. */
export type GeneratedChord = ExpandedChord & { key: string };

export type GenerateResult = {
    chords: GeneratedChord[];
    /** The bricks chosen, in order — for display and for explaining the output. */
    bricks: Array<{ name: string; type: BrickType; key: string }>;
    /** State after generating, so a later call can continue from here. */
    state: GeneratorState;
};

/** Injected randomness, so generation is reproducible under test. */
export type Rng = () => number;
