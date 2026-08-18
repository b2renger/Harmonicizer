import { Chord, Note, Scale } from 'tonal';
import { getRomanNumeralForChord, degreeReferenceScale, modeFamily } from '../harmony.js';
import { parseRomanNumeral } from '../romanNumeral.js';
import { expandBrick } from './expand.js';
import { BRICK_DICTIONARY } from './dictionary.js';
import type { Brick } from './types.js';

/**
 * The gap a brick would fill: what comes immediately before it and immediately after it.
 *
 * `next` is whatever will actually sound next — at the end of a looping progression that
 * is the *first* chord, not nothing. The caller decides; this module just scores.
 */
export type SlotContext = {
    /** Chord symbol before the slot, or null at the start. */
    prev: string | null;
    /** Chord symbol after the slot, or null if nothing follows. */
    next: string | null;
    key: string;
    mode: string;
};

export type BrickSuggestion = {
    brick: Brick;
    /** The brick expanded into the context's key. */
    chords: string[];
    /** Fit, 0..1. */
    score: number;
    /** Short phrases explaining the score, for display. */
    reasons: string[];
};

type HarmonicFunction = 'tonic' | 'predominant' | 'dominant' | 'mediant';

/** Scale degree to harmonic function. Degree-based, so it holds across modes. */
const FUNCTION_BY_DEGREE: HarmonicFunction[] = [
    'tonic',        // I
    'predominant',  // II
    'mediant',      // III
    'predominant',  // IV
    'dominant',     // V
    'tonic',        // VI
    'dominant',     // VII
];

/** How idiomatic it is to move from one function to another. */
const TRANSITION: Record<HarmonicFunction, Record<HarmonicFunction, number>> = {
    tonic:       { tonic: 0.50, predominant: 1.00, dominant: 0.90, mediant: 0.70 },
    predominant: { tonic: 0.50, predominant: 0.60, dominant: 1.00, mediant: 0.40 },
    dominant:    { tonic: 1.00, predominant: 0.40, dominant: 0.50, mediant: 0.60 },
    mediant:     { tonic: 0.70, predominant: 0.90, dominant: 0.70, mediant: 0.40 },
};

/**
 * Strength of a root movement, by ascending semitone distance.
 *
 * 5 is an ascending fourth — the falling fifth of V to I — and is the strongest move in
 * tonal harmony. 0 means the root does not move at all, which is the weakest: it is why a
 * brick that merely repeats its neighbour ranks low.
 */
const ROOT_MOTION: Record<number, number> = {
    0: 0.30, 1: 0.60, 2: 0.70, 3: 0.80, 4: 0.65, 5: 1.00,
    6: 0.40, 7: 0.50, 8: 0.65, 9: 0.80, 10: 0.70, 11: 0.60,
};

const functionOf = (symbol: string, key: string, mode: string): HarmonicFunction | null => {
    const parsed = parseRomanNumeral(getRomanNumeralForChord(symbol, key, mode));
    return parsed ? FUNCTION_BY_DEGREE[parsed.degree] ?? null : null;
};

const chromasOf = (symbol: string): Set<number> => {
    const notes = Chord.get(symbol).notes;
    return new Set(notes.map(n => Note.chroma(n)).filter((c): c is number => c != null));
};

/** Shared pitch classes as a fraction of the smaller chord. */
const commonToneRatio = (a: string, b: string): number => {
    const first = chromasOf(a);
    const second = chromasOf(b);
    if (first.size === 0 || second.size === 0) return 0;

    let shared = 0;
    for (const chroma of first) if (second.has(chroma)) shared++;
    return shared / Math.min(first.size, second.size);
};

const rootMotion = (a: string, b: string): number => {
    const from = Chord.get(a).tonic;
    const to = Chord.get(b).tonic;
    if (!from || !to) return 0.5;

    const fromChroma = Note.chroma(from);
    const toChroma = Note.chroma(to);
    if (fromChroma == null || toChroma == null) return 0.5;

    return ROOT_MOTION[(toChroma - fromChroma + 12) % 12] ?? 0.5;
};

/** How idiomatic the move from `a` to `b` is, 0..1. */
const joinScore = (a: string, b: string, key: string, mode: string): number => {
    const fromFn = functionOf(a, key, mode);
    const toFn = functionOf(b, key, mode);
    // An unclassifiable chord gets a neutral functional reading rather than a zero.
    const functional = fromFn && toFn ? TRANSITION[fromFn][toFn] : 0.55;

    return 0.5 * functional + 0.3 * rootMotion(a, b) + 0.2 * commonToneRatio(a, b);
};

