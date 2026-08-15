import type { VoicingParams } from './types.js';

/**
 * Scores a candidate voicing. Lower is better; the voicer takes the minimum.
 *
 * The terms are the same concerns Impro-Visor's .fv presets express: how far the voices
 * moved, whether they sit in the instrument's register, how wide the chord is, and
 * whether any interval is too close to be clear down low.
 *
 * @param midis - Ascending MIDI notes of the candidate.
 * @param previous - The preceding voicing's notes, or null to start a phrase.
 * @param p - Weights and limits.
 * @returns A non-negative cost.
 */
export function voicingCost(
    midis: number[],
    previous: number[] | null,
    p: VoicingParams,
): number {
    if (midis.length === 0) return 0;

    const lowest = Math.min(...midis);
    const highest = Math.max(...midis);
    const spread = highest - lowest;

    // Voice leading: how far each voice had to travel from the nearest previous voice.
    let motion = 0;
    let topMotion = 0;
    if (previous && previous.length > 0) {
        for (const midi of midis) {
            let nearest = Infinity;
            for (const prev of previous) {
                nearest = Math.min(nearest, Math.abs(midi - prev));
            }
            motion += nearest;
        }
        topMotion = Math.abs(highest - Math.max(...previous));
    }

    // Register: distance outside the configured window.
    let range = 0;
    for (const midi of midis) {
        if (midi < p.low) range += p.low - midi;
        else if (midi > p.high) range += midi - p.high;
    }

    // Muddiness: adjacent voices too close together in the low register.
    let interval = 0;
    const sorted = [...midis].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i] - sorted[i - 1];
        if (sorted[i - 1] < p.minIntervalBelowMidi && gap < p.minInterval) {
            interval += p.minInterval - gap;
        }
    }

    const overSpread = Math.max(0, spread - p.maxSpread);
    const openness = Math.abs(spread - p.targetSpread);

    return (
        p.wMotion * motion +
        p.wRange * range +
        p.wSpread * overSpread +
        p.wInterval * interval +
        p.wOpen * openness +
        p.wTop * topMotion
    );
}
