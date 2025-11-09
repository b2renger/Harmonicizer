import { Chord, Scale, Note, Mode } from 'tonal';
import type { Chord as ChordType } from '../modes/composer/Composer';
import { getRomanNumeralForChord, COMMON_PATTERNS, getChordFromRomanNumeral, getDiatonicChords, getBorrowedChords, getChordNotesWithOctaves } from './harmony';

/**
 * A robust method for checking common notes between chords, accounting for octaves.
 * @param chordName1 First chord.
 * @param chordName2 Second chord.
 * @returns The number of common pitch classes.
 */
function calculateConsonance(chordName1: string, chordName2: string): number {
    if (!chordName1 || chordName1 === 'Rest' || !chordName2 || chordName2 === 'Rest') {
        return 0;
    }
    const notes1 = Chord.get(chordName1).notes;
    const notes2 = Chord.get(chordName2).notes;
    if (!notes1 || !notes2 || notes1.length === 0 || notes2.length === 0) {
        return 0;
    }
    const set1 = new Set(notes1.map(Note.pitchClass));
    const set2 = new Set(notes2.map(Note.pitchClass));
    let commonNotes = 0;
    for (const note of set1) {
        if (set2.has(note)) {
            commonNotes++;
        }
    }
    return commonNotes;
}

const getChordComplexityScore = (chordName: string): number => {
    const notes = Chord.get(chordName).notes;
    if (notes.length >= 5) return 3; // Extended chords (9ths, 11ths, 13ths)
    if (notes.length === 4) return 2; // Seventh chords
    if (notes.length === 3) return 1; // Triads
    return 0;
};

const getChordTensionScore = (chordName: string): number => {
    // FIX: Cast quality to string to avoid type errors with tonal's sometimes-incomplete ChordQuality type.
    const quality = Chord.get(chordName).quality as string;
    if (quality === 'Diminished' || quality === 'Augmented' || quality === 'Half-diminished') return 3;
    // FIX: Added 'Dominant seventh' to correctly score tension for dominant 7th chords.
    if (quality === 'Dominant' || quality === 'Major seventh' || quality === 'Dominant seventh') return 2;
    if (quality === 'Major' || quality === 'Minor' || quality === 'Minor seventh') return 1;
    return 0;
};

const MODE_DESCRIPTIONS: Record<string, string> = {
    major: 'Bright and happy. The most common scale in Western music.',
    minor: 'Sad or melancholic. Often used for dramatic or emotional effect.',
    dorian: 'Jazzy and soulful. A minor-type scale with a raised 6th degree.',
    phrygian: 'Dark and exotic, with a distinctive Spanish or flamenco sound.',
    lydian: 'Bright and dreamy, with a raised 4th that adds a sense of wonder.',
    mixolydian: 'Bluesy and rock-oriented. A major-type scale with a flat 7th.',
    locrian: 'Tense and unstable. The darkest mode, rarely used as a tonal center.'
};

const DIATONIC_SUGGESTIONS: Record<string, string[]> = {
    'I': ['IV', 'V', 'ii', 'vi'],
    'i': ['iv', 'V', 'VI', 'iio'],
    'II': ['V', 'vii°'], 'ii': ['V', 'vii°'],
    'III': ['vi', 'IV'], 'iii': ['vi', 'IV'],
    'IV': ['V', 'I', 'ii'], 'iv': ['V', 'i'],
    'V': ['I', 'vi', 'i'],
    'VI': ['ii', 'IV'], 'vi': ['ii', 'IV'],
    'VII': ['I'], 'vii°': ['I', 'i']
};

/**
 * Generates suggestions for the next chord.
 * @param contextChordName The name of the chord to generate suggestions from. Can be null.
 * @param musicalKey The tonic of the key.
 * @param musicalMode The mode of the key.
 * @returns An object with coherent and inventive suggestions.
 */
