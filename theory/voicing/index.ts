import { Chord, Note } from 'tonal';
import { generateCandidates } from './candidates.js';
import { voicingCost } from './cost.js';
import type { HarmonicEvent, Voice, VoiceRole, Voicing, VoicingParams } from './types.js';

export * from './types.js';
export { generateCandidates, CANDIDATE_CAP } from './candidates.js';
export { voicingCost } from './cost.js';

/** Cost swing applied for or against omitting the root, scaled by `preferRootless`. */
const ROOTLESS_BIAS = 12;

/**
 * Labels each note of a voicing with its harmonic role, so that rhythm patterns can
 * select by role ("strike the guide tones on the offbeat") without knowing the chord.
 *
 * The fifth is labelled 'ext'. It is neither the root nor a guide tone, and in comping
 * it behaves like a colour tone — the first thing dropped after extensions. Whether five
 * roles is the right granularity is flagged for review after listening (design §15).
 *
 * @param midis - Ascending MIDI notes.
 * @param symbol - The chord symbol they voice.
 */
export function assignRoles(midis: number[], symbol: string): Voice[] {
    const sorted = [...midis].sort((a, b) => a - b);
    if (sorted.length === 0) return [];

    const chord = Chord.get(symbol);
    const chromaToIndex = new Map<number, number>();
    chord.notes.forEach((pitchClass, index) => {
        const chroma = Note.chroma(pitchClass);
        if (chroma !== undefined && chroma !== null && !chromaToIndex.has(chroma)) {
            chromaToIndex.set(chroma, index);
        }
    });

    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];

    return sorted.map((midi): Voice => {
        // Position overrides function: the outer voices are what the ear tracks.
        if (midi === lowest) return { role: 'bass', midi };
        if (midi === highest) return { role: 'top', midi };

        const index = chromaToIndex.get(midi % 12);
        let role: VoiceRole;
        if (index === 0) role = 'root';
        else if (index === 1 || index === 3) role = 'guide';   // third and seventh
        else role = 'ext';                                      // fifth and true extensions

        return { role, midi };
    });
}

/**
 * Chooses the best voicing for one chord, given what came before it.
 *
 * A pinned voicing is returned untouched — hand-edited notes are the user's work and the
 * engine does not overrule them — but it still seeds the next chord's voice leading.
 *
 * @param event - The chord to voice.
 * @param previous - The preceding voicing, or null at the start of a progression.
 * @param p - Search weights and limits.
 */
export function voice(
    event: HarmonicEvent,
    previous: Voicing | null,
    p: VoicingParams,
): Voicing {
    if (event.pinned) return event.pinned;

    const candidates = generateCandidates(event.symbol, p);
    if (candidates.length === 0) {
        return { voices: [], sourceEventId: event.id };
    }

    const previousMidis = previous ? previous.voices.map(v => v.midi) : null;

    let best = candidates[0];
    let bestCost = Infinity;
    for (const candidate of candidates) {
        let cost = voicingCost(candidate.midis, previousMidis, p);
        // A rootless voicing needs something else to state the root. Until a bass voice
        // exists the bias must be symmetric, not merely absent: at preferRootless = 0 an
        // omitted root is a penalty, at 0.5 it is neutral, at 1 it is preferred.
        // Without this, rootless voicings won whenever they were cheaper, and Cmaj7 came
        // out as E-B-G, which the ear hears closer to Em7 than to C major 7.
        if (candidate.subset === 'rootless') cost += (1 - 2 * p.preferRootless) * ROOTLESS_BIAS;
        if (cost < bestCost) {
            bestCost = cost;
            best = candidate;
        }
    }

    return { voices: assignRoles(best.midis, event.symbol), sourceEventId: event.id };
}

/**
 * Voices a whole progression, threading each result into the next so that voice leading
 * accumulates across the sequence.
 */
export function voiceProgression(events: HarmonicEvent[], p: VoicingParams): Voicing[] {
    const out: Voicing[] = [];
    let previous: Voicing | null = null;

    for (const event of events) {
        const voiced = voice(event, previous, p);
        out.push(voiced);
        // An empty voicing carries no information about where the next one should sit.
        if (voiced.voices.length > 0) previous = voiced;
    }
    return out;
}
