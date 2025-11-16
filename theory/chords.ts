
import { Chord, Note, Interval } from 'tonal';

export const rootNotes = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const chordTypes = [
    'maj', 'm', 'maj7', 'm7', '7',
    'dim', 'dim7', 'm7b5', 'aug',
    'sus2', 'sus4', '6', 'm6', 'add9', 'm9', 'maj9'
];

export const modes = [
    'major',
    'minor',
    'dorian',
    'phrygian',
    'lydian',
    'mixolydian',
    'locrian',
];

const MIN_MIDI_RANGE = 48; // C3
const MAX_MIDI_RANGE = 84; // C6

/**
 * Adjusts a chord's octave to fit it within a defined MIDI range (C3-C6).
 * This is done by shifting the entire chord up or down by octaves to keep the voicing intact.
 * @param {string[]} notes - An array of notes.
 * @returns {string[]} The notes transposed to be within the desired range.
 */
export const wrapNotesToRange = (notes: string[]): string[] => {
    if (!notes || notes.length === 0) {
        return [];
    }

    const midiNotes = notes.map(note => Note.midi(note)).filter((m): m is number => m !== null);
    if (midiNotes.length === 0) {
        return notes; // Return original if no valid midi notes
    }

    const avgMidi = midiNotes.reduce((sum, midi) => sum + midi, 0) / midiNotes.length;
    const rangeCenter = (MIN_MIDI_RANGE + MAX_MIDI_RANGE) / 2;
    const difference = avgMidi - rangeCenter;
    const octaveShift = Math.round(difference / 12);

    if (octaveShift === 0) {
        return notes; // Already in range
    }

    const semitoneShift = -octaveShift * 12;
    const interval = Interval.fromSemitones(semitoneShift);
    
    if (!interval) return notes; // Should not happen for multiples of 12, but a safe fallback

    return notes.map(note => Note.transpose(note, interval));
};


/**
 * Detects the most likely chord from a set of notes, ensuring the result is valid.
 * It prioritizes chords that Tonal.js can fully parse.
 * @param {string[]} notes - An array of note names (e.g., ['C4', 'E4', 'G4']).
 * @returns {string | null} The detected chord symbol (e.g., 'Cmaj7') or null if no valid chord is detected.
 */
export const detectChordFromNotes = (notes) => {
    if (!notes || notes.length < 2) {
        return null;
    }

    // Tonal.Chord.detect works best with pitch classes (note names without octaves).
    const pitchClasses = notes.map(Note.pitchClass);
    const detectedChords = Chord.detect(pitchClasses);

    if (detectedChords.length === 0) {
        return null;
    }

    // Find the first detected chord name that Tonal can fully parse.
    // This ensures compatibility with other functions that rely on `Chord.get`.
    for (const chordName of detectedChords) {
        const chordInfo = Chord.get(chordName);
        if (!chordInfo.empty && chordInfo.tonic) {
            // It's a valid, parsable chord. Return its standardized symbol.
            return chordInfo.symbol;
        }
    }

    // If no detected chords could be parsed, it's not a standard chord.
    return null;
};

/**
 * Gets an abbreviated display name (e.g., "Cmaj7" or "Rest") from an array of notes.
 * If no standard chord is detected, it returns a simple list of the pitch classes.
 * @param {string[]} notes - An array of note names.
 * @returns {string} The detected chord symbol or a fallback name.
 */
export const getAbbreviatedNameFromNotes = (notes) => {
    if (!notes || notes.length === 0) return "Rest";
    const detectedName = detectChordFromNotes(notes);
    if (!detectedName) {
        // Fallback for non-standard chords.
        return notes.map(n => Note.pitchClass(n)).join('-');
    }
    return detectedName;
};

/**
 * Returns a consistently abbreviated name for a chord by returning its canonical symbol from Tonal.js.
 * This ensures that names are always valid for the library (e.g., "Cmaj7", not "cmaj7").
 * @param {string} chordName - The chord name to abbreviate.
 * @returns {string} The abbreviated and valid chord name.
 */
export const getAbbreviatedChordName = (chordName) => {
    if (!chordName || chordName === 'Rest') {
        return chordName;
    }
    const chordInfo = Chord.get(chordName);
    if (chordInfo.empty || !chordInfo.tonic) {
        return chordName; // Return original if not recognized
    }

    // The .symbol property from Tonal.js is the most reliable and canonical representation.
    return chordInfo.symbol;
};


/**
 * Returns a descriptive name for a chord, like "C Major 7th".
 * Handles slash chords by indicating the bass note (e.g., "C Major 7th / E").
 * @param {string} chordName - The chord name to format (e.g., 'Cmaj7/E').
 * @param {number} [octave] - The octave of the chord. If provided, it will be included in the name.
 * @returns {string} The descriptive chord name.
 */
export const getDisplayChordName = (chordName, octave) => {
    if (!chordName || chordName === 'Rest') {
        return "Rest";
    }
    const chordInfo = Chord.get(chordName);
    if (chordInfo.empty || !chordInfo.tonic) {
        return chordName;
    }
    
    const tonic = chordInfo.tonic;
    const quality = (chordInfo.quality) || '';

    let descriptiveQuality = quality.toLowerCase();

    // Custom mappings for cleaner, more readable names.
    if (descriptiveQuality === 'dominant seventh') descriptiveQuality = '7th';
    else if (descriptiveQuality === 'major seventh') descriptiveQuality = 'major 7th';
    else if (descriptiveQuality === 'minor seventh') descriptiveQuality = 'minor 7th';
    else if (descriptiveQuality === 'half-diminished') descriptiveQuality = 'm7b5';
    else if (descriptiveQuality === 'diminished') {
        descriptiveQuality = chordInfo.type === 'dim7' ? 'diminished 7th' : 'diminished';
    }

    const baseName = octave !== undefined 
        ? `${tonic}${octave} ${descriptiveQuality}`.trim()
        : `${tonic} ${descriptiveQuality}`.trim();
    
    // Handle slash chords (inversions where the bass note is not the tonic).
    if (chordInfo.root && chordInfo.root !== chordInfo.tonic) {
        return `${baseName} / ${chordInfo.root}`;
    }
    
    return baseName;
};

/**
 * Builds a musically valid, ascending chord voicing from a given bass note and the pitch classes of the upper voices.
 * @param {string} bassNote - The starting note of the chord (e.g., 'C4').
 * @param {string[]} upperPitchClasses - An array of the pitch classes for the other notes in a specific order (e.g., ['G', 'B', 'E']).
 * @returns {string[]} A new array of notes forming an ascending chord voicing (e.g., ['C4', 'G4', 'B4', 'E5']).
 */
export const buildAscendingVoicing = (bassNote, upperPitchClasses) => {
    let currentMidi = Note.midi(bassNote);
    if (currentMidi === null) return [];

    const results = [bassNote];
    
    for (const pc of upperPitchClasses) {
        let nextOctave = Note.octave(Note.fromMidi(currentMidi)) || 4;
        let nextNoteMidi = Note.midi(`${pc}${nextOctave}`);

        // Ensure notes always ascend by incrementing the octave if a note would be lower than the previous one.
        while (nextNoteMidi !== null && nextNoteMidi <= currentMidi) {
            nextOctave++;
            nextNoteMidi = Note.midi(`${pc}${nextOctave}`);
        }

        if (nextNoteMidi !== null) {
            results.push(Note.fromMidi(nextNoteMidi));
            currentMidi = nextNoteMidi;
        }
    }
    return results;
};

