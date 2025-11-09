import { Chord, Note } from 'tonal';

export const rootNotes: string[] = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const chordTypes: string[] = [
    'maj', 'm', 'maj7', 'm7', '7',
    'dim', 'dim7', 'm7b5', 'aug',
    'sus2', 'sus4', '6', 'm6', 'add9', 'm9', 'maj9'
];

export const modes: string[] = [
    'major',
    'minor',
    'dorian',
    'phrygian',
    'lydian',
    'mixolydian',
    'locrian',
];

/**
 * Detects the most likely chord from a set of notes, ensuring the result is valid.
 * @param notes An array of note names (e.g., ['C4', 'E4', 'G4']).
 * @returns The detected chord symbol (e.g., 'C') or null if no valid chord is detected.
 */
export const detectChordFromNotes = (notes: string[]): string | null => {
    // A chord needs at least two notes to be detected.
    if (notes.length < 2) {
        return null;
    }

    // Tonal.Chord.detect works best with pitch classes, so we remove the octave info.
    const pitchClasses = notes.map(Note.pitchClass);
    const detectedChords = Chord.detect(pitchClasses);

    if (detectedChords.length === 0) {
        return null;
    }

    // Find the first detected chord name that Tonal can fully parse.
    // This ensures compatibility with the rest of the app's functions.
    for (const chordName of detectedChords) {
        const chordInfo = Chord.get(chordName);
        if (!chordInfo.empty && chordInfo.tonic) {
            // It's a valid, parsable chord. Return its standardized symbol.
            return chordInfo.symbol;
        }
    }

    // If no detected chords could be parsed by Chord.get(), return null.
    return null;
};

/**
 * Gets an abbreviated display name (e.g. "Cmaj7" or "Rest") from an array of notes.
 * @param notes An array of note names.
 * @returns The detected chord symbol or a fallback.
 */
export const getAbbreviatedNameFromNotes = (notes: string[]): string => {
    if (!notes || notes.length === 0) return "Rest";
    const detectedName = detectChordFromNotes(notes);
    if (!detectedName) {
        return notes.map(n => Note.pitchClass(n)).join('-');
    }
    return detectedName;
};

/**
 * Returns a consistently abbreviated name for a chord by returning its canonical symbol from Tonal.js
 * This ensures that names are always valid for the library (e.g., "Cmaj7", not "cmaj7").
 * @param chordName The chord name to abbreviate.
 * @returns The abbreviated and valid chord name.
 */
export const getAbbreviatedChordName = (chordName: string): string => {
    if (!chordName || chordName === 'Rest') {
        return chordName;
    }
    const chordInfo = Chord.get(chordName);
    if (chordInfo.empty || !chordInfo.tonic) {
        return chordName; // Return original if not recognized
    }

    // The .symbol property from Tonal.js is the most reliable and canonical representation.
    // e.g., for "C Major", it gives "C"; for "A minor seventh", it gives "Am7".
    // This avoids manual string concatenation that could create invalid names.
    return chordInfo.symbol;
};


/**
 * Returns a descriptive name for a chord, like "C4 Major 7th".
 * Handles slash chords by indicating the bass note (e.g. "C4 Major 7th / E")
 * @param chordName The chord name to format (e.g., 'Cmaj7/E').
 * @param octave The octave of the chord. If provided, it will be included in the name.
 * @returns The descriptive chord name.
 */
export const getDisplayChordName = (chordName: string, octave?: number): string => {
    if (!chordName || chordName === 'Rest') {
        return "Rest";
    }
    const chordInfo = Chord.get(chordName);
    if (chordInfo.empty || !chordInfo.tonic) {
        return chordName;
    }
    
    const tonic = chordInfo.tonic;
    const quality = (chordInfo.quality as string) || '';

    let descriptiveQuality = quality.toLowerCase();

    // Custom mappings for cleaner, more readable names
    if (descriptiveQuality === 'dominant seventh') descriptiveQuality = '7th';
    else if (descriptiveQuality === 'major') descriptiveQuality = 'major';
    else if (descriptiveQuality === 'minor') descriptiveQuality = 'minor';
    else if (descriptiveQuality === 'half-diminished') descriptiveQuality = 'm7b5';
    else if (descriptiveQuality === 'diminished') {
        descriptiveQuality = chordInfo.type === 'dim7' ? 'diminished 7th' : 'diminished';
    } else if (descriptiveQuality === 'major seventh') {
        descriptiveQuality = 'major 7th';
    } else if (descriptiveQuality === 'minor seventh') {
        descriptiveQuality = 'minor 7th';
    }

    const baseName = octave !== undefined 
        ? `${tonic}${octave} ${descriptiveQuality}`.trim()
        : `${tonic} ${descriptiveQuality}`.trim();
    
    // Handle slash chords
    if (chordInfo.root && chordInfo.root !== chordInfo.tonic) {
        return `${baseName} / ${chordInfo.root}`;
    }
    
    return baseName;
};