export const getSuggestionsForChord = (contextChordName: string | null, musicalKey: string, musicalMode: string) => {
    const suggestions = {
        coherent: [] as string[],
        inventive: [] as string[],
        jazzy: [] as string[],
        classical: [] as string[],
    };
    
    // --- COHERENT (Diatonic) Suggestions ---
    if (contextChordName && contextChordName !== 'Rest') {
        const contextChordRoman = getRomanNumeralForChord(contextChordName, musicalKey, musicalMode);
        
        if (contextChordRoman) {
            const baseRomanMatch = contextChordRoman.match(/^(#|b)?(I|II|III|IV|V|VI|VII|i|ii|iii|iv|v|vi|vii)/);
            if (baseRomanMatch) {
                const simpleRoman = baseRomanMatch[2]; // just the roman part, e.g., 'vi' from 'vim7'
                const suggestionNumerals = DIATONIC_SUGGESTIONS[simpleRoman] || DIATONIC_SUGGESTIONS[simpleRoman.toUpperCase()] || DIATONIC_SUGGESTIONS[simpleRoman.toLowerCase()];
                
                if (suggestionNumerals) {
                    suggestions.coherent = suggestionNumerals
                        .map(numeral => getChordFromRomanNumeral(numeral, musicalKey, musicalMode))
                        .filter((c): c is string => c !== null && c !== contextChordName);
                }
            }
        }
    } else {
        const startingNumerals = musicalMode === 'minor' ? ['i', 'iv', 'VI'] : ['I', 'vi', 'IV'];
        suggestions.coherent = startingNumerals.map(n => getChordFromRomanNumeral(n, musicalKey, musicalMode)).filter(Boolean) as string[];
    }

    // --- INVENTIVE (Modal Mixture) Suggestions ---
    if (musicalMode === 'major') {
        suggestions.inventive.push(getChordFromRomanNumeral('iv', musicalKey, 'minor')); // Minor Subdominant
        suggestions.inventive.push(getChordFromRomanNumeral('VI', musicalKey, 'minor')); // Flat VI
        suggestions.inventive.push(getChordFromRomanNumeral('III', musicalKey, 'minor'));// Flat III
    } else if (musicalMode === 'minor') {
        suggestions.inventive.push(getChordFromRomanNumeral('I', musicalKey, 'major')); // Piccardy Third
        suggestions.inventive.push(getChordFromRomanNumeral('IV', musicalKey, 'major'));// Major Subdominant
    }
    
    const contextChordInfo = Chord.get(contextChordName || '');

    // --- JAZZY Suggestions ---
    // FIX: Cast quality to string to fix the type error and check for 'Dominant seventh' for correctness.
    if (!contextChordInfo.empty && ((contextChordInfo.quality as string) === "Dominant" || (contextChordInfo.quality as string) === "Dominant seventh")) {
        suggestions.jazzy.push(`${contextChordInfo.tonic}7b9`, `${contextChordInfo.tonic}7#5`);
        const tritoneSubNote = Note.transpose(contextChordInfo.tonic as string, 'd5');
        suggestions.jazzy.push(`${tritoneSubNote}7`);
    }
    const iiChord = getChordFromRomanNumeral('ii', musicalKey, musicalMode);
    if (iiChord) suggestions.jazzy.push(iiChord.replace('m7', 'm9'));

    // --- CLASSICAL Suggestions ---
    // Secondary Dominants (V/V, V/vi, V/ii)
    const V_of_V_Note = Note.transpose(musicalKey, 'M2');
    suggestions.classical.push(`${V_of_V_Note}7`);

    const V_of_vi_Note = Note.transpose(musicalKey, 'M6');
    suggestions.classical.push(`${V_of_vi_Note}7`);
    
    // Neapolitan Chord (bII)
    const neapolitanNote = Note.transpose(musicalKey, 'm2');
    suggestions.classical.push(`${neapolitanNote}maj`);


    // --- Final Filtering ---
    const filterAndUnique = (arr: (string | null)[]) => [...new Set(arr.filter(c => c && c !== contextChordName))] as string[];
    
    suggestions.coherent = filterAndUnique(suggestions.coherent);
    suggestions.inventive = filterAndUnique(suggestions.inventive);
    suggestions.jazzy = filterAndUnique(suggestions.jazzy);
    suggestions.classical = filterAndUnique(suggestions.classical);

    return suggestions;
}

/**
 * Finds common patterns that start with a given chord and returns the rest of the pattern.
 * @param contextChordName The chord to start the pattern from.
 * @param musicalKey The key of the progression.
 * @param musicalMode The mode of the progression.
 * @returns An array of pattern suggestions, each with a name and the remaining chords to add.
 */
export const getPatternSuggestionsForChord = (contextChordName: string, musicalKey: string, musicalMode: string): { name: string, chordsToAdd: string[] }[] => {
    const contextRoman = getRomanNumeralForChord(contextChordName, musicalKey, musicalMode);
    if (!contextRoman) return [];

    const baseRomanMatch = contextRoman.match(/^(#|b)?(I|II|III|IV|V|VI|VII|i|ii|iii|iv|v|vi|vii)/);
    if (!baseRomanMatch) return [];
    
    // Get the simple roman numeral (e.g., 'ii' from 'iim7') for pattern matching
    const simpleRoman = baseRomanMatch[2];

    const suggestions: { name: string, chordsToAdd: string[] }[] = [];

    for (const [patternName, patternSequence] of Object.entries(COMMON_PATTERNS)) {
        const index = patternSequence.indexOf(simpleRoman);
        // Find patterns where the context chord is the first element
        if (index === 0 && patternSequence.length > 1) {
            const remainingNumerals = patternSequence.slice(1);
            const chordsToAdd = remainingNumerals
                .map(numeral => getChordFromRomanNumeral(numeral, musicalKey, musicalMode))
                .filter((c): c is string => c !== null); // Ensure chord conversion was successful

            if (chordsToAdd.length === remainingNumerals.length) { // Check if all numerals were converted
                suggestions.push({
                    name: `Complete '${patternName}'`,
                    chordsToAdd: chordsToAdd
                });
            }
        }
    }

    return suggestions;
};

/**
 * Analyzes a chord progression to find the minimum and maximum MIDI notes.
 * @param progression An array of Chord objects.
 * @returns An object with minMidi and maxMidi, or null if progression is empty.
 */
export const getProgressionNoteRange = (progression: ChordType[]): { minMidi: number; maxMidi: number } | null => {
    if (progression.length === 0) {
        return null;
    }

    let minMidi = Infinity;
    let maxMidi = -Infinity;

    for (const chord of progression) {
        if (chord.name === 'Rest') continue;

        // We need to import or have access to getChordNotesWithOctaves
        const notes = getChordNotesWithOctaves(chord.name, chord.octave);
        for (const noteName of notes) {
            const midi = Note.midi(noteName);
            if (midi !== null) {
                if (midi < minMidi) minMidi = midi;
                if (midi > maxMidi) maxMidi = midi;
            }
        }
    }

    if (minMidi === Infinity || maxMidi === -Infinity) {
        // This case handles progressions with only invalid chords
        return null;
    }

    return { minMidi, maxMidi };
};

/**
 * Analyzes a chord progression for frequency, common patterns, and suggestions.
 * @param progression An array of Chord objects.
 * @param musicalKey The tonic of the key.
 * @param musicalMode The mode of the key.
 * @returns An object with full analysis.
 */
export const analyzeProgression = (progression: ChordType[], musicalKey: string, musicalMode: string) => {
    const validChords = progression.filter(c => c.name !== 'Rest');

    // Frequency Analysis
    const chordFrequency = validChords.reduce((acc, chord) => {
        acc[chord.name] = (acc[chord.name] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Pattern Detection
    const romanProgression = validChords.map(chord => getRomanNumeralForChord(chord.name, musicalKey, musicalMode));
    const detectedPatterns: { name: string; chords: string[] }[] = [];
    const uniquePatterns = new Set<string>(); // To avoid duplicate pattern messages

    if (validChords.length >= 2) {
        for (let i = 0; i <= romanProgression.length - 2; i++) { // Check every possible slice
            for (const [patternName, patternSequence] of Object.entries(COMMON_PATTERNS)) {
                if (i + patternSequence.length > romanProgression.length) continue; // Slice would be out of bounds

                const romanSlice = romanProgression.slice(i, i + patternSequence.length);
                const simplifiedSlice = romanSlice.map(roman => {
                    if (!roman) return null;
                    const baseRomanMatch = roman.match(/^(I|II|III|IV|V|VI|VII|i|ii|iii|iv|v|vi|vii)/);
                    return baseRomanMatch ? baseRomanMatch[0] : null;
                });

                if (simplifiedSlice.some(r => r === null)) continue;

                if (JSON.stringify(simplifiedSlice) === JSON.stringify(patternSequence)) {
                    const chordsInPattern = validChords.slice(i, i + patternSequence.length).map(c => c.name);
                    const patternKey = `${patternName}-${chordsInPattern.join(',')}`;
                    
                    if (!uniquePatterns.has(patternKey)) {
                        detectedPatterns.push({
                            name: patternName,
                            chords: chordsInPattern,
                        });
                        uniquePatterns.add(patternKey);
                    }
                }
            }
        }
    }

    // Richness Analysis
    let totalComplexity = 0;
    let totalTension = 0;
    let totalCommonTones = 0;
    let transitions = 0;

    if (validChords.length > 0) {
        validChords.forEach(chord => {
            totalComplexity += getChordComplexityScore(chord.name);
            totalTension += getChordTensionScore(chord.name);
        });

        if (validChords.length > 1) {
            for (let i = 0; i < validChords.length - 1; i++) {
                totalCommonTones += calculateConsonance(validChords[i].name, validChords[i+1].name);
                transitions++;
            }
        }
    }

    const avgComplexity = validChords.length > 0 ? totalComplexity / validChords.length : 0; // Range 0-3
    const avgTension = validChords.length > 0 ? totalTension / validChords.length : 0; // Range 0-3
    const avgSmoothness = transitions > 0 ? totalCommonTones / transitions : 0; // Range 0-4 approx

    const complexityScore = (avgComplexity / 3) * 100;
    const tensionScore = (avgTension / 3) * 100;
    const smoothnessScore = (avgSmoothness / 4) * 100;
    
    const overallScore = Math.round((complexityScore + tensionScore + smoothnessScore) / 3);

    const tags: string[] = [];
    if (avgComplexity > 2.2) tags.push('Jazzy & Complex');
    else if (avgComplexity > 1.5) tags.push('Rich Harmonies');
    else tags.push('Simple & Direct');

    if (avgTension > 1.8) tags.push('High Tension');
    else if (avgTension < 1.2) tags.push('Relaxed & Stable');

    if (avgSmoothness > 2) tags.push('Smooth Voice Leading');
    else if (avgSmoothness < 1 && validChords.length > 1) tags.push('Leaping Motion');
    
    const richnessAnalysis = {
        score: isNaN(overallScore) ? 0 : overallScore,
        tags: tags
    };
    
    // Hints
    const scale = Scale.get(`${musicalKey} ${musicalMode}`);
    const diatonicChords = getDiatonicChords(musicalKey, musicalMode);
    const borrowedChords = getBorrowedChords(musicalKey, musicalMode);

    const hints = {
        scaleNotes: scale.notes || [],
        modeInfo: {
            name: musicalMode.charAt(0).toUpperCase() + musicalMode.slice(1),
            description: MODE_DESCRIPTIONS[musicalMode] || 'A musical mode.'
        },
        diatonicChords,
        borrowedChords,
    };

    return { chordFrequency, detectedPatterns, richnessAnalysis, hints };
};