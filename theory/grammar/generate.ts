import { Note } from 'tonal';
import { BRICK_DICTIONARY } from '../bricks/dictionary.js';
import { expandBrick } from '../bricks/expand.js';
import { modeFamily } from '../harmony.js';
import { rootNotes } from '../chords.js';
import type { Brick, BrickType } from '../bricks/types.js';
import type { Params } from '../../params/store.js';
import { TYPE_TRANSITIONS, TERMINATING_TYPES } from './transitions.js';
import type {
    GenerateRequest, GenerateResult, GeneratedChord, GeneratorState, Rng,
} from './types.js';

/** Shortest brick we will place; below this a cadence would be cut to nothing. */
const MIN_BRICK_BEATS = 2;
/** Hard stop, so a pathological weighting cannot spin forever. */
const MAX_BRICKS = 64;
/** Beats a cadence typically wants; reserved from the budget so a phrase can resolve. */
const TYPICAL_CADENCE_BEATS = 8;
/** How much less likely a brick from the parallel mode is, before chromaticism scales it. */
const BORROWING_PENALTY = 0.2;

/** Weighted draw. Returns null only if every weight is zero. */
const pick = <T,>(entries: Array<[T, number]>, rng: Rng): T | null => {
    const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
    if (total <= 0) return null;

    let roll = rng() * total;
    for (const [value, weight] of entries) {
        roll -= Math.max(0, weight);
        if (roll <= 0) return value;
    }
    return entries[entries.length - 1][0];
};

/**
 * Chooses the next kind of gesture.
 *
 * `cadencePressure` leans the chain toward resolution: it multiplies the terminating types
 * and divides the ones that prolong. Driven by hand it is a "resolve" control; ramped slowly
 * it produces arcs without any explicit model of form.
 */
export function selectType(
    lastType: BrickType | null,
    params: Params,
    rng: Rng,
    mustEnd = false,
): BrickType | null {
    const row = TYPE_TRANSITIONS[lastType ?? 'start'] ?? {};

    // 0.5 is neutral; 1 doubles the pull toward a cadence, 0 halves it.
    const pull = 0.5 + params.cadencePressure;

    const entries = (Object.entries(row) as Array<[BrickType, number]>)
        .filter(([type]) => !mustEnd || TERMINATING_TYPES.includes(type))
        .map(([type, weight]): [BrickType, number] => {
            if (TERMINATING_TYPES.includes(type)) return [type, weight * pull];
            if (type === 'Dropback' || type === 'Turnaround') return [type, weight / pull];
            return [type, weight];
        });

    if (entries.length === 0) {
        // The row offered nothing terminating; fall back to any terminating type.
        return mustEnd ? (TERMINATING_TYPES[0] ?? null) : null;
    }
    return pick(entries, rng);
}

/**
 * Chooses which brick of a given kind to use.
 *
 * `chromaticism` gates bricks that leave the key: below the threshold they are excluded
 * outright rather than merely made unlikely, so turning the dial down genuinely keeps the
 * harmony diatonic instead of only mostly diatonic.
 */
export function selectBrick(
    type: BrickType,
    state: GeneratorState,
    params: Params,
    rng: Rng,
    dictionary: Brick[] = BRICK_DICTIONARY,
): Brick | null {
    const allowChromatic = params.chromaticism > 0.15;

    const candidates = dictionary
        .filter(b => b.type === type)
        // Borrowing from the parallel mode is modal mixture, which is a chromatic move: Fm
        // in C major needs an Ab. Gating it with `diatonic` keeps a closed chromaticism dial
        // honestly in one mode, instead of wandering from major into minor mid-phrase.
        .filter(b => (b.diatonic && b.mode === state.mode) || allowChromatic)
        .map((b): [Brick, number] => {
            let weight = b.weight;
            if (b.mode !== state.mode) weight *= BORROWING_PENALTY * params.chromaticism;
            if (!b.diatonic) weight *= params.chromaticism;
            return [b, weight];
        });

    return candidates.length === 0 ? null : pick(candidates, rng);
}

/**
 * Chooses the key for the next brick.
 *
 * Modulation is not a separate mechanism: each brick is simply placed in a key, and
 * `modulationRate` is the chance that key differs from the current one. `brightness` biases
 * the destination sharpward (bright) or flatward (dark) round the circle of fifths.
 */
export function selectKey(state: GeneratorState, params: Params, rng: Rng): string {
    if (rng() >= params.modulationRate) return state.key;

    const sharpward = rng() < params.brightness;
    const moved = Note.transpose(state.key, sharpward ? '5P' : '4P');
    if (!moved) return state.key;

    // Keep to spellings the app's key picker knows; fall back rather than invent one.
    const simplified = Note.simplify(moved) ?? moved;
    return rootNotes.includes(simplified) ? simplified : state.key;
}