/**
 * Builds a musically valid, ascending chord voicing from a given bass note and the pitch classes of the upper voices.
 * @param bassNote The starting note of the chord (e.g., 'C4').
 * @param upperPitchClasses An array of the pitch classes for the other notes in a specific order (e.g., ['G', 'B', 'E']).
 * @returns A new array of notes forming an ascending chord voicing (e.g., ['C4', 'G4', 'B4', 'E5']).
 */
export const buildAscendingVoicing = (bassNote: string, upperPitchClasses: string[]): string[] => {
    let currentMidi = Note.midi(bassNote);
    if (currentMidi === null) return [];

    const results: string[] = [bassNote];
    
    for (const pc of upperPitchClasses) {
        let nextOctave = Note.octave(Note.fromMidi(currentMidi)) || 4;
        let nextNoteMidi = Note.midi(`${pc}${nextOctave}`);

        // Ensure notes always ascend by incrementing octave if needed
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
 * This method is designed to be perfectly reversible, so that applying an ascending inversion
 * followed by a descending inversion returns the chord to its original state.
 * It works by finding the next appropriate chord tone (up or down) and rebuilding the voicing
 * around it, keeping the chord in a musically similar register.
 * For non-standard chords that cannot be identified by Tonal.js, it falls back to a
 * simple rotational inversion (moving the bass note up an octave, or the top note down).
 *
 * @param notes The array of notes in the current chord voicing (e.g., ['C4', 'E4', 'G4']).
 * @param direction Whether to find the next inversion ('up') or the previous one ('down').
 * @returns A new array of notes representing the inverted chord.
 */
const getInversion = (notes: string[], direction: 'up' | 'down'): string[] => {
    // A chord needs at least two notes to be inverted.
    if (notes.length < 2) return notes;

    // Sort notes by MIDI value to reliably determine the bass and top notes.
    const sortedNotes = notes.slice().sort((a, b) => (Note.midi(a) || 0) - (Note.midi(b) || 0));
    const bassNote = sortedNotes[0];
    const bassNoteMidi = Note.midi(bassNote);
    const topNote = sortedNotes[sortedNotes.length - 1];

    // Try to identify the chord to perform a musically-aware inversion.
    const detectedName = detectChordFromNotes(notes);

    // --- Fallback for non-standard chords ---
    // If Tonal.js can't detect the chord, we perform a simple rotational inversion.
    if (!detectedName) {
        if (direction === 'up') {
            // Ascending: Move the bass note up an octave and place it at the top.
            const upperNotes = sortedNotes.slice(1);
            const newTopNote = Note.transpose(bassNote, 'P8'); // P8 = Perfect Octave
            return newTopNote ? [...upperNotes, newTopNote] : notes;
        } else { // 'down'
            // Descending: Move the top note down an octave and place it at the bottom.
            const bottomNotes = sortedNotes.slice(0, -1);
            const newBottomNote = Note.transpose(topNote, '-P8'); // -P8 = Descending Perfect Octave
            return newBottomNote ? [newBottomNote, ...bottomNotes] : notes;
        }
    }

    // --- Standard Inversion Logic ---
    const chordInfo = Chord.get(detectedName);
    // Get the pitch classes of the chord in root position (e.g., Cmaj7 -> ['C', 'E', 'G', 'B'])
    const rootPositionPitchClasses = chordInfo.notes;
    const currentBassPitchClass = Note.pitchClass(bassNote);
    
    const currentInversionIndex = rootPositionPitchClasses.indexOf(currentBassPitchClass);
    // If the current bass note isn't a chord tone, we can't do a standard inversion.
    // This is unlikely if detectChordFromNotes worked, but it's a safe fallback.
    if (currentInversionIndex === -1) {
        // Re-use the rotational inversion fallback.
        return getInversion(notes, direction); 
    }
    
    const numNotes = rootPositionPitchClasses.length;
    const change = direction === 'up' ? 1 : -1;
    // Cycle to the next/previous chord tone in the root position list.
    const nextInversionIndex = (currentInversionIndex + change + numNotes) % numNotes;
    const newBassPitchClass = rootPositionPitchClasses[nextInversionIndex];
    
    // Find the specific instance (with octave) of the new bass note that is
    // closest to the old bass note in the desired direction.
    let newBassNote: string;
    if (direction === 'up') {
        // Find the first note with the new pitch class that is higher than the old bass note.
        let octave = Note.octave(bassNote) || 4;
        let tempMidi = Note.midi(`${newBassPitchClass}${octave}`);
        while (tempMidi !== null && bassNoteMidi !== null && tempMidi <= bassNoteMidi) {
            octave++;
            tempMidi = Note.midi(`${newBassPitchClass}${octave}`);
        }
        newBassNote = `${newBassPitchClass}${octave}`;
    } else { // 'down'
        // Find the first note with the new pitch class that is lower than the old bass note.
        let octave = Note.octave(bassNote) || 4;
        let tempMidi = Note.midi(`${newBassPitchClass}${octave}`);
        while (tempMidi !== null && bassNoteMidi !== null && tempMidi >= bassNoteMidi) {
            octave--;
            tempMidi = Note.midi(`${newBassPitchClass}${octave}`);
        }
        newBassNote = `${newBassPitchClass}${octave}`;
    }
    
    // Re-order the root pitch classes to start from our new bass note.
    // This gives us the correct order for the upper voices.
    const reorderedRootPcs = [
        ...rootPositionPitchClasses.slice(nextInversionIndex), 
        ...rootPositionPitchClasses.slice(0, nextInversionIndex)
    ];
    // The remaining notes are our upper voices.
    const upperPitchClasses = reorderedRootPcs.slice(1);

    // Build the final ascending voicing from our new calculated bass note.
    return buildAscendingVoicing(newBassNote, upperPitchClasses);
};

export const getNextInversion = (notes: string[]): string[] => getInversion(notes, 'up');
export const getPreviousInversion = (notes: string[]): string[] => getInversion(notes, 'down');

const shuffle = <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

export const getPermutedVoicing = (notes: string[]): string[] => {
    if (notes.length < 3) return notes;

    const sortedNotes = notes.slice().sort((a, b) => (Note.midi(a) || 0) - (Note.midi(b) || 0));
    const bassNote = sortedNotes[0];
    const upperNotes = sortedNotes.slice(1);
    const originalUpperPitchClasses = upperNotes.map(n => Note.pitchClass(n));

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
 * This is crucial for playing inversions correctly. It now uses MIDI numbers for robust octave calculation.
 * @param chordName The name of the chord, including any inversion (e.g., 'Cmaj7/E').
 * @param octave The octave for the bass note of the chord.
 * @returns An array of scientific note names (e.g., ['E4', 'G4', 'B4', 'C5']).
 */
export const getChordNotesWithOctaves = (chordName: string, octave: number): string[] => {
    if (!chordName || chordName === 'Rest') return [];

    const chordInfo = Chord.get(chordName);
    if (chordInfo.empty || !chordInfo.tonic) return [];

    // 1. Get root position notes to establish the base structure
    const rootPositionNotes = Chord.get(chordInfo.tonic + chordInfo.type).notes;
    if (rootPositionNotes.length === 0) return [];

    // 2. Identify the bass note (root of the inversion)
    const bassNote = chordInfo.root || chordInfo.tonic;

    // 3. Reorder notes starting from the bass note for the correct voicing
    const bassNoteIndex = rootPositionNotes.indexOf(bassNote);
    if (bassNoteIndex === -1) return []; // Should not happen with valid chords

    const reorderedNotes = [
        ...rootPositionNotes.slice(bassNoteIndex),
        ...rootPositionNotes.slice(0, bassNoteIndex)
    ];

    // 4. Apply octaves, starting with the bass note, ensuring the voicing is always ascending
    let currentOctave = octave;
    let previousMidi: number | null = null; 

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