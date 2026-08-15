import type { Brick } from './types.js';

/**
 * A starter brick dictionary, written from the published brick theory rather than
 * transcribed from Impro-Visor's `vocab/My.dictionary`.
 *
 * Deliberately small. Hand-checked bricks that sound right beat forty that have not been
 * listened to, and the weights only mean anything once they have been heard against each
 * other. Everything is spelled in C and transposed at expansion time.
 */
export const BRICK_DICTIONARY: Brick[] = [
    // ---------------------------------------------------------------- major
    {
        name: 'Perfect-Cadence',
        type: 'Cadence',
        mode: 'Major',
        key: 'C',
        blocks: [
            { kind: 'chord', symbol: 'G7', dur: 1 },
            { kind: 'chord', symbol: 'C', dur: 1 },
        ],
        defaultBeats: 8,
        weight: 4.0,
        diatonic: true,
        description: 'V7 → I. The plainest way to arrive home.',
    },
    {
        name: 'Straight-Approach',
        type: 'Approach',
        mode: 'Major',
        key: 'C',
        blocks: [
            { kind: 'chord', symbol: 'Dm7', dur: 1 },
            { kind: 'chord', symbol: 'G7', dur: 1 },
        ],
        defaultBeats: 8,
        weight: 2.2,
        diatonic: true,
        description: 'ii7 → V7. Sets up a cadence without resolving it.',
    },
    {
        name: 'Full-Cadence',
        type: 'Cadence',
        mode: 'Major',
        key: 'C',
        // Nested: proves a brick can be built from other bricks.
        blocks: [
            { kind: 'brick', name: 'Straight-Approach', key: 'C', dur: 2 },
            { kind: 'chord', symbol: 'Cmaj7', dur: 2 },
        ],
        defaultBeats: 16,
        weight: 4.0,
        diatonic: true,
        description: 'ii7 → V7 → Imaj7. The standard jazz cadence.',
    },
    {
        name: 'Plagal-Cadence',
        type: 'Cadence',
        mode: 'Major',
        key: 'C',
        blocks: [
            { kind: 'chord', symbol: 'F', dur: 1 },
            { kind: 'chord', symbol: 'C', dur: 1 },
        ],
        defaultBeats: 8,
        weight: 1.6,
        diatonic: true,
        description: 'IV → I. Softer than a perfect cadence; the "Amen".',
    },
    {
        name: 'Dropback',
        type: 'Dropback',
        mode: 'Major',
        key: 'C',
        blocks: [
            { kind: 'chord', symbol: 'Cmaj7', dur: 1 },
            { kind: 'chord', symbol: 'Am7', dur: 1 },
        ],
        defaultBeats: 8,
        weight: 3.3,
        diatonic: true,
        description: 'I → vi. Steps away from home without leaving the key.',
    },
    {
        name: 'Turnaround',
        type: 'Turnaround',
        mode: 'Major',
        key: 'C',
        blocks: [
            { kind: 'chord', symbol: 'Cmaj7', dur: 1 },
            { kind: 'chord', symbol: 'A7', dur: 1 },
            { kind: 'chord', symbol: 'Dm7', dur: 1 },
            { kind: 'chord', symbol: 'G7', dur: 1 },
        ],
        defaultBeats: 8,
        weight: 5.0,
        diatonic: false,   // A7 is a secondary dominant
        description: 'I → VI7 → ii7 → V7. Circles back to the start.',
    },

    // ---------------------------------------------------------------- minor
    {
        name: 'Minor-Cadence',
        type: 'Cadence',
        mode: 'Minor',
        key: 'C',
        blocks: [
            { kind: 'chord', symbol: 'G7', dur: 1 },
            { kind: 'chord', symbol: 'Cm', dur: 1 },
        ],
        defaultBeats: 8,
        weight: 4.0,
        diatonic: true,
        description: 'V7 → i. The raised third in the dominant is what pulls.',
    },
    {
        name: 'Minor-Approach',
        type: 'Approach',
        mode: 'Minor',
        key: 'C',
        blocks: [
            { kind: 'chord', symbol: 'Dm7b5', dur: 1 },
            { kind: 'chord', symbol: 'G7', dur: 1 },
        ],
        defaultBeats: 8,
        weight: 2.2,
        diatonic: true,
        description: 'iiø7 → V7. The minor-key approach to a cadence.',
    },
    {
        name: 'Andalusian',
        type: 'Dropback',
        mode: 'Minor',
        key: 'C',
        blocks: [
            { kind: 'chord', symbol: 'Cm', dur: 1 },
            { kind: 'chord', symbol: 'Bb', dur: 1 },
            { kind: 'chord', symbol: 'Ab', dur: 1 },
            { kind: 'chord', symbol: 'G7', dur: 1 },
        ],
        defaultBeats: 16,
        weight: 3.3,
        diatonic: true,
        description: 'i → bVII → bVI → V7. The descending flamenco tetrachord.',
    },
];

/** Look a brick up by name. */
export const findBrick = (name: string): Brick | undefined =>
    BRICK_DICTIONARY.find(b => b.name === name);
