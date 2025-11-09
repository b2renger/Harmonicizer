import { Mode, Chord, Scale, Interval, Note } from 'tonal';
import { getAbbreviatedChordName, getChordNotesWithOctaves as getChordNotesWithOctavesUtil } from './chords.js';

/**
 * A robust wrapper around Tonal.Chord.get to handle inconsistencies
 * from Tonal.Mode.seventhChords, like "G half-diminished seventh".
 * @param chordName The name of the chord to parse.
 * @returns A Tonal Chord object.
 */
const getChordInfo = (chordName) => {
    if (!chordName) return Chord.get('');
    
    // First try to get it directly
    let info = Chord.get(chordName);
    if (!info.empty) return info;

    // If it fails, try some common normalizations.
    // e.g., "G half-diminished seventh" -> "Gm7b5"
    if (chordName.includes('half-diminished seventh')) {
        const tonic = chordName.split(' ')[0];
        info = Chord.get(`${tonic}m7b5`);
    } else if (chordName.endsWith('ø7')) {
        info = Chord.get(chordName.replace('ø7', 'm7b5'));
    } else if (chordName.endsWith('o7')) {
        info = Chord.get(chordName.replace('o7', 'dim7'));
    }
    
    return info;
};

/**
 * Generates a detailed Roman numeral for a given chord in the context of a key and mode.
 * @param chordName The name of the chord (e.g., "Am7").
 * @param key The tonic of the key (e.g., "C").
 * @param mode The mode of the key (e.g., "major").
 * @returns A Roman numeral string (e.g., "vim7") or an empty string.
 */
export const getRomanNumeralForChord = (chordName, key, mode) => {
    const scale = Scale.get(`${key} ${mode}`);
    const chordInfo = Chord.get(chordName);
    if (scale.empty || chordInfo.empty || !chordInfo.tonic) return '';

    const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    
    // Find diatonic degree
    const simplifiedTonic = Note.simplify(chordInfo.tonic);
    const degreeIndex = scale.notes.findIndex(note => Note.simplify(note) === simplifiedTonic);

    let roman = '';
    let accidental = '';

    if (degreeIndex !== -1) {
        roman = numerals[degreeIndex];
    } else {
        // Handle chromatic/borrowed chords
        const interval = Interval.distance(key, chordInfo.tonic);
        const intervalInfo = Interval.get(interval);
        if (!intervalInfo.num || intervalInfo.num > 7) return '';
        
        const baseDegreeIndex = intervalInfo.num - 1;
        roman = numerals[baseDegreeIndex];
        
        const diatonicNote = scale.notes[baseDegreeIndex];
        const diatonicInterval = Interval.distance(key, diatonicNote);
        const diatonicSemitones = Interval.semitones(diatonicInterval);
        const currentSemitones = Interval.semitones(interval);

        if (diatonicSemitones === null || currentSemitones === null) return '';

        if (currentSemitones > diatonicSemitones) {
            accidental = '#';
        } else if (currentSemitones < diatonicSemitones) {
            accidental = 'b';
        }
    }
    
    // Determine quality and suffix
    let suffix = chordInfo.type;
    // FIX: Cast quality to string to avoid type errors with tonal's sometimes-incomplete ChordQuality type.
    const quality = chordInfo.quality as string;

    if (quality === 'Minor' || quality === 'Diminished' || quality === 'Half-diminished') {
        roman = roman.toLowerCase();
    }
    
    if (quality === 'Major') {
        suffix = (suffix === 'M' || suffix === 'maj') ? '' : suffix;
    } else if (quality === 'Minor') {
        suffix = (suffix === 'm') ? '' : suffix;
    } else if (quality === 'Diminished') {
        suffix = '°';
        if (chordInfo.type === 'dim7') suffix = '°7';
    } else if (quality === 'Half-diminished') {
        suffix = 'ø7';
    } else if (quality === 'Augmented') {
        roman = roman + '+';
        suffix = (suffix === 'aug') ? '' : suffix;
    }
    
    return accidental + roman + suffix;
};

/**
 * Calculates the Roman numeral for a single note's degree within a key and mode.
 * The case of the numeral (e.g., 'ii' vs 'II') reflects the quality of the diatonic triad built on that degree.
 * @param note The note to analyze (e.g., "D").
 * @param key The tonic of the key (e.g., "C").
 * @param mode The mode of the key (e.g., "major").
 * @returns The Roman numeral as a string (e.g., "ii", "bVI", "#IV°") or an empty string if not found.
 */
