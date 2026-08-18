/**
 * Arpeggiator settings.
 *
 * The shape of an arpeggio is a **permutation** rather than a named direction. Pick how
 * many steps the figure has, then choose among every ordering of those steps: 3 steps give
 * 6 shapes, 4 give 24, 6 give 720. That idea is taken from Jake Albaugh's Musical Chord
 * Progression Arpeggiator, and it is far more expressive than the usual
 * up/down/up-down/random menu, which is four of those orderings.
 *
 * Permutations are enumerated lexicographically, so index 0 is always straight up and the
 * last index is always straight down.
 */
export type ArpeggioSettings = {
    active: boolean;
    /** Notes in the figure, 3..6. Clamped to what the chord and octave span can supply. */
    steps: number;
    /** Which ordering of those steps to use. Taken modulo the number available. */
    style: number;
    /** Play the figure, then come back down through it without repeating the endpoints. */
    looped: boolean;
    /** How many octaves of the chord are available to draw steps from, 1..3. */
    octaves: number;
    /** Note length as a fraction of the step, 0.05..1. Staccato through legato. */
    gate: number;
    /** Step length, as a Tone subdivision. */
    timing: string;
    /** How many times the figure repeats within one chord. Infinity for the whole chord. */
    repeats: number;
};

export const DEFAULT_ARPEGGIO: ArpeggioSettings = {
    active: false,
    steps: 4,
    style: 0,          // straight up
    looped: false,
    octaves: 1,
    gate: 0.8,         // what the old fixed value was, so nothing changes by default
    timing: '16n',
    repeats: Infinity,
};

export const STEP_CHOICES = [3, 4, 5, 6];
export const OCTAVE_CHOICES = [1, 2, 3];
export const TIMING_CHOICES = ['4n', '8n', '8t', '16n', '16t', '32n'];