const isTonic = (symbol: string, key: string): boolean => {
    const tonic = Chord.get(symbol).tonic;
    return tonic != null && Note.chroma(tonic) === Note.chroma(key);
};

/** With nothing before it, prefer bricks that are built to start. */
const openerScore = (brick: Brick, first: string, key: string): number => {
    if (brick.type === 'Opening') return 1.0;
    if (isTonic(first, key)) return 0.9;
    return 0.6;
};

/** With nothing after it, prefer bricks that are built to finish. */
const closerScore = (brick: Brick, last: string, key: string): number => {
    const lands = isTonic(last, key);
    if (lands && (brick.type === 'Ending' || brick.type === 'Cadence')) return 1.0;
    if (lands) return 0.9;
    return 0.6;
};

/** Fraction of the brick's chords that sit entirely inside the key. */
const keyFit = (chords: string[], key: string, mode: string): number => {
    const scale = Scale.get(degreeReferenceScale(key, mode));
    if (scale.empty) return 0.5;

    const inKey = new Set(scale.notes.map(n => Note.chroma(n)).filter((c): c is number => c != null));
    const diatonic = chords.filter(symbol => {
        const chromas = chromasOf(symbol);
        return chromas.size > 0 && [...chromas].every(c => inKey.has(c));
    });
    return chords.length === 0 ? 0.5 : diatonic.length / chords.length;
};

// `prominence` is small on purpose: it only decides between bricks the context cannot
// separate. Without it, an empty progression left five bricks tied and falling back to
// their order in the dictionary array, which carries no musical meaning.
const WEIGHTS = { back: 0.35, ahead: 0.35, key: 0.18, mode: 0.07, prominence: 0.05 };
const STRONG = 0.75;

/**
 * Ranks bricks by how well they fill a slot, looking both backwards and forwards.
 *
 * @param context - The gap to fill.
 * @param options.dictionary - Bricks to consider. Defaults to the whole dictionary.
 * @param options.limit - How many to return. Defaults to all of them.
 * @returns Suggestions, best first. Bricks the context cannot separate are ordered by
 *          prominence, then by dictionary order.
 */
export function suggestBricks(
    context: SlotContext,
    options: { dictionary?: Brick[]; limit?: number } = {},
): BrickSuggestion[] {
    const { prev, next, key, mode } = context;
    const dictionary = options.dictionary ?? BRICK_DICTIONARY;
    const family = modeFamily(mode) === 'minor' ? 'Minor' : 'Major';
    const heaviest = Math.max(...dictionary.map(b => b.weight), 1);

    const scored = dictionary.flatMap((brick): BrickSuggestion[] => {
        const chords = expandBrick(brick, key, brick.defaultBeats).map(c => c.symbol);
        if (chords.length === 0) return [];

        const first = chords[0];
        const last = chords[chords.length - 1];

        const back = prev ? joinScore(prev, first, key, mode) : openerScore(brick, first, key);
        const ahead = next ? joinScore(last, next, key, mode) : closerScore(brick, last, key);
        const fit = keyFit(chords, key, mode);
        const modeFit = brick.mode === family ? 1 : 0.65;

        const score =
            WEIGHTS.back * back +
            WEIGHTS.ahead * ahead +
            WEIGHTS.key * fit +
            WEIGHTS.mode * modeFit +
            WEIGHTS.prominence * (brick.weight / heaviest);

        const reasons: string[] = [];
        if (back >= STRONG) reasons.push(prev ? `follows ${prev}` : 'good place to start');
        if (ahead >= STRONG) reasons.push(next ? `leads into ${next}` : 'lands on the tonic');
        if (fit === 1) reasons.push('stays in key');
        else if (fit < 0.75) reasons.push('leaves the key');
        if (modeFit < 1) reasons.push(`borrowed from ${brick.mode.toLowerCase()}`);
        if (reasons.length === 0) reasons.push('plausible, but nothing special');

        return [{ brick, chords, score: Math.min(1, Math.max(0, score)), reasons }];
    });

    // Stable: equal scores keep dictionary order.
    const ranked = scored
        .map((s, index) => ({ s, index }))
        .sort((a, b) => (b.s.score - a.s.score) || (a.index - b.index))
        .map(({ s }) => s);

    return options.limit != null ? ranked.slice(0, options.limit) : ranked;
}
