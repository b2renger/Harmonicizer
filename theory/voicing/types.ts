/**
 * Types for the voicing engine.
 *
 * A voicing is chosen by scored search rather than by rule: candidates are enumerated,
 * each is costed against the previous voicing and the configured register, and the
 * cheapest wins. The parameters below are the weights and limits of that search — the
 * same knobs Impro-Visor exposes in its .fv auto-voicing presets.
 */

export type VoiceRole = 'bass' | 'root' | 'guide' | 'ext' | 'top';

export type Voice = {
    role: VoiceRole;
    midi: number;
};

export type Voicing = {
    voices: Voice[];
    sourceEventId: string;
};

/**
 * Harmonic intent: what the chord means, independent of how it is played.
 *
 * Step 1 synthesizes these on the fly from the app's existing note arrays. They become
 * the stored representation in step 3.
 */
export type HarmonicEvent = {
    id: string;
    /** Canonical chord symbol, e.g. 'Cmaj7'. */
    symbol: string;
    durationBeats: number;
    /** A hand-made voicing. The voicer returns it untouched. */
    pinned?: Voicing;
};

export type VoicingParams = {
    /** MIDI window the chord voices must sit in. */
    low: number;
    high: number;
    /** Preferred distance from lowest to highest voice, in semitones. */
    targetSpread: number;
    /** Hard-ish ceiling on that distance. */
    maxSpread: number;
    /** Minimum gap between adjacent voices in the low register, where close intervals muddy. */
    minInterval: number;
    /** The register below which `minInterval` is enforced. */
    minIntervalBelowMidi: number;
    /** 0 = always include the root, 1 = strongly prefer omitting it. */
    preferRootless: number;
    /**
     * Which chord-tone subsets may be used. Reduced voicings ('rootless', 'shell') drop
     * notes the chord needs to be identifiable on its own, so they are only appropriate
     * once another voice — a bass line — states what they leave out.
     */
    subsets: Array<'full' | 'rootless' | 'shell'>;

    // Cost weights. Only wMotion, targetSpread, the window and preferRootless are
    // exposed as live dials later; the rest encode "do not sound bad".
    wMotion: number;
    wRange: number;
    wSpread: number;
    wInterval: number;
    wOpen: number;
    wTop: number;
};

export const DEFAULT_VOICING_PARAMS: VoicingParams = {
    low: 52,                    // E3
    high: 84,                   // C6
    targetSpread: 14,
    maxSpread: 24,
    minInterval: 3,
    minIntervalBelowMidi: 60,   // below middle C, seconds and minor thirds turn to mud
    preferRootless: 0,
    subsets: ['full', 'rootless', 'shell'],

    wMotion: 1.0,
    wRange: 4.0,
    wSpread: 1.5,
    wInterval: 6.0,
    wOpen: 0.35,
    wTop: 0.5,
};