/**
 * Calculates the next or previous inversion of a chord by manipulating the note array directly.
 * For standard chords, it performs a musically-aware inversion by moving to the next chord tone in the bass.
 * For non-standard chords, it falls back to a simple rotational inversion.
 * The final result is wrapped to a C3-C6 range.
 * @param {string[]} notes - The array of notes in the current chord voicing (e.g., ['C4', 'E4', 'G4']).
 * @param {'up' | 'down'} direction - Whether to find the next inversion ('up') or the previous one ('down').
 * @returns {string[]} A new array of notes representing the inverted chord.
 */
const getInversion = (notes, direction) => {
    if (notes.length < 2) return notes;

    const sortedNotes = notes.slice().sort((a, b) => (Note.midi(a) || 0) - (Note.midi(b) || 0));
    const bassNote = sortedNotes[0];
    const bassNoteMidi = Note.midi(bassNote);
    const topNote = sortedNotes[sortedNotes.length - 1];

    const detectedName = detectChordFromNotes(notes);

    // --- Fallback for non-standard chords (rotational inversion) ---
    if (!detectedName) {
        let invertedNotes;
        if (direction === 'up') {
            const upperNotes = sortedNotes.slice(1);
            const newTopNote = Note.transpose(bassNote, 'P8'); // Move bass note up an octave
            invertedNotes = newTopNote ? [...upperNotes, newTopNote] : notes;
        } else { // 'down'
            const bottomNotes = sortedNotes.slice(0, -1);
            const newBottomNote = Note.transpose(topNote, '-P8'); // Move top note down an octave
            invertedNotes = newBottomNote ? [newBottomNote, ...bottomNotes] : notes;
        }
        return wrapNotesToRange(invertedNotes);
    }

    // --- Standard Inversion Logic ---
    const chordInfo = Chord.get(detectedName);
    const rootPositionPitchClasses = chordInfo.notes;
    const currentBassPitchClass = Note.pitchClass(bassNote);
    
    const currentInversionIndex = rootPositionPitchClasses.indexOf(currentBassPitchClass);
    if (currentInversionIndex === -1) {
        // Fallback if the bass note isn't a chord tone, which is unlikely but safe.
        return getInversion(notes, direction); 
    }
    
    const numNotes = rootPositionPitchClasses.length;
    const change = direction === 'up' ? 1 : -1;
    const nextInversionIndex = (currentInversionIndex + change + numNotes) % numNotes;
    const newBassPitchClass = rootPositionPitchClasses[nextInversionIndex];
    
    // Find the specific instance (with octave) of the new bass note that is
    // closest to the old bass note in the desired direction.
    let newBassNote;
    if (direction === 'up') {
        let octave = Note.octave(bassNote) || 4;
        let tempMidi = Note.midi(`${newBassPitchClass}${octave}`);
        while (tempMidi !== null && bassNoteMidi !== null && tempMidi <= bassNoteMidi) {
            octave++;
            tempMidi = Note.midi(`${newBassPitchClass}${octave}`);
        }
        newBassNote = `${newBassPitchClass}${octave}`;
    } else { // 'down'
        let octave = Note.octave(bassNote) || 4;
        let tempMidi = Note.midi(`${newBassPitchClass}${octave}`);
        while (tempMidi !== null && bassNoteMidi !== null && tempMidi >= bassNoteMidi) {
            octave--;
            tempMidi = Note.midi(`${newBassPitchClass}${octave}`);
        }
        newBassNote = `${newBassPitchClass}${octave}`;
    }
    
    // Re-order the root pitch classes to start from our new bass note to get the correct order for the upper voices.
    const reorderedRootPcs = [
        ...rootPositionPitchClasses.slice(nextInversionIndex), 
        ...rootPositionPitchClasses.slice(0, nextInversionIndex)
    ];
    const upperPitchClasses = reorderedRootPcs.slice(1);

    // Build the final ascending voicing from the new calculated bass note.
    const finalVoicing = buildAscendingVoicing(newBassNote, upperPitchClasses);
    return wrapNotesToRange(finalVoicing);
};

/**
 * Calculates the next ascending inversion of a chord.
 * @param {string[]} notes - The current chord notes.
 * @returns {string[]} The notes of the next inversion.
 */
