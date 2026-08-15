/**
 * Parsing of Roman numeral chord symbols.
 *
 * The numeral is the source of truth for both the scale degree and the chord quality.
 * Case carries the third (V is major, v is minor), the marker carries diminished /
 * half-diminished / augmented, and the suffix carries any extension.
 *
 * This is deliberately separate from any key context: turning a parsed numeral into a
 * concrete chord is `getChordFromRomanNumeral`'s job.
 */

export type NumeralMarker = '' | '°' | 'ø' | '+';

export type ParsedNumeral = {
    /** Scale degree, 0-indexed: I is 0, VII is 6. */
    degree: number;
    /** Chromatic alteration applied to the degree: -1 for b, +1 for #. */
    accidental: -1 | 0 | 1;
    /** Upper case means a major third, lower case a minor third. */
    case: 'upper' | 'lower';
    /** Quality marker, with the ASCII 'o' normalized to '°'. */
    marker: NumeralMarker;
    /** Everything after the marker, e.g. '7', 'maj7', '7b9'. Validated by the caller. */
    suffix: string;
};

// Alternatives are ordered longest-first so that 'VII' is not matched as 'VI' + junk,
// and each alternative is uniformly cased so 'Vi' cannot match as a numeral.
const NUMERAL = /^(b|#)?(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(°|o|ø|\+)?(.*)$/;

const DEGREE: Record<string, number> = {
    i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6,
};

// Rejects suffixes containing whitespace or characters that never appear in a chord
// extension. Whether the suffix names a real chord is decided when the chord is built.
const PLAUSIBLE_SUFFIX = /^[0-9a-zA-Z#b+\-()]*$/;

/**
 * Parses a Roman numeral such as 'V7', 'bVI', '#iv°' or 'viiø7'.
 * @returns The parsed numeral, or null if the input is not a well-formed numeral.
 */
export function parseRomanNumeral(roman: string): ParsedNumeral | null {
    if (typeof roman !== 'string') return null;

    const match = NUMERAL.exec(roman.trim());
    if (!match) return null;

    const [, accidentalToken, numeralToken, markerToken, suffix] = match;

    if (!PLAUSIBLE_SUFFIX.test(suffix)) return null;

    // 'o' is the conventional ASCII stand-in for '°'.
    const marker = (markerToken === 'o' ? '°' : markerToken ?? '') as NumeralMarker;

    return {
        degree: DEGREE[numeralToken.toLowerCase()],
        accidental: accidentalToken === 'b' ? -1 : accidentalToken === '#' ? 1 : 0,
        case: numeralToken === numeralToken.toUpperCase() ? 'upper' : 'lower',
        marker,
        suffix,
    };
}
