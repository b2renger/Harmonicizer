import { describe, it, expect } from 'vitest';
import { Note } from 'tonal';
import { voice, voiceProgression, assignRoles } from '../voicing/index.js';
import { DEFAULT_VOICING_PARAMS, type HarmonicEvent, type Voicing } from '../voicing/types.js';
import { getChordNotesWithOctaves } from '../chords.js';

const p = DEFAULT_VOICING_PARAMS;
const ev = (symbol: string, id = symbol): HarmonicEvent => ({ id, symbol, durationBeats: 4 });
const midisOf = (v: Voicing) => v.voices.map(x => x.midi);

/** Total voice-leading distance across a progression, nearest-voice definition. */
const totalMotion = (voicings: number[][]): number => {
    let total = 0;
    for (let i = 1; i < voicings.length; i++) {
        for (const midi of voicings[i]) {
            let nearest = Infinity;
            for (const prev of voicings[i - 1]) nearest = Math.min(nearest, Math.abs(midi - prev));
            total += nearest;
        }
    }
    return total;
};

describe('voice', () => {
    it('is deterministic', () => {
        expect(voice(ev('Cmaj7'), null, p)).toEqual(voice(ev('Cmaj7'), null, p));
    });

    it('returns an empty voicing for an unparseable symbol rather than throwing', () => {
        expect(voice(ev('not-a-chord'), null, p).voices).toEqual([]);
    });

    it('gives every voice a role', () => {
        for (const v of voice(ev('Cmaj7'), null, p).voices) {
            expect(['bass', 'root', 'guide', 'ext', 'top']).toContain(v.role);
        }
    });

    // Regression: with no bias against omitting the root, rootless voicings won whenever
    // they were cheaper, and Cmaj7 came out as E-B-G — which reads as Em7, not Cmaj7.
    it('states the root by default, when nothing else covers it', () => {
        for (const symbol of ['Cmaj7', 'G7', 'Am7', 'Dm7', 'Fmaj7', 'Bm7b5']) {
            const rootChroma = Note.chroma(symbol.replace(/[^A-G#b].*$/, ''));
            const chromas = voice(ev(symbol), null, p).voices.map(v => v.midi % 12);
            expect(chromas).toContain(rootChroma);
        }
    });

    it('omits the root when asked to, as it would with a bass voice present', () => {
        const rootless = { ...p, preferRootless: 1 };
        const chromas = voice(ev('Cmaj7'), null, rootless).voices.map(v => v.midi % 12);
        expect(chromas).not.toContain(Note.chroma('C'));
    });

    it('keeps voices inside the register window', () => {
        for (const symbol of ['C', 'Cmaj7', 'F#m7b5', 'Bb13']) {
            for (const v of voice(ev(symbol), null, p).voices) {
                expect(v.midi).toBeGreaterThanOrEqual(p.low);
                expect(v.midi).toBeLessThanOrEqual(p.high);
            }
        }
    });

    describe('pinned voicings', () => {
        const pinned: Voicing = {
            voices: [{ role: 'bass', midi: 48 }, { role: 'top', midi: 55 }],
            sourceEventId: 'pinned',
        };

        it('passes through untouched, even outside the register window', () => {
            const event: HarmonicEvent = { ...ev('Cmaj7', 'pinned'), pinned };
            expect(voice(event, null, p)).toEqual(pinned);
        });

        it('still seeds the next chord’s voice leading', () => {
            const events: HarmonicEvent[] = [
                { ...ev('Cmaj7', 'a'), pinned },
                ev('Am7', 'b'),
            ];
            const [first, second] = voiceProgression(events, p);
            expect(first).toEqual(pinned);
            // The second chord should sit near the pin, not wherever it would start cold.
            const cold = midisOf(voice(ev('Am7', 'b'), null, p));
            expect(totalMotion([midisOf(first), midisOf(second)]))
                .toBeLessThanOrEqual(totalMotion([midisOf(first), cold]));
        });
    });
});

describe('assignRoles', () => {
    it('labels bass, guide tones and top', () => {
        // Cmaj7 in root position: C=root(bass), E=third, G=fifth, B=seventh(top)
        const roles = assignRoles([60, 64, 67, 71], 'Cmaj7');
        expect(roles.map(r => r.role)).toEqual(['bass', 'guide', 'ext', 'top']);
    });

    it('labels a rootless voicing without a root present', () => {
        // E G B from Cmaj7: third, fifth, seventh
        const roles = assignRoles([64, 67, 71], 'Cmaj7');
        expect(roles.map(r => r.role)).toEqual(['bass', 'ext', 'top']);
        expect(roles.every(r => Note.chroma('C') !== r.midi % 12)).toBe(true);
    });
});

describe('voiceProgression beats root-position voicing', () => {
    const corpus: Array<{ name: string; symbols: string[] }> = [
        { name: 'app default',     symbols: ['Cmaj7', 'Am7', 'Dm7', 'G7'] },
        { name: 'ii-V-I in C',     symbols: ['Dm7', 'G7', 'Cmaj7'] },
        { name: 'ii-V-i in C min', symbols: ['Dm7b5', 'G7', 'Cm7'] },
        { name: 'axis in C',       symbols: ['Cmaj7', 'G7', 'Am7', 'Fmaj7'] },
        { name: 'diatonic cycle C',symbols: ['Cmaj7','Dm7','Em7','Fmaj7','G7','Am7','Bm7b5'] },
        { name: 'diatonic cycle F',symbols: ['Fmaj7','Gm7','Am7','Bbmaj7','C7','Dm7','Em7b5'] },
        { name: 'diatonic cycle A',symbols: ['Amaj7','Bm7','C#m7','Dmaj7','E7','F#m7','G#m7b5'] },
        { name: 'circle of 5ths',  symbols: ['Cmaj7','Fmaj7','Bm7b5','Em7','Am7','Dm7','G7','Cmaj7'] },
        { name: 'modulating',      symbols: ['Cmaj7','A7','Dm7','B7','Em7','C7','Fmaj7'] },
        { name: 'chromatic desc',  symbols: ['Cmaj7','B7','Bbmaj7','A7','Abmaj7','G7'] },
        { name: 'minor andalusian',symbols: ['Cm7','Bb7','Abmaj7','G7'] },
        { name: 'extended',        symbols: ['Cmaj9','Am9','Dm9','G13'] },
        { name: 'triads',          symbols: ['C','F','G','Am','C'] },
        { name: 'wide leaps',      symbols: ['Cmaj7','F#maj7','Cmaj7','F#maj7'] },
    ];

    for (const { name, symbols } of corpus) {
        it(`improves voice leading: ${name}`, () => {
            const events = symbols.map((s, i) => ev(s, `${name}-${i}`));

            const voiced = voiceProgression(events, p).map(midisOf);
            // Baseline: exactly what the app does today — root position from octave 4.
            const baseline = symbols.map(s =>
                getChordNotesWithOctaves(s, 4).map(n => Note.midi(n)!).filter(m => m != null),
            );

            expect(totalMotion(voiced)).toBeLessThan(totalMotion(baseline));
        });
    }

    it('never lets a voice escape the register window across the whole corpus', () => {
        for (const { name, symbols } of corpus) {
            const events = symbols.map((s, i) => ev(s, `${name}-${i}`));
            for (const v of voiceProgression(events, p)) {
                for (const { midi } of v.voices) {
                    expect(midi).toBeGreaterThanOrEqual(p.low);
                    expect(midi).toBeLessThanOrEqual(p.high);
                }
            }
        }
    });
});
