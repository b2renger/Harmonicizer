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
 * Returns a consistently abbreviated name for a chord by reconstructing it from
 * Tonal's tonic and type properties. This ensures "Cdim" is used instead of "Co", etc.
 * The root note is lowercased to match user request (e.g., "bm7").
 * @param chordName The chord name to abbreviate.
 * @returns The abbreviated chord name.
 */
export const getAbbreviatedChordName = (chordName: string): string => {
    if (!chordName || chordName === 'Rest') {
        return chordName;
    }
    const chordInfo = Chord.get(chordName);
    if (chordInfo.empty || !chordInfo.tonic) {
        return chordName; // Return original if not recognized
    }

    const displayTonic = chordInfo.tonic.toLowerCase();
    let displayType = chordInfo.type;
    
    // For major triads, Tonal's `type` is 'M'. To avoid ambiguity with minor ('m'),
    // we'll explicitly use 'maj' for major triads, following the lowercase root convention.
    if (displayType === 'M') {
        displayType = 'maj';
    }
    
    return displayTonic + displayType;
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
 * Calculates the next or previous inversion of a chord.
 * @param chordName The name of the chord (e.g., 'Cmaj7', 'Cmaj7/E').
 * @param direction 'up' for the next inversion, 'down' for the previous.
 * @returns The new chord name representing the inverted chord.
 */
export const invertChord = (chordName: string, direction: 'up' | 'down'): string => {
    if (!chordName || chordName === 'Rest') return chordName;

    const chordInfo = Chord.get(chordName);
    if (chordInfo.empty) return chordName;

    // Get the notes in root position to determine the inversion cycle
    const rootPositionChord = Chord.get(chordInfo.tonic + chordInfo.type);
    const notesInOrder = rootPositionChord.notes;
    if (notesInOrder.length <= 1) return chordName;

    const currentBass = chordInfo.root || chordInfo.tonic;
    const currentInversionIndex = notesInOrder.indexOf(currentBass as string);

    if (currentInversionIndex === -1) return chordName; // Should not happen

    let nextInversionIndex;
    if (direction === 'up') {
        nextInversionIndex = (currentInversionIndex + 1) % notesInOrder.length;
    } else {
        nextInversionIndex = (currentInversionIndex - 1 + notesInOrder.length) % notesInOrder.length;
    }

    if (nextInversionIndex === 0) {
        return rootPositionChord.symbol; // Back to root position
    } else {
        const newBass = notesInOrder[nextInversionIndex];
        return `${rootPositionChord.symbol}/${newBass}`;
    }
};

/**
 * Selects a random inversion for the given chord, ensuring it's different from the current one.
 * @param chordName The name of the chord.
 * @returns A new chord name representing a random inversion.
 */
export const randomlyInvertChord = (chordName: string): string => {
    if (!chordName || chordName === 'Rest') return chordName;

    const chordInfo = Chord.get(chordName);
    if (chordInfo.empty) return chordName;

    const rootPositionChord = Chord.get(chordInfo.tonic + chordInfo.type);
    const notes = rootPositionChord.notes;
    if (notes.length <= 1) return chordName;

    const currentBass = chordInfo.root || chordInfo.tonic;
    const currentInversionIndex = notes.indexOf(currentBass as string);
    if (currentInversionIndex === -1) return chordName;

    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * notes.length);
    } while (notes.length > 1 && randomIndex === currentInversionIndex);
    
    if (randomIndex === 0) {
        return rootPositionChord.symbol;
    } else {
        const newBass = notes[randomIndex];
        return `${rootPositionChord.symbol}/${newBass}`;
    }
};

/**
 * Generates an array of notes with correct octaves for a given chord symbol and bass octave.
 * This is crucial for playing inversions correctly.
 * @param chordName The name of the chord, including any inversion (e.g., 'Cmaj7/E').
 * @param octave The octave for the bass note of the chord.
 * @returns An array of scientific note names (e.g., ['E4', 'G4', 'B4', 'C5']).
 */
export const getChordNotesWithOctaves = (chordName: string, octave: number): string[] => {
    if (!chordName || chordName === 'Rest') return [];

    const chordInfo = Chord.get(chordName);
    if (chordInfo.empty) return [];
    const notes = chordInfo.notes;

    if (!notes || notes.length === 0) return [];

    let currentOctave = octave;
    let previousChroma: number | null = null;
    
    return notes.map((note, index) => {
        const chroma = Note.chroma(note);
        if (chroma === null) return ''; // Should not happen with valid notes

        if (index > 0 && previousChroma !== null && chroma < previousChroma) {
            currentOctave++;
        }
        
        previousChroma = chroma;
        return `${note}${currentOctave}`;
    }).filter(Boolean); // Filter out any empty strings
};