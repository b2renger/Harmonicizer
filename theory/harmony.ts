import { Mode, Chord, Scale, Interval, Note } from 'tonal';
import { getAbbreviatedChordName } from './chords';

/**
 * A robust wrapper around Tonal.Chord.get to handle inconsistencies
 * from Tonal.Mode.seventhChords, like "G half-diminished seventh".
 * @param chordName The name of the chord to parse.
 * @returns A Tonal Chord object.
 */
const getChordInfo = (chordName: string) => {
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
export const getRomanNumeralForChord = (chordName: string, key: string, mode: string): string => {
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

export const getDiatonicChords = (tonic: string, modeName: string): Array<{ name: string; roman: string }> => {
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

export const getBorrowedChords = (tonic: string, modeName: string): Array<{ name: string; roman: string }> => {
    let parallelModeName: string | null = null;
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