export const getNextInversion = (notes) => getInversion(notes, 'up');

/**
 * Calculates the next descending inversion of a chord.
 * @param {string[]} notes - The current chord notes.
 * @returns {string[]} The notes of the previous inversion.
 */
export const getPreviousInversion = (notes) => getInversion(notes, 'down');

/**
 * A simple array shuffle utility.
 * @param {any[]} array - The array to shuffle.
 * @returns {any[]} The shuffled array.
 */
const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

/**
 * Creates a new voicing of a chord by keeping the bass note the same
 * and shuffling the upper voices.
 * @param {string[]} notes - The original chord notes.
 * @returns {string[]} A new array of notes with a permuted voicing.
 */
export const getPermutedVoicing = (notes) => {
    if (notes.length < 3) return notes; // Permutation needs at least two upper notes.

    const sortedNotes = notes.slice().sort((a, b) => (Note.midi(a) || 0) - (Note.midi(b) || 0));
    const bassNote = sortedNotes[0];
    const upperNotes = sortedNotes.slice(1);
    const originalUpperPitchClasses = upperNotes.map(n => Note.pitchClass(n));

    // Shuffle until a different order is achieved, with a max attempt limit.
    let shuffledUpperPitchClasses;
    let attempts = 0;
    const maxAttempts = 10; 
    do {
        shuffledUpperPitchClasses = shuffle([...originalUpperPitchClasses]);
        attempts++;
    } while (
        shuffledUpperPitchClasses.every((pc, i) => pc === originalUpperPitchClasses[i]) &&
        attempts < maxAttempts
    );

    return buildAscendingVoicing(bassNote, shuffledUpperPitchClasses);
};


/**
 * Generates an array of notes with correct octaves for a given chord symbol and bass octave.
 * This is crucial for playing inversions correctly, ensuring an ascending voicing.
 * @param {string} chordName - The name of the chord, including any inversion (e.g., 'Cmaj7/E').
 * @param {number} octave - The octave for the bass note of the chord.
 * @returns {string[]} An array of scientific note names (e.g., ['E4', 'G4', 'B4', 'C5']).
 */
export const getChordNotesWithOctaves = (chordName, octave) => {
    if (!chordName || chordName === 'Rest') return [];

    const chordInfo = Chord.get(chordName);
    if (chordInfo.empty || !chordInfo.tonic) return [];

    // 1. Get root position notes to establish the base structure (e.g., Cmaj7 -> ['C', 'E', 'G', 'B'])
    const rootPositionNotes = Chord.get(chordInfo.tonic + chordInfo.type).notes;
    if (rootPositionNotes.length === 0) return [];

    // 2. Identify the bass note (root of the inversion, e.g., 'E' for 'Cmaj7/E')
    const bassNote = chordInfo.root || chordInfo.tonic;

    // 3. Reorder notes starting from the bass note for the correct voicing.
    const bassNoteIndex = rootPositionNotes.indexOf(bassNote);
    if (bassNoteIndex === -1) return [];

    const reorderedNotes = [
        ...rootPositionNotes.slice(bassNoteIndex),
        ...rootPositionNotes.slice(0, bassNoteIndex)
    ];

    // 4. Apply octaves, starting with the bass note, ensuring the voicing is always ascending.
    let currentOctave = octave;
    let previousMidi = null; 

    return reorderedNotes.map(note => {
        let noteWithOctave = `${note}${currentOctave}`;
        let currentMidi = Note.midi(noteWithOctave);

        // If the current note's MIDI value is less than or equal to the previous one,
        // it means we've crossed an octave boundary and need to go up.
        if (currentMidi !== null && previousMidi !== null && currentMidi <= previousMidi) {
            currentOctave++;
            noteWithOctave = `${note}${currentOctave}`;
            currentMidi = Note.midi(noteWithOctave);
        }

        previousMidi = currentMidi;
        return noteWithOctave;
    });
};
