
import { Mode, Chord, Scale, Interval, Note } from 'tonal';
import { getAbbreviatedChordName, getChordNotesWithOctaves as getChordNotesWithOctavesUtil } from './chords.js';
import { parseRomanNumeral, type ParsedNumeral } from './romanNumeral.js';

/**
 * A robust wrapper around Tonal.Chord.get to handle inconsistencies
 * from Tonal.Mode.seventhChords, like "G half-diminished seventh".
 * @param {string} chordName - The name of the chord to parse.
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
 * @param {string} chordName - The name of the chord (e.g., "Am7").
 * @param {string} key - The tonic of the key (e.g., "C").
 * @param {string} mode - The mode of the key (e.g., "major").
 * @returns {string} A Roman numeral string (e.g., "vim7") or an empty string.
 */
export const getRomanNumeralForChord = (chordName, key, mode) => {
    // Must use the same reference scale as getChordFromRomanNumeral, or numerals will not
    // round-trip: harmonic minor puts the leading tone at degree 7, so Bb in C minor is
    // correctly labelled 'bVII' rather than a plain 'VII'.
    const scale = Scale.get(degreeReferenceScale(key, mode));
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
        // Handle chromatic/borrowed chords by calculating interval from the key's tonic.
        const interval = Interval.distance(key, chordInfo.tonic);
        const intervalInfo = Interval.get(interval);
        if (!intervalInfo.num || intervalInfo.num > 7) return '';
        
        const baseDegreeIndex = intervalInfo.num - 1;
        roman = numerals[baseDegreeIndex];
        
        // Determine if an accidental (b or #) is needed.
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
    
    // `chordInfo.type` is prose ("major seventh"), which is why numerals used to render as
    // "Imajor seventh". The first alias is Tonal's short form: "maj7", "7", "m7", "m7b5".
    const alias = chordInfo.aliases?.[0] ?? '';
    const quality = chordInfo.quality as string; // Cast needed due to Tonal.js types
    let suffix: string;

    // Half-diminished must be detected by type: Tonal reports its quality as "Diminished".
    if (chordInfo.type === 'half-diminished') {
        roman = roman.toLowerCase();
        suffix = 'ø7';
    } else if (quality === 'Diminished') {
        roman = roman.toLowerCase();
        suffix = chordInfo.type === 'diminished seventh' ? '°7' : '°';
    } else if (quality === 'Augmented') {
        roman = roman + '+';
        suffix = alias === 'aug' ? '' : alias;
    } else if (quality === 'Minor') {
        roman = roman.toLowerCase();
        // Lower case already conveys the minor third, so drop the leading 'm': vi7, not vim7.
        suffix = alias === 'm' ? '' : alias.replace(/^m/, '');
    } else {
        // Major family, which includes dominant sevenths.
        suffix = (alias === 'M' || alias === '') ? '' : alias;
    }

    return accidental + roman + suffix;
};

/**
 * Calculates the Roman numeral for a single note's degree within a key and mode.
 * The case of the numeral (e.g., 'ii' vs 'II') reflects the quality of the diatonic triad built on that degree.
 * @param {string} note - The note to analyze (e.g., "D").
 * @param {string} key - The tonic of the key (e.g., "C").
 * @param {string} mode - The mode of the key (e.g., "major").
 * @returns {string} The Roman numeral as a string (e.g., "ii", "bVI", "#IV°") or an empty string if not found.
 */
export const getRomanNumeralForNote = (note, key, mode) => {
    const scale = Scale.get(`${key} ${mode}`);
    const diatonicTriads = Mode.triads(mode, key);
    if (scale.empty || diatonicTriads.length === 0) return '';
    
    const simplifiedNote = Note.simplify(note);
    
    const degreeIndex = scale.notes.findIndex(scaleNote => Note.simplify(scaleNote) === simplifiedNote);

    if (degreeIndex !== -1) {
        // It's a diatonic note.
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
        // It's a chromatic note.
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
        // For chromatic notes, quality is ambiguous, so use uppercase by convention.
        return accidental + roman;
    }
}

/**
 * Gets all the diatonic seventh chords for a given key and mode.
 * @param {string} tonic - The tonic of the key (e.g., "C").
 * @param {string} modeName - The name of the mode (e.g., "major").
 * @returns {Array<{name: string, roman: string}>} An array of chord objects.
 */
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

/**
 * Gets chords "borrowed" from the parallel mode (e.g., from C minor while in C major).
 * @param {string} tonic - The tonic of the key.
 * @param {string} modeName - The original mode name.
 * @returns {Array<{name: string, roman: string}>} An array of borrowed chord objects.
 */
export const getBorrowedChords = (tonic, modeName) => {
    let parallelModeName = null;
    if (modeName === 'major') parallelModeName = 'minor';
    else if (modeName === 'minor') parallelModeName = 'major';
    else return []; // Borrowing is most common between parallel major/minor

    if (!parallelModeName) return [];

    const currentDiatonicChordSymbols = new Set(getDiatonicChords(tonic, modeName).map(c => c.name));
    const parallelDiatonicChords = getDiatonicChords(tonic, parallelModeName);
    
    // Find chords from the parallel mode that are not in the current mode.
    const borrowedChords = parallelDiatonicChords.filter(pChord => 
        !currentDiatonicChordSymbols.has(pChord.name)
    );
    
    // Recalculate roman numerals from the perspective of the original mode.
    return borrowedChords.map(chord => ({
        name: chord.name,
        roman: getRomanNumeralForChord(chord.name, tonic, modeName)
    }));
};

/**
 * Whether a mode behaves as major or minor when choosing chords.
 * The tables below are keyed by this rather than by the exact mode; the seven modes
 * differ in ways this interim scaffolding does not model.
 */
export const modeFamily = (mode: string): 'major' | 'minor' =>
    ['minor', 'aeolian', 'dorian', 'phrygian', 'locrian'].includes(mode) ? 'minor' : 'major';

/**
 * Common harmonic patterns as explicit Roman numerals, split by mode family.
 *
 * Numerals now carry their own quality, so these must say what they mean: 'V7' for a
 * dominant seventh, 'viiø7' for the half-diminished leading-tone chord in major, 'vii°7'
 * for the fully diminished one in minor.
 *
 * Interim scaffolding: replaced by the brick grammar in step 3 of the accompaniment spec.
 */
export const COMMON_PATTERNS = {
    major: {
        'ii-V-I Turnaround':        ['ii7', 'V7', 'Imaj7'],
        'I-vi-IV-V "Doo-Wop"':      ['Imaj7', 'vi7', 'IVmaj7', 'V7'],
        'I-V-vi-IV "Axis"':         ['Imaj7', 'V7', 'vi7', 'IVmaj7'],
        'vi-IV-I-V':                ['vi7', 'IVmaj7', 'Imaj7', 'V7'],
        'I-IV-vi-V':                ['Imaj7', 'IVmaj7', 'vi7', 'V7'],
        'iii-vi-ii-V':              ['iii7', 'vi7', 'ii7', 'V7'],
        'Authentic Cadence (V-I)':  ['V7', 'Imaj7'],
        'Plagal Cadence (IV-I)':    ['IVmaj7', 'Imaj7'],
        'Half Cadence (to V)':      ['ii7', 'V7'],
        'Deceptive Cadence (V-vi)': ['V7', 'vi7'],
    },
    minor: {
        'i-iv-V-i':                 ['i7', 'iv7', 'V7', 'i7'],
        'i-VI-III-VII':             ['i7', 'VImaj7', 'IIImaj7', 'bVII7'],
        'Andalusian i-VII-VI-V':    ['i7', 'bVII7', 'VImaj7', 'V7'],
        'i-iv-bVII-III':            ['i7', 'iv7', 'bVII7', 'IIImaj7'],
        'iiø-V-i Turnaround':       ['iiø7', 'V7', 'i7'],
        'Minor Authentic (V-i)':    ['V7', 'i7'],
    },
};

