import type { BrickType } from '../bricks/types.js';

export const BRICK_TYPES: BrickType[] = [
    'Opening', 'Approach', 'Cadence', 'Turnaround', 'Dropback', 'OnOff', 'Ending',
];

/**
 * How likely each kind of gesture is to follow another.
 *
 * A first-order Markov chain rather than a flat weighted draw, because the ordering is the
 * point: an Approach wants a Cadence after it, an Opening does not follow an Ending. A flat
 * draw over brick weights produces plausible bricks in an order that goes nowhere.
 *
 * Rows are relative weights, not probabilities — they are normalized at selection time
 * after the dials have reweighted them. Every row must be able to reach a terminating type
 * so the generator cannot dead-end.
 */
export const TYPE_TRANSITIONS: Record<'start' | BrickType, Partial<Record<BrickType, number>>> = {
    // A phrase usually begins by establishing, or by walking straight in.
    start:      { Opening: 5, Dropback: 2, OnOff: 1, Turnaround: 2, Approach: 1 },

    // Having established home, move away or set up a cadence.
    Opening:    { Dropback: 3, Approach: 3, Turnaround: 2, OnOff: 2, Cadence: 1 },

    // An approach is a wind-up; it wants resolution.
    Approach:   { Cadence: 8, Ending: 2, Approach: 1 },

    // After arriving, either sit, leave again, or wrap up.
    Cadence:    { Dropback: 3, Turnaround: 3, OnOff: 2, Opening: 1, Approach: 2, Ending: 1 },

    // A turnaround already ends on the dominant, so a cadence follows naturally.
    Turnaround: { Cadence: 5, Approach: 2, Dropback: 1, Ending: 1 },

    // Having stepped away, head back toward a cadence.
    Dropback:   { Approach: 5, Turnaround: 3, Cadence: 2, OnOff: 1 },

    // Rocking between two chords; break out of it eventually.
    OnOff:      { Approach: 4, Dropback: 2, Cadence: 2, OnOff: 1, Turnaround: 1 },

    // An ending is terminal, but a new section may start after it.
    Ending:     { Opening: 4, Dropback: 1 },
};

/** Types that finish a phrase. Used to force termination when the budget runs out. */
export const TERMINATING_TYPES: BrickType[] = ['Cadence', 'Ending'];
