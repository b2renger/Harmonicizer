import { Note } from 'tonal';
import { detectChordFromNotes } from '../chords.js';
import { voiceProgression } from './index.js';
import type { HarmonicEvent, VoicingParams, Voicing } from './types.js';

/** The chord shape the app currently stores. */
type StoredChord = { id: string; notes: string[]; duration: number; [key: string]: any };

/**
 * Re-voices a progression of stored chords, leaving the input untouched.
 *
 * Step 1 has no stored harmonic intent, so a symbol is recovered from each chord's notes.
 * Two kinds of chord pass through unchanged:
 *   - rests, which have no notes;
 *   - chords whose notes do not spell anything nameable, which are treated as pinned,
 *     because they can only have got that way by hand.
 *
 * @returns A new array; the caller decides whether to use it.
 */
export function voiceStoredProgression(
    progression: StoredChord[],
    params: VoicingParams,
): StoredChord[] {
    // Until a bass voice states the omitted notes, reduced voicings would make the chord
    // unidentifiable: Cmaj7 as a shell is B-E-C, which Tonal cannot name, so the chord
    // card would stop showing "Cmaj7". Full voicings only, for now.
    const fullOnly: VoicingParams = { ...params, subsets: ['full'] };

    const events: HarmonicEvent[] = progression.map(chord => {
        const symbol = chord.notes.length > 0 ? detectChordFromNotes(chord.notes) : null;

        if (!symbol) {
            // Pass through: a rest, or a hand-made voicing the engine must not overrule.
            const pinned: Voicing = {
                voices: chord.notes
                    .map(n => Note.midi(n))
                    .filter((m): m is number => m !== null)
                    .sort((a, b) => a - b)
                    .map(midi => ({ role: 'ext' as const, midi })),
                sourceEventId: chord.id,
            };
            return { id: chord.id, symbol: '', durationBeats: chord.duration, pinned };
        }

        return { id: chord.id, symbol, durationBeats: chord.duration };
    });

    const voicings = voiceProgression(events, fullOnly);

    return progression.map((chord, i) => {
        // Pinned chords are returned as they were stored. Rebuilding their notes from MIDI
        // would re-spell them — C#4 coming back as Db4 — which is a silent edit to
        // something the user wrote by hand.
        if (events[i].pinned) return chord;

        const voiced = voicings[i];
        if (!voiced || voiced.voices.length === 0) return chord;

        const notes = voiced.voices
            .map(v => Note.fromMidi(v.midi))
            .filter((n): n is string => Boolean(n));

        return notes.length > 0 ? { ...chord, notes } : chord;
    });
}
