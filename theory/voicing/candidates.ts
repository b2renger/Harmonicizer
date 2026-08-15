import { Chord, Note } from 'tonal';
import type { VoicingParams } from './types.js';

/** Which chord tones a candidate uses. */
export type SubsetKind = 'full' | 'rootless' | 'shell';

export type Candidate = {
    /** Ascending, distinct MIDI notes. */
    midis: number[];
    subset: SubsetKind;
};

/**
 * Upper bound on candidates per chord. Enumeration is a cartesian product over octave
 * placements, so it grows fast for extended chords. This is a guess, not a measurement —
 * see §15 of the accompaniment design.
 */
export const CANDIDATE_CAP = 200;

/**
 * The chord tones to use for each subset, as indices into Tonal's note list
 * (0 = root, 1 = third, 2 = fifth, 3 = seventh, 4+ = extensions).
 */
const subsetIndices = (noteCount: number): Array<{ kind: SubsetKind; indices: number[] }> => {
    const all = Array.from({ length: noteCount }, (_, i) => i);
    const subsets: Array<{ kind: SubsetKind; indices: number[] }> = [
        { kind: 'full', indices: all },
    ];

    // Rootless and shell only mean something once there is a seventh to hang them on.
    if (noteCount >= 4) {
        subsets.push({ kind: 'rootless', indices: all.slice(1) });
        subsets.push({ kind: 'shell', indices: [0, 1, 3] });
    }
    return subsets;
};

/** Every MIDI note in [low, high] with the given pitch class, ascending. */
const placementsFor = (pitchClass: string, low: number, high: number): number[] => {
    const chroma = Note.chroma(pitchClass);
    if (chroma === undefined || chroma === null) return [];

    const out: number[] = [];
    for (let midi = low; midi <= high; midi++) {
        if (midi % 12 === chroma) out.push(midi);
    }
    return out;
};

/**
 * Enumerates plausible voicings of a chord symbol.
 *
 * Rather than hand-listing voicing shapes, this takes the cartesian product of octave
 * placements for each chord tone and filters by span. Inversions, close and open
 * voicings and drop spacings all fall out of that naturally; choosing between them is
 * the cost function's job.
 *
 * @returns Candidates in a stable order, capped at CANDIDATE_CAP.
 */
export function generateCandidates(symbol: string, p: VoicingParams): Candidate[] {
    const chord = Chord.get(symbol);
    if (chord.empty || chord.notes.length === 0) return [];

    const bySubset: Candidate[][] = [];

    for (const { kind, indices } of subsetIndices(chord.notes.length)) {
        if (!p.subsets.includes(kind)) continue;
        const perTone = indices.map(i => placementsFor(chord.notes[i], p.low, p.high));
        // A chord tone with nowhere to sit makes the whole subset impossible.
        if (perTone.some(options => options.length === 0)) continue;

        // Iterative cartesian product, pruned by span as it is built.
        let partial: number[][] = [[]];
        for (const options of perTone) {
            const next: number[][] = [];
            for (const prefix of partial) {
                for (const midi of options) {
                    if (prefix.includes(midi)) continue;
                    const lo = Math.min(midi, ...prefix.length ? prefix : [midi]);
                    const hi = Math.max(midi, ...prefix.length ? prefix : [midi]);
                    if (hi - lo > p.maxSpread) continue;
                    next.push([...prefix, midi]);
                }
            }
            partial = next;
            if (partial.length === 0) break;
        }

        bySubset.push(partial.map(midis => ({
            midis: [...midis].sort((a, b) => a - b),
            subset: kind,
        })));
    }

    // Take the cap round-robin across subsets rather than off the front of a concatenated
    // list. Truncating the concatenation let 'full' consume every slot for extended
    // chords, so a 13th chord could never be voiced rootless — exactly the case where
    // rootless matters most.
    const out: Candidate[] = [];
    for (let i = 0; out.length < CANDIDATE_CAP; i++) {
        let addedAny = false;
        for (const list of bySubset) {
            if (i >= list.length) continue;
            out.push(list[i]);
            addedAny = true;
            if (out.length >= CANDIDATE_CAP) break;
        }
        if (!addedAny) break;
    }
    return out;
}
