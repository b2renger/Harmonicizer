
import { Chord, Scale, Note, Mode } from 'tonal';
import { getRomanNumeralForChord, getChordFromRomanNumeral, getDiatonicChords, getBorrowedChords } from './harmony.js';
import { detectChordFromNotes } from './chords.js';

/**
 * A robust method for checking common notes between chords, accounting for octaves.
 * @param {string} chordName1 - First chord.
 * @param {string} chordName2 - Second chord.
 * @returns {number} The number of common pitch classes.
 */
function calculateConsonance(chordName1, chordName2) {
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

/**
 * Calculates a complexity score for a chord based on the number of notes (triad, 7th, extended).
 * @param {string} chordName - The name of the chord.
 * @returns {number} A complexity score (0-3).
 */
const getChordComplexityScore = (chordName) => {
    const notes = Chord.get(chordName).notes;
    if (notes.length >= 5) return 3; // Extended chords (9ths, 11ths, 13ths)
    if (notes.length === 4) return 2; // Seventh chords
    if (notes.length === 3) return 1; // Triads
    return 0;
};

/**
 * Calculates a tension score for a chord based on its quality (dim, aug, dom, etc.).
 * @param {string} chordName - The name of the chord.
 * @returns {number} A tension score (0-3).
 */
const getChordTensionScore = (chordName) => {
    // Cast quality to string to avoid type errors with tonal's sometimes-incomplete ChordQuality type.
    const quality = Chord.get(chordName).quality as string;
    if (quality === 'Diminished' || quality === 'Augmented' || quality === 'Half-diminished') return 3;
    // Added 'Dominant seventh' to correctly score tension for dominant 7th chords.
    if (quality === 'Dominant' || quality === 'Major seventh' || quality === 'Dominant seventh') return 2;
    if (quality === 'Major' || quality === 'Minor' || quality === 'Minor seventh') return 1;
    return 0;
};

const MODE_DESCRIPTIONS = {
    major: 'Bright and happy. The most common scale in Western music.',
    minor: 'Sad or melancholic. Often used for dramatic or emotional effect.',
    dorian: 'Jazzy and soulful. A minor-type scale with a raised 6th degree.',
    phrygian: 'Dark and exotic, with a distinctive Spanish or flamenco sound.',
    lydian: 'Bright and dreamy, with a raised 4th that adds a sense of wonder.',
    mixolydian: 'Bluesy and rock-oriented. A major-type scale with a flat 7th.',
    locrian: 'Tense and unstable. The darkest mode, rarely used as a tonal center.'
};

// A dictionary mapping a Roman numeral to common subsequent Roman numerals.
const DIATONIC_SUGGESTIONS = {
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
 * Generates suggestions for the next chord based on harmonic function and common practice.
 * @param {string | null} contextChordName - The name of the chord to generate suggestions from. Can be null.
 * @param {string} musicalKey - The tonic of the key.
 * @param {string} musicalMode - The mode of the key.
 * @returns {{coherent: string[], inventive: string[], jazzy: string[], classical: string[]}} An object with categorized suggestions.
 */
export const getSuggestionsForChord = (contextChordName, musicalKey, musicalMode) => {
    const suggestions = {
        coherent: [],
        inventive: [],
        jazzy: [],
        classical: [],
    };
    
    // --- COHERENT (Diatonic) Suggestions ---
    if (contextChordName && contextChordName !== 'Rest') {
        const contextChordRoman = getRomanNumeralForChord(contextChordName, musicalKey, musicalMode);
        
        if (contextChordRoman) {
            // Simplify Roman numeral (e.g., 'vim7' -> 'vi') to match suggestion dictionary.
            const baseRomanMatch = contextChordRoman.match(/^(#|b)?(I|II|III|IV|V|VI|VII|i|ii|iii|iv|v|vi|vii)/);
            if (baseRomanMatch) {
                const simpleRoman = baseRomanMatch[2];
                const suggestionNumerals = DIATONIC_SUGGESTIONS[simpleRoman] || DIATONIC_SUGGESTIONS[simpleRoman.toUpperCase()] || DIATONIC_SUGGESTIONS[simpleRoman.toLowerCase()];
                
                if (suggestionNumerals) {
                    suggestions.coherent = suggestionNumerals
                        .map(numeral => getChordFromRomanNumeral(numeral, musicalKey, musicalMode))
                        .filter((c): c is string => c !== null && c !== contextChordName);
                }
            }
        }
    } else {
        // If there's no context, suggest common starting chords.
        const startingNumerals = musicalMode === 'minor' ? ['i', 'iv', 'VI'] : ['I', 'vi', 'IV'];
        suggestions.coherent = startingNumerals.map(n => getChordFromRomanNumeral(n, musicalKey, musicalMode)).filter(Boolean);
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

    // --- JAZZY Suggestions (Alterations, Tritone Subs) ---
    if (!contextChordInfo.empty && ((contextChordInfo.quality as string) === "Dominant" || (contextChordInfo.quality as string) === "Dominant seventh")) {
        suggestions.jazzy.push(`${contextChordInfo.tonic}7b9`, `${contextChordInfo.tonic}7#5`);
        const tritoneSubNote = Note.transpose(contextChordInfo.tonic, 'd5');
        suggestions.jazzy.push(`${tritoneSubNote}7`);
    }
    const iiChord = getChordFromRomanNumeral('ii', musicalKey, musicalMode);
    if (iiChord) suggestions.jazzy.push(iiChord.replace('m7', 'm9'));

    // --- CLASSICAL Suggestions (Secondary Dominants, Neapolitan) ---
    const V_of_V_Note = Note.transpose(musicalKey, 'M2');
    suggestions.classical.push(`${V_of_V_Note}7`);
    const V_of_vi_Note = Note.transpose(musicalKey, 'M6');
    suggestions.classical.push(`${V_of_vi_Note}7`);
    const neapolitanNote = Note.transpose(musicalKey, 'm2');
    suggestions.classical.push(`${neapolitanNote}maj`);


    // --- Final Filtering (Remove nulls, duplicates, and the context chord itself) ---
    const filterAndUnique = (arr) => [...new Set(arr.filter(c => c && c !== contextChordName))];
    
    suggestions.coherent = filterAndUnique(suggestions.coherent);
    suggestions.inventive = filterAndUnique(suggestions.inventive);
    suggestions.jazzy = filterAndUnique(suggestions.jazzy);
    suggestions.classical = filterAndUnique(suggestions.classical);

    return suggestions;
}

// A dictionary of simplified harmonic function theory.
const HARMONIC_FUNCTION_THEORY = {
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
 * @param {string} contextChordName - The chord to analyze.
 * @param {string} musicalKey - The key of the progression.
 * @param {string} musicalMode - The mode of the progression.
 * @returns {{summary: string, movements: any[]} | null} An object with a summary and a list of described movements, or null.
 */
export const getHarmonicTheoryForChord = (contextChordName, musicalKey, musicalMode) => {
    const contextRoman = getRomanNumeralForChord(contextChordName, musicalKey, musicalMode);
    if (!contextRoman) return null;
    
    // Simplify roman numeral for matching (e.g., 'V7' -> 'V', 'iim7' -> 'ii')
    const simpleRomanMatch = contextRoman.match(/^(#|b)?(I|II|III|IV|V|VI|VII|i|ii|iii|iv|v|vi|vii)/);
    if (!simpleRomanMatch) return null;
    const simpleRoman = simpleRomanMatch[2]; // e.g. 'V' or 'ii'
    
    const theory = HARMONIC_FUNCTION_THEORY[simpleRoman];
    if (!theory) return null;
    
    // Resolve the Roman numerals in the theory dictionary to actual chord names in the current key.
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
 * Analyzes a full chord progression, calculating its characteristics and providing contextual hints.
 * @param {any[]} progression - An array of Chord objects from the application state.
 * @param {string} musicalKey - The tonic of the key.
 * @param {string} musicalMode - The mode of the key.
 * @returns {object} An object containing the full analysis results.
 */
export const analyzeProgression = (progression, musicalKey, musicalMode) => {
    const validChords = progression.filter(c => c.notes.length > 0);
    const validChordNames = validChords.map(c => detectChordFromNotes(c.notes) || 'Unknown');

    // --- Progression Characteristics (Richness & Consonance) ---
    let totalComplexity = 0;
    let totalCommonTones = 0;
    let transitions = 0;

    if (validChords.length > 0) {
        validChordNames.forEach(name => {
            if (name === 'Unknown') return;
            totalComplexity += getChordComplexityScore(name);
        });

        if (validChords.length > 1) {
            for (let i = 0; i < validChordNames.length - 1; i++) {
                totalCommonTones += calculateConsonance(validChordNames[i], validChordNames[i+1]);
                transitions++;
            }
        }
    }

    const avgComplexity = validChords.length > 0 ? totalComplexity / validChords.length : 0;
    const avgSmoothness = transitions > 0 ? totalCommonTones / transitions : 0;

    const richnessScore = Math.round((avgComplexity / 3) * 100);
    const consonanceScore = Math.round((avgSmoothness / 4) * 100);
    
    // Generate descriptive tags based on scores.
    const richnessTags = [];
    if (avgComplexity > 2.2) richnessTags.push('Jazzy & Complex');
    else if (avgComplexity > 1.5) richnessTags.push('Rich Harmonies');
    else richnessTags.push('Simple & Direct');
    
    const consonanceTags = [];
    if (avgSmoothness > 2) consonanceTags.push('Smooth Voice Leading');
    else if (avgSmoothness < 1 && validChords.length > 1) consonanceTags.push('Leaping Motion');
    else consonanceTags.push('Moderate Motion');
    
    const analysis = {
        richnessScore: isNaN(richnessScore) ? 0 : richnessScore,
        consonanceScore: isNaN(consonanceScore) ? 0 : consonanceScore,
        richnessTags,
        consonanceTags,
    };
    
    // --- Contextual Hints ---
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

    return { analysis, hints };
};