export const getRomanNumeralForNote = (note, key, mode) => {
    const scale = Scale.get(`${key} ${mode}`);
    const diatonicTriads = Mode.triads(mode, key);
    if (scale.empty || diatonicTriads.length === 0) return '';
    
    const simplifiedNote = Note.simplify(note);
    
    // Find diatonic degree
    const degreeIndex = scale.notes.findIndex(scaleNote => Note.simplify(scaleNote) === simplifiedNote);

    if (degreeIndex !== -1) {
        // It's diatonic, so we can determine the quality and case.
        const diatonicTriad = diatonicTriads[degreeIndex];
        const quality = Chord.get(diatonicTriad).quality;
        const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        let roman = numerals[degreeIndex];
        if (quality === 'Minor' || quality === 'Diminished') {
            roman = roman.toLowerCase();
        }
        if (quality === 'Diminished') return roman + '°';
        if (quality === 'Augmented') return roman + '+';
        return roman;
    } else {
        // It's chromatic, calculate from interval.
        const interval = Interval.distance(key, note);
        const intervalInfo = Interval.get(interval);
        if (!intervalInfo.num || intervalInfo.num > 7) return '';
        
        const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        const baseDegreeIndex = intervalInfo.num - 1;
        let roman = numerals[baseDegreeIndex];
        
        const diatonicNote = scale.notes[baseDegreeIndex];
        const diatonicInterval = Interval.distance(key, diatonicNote);
        const diatonicSemitones = Interval.semitones(diatonicInterval);
        const currentSemitones = Interval.semitones(interval);

        if (diatonicSemitones === null || currentSemitones === null) return '';

        let accidental = '';
        if (currentSemitones > diatonicSemitones) {
            accidental = '#';
        } else if (currentSemitones < diatonicSemitones) {
            accidental = 'b';
        }
        // For chromatic notes, we can't infer quality, so we leave it uppercase by convention.
        return accidental + roman;
    }
}


export const getDiatonicChords = (tonic, modeName) => {
    try {
        const chords = Mode.seventhChords(modeName, tonic);
        if (!chords || chords.length === 0) {
            return [];
        }
        
        return chords.map(chordName => {
            const chordInfo = getChordInfo(chordName);
            const abbreviatedName = getAbbreviatedChordName(chordInfo.symbol || chordName);
            const roman = getRomanNumeralForChord(abbreviatedName, tonic, modeName);
            return { name: abbreviatedName, roman };
        });
    } catch {
        return [];
    }
};

export const getBorrowedChords = (tonic, modeName) => {
    let parallelModeName = null;
    if (modeName === 'major') parallelModeName = 'minor';
    else if (modeName === 'minor') parallelModeName = 'major';
    else return []; // Borrowing is most common between parallel major/minor

    if (!parallelModeName) return [];

    const currentDiatonicChordSymbols = new Set(getDiatonicChords(tonic, modeName).map(c => c.name));
    const parallelDiatonicChords = getDiatonicChords(tonic, parallelModeName);
    
    const borrowedChords = parallelDiatonicChords.filter(pChord => 
        !currentDiatonicChordSymbols.has(pChord.name)
    );
    
    // Recalculate roman numerals from the perspective of the original mode
    return borrowedChords.map(chord => ({
        name: chord.name,
        roman: getRomanNumeralForChord(chord.name, tonic, modeName)
    }));
};

// A dictionary of common harmonic patterns.
export const COMMON_PATTERNS = {
    'ii-V-I Turnaround': ['ii', 'V', 'I'],
    'I-vi-IV-V "Doo-Wop"': ['I', 'vi', 'IV', 'V'],
    'I-V-vi-IV "Axis"': ['I', 'V', 'vi', 'IV'],
    'Minor iv-V-i': ['iv', 'V', 'i'],
    'Authentic Cadence (V-I)': ['V', 'I'],
    'Plagal Cadence (IV-I)': ['IV', 'I'],
    'Half Cadence (to V)': ['ii', 'V'],
    'Deceptive Cadence (V-vi)': ['V', 'vi'],
};

/**
 * Gets a chord symbol for a given Roman numeral in a key.
 * @param roman The Roman numeral (e.g., "IV", "vi").
 * @param key The tonic of the key.
 * @param mode The mode of the key.
 * @returns A chord symbol (e.g., "Fmaj7") or null.
 */
export const getChordFromRomanNumeral = (roman, key, mode) => {
    const scale = Scale.get(`${key} ${mode}`);
    if (scale.empty) return null;

    const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    const baseRoman = roman.replace('°', '').replace('+', '').toUpperCase();
    const degreeIndex = numerals.indexOf(baseRoman);
    
    if (degreeIndex === -1) return null;
    
    // Tonal's Mode.seventhChords is more reliable for getting the correct chord quality
    const diatonicChords = Mode.seventhChords(mode, key);
    if (diatonicChords.length > degreeIndex) {
        return getAbbreviatedChordName(diatonicChords[degreeIndex]);
    }
    
    return null;
}

/**
 * Generates a random 4-chord progression based on common patterns.
 * @param key The tonic of the key.
 * @param mode The mode of the key.
 * @returns An array of 4 chord names.
 */
export const generateRandomProgression = (key, mode) => {
    const fourChordPatterns = Object.values(COMMON_PATTERNS).filter(p => p.length === 4);
    
    let patternToUse;

    if (fourChordPatterns.length > 0) {
        patternToUse = fourChordPatterns[Math.floor(Math.random() * fourChordPatterns.length)];
    } else {
        // Fallback if no 4-chord patterns are defined
        patternToUse = mode === 'minor' ? ['i', 'VI', 'III', 'VII'] : ['I', 'V', 'vi', 'IV'];
    }
    
    const chords = patternToUse
        .map(numeral => getChordFromRomanNumeral(numeral, key, mode))
        .filter((c) => c !== null);

    // If any chord failed to convert, use a failsafe progression
    if (chords.length !== 4) {
        const fallbackNumerals = mode === 'minor' ? ['i', 'iv', 'V', 'i'] : ['I', 'IV', 'V', 'I'];
         return fallbackNumerals.map(n => getChordFromRomanNumeral(n, key, mode)).filter((c) => c !== null);
    }
    
    return chords;
};

// Re-export for use in analysis module
export { getChordNotesWithOctavesUtil as getChordNotesWithOctaves };