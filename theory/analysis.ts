import { Chord, Scale, Note, Mode } from 'tonal';
import type { Chord as ChordType } from '../modes/composer/Composer';
import { getRomanNumeralForChord, getChordFromRomanNumeral, getDiatonicChords, getBorrowedChords } from './harmony';
import { detectChordFromNotes } from './chords';

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

const HARMONIC_FUNCTION_THEORY: Record<string, { summary: string, movements: { name: string, description: string, to: string[] }[] }> = {
    'I': {
        summary: "The tonic (I) is the 'home' chord, providing a sense of stability and rest. Progressions often begin here and seek to return.",
        movements: [
            { name: "Move to Subdominant", description: "Moving to IV or ii creates a gentle departure from the tonic, setting up a harmonic journey.", to: ['IV', 'ii'] },
            { name: "Move to Dominant", description: "Moving to V or vii° builds tension that strongly desires to resolve back home.", to: ['V', 'vii°'] },
        ]
    },
    'V': {
        summary: "The dominant (V) chord creates the strongest tension, pulling powerfully back to the tonic (I). It's the engine of harmonic motion.",
        movements: [
            { name: "Authentic Cadence", description: "The classic V → I resolution. Creates a strong, satisfying sense of finality.", to: ['I'] },
            { name: "Deceptive Cadence", description: "A V → vi movement. Subverts expectations, creating surprise and often a melancholic feeling.", to: ['vi'] },
        ]
    },
    'IV': {
        summary: "The subdominant (IV) provides a moderate departure from the tonic, often feeling bright and hopeful. It commonly leads to the dominant (V).",
        movements: [
            { name: "Plagal Cadence", description: "A IV → I movement. A gentle, less final resolution than V → I, often called the 'Amen' cadence.", to: ['I'] },
            { name: "Lead to Dominant", description: "Moving from IV to V is a very common and strong progression that builds tension towards resolution.", to: ['V'] },
        ]
    },
    'ii': {
        summary: "The supertonic (ii) is a pre-dominant chord, similar to IV but with a slightly softer, more melancholic feel. It leads smoothly to the dominant.",
        movements: [
            { name: "Classic Pre-Dominant", description: "The ii → V → I turnaround is one of the most fundamental patterns in jazz and classical music.", to: ['V'] },
        ]
    },
     'vi': {
        summary: "The submediant (vi) is the relative minor. It feels like a darker, more introspective version of the tonic and can be a point of rest.",
        movements: [
            { name: "Move to Pre-Dominant", description: "From the submediant, moving to ii or IV continues the harmonic journey away from the tonic.", to: ['ii', 'IV'] },
        ]
    },
     'i': {
        summary: "The minor tonic (i) is the 'home' chord in a minor key, providing a sense of stability, albeit with a melancholic or dramatic mood.",
        movements: [
            { name: "Move to Subdominant", description: "Moving to iv or ii° creates a gentle departure, continuing the minor key's mood.", to: ['iv', 'ii°'] },
            { name: "Move to Dominant", description: "Moving to V or VII builds tension. The major V chord has a particularly strong pull back to i.", to: ['V', 'VII'] },
        ]
    },
    'iv': {
        summary: "The minor subdominant (iv) functions similarly to its major counterpart, leading naturally to the dominant.",
        movements: [
            { name: "Lead to Dominant", description: "The iv → V → i progression is a powerful and common pattern in minor keys.", to: ['V'] },
        ]
    },
};


/**
 * Provides music theory context for a given chord, including its function and possible next movements.
 * @param contextChordName The chord to analyze.
 * @param musicalKey The key of the progression.
 * @param musicalMode The mode of the progression.
 * @returns An object with a summary and a list of described movements, or null.
 */
export const getHarmonicTheoryForChord = (contextChordName: string, musicalKey: string, musicalMode: string): { summary: string, movements: { name: string, description: string, chordsToAdd: string[] }[] } | null => {
    const contextRoman = getRomanNumeralForChord(contextChordName, musicalKey, musicalMode);
    if (!contextRoman) return null;
    
    // Simplify roman numeral for matching (e.g., 'V7' -> 'V', 'iim7' -> 'ii')
    const simpleRomanMatch = contextRoman.match(/^(#|b)?(I|II|III|IV|V|VI|VII|i|ii|iii|iv|v|vi|vii)/);
    if (!simpleRomanMatch) return null;
    const simpleRoman = simpleRomanMatch[2]; // e.g. 'V' or 'ii'
    
    // Find theory based on the simplified numeral (e.g., 'ii' for 'iim7')
    const theory = HARMONIC_FUNCTION_THEORY[simpleRoman];
    if (!theory) return null;
    
    const resolvedMovements = theory.movements.map(movement => {
        const chordsToAdd = movement.to
            .map(numeral => getChordFromRomanNumeral(numeral, musicalKey, musicalMode))
            .filter((c): c is string => c !== null);
        return { ...movement, chordsToAdd };
    }).filter(m => m.chordsToAdd.length > 0);

    return {
        summary: theory.summary,
        movements: resolvedMovements
    };
};

/**
 * Analyzes a chord progression for frequency, common patterns, and suggestions.
 * @param progression An array of Chord objects.
 * @param musicalKey The tonic of the key.
 * @param musicalMode The mode of the key.
 * @returns An object with full analysis.
 */
export const analyzeProgression = (progression: ChordType[], musicalKey: string, musicalMode: string) => {
    const validChords = progression.filter(c => c.notes.length > 0);
    const validChordNames = validChords.map(c => detectChordFromNotes(c.notes) || 'Unknown');

    // Frequency Analysis
    const chordFrequency = validChordNames.reduce((acc, name) => {
        if (name !== 'Unknown') {
            acc[name] = (acc[name] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    // Richness Analysis
    let totalComplexity = 0;
    let totalTension = 0;
    let totalCommonTones = 0;
    let transitions = 0;

    if (validChords.length > 0) {
        validChordNames.forEach(name => {
            if (name === 'Unknown') return;
            totalComplexity += getChordComplexityScore(name);
            totalTension += getChordTensionScore(name);
        });

        if (validChords.length > 1) {
            for (let i = 0; i < validChordNames.length - 1; i++) {
                totalCommonTones += calculateConsonance(validChordNames[i], validChordNames[i+1]);
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

    // Note: The 'detectedPatterns' logic has been removed as per the design change.
    // The new approach focuses on contextual theory rather than retrospective pattern matching.
    const detectedPatterns: any[] = []; 

    return { chordFrequency, detectedPatterns, richnessAnalysis, hints };
};