
import { Note } from 'tonal';

const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Maps a MIDI note number to the specific filename convention used by the 
 * gleitz/midi-js-soundfonts library (standard scientific notation with flats).
 * @param midi The MIDI note number.
 * @returns The filename (e.g., "Bb4.mp3").
 */
const getNoteFileName = (midi: number): string => {
    const octave = Math.floor(midi / 12) - 1;
    const pcIndex = midi % 12;
    const pc = NOTE_NAMES_FLAT[pcIndex];
    return `${pc}${octave}.mp3`;
};

/**
 * Generates a mapping of note names to audio file names for a sampler.
 * Loads samples sparsely (every 3 semitones) to save bandwidth and reduce errors.
 * Tone.Sampler handles the pitch shifting for the in-between notes.
 * @param {number} minMidi - The minimum MIDI note number.
 * @param {number} maxMidi - The maximum MIDI note number.
 * @returns {Record<string, string>} An object mapping note names to filenames.
 */
const generateNoteMap = (minMidi: number, maxMidi: number): Record<string, string> => {
    const map: Record<string, string> = {};
    // Iterate in steps of 3 (minor third) to reduce the number of requests.
    for (let i = minMidi; i <= maxMidi; i += 3) {
        const noteName = Note.fromMidi(i);
        const fileName = getNoteFileName(i);
        map[noteName] = fileName;
    }
    return map;
};


// Soundfont configurations, using a public CDN for audio samples.
export const soundfonts = {
    'acoustic_grand_piano': {
        name: 'Grand Piano',
        baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/',
        notes: generateNoteMap(21, 108), // A0 to C8
        minMidi: 21,
        maxMidi: 108,
    },
    'electric_piano_1': {
        name: 'Electric Piano',
        baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/electric_piano_1-mp3/',
        notes: generateNoteMap(28, 96), // F1 to C7
        minMidi: 28,
        maxMidi: 96,
    },
    'acoustic_guitar_nylon': {
        name: 'Nylon Guitar',
        baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3/',
        notes: generateNoteMap(40, 88), // E2 to E6
        minMidi: 40,
        maxMidi: 88,
    },
     'acoustic_bass': {
        name: 'Acoustic Bass',
        baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_bass-mp3/',
        notes: generateNoteMap(25, 68), // C1 to F#4
        minMidi: 25,
        maxMidi: 68,
    },
    'violin': {
        name: 'Violin',
        baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/violin-mp3/',
        notes: generateNoteMap(55, 103), // G3 to G7
        minMidi: 55,
        maxMidi: 103,
    },
    'string_ensemble_1': {
        name: 'Strings',
        baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/string_ensemble_1-mp3/',
        notes: generateNoteMap(36, 96), // C2 to C7
        minMidi: 36,
        maxMidi: 96,
    },
    'pad_2_warm': {
        name: 'Warm Pad',
        baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/pad_2_warm-mp3/',
        notes: generateNoteMap(36, 96), // C2 to C7
        minMidi: 36,
        maxMidi: 96,
    }
};

// Type alias for convenience in other parts of the application.
export type SoundfontInstrument = keyof typeof soundfonts;
