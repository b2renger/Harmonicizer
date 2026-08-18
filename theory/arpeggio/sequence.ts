import { Note } from 'tonal';
import { permutationAt, permutationCount } from './permutations.js';
import type { ArpeggioSettings } from './types.js';

const MAX_MIDI = 127;

/**
 * The pitches available to draw arpeggio steps from: the chord, stacked up through the
 * configured octave span.
 */
export function arpeggioPool(notes: string[], octaves: number): string[] {
    const midis = notes
        .map(n => Note.midi(n))
        .filter((m): m is number => m !== null)
        .sort((a, b) => a - b);

    const pool: string[] = [];
    for (let octave = 0; octave < Math.max(1, octaves); octave++) {
        for (const midi of midis) {
            const shifted = midi + 12 * octave;
            if (shifted > MAX_MIDI) continue;
            const name = Note.fromMidi(shifted);
            if (name) pool.push(name);
        }
    }
    return pool;
}

/**
 * Builds the note sequence one pass of the arpeggio plays.
 *
 * `steps` is clamped to what the chord and octave span can actually supply — asking for six
 * steps of a triad within one octave cannot be honoured, and silently repeating a note
 * would be worse than using three.
 *
 * @returns Note names in playing order. Empty if there is nothing to play.
 */
export function arpeggioSequence(notes: string[], settings: ArpeggioSettings): string[] {
    const pool = arpeggioPool(notes, settings.octaves);
    if (pool.length === 0) return [];

    const steps = Math.max(1, Math.min(settings.steps, pool.length));
    const selected = pool.slice(0, steps);

    const order = permutationAt(steps, settings.style % permutationCount(steps));
    const figure = order.map(i => selected[i]);

    // Looped comes back down without sounding the endpoints twice: a-b-c becomes a-b-c-b.
    if (settings.looped && figure.length > 2) {
        return [...figure, ...figure.slice(1, -1).reverse()];
    }
    return figure;
}