/**
 * Generates a progression filling exactly the requested number of beats.
 *
 * @param request - How many beats to fill, and the starting key and mode.
 * @param params - The live parameter bus.
 * @param rng - Injected randomness; pass a seeded generator for reproducible output.
 */
export function generate(
    request: GenerateRequest,
    params: Params,
    rng: Rng = Math.random,
    dictionary: Brick[] = BRICK_DICTIONARY,
): GenerateResult {
    const state: GeneratorState = {
        key: request.key,
        mode: modeFamily(request.mode) === 'minor' ? 'Minor' : 'Major',
        lastType: null,
    };

    const chords: GeneratedChord[] = [];
    const bricks: GenerateResult['bricks'] = [];
    let remaining = request.beats;

    // 0.5 is neutral; higher means shorter bricks, so harmony moves faster.
    const rhythmScale = 1.5 - params.harmonicRhythm;

    // Hold back enough beats for a closing cadence. Without this the free loop spends the
    // whole budget and the progression simply stops on whatever brick came last, so most
    // generated phrases never resolved.
    const cadenceReserve = Math.max(MIN_BRICK_BEATS, Math.round(TYPICAL_CADENCE_BEATS * rhythmScale));

    while (remaining - cadenceReserve >= MIN_BRICK_BEATS && bricks.length < MAX_BRICKS) {
        const type = selectType(state.lastType, params, rng);
        if (!type) break;

        const brick = selectBrick(type, state, params, rng, dictionary);
        if (!brick) {
            // Nothing of that kind is available under the current dials; try another.
            state.lastType = type;
            continue;
        }

        const key = selectKey(state, params, rng);
        const wanted = Math.max(MIN_BRICK_BEATS, Math.round(brick.defaultBeats * rhythmScale));
        // Clamp against the reserve, not the whole budget: a long brick would otherwise eat
        // the beats set aside for the cadence and the phrase would simply stop on it. The
        // loop condition guarantees at least MIN_BRICK_BEATS remain after the reserve.
        const beats = Math.min(wanted, remaining - cadenceReserve);

        const expanded = expandBrick(brick, key, beats);
        if (expanded.length === 0) {
            state.lastType = type;
            continue;
        }

        appendMerging(chords, expanded.map(c => ({ ...c, key })));
        bricks.push({ name: brick.name, type: brick.type, key });
        remaining -= beats;
        state.key = key;
        state.lastType = brick.type;
    }

    // Finish on a resolution, and spend whatever is left doing it.
    if (remaining > 0) {
        const closer = closeOut(state, params, rng, remaining, dictionary);
        if (closer) {
            appendMerging(chords, closer.chords);
            bricks.push(closer.brick);
            state.lastType = closer.brick.type;
        } else if (chords.length > 0) {
            // No cadence fits the leftover; give the beats to the last chord rather than
            // returning a progression that is short.
            chords[chords.length - 1].durationBeats += remaining;
        }
    }

    return { chords, bricks, state };
}

/**
 * Appends chords, merging a repeat across the join.
 *
 * Bricks butt up against each other, so a turnaround ending on G7 followed by a cadence
 * starting on G7 produced "G7 G7". That is one held chord, and writing it as two wastes a
 * slot and reads as a bug. Total duration is unchanged.
 */
function appendMerging(into: GeneratedChord[], incoming: GeneratedChord[]): void {
    const last = into[into.length - 1];
    const first = incoming[0];

    if (last && first && last.symbol === first.symbol) {
        last.durationBeats += first.durationBeats;
        into.push(...incoming.slice(1));
        return;
    }
    into.push(...incoming);
}

/** Places a terminating brick in the beats that remain. */
function closeOut(
    state: GeneratorState,
    params: Params,
    rng: Rng,
    beats: number,
    dictionary: Brick[],
): { chords: GeneratedChord[]; brick: GenerateResult['bricks'][number] } | null {
    if (beats < MIN_BRICK_BEATS) return null;

    for (const type of [selectType(state.lastType, params, rng, true), ...TERMINATING_TYPES]) {
        if (!type) continue;
        const brick = selectBrick(type, state, params, rng, dictionary);
        if (!brick) continue;

        const expanded = expandBrick(brick, state.key, beats);
        if (expanded.length === 0) continue;

        return {
            chords: expanded.map(c => ({ ...c, key: state.key })),
            brick: { name: brick.name, type: brick.type, key: state.key },
        };
    }
    return null;
}