/**
 * Gets a chord symbol for a given Roman numeral in a key.
 * @param {string} roman - The Roman numeral (e.g., "IV", "vi").
 * @param {string} key - The tonic of the key.
 * @param {string} mode - The mode of the key.
 * @returns {string | null} A chord symbol (e.g., "Fmaj7") or null.
 */
export const getChordFromRomanNumeral = (roman, key, mode) => {
    const parsed = parseRomanNumeral(roman);
    if (!parsed) return null;

    const scale = Scale.get(degreeReferenceScale(key, mode));
    if (scale.empty) return null;

    const degreeNote = scale.notes[parsed.degree];
    if (!degreeNote) return null;

    let root = degreeNote;
    if (parsed.accidental === 1) root = Note.transpose(root, 'A1');
    else if (parsed.accidental === -1) root = Note.transpose(root, 'd1');
    if (!root) return null;

    const type = chordTypeForNumeral(parsed);
    if (type === null) return null;

    const chord = Chord.get(`${root}${type}`);
    if (chord.empty || !chord.tonic) return null;

    return getAbbreviatedChordName(chord.symbol);
}

/**
 * The scale a Roman numeral's degrees are counted against.
 *
 * For minor this is *harmonic* minor, not natural minor. A numeral like "vii°7" means the
 * leading-tone chord; counting against natural minor would root it on the subtonic (Bb in
 * C minor) and produce a chord nobody asked for. Harmonic minor puts the leading tone at
 * degree 7, and the subtonic is then written explicitly as "bVII".
 */
const degreeReferenceScale = (key: string, mode: string): string =>
    mode === 'minor' ? `${key} harmonic minor` : `${key} ${mode}`;

/**
 * Maps a parsed numeral's case and marker to a Tonal chord type suffix.
 * The numeral is authoritative: case carries the third, the marker carries
 * diminished / half-diminished / augmented.
 * @returns {string | null} A chord type suffix, or null if the combination is meaningless.
 */
const chordTypeForNumeral = (p: ParsedNumeral): string | null => {
    const { marker, suffix } = p;

    if (marker === '+') return suffix ? `aug${suffix}` : 'aug';
    if (marker === 'ø') return (suffix === '' || suffix === '7') ? 'm7b5' : null;
    if (marker === '°') {
        if (suffix === '') return 'dim';
        if (suffix === '7') return 'dim7';
        return null;
    }

    if (p.case === 'upper') {
        if (suffix === '') return '';        // major triad
        if (suffix === '7') return '7';      // dominant seventh, not major seventh
        return suffix;                       // maj7, 9, 13, sus4, ...
    }
    return suffix === '' ? 'm' : `m${suffix}`;
}

/**
 * Generates a random 4-chord progression based on common patterns.
 * @param {string} key - The tonic of the key.
 * @param {string} mode - The mode of the key.
 * @returns {string[]} An array of 4 chord names.
 */
export const generateRandomProgression = (key, mode) => {
    const family = modeFamily(mode);
    const fourChordPatterns = Object.values(COMMON_PATTERNS[family]).filter(p => p.length === 4);

    let patternToUse;

    if (fourChordPatterns.length > 0) {
        patternToUse = fourChordPatterns[Math.floor(Math.random() * fourChordPatterns.length)];
    } else {
        // Fallback if no 4-chord patterns are defined.
        patternToUse = family === 'minor' ? ['i7', 'VImaj7', 'IIImaj7', 'bVII7'] : ['Imaj7', 'V7', 'vi7', 'IVmaj7'];
    }

    const chords = patternToUse
        .map(numeral => getChordFromRomanNumeral(numeral, key, mode))
        .filter((c): c is string => c !== null);

    // If any chord failed to convert, use a failsafe progression.
    if (chords.length !== 4) {
        const fallbackNumerals = family === 'minor' ? ['i7', 'iv7', 'V7', 'i7'] : ['Imaj7', 'IVmaj7', 'V7', 'Imaj7'];
         return fallbackNumerals.map(n => getChordFromRomanNumeral(n, key, mode)).filter((c): c is string => c !== null);
    }

    return chords;
};

// Re-export for use in other modules.
export { getChordNotesWithOctavesUtil as getChordNotesWithOctaves };
