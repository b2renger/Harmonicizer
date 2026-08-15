import { DEFAULT_VOICING_PARAMS, type VoicingParams } from '../theory/voicing/types.js';
import type { Params } from './store.js';

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/** Half the width of the voicing register window, in semitones. */
const WINDOW_HALF_WIDTH = 16;

/**
 * Maps the normalized parameter bus onto the voicing engine's weights and limits.
 *
 * The ranges are chosen so that the default parameters reproduce
 * DEFAULT_VOICING_PARAMS exactly — a fresh session sounds the same as it did before the
 * dials existed. That equivalence is asserted by test.
 *
 * Not every cost weight is exposed. wSpread, wInterval and wTop encode "do not sound bad"
 * rather than "sound like this", and stay fixed.
 */
export function paramsToVoicing(
    params: Params,
    base: VoicingParams = DEFAULT_VOICING_PARAMS,
): VoicingParams {
    const centre = lerp(56, 80, params.register);

    return {
        ...base,
        low: Math.round(centre - WINDOW_HALF_WIDTH),
        high: Math.round(centre + WINDOW_HALF_WIDTH),
        targetSpread: Math.round(lerp(4, 24, params.voicingOpenness)),
        preferRootless: params.rootless,
        wMotion: lerp(0, 2, params.motionWeight),
    };
}
