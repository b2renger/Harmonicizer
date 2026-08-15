import { describe, it, expect } from 'vitest';
import { voiceStoredProgression } from '../voicing/adapt.js';
import { DEFAULT_VOICING_PARAMS as p } from '../voicing/types.js';
import { detectChordFromNotes } from '../chords.js';
import { Note } from 'tonal';

const chord = (id: string, notes: string[], duration = 4) => ({ id, notes, duration });

describe('voiceStoredProgression', () => {
    const original = [
        chord('a', ['C4', 'E4', 'G4', 'B4']),
        chord('b', ['A4', 'C5', 'E5', 'G5']),
        chord('c', ['D4', 'F4', 'A4', 'C5']),
        chord('d', ['G4', 'B4', 'D5', 'F5']),
    ];

    it('does not mutate the input', () => {
        const snapshot = JSON.parse(JSON.stringify(original));
        voiceStoredProgression(original, p);
        expect(original).toEqual(snapshot);
    });

    it('preserves ids, durations and any extra fields', () => {
        const withExtras = [{ ...chord('a', ['C4', 'E4', 'G4']), songPartInstanceId: 'part-1' }];
        const [out] = voiceStoredProgression(withExtras, p);
        expect(out.id).toBe('a');
        expect(out.duration).toBe(4);
        expect(out.songPartInstanceId).toBe('part-1');
    });

    // Re-voicing preserves the harmony, not the inversion: Cmaj7 may come back as
    // Cmaj7/B. The invariant is the set of pitch classes.
    it('preserves the harmony of every chord', () => {
        const pcs = (notes: string[]) =>
            [...new Set(notes.map(n => Note.chroma(n)))].sort((a, b) => (a ?? 0) - (b ?? 0)).join(',');

        const voiced = voiceStoredProgression(original, p);
        voiced.forEach((c, i) => {
            expect(pcs(c.notes)).toBe(pcs(original[i].notes));
            // ...and it must still be nameable, or the chord card degrades to a note list.
            expect(detectChordFromNotes(c.notes)).not.toBeNull();
        });
    });

    it('leaves rests as rests', () => {
        const withRest = [chord('a', ['C4', 'E4', 'G4']), chord('r', []), chord('b', ['F4', 'A4', 'C5'])];
        const voiced = voiceStoredProgression(withRest, p);
        expect(voiced[1].notes).toEqual([]);
    });

    it('leaves hand-made chords that spell nothing nameable untouched', () => {
        // A cluster Tonal cannot name — the only way to get this is by hand.
        const cluster = ['C4', 'C#4', 'D4', 'D#4'];
        expect(detectChordFromNotes(cluster)).toBeNull();

        const voiced = voiceStoredProgression([chord('x', cluster)], p);
        expect(voiced[0].notes).toEqual(cluster);
    });

    it('actually improves voice leading over the stored voicings', () => {
        const midiOf = (notes: string[]) => notes.map(n => parseInt(String(n).replace(/\D/g, ''), 10));
        const motion = (progression: Array<{ notes: string[] }>) => {
            const seqs = progression.map(c =>
                c.notes.map(n => {
                    const m = /^([A-G][#b]?)(-?\d+)$/.exec(n);
                    const semis: Record<string, number> = { C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11 };
                    return m ? semis[m[1]] + 12 * (parseInt(m[2], 10) + 1) : 0;
                }),
            );
            let total = 0;
            for (let i = 1; i < seqs.length; i++) {
                for (const midi of seqs[i]) {
                    let nearest = Infinity;
                    for (const prev of seqs[i - 1]) nearest = Math.min(nearest, Math.abs(midi - prev));
                    total += nearest;
                }
            }
            return total;
        };

        expect(motion(voiceStoredProgression(original, p))).toBeLessThan(motion(original));
        expect(midiOf(['C4']).length).toBe(1); // guard the helper itself is exercised
    });
});
