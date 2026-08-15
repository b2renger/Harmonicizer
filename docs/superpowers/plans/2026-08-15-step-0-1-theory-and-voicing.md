# Implementation Plan — Steps 0 & 1: Theory Primitives and the Voicing Engine

**Date:** 2026-08-15
**Spec:** [2026-08-15-harmonic-accompaniment-design.md](../specs/2026-08-15-harmonic-accompaniment-design.md) §11, §7, §13, §14
**Covers:** delivery steps 0 and 1 only. Steps 2–6 get their own plans.

Both steps are additive. Nothing in the data model, the session format, or `audio/player.ts`
changes. At the end, the app behaves as it does today except that Roman numerals render
correctly, minor-key cadences are right, and an optional toggle makes the progression play
with real voice leading.

---

## Design decisions resolved before starting

Two things the spec left implicit. Settled here so implementation does not have to guess.

**1. Numerals are explicit; there is no `seventh` option.** `V` is a major triad, `V7` is a
dominant seventh, `Vmaj7` is a major seventh, `v7` is a minor seventh. Inferring "add a
seventh" from a bare numeral requires special-casing the dominant, which is the exact
cleverness that produced the current bug. Call sites pass what they mean.

**2. Degree roots are mode-relative.** The root of a numeral is
`Scale.get(`${key} ${mode}`).notes[degree]`, with any accidental applied on top. So in C
minor, `VI` → `Ab` (no flat needed) and `V` → `G`. This matches how `getRomanNumeralForChord`
already locates degrees, which keeps round-tripping consistent. Verified:
`Scale.get('C minor').notes` = `C D Eb F G Ab Bb`.

Quality comes from the numeral's case and marker, never from the diatonic table:

| case | marker | suffix | chord type |
|---|---|---|---|
| upper | — | — | `''` (major triad) |
| upper | — | `7` | `7` (dominant) |
| upper | — | `maj7` | `maj7` |
| lower | — | — | `m` |
| lower | — | `7` | `m7` |
| any | `°` | — | `dim` |
| any | `°` | `7` | `dim7` |
| any | `ø` | `7` | `m7b5` |
| any | `+` | — | `aug` |

---

## Step 0 — Test harness and theory primitives

### T0.1 Vitest harness

- `npm i -D vitest`
- `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`
- Add a `test` block to `vite.config.ts` (`environment: 'node'`, `include: ['**/*.test.ts']`)
  with the `/// <reference types="vitest" />` pragma.
- Smoke test at `theory/__tests__/smoke.test.ts` asserting Tonal is importable.

**Verify:** `npm test` green.

### T0.2 Roman numeral parser — new, pure

New file `theory/romanNumeral.ts`:

```ts
export type ParsedNumeral = {
  degree: number                       // 0..6
  accidental: -1 | 0 | 1
  case: 'upper' | 'lower'
  marker: '' | '°' | 'ø' | '+'
  suffix: string                       // '', '7', 'maj7', '9', ...
}
export function parseRomanNumeral(roman: string): ParsedNumeral | null
```

**Write the test table first.** `I`, `v`, `V7`, `bVI`, `#iv°`, `viiø7`, `III+`, `vii°7`,
`Imaj7`, `bII`, and at least three malformed inputs returning `null` (including the `'iio'`
that silently fails today — it must parse as `ii` + suffix `o`, and `o` must be rejected as
an unknown suffix, or be accepted as an alias for `°`; **pick the alias, and test it**, since
`o` and `°` are conventionally interchangeable in ASCII sources).

**Verify:** `npm test` — parser tests green, no other file touched.

### T0.3 Rewrite `getChordFromRomanNumeral`

In `theory/harmony.ts`. Signature becomes `(roman, key, mode) => string | null` — the same
shape, new semantics.

Implementation: parse → root from mode scale degree → apply accidental with
`Note.transpose(root, 'A1' | 'd1')` so the letter name is preserved → map case/marker/suffix
to a chord type via the table above → return `Chord.get(root + type).symbol`.

**Write these tests first** — they are the bugs from the spec, and they must fail before the
rewrite:

```
('V','C','minor')       → 'G'        (currently 'Gm7')
('V7','C','minor')      → 'G7'       ← the authentic-cadence fix
('v7','C','minor')      → 'Gm7'
('vii°7','C','minor')   → 'Bdim7'    (currently 'Bb7')
('IV','C','major')      → 'F'        (currently 'FMaj7'; triads now reachable)
('IVmaj7','C','major')  → 'FMaj7'
('ii7','C','major')     → 'Dm7'
('viiø7','C','major')   → 'Bm7b5'
('bII','C','major')     → 'Db'
('VI','C','minor')      → 'Ab'
('III+','C','minor')    → 'Ebaug'
```

**Verify:** `npm test` green; `npx tsc --noEmit` clean.

### T0.4 Update call sites to explicit numerals

`getChordFromRomanNumeral` now returns triads for bare numerals, so every caller must say
what it means. This is a mechanical edit that also corrects the musical intent.

- `theory/analysis.ts` — `DIATONIC_SUGGESTIONS` and `HARMONIC_FUNCTION_THEORY`. The
  authentic cadence becomes `['V7','I']`; `'iio'` becomes `'ii°7'`; the minor-key "move to
  dominant" becomes `['V7','VII']` so the prose about a strong pull is finally true.
- `theory/harmony.ts` — `COMMON_PATTERNS` and `generateRandomProgression`.
- `getSuggestionsForChord` inventive/classical branches — the secondary dominants must be
  built from the mode's scale, not the tonic alone, so C minor stops being offered `A7`.

These tables are deleted at step 3 when the grammar lands. Correcting them now is cheap and
keeps the app honest in the meantime.

**Verify:** `npm run dev`, open the app, confirm the Harmonic Movement panel offers `G7` (not
`Gm7`) for an authentic cadence in C minor.

### T0.5 Fix `getRomanNumeralForChord` rendering

Replace the use of `chordInfo.type` (prose: `"major seventh"`) with `chordInfo.aliases[0]`
(`"maj7"`). Verified alias values: `CMaj7`→`maj7`, `G7`→`7`, `Am7`→`m7`, `Bm7b5`→`m7b5`,
`Cdim7`→`dim7`, `C`→`M`, `Dm`→`m`.

Half-diminished must be detected by `type === 'half-diminished'`, not by quality — Tonal
reports `quality: "Diminished"` for `Bm7b5`.

**Test table first:** `Cmaj7`→`Imaj7`, `G7`→`V7`, `Am7`→`vi7`, `Bm7b5`→`viiø7`, `C`→`I`,
`Dm`→`ii`, `Cdim7`→`i°7`, and in C minor `Ab`→`VI`, `G7`→`V7`.

**Verify:** the Diatonic Chords panel shows `Imaj7`, `V7` — not `Imajor seventh`,
`Vdominant seventh`.

### T0.6 Round-trip property test

For all 12 keys × 7 modes × each diatonic seventh chord: take the numeral from
`getRomanNumeralForChord`, feed it back to `getChordFromRomanNumeral`, and assert the
resulting pitch-class sets match. **Compare with `Note.chroma`, not string equality** —
Locrian spells `Gb` where other contexts spell `F#` (`Note.chroma('Ab') === Note.chroma('G#')`
is confirmed).

Any pair that cannot round-trip is either a real bug or a documented exception; if the
latter, list it explicitly in the test rather than loosening the assertion.

### T0.7 Delete verified-dead code

Confirmed unreferenced by grep:

- `theory/consonance.ts` — orphan of the dropped consonance-ranked chord list. Note
  `analysis.ts` has its own private `calculateConsonance`; that one stays.
- `getChordTensionScore` in `theory/analysis.ts` — never called, and its
  `quality === 'Dominant'` branch is unreachable.
- The six empty placeholder files: `PerformancePad`, `SelectionAnalyzer`,
  `EnvelopeControls` (`.tsx` and `.css`, 0 bytes each).

Do **not** delete `DIATONIC_SUGGESTIONS`, `COMMON_PATTERNS` or `getSuggestionsForChord` —
they are still wired to `ProgressionAnalyzer` and `handleFeelLucky`. They go at step 3.

**Step 0 gate:** `npm test` green · `npx tsc --noEmit` clean · `npm run build` clean · app
runs and sounds exactly as before, with correct numerals on screen.

---

## Step 1 — The voicing engine

New directory `theory/voicing/`. Every task is a pure function with tests written first.

### T1.1 Types

`theory/voicing/types.ts` — `VoiceRole`, `Voice`, `Voicing`, `VoicingParams`, and the
step-1 `HarmonicEvent` (the type lands now; storage migrates at step 3).

`VoicingParams`: `low`, `high` (MIDI window), `targetSpread`, `maxSpread`, `minInterval`,
`preferRootless`, and the weights `wMotion`, `wRange`, `wSpread`, `wInterval`, `wOpen`,
`wTop`. Per spec §10, only `wMotion`, `targetSpread`, the window and `preferRootless` become
dials later; the rest are tuned constants.

### T1.2 Candidate generation

`theory/voicing/candidates.ts`:

```ts
generateCandidates(symbol: string, p: VoicingParams): number[][]
```

Chord tones from Tonal, crossed with subsets (full / rootless / shell = root+3rd+7th /
quartal), inversions (each rotation), and octave placements that put the lowest voice inside
`[low, high]`. Cap at 200; when the cap bites, keep a deterministic slice (not a random
sample) so tests stay stable.

**Tests:** every candidate's notes lie within the window; a triad yields fewer candidates
than a 13th chord; rootless candidates never contain the root's pitch class; shell candidates
have exactly three notes; the cap is respected and deterministic; an unparseable symbol
returns `[]`.

### T1.3 Cost function

`theory/voicing/cost.ts` — the formula from spec §7, pure and total.

**Tests:** identical voicings cost 0 motion; a voicing an octave outside the window costs
more than one inside it; a close low second is penalised by `wInterval` while the same
interval high up is not; with `previous = null` the motion term is 0 rather than `NaN`.

### T1.4 `voice()` and role assignment

`theory/voicing/index.ts`:

```ts
voice(event: HarmonicEvent, previous: Voicing | null, p: VoicingParams): Voicing
```

`argmin` over scored candidates, then assign roles: lowest → `bass`, 3rd and 7th → `guide`,
9/11/13 → `ext`, highest → `top`. If `event.pinned` is set, return it unchanged and use it as
`previous` for the next event.

**Tests:** deterministic for a fixed `(event, previous, params)` — golden files; pinned
voicings pass through untouched *and* still seed the next event's motion cost; every returned
voice carries a role; a chord with no parseable symbol returns an empty voicing rather than
throwing.

### T1.5 Corpus property test

Over a corpus of ~20 progressions (the app's default `Cmaj7–Am7–Dm7–G7`, the diatonic cycle
in several keys, and a modulating sequence): assert total voice-leading cost is **strictly
lower** than a root-position-from-octave-4 baseline — which is precisely what the app does
today. This is the test that proves the feature works.

Also assert no voice crosses below `low` or above `high`, across the whole corpus.

### T1.6 Non-destructive wiring

**The voicer must not write back into progression state.** Manual inversions and hand-edited
notes are user work; clobbering them would be a regression. Instead:

- A `useMemo` in `Composer.tsx` derives a voiced copy of the progression, running the events
  sequentially so each voicing sees its predecessor.
- Events whose notes do not spell a nameable chord (`detectChordFromNotes` → `null`) are
  treated as pinned and pass through untouched.
- Only the derived copy is handed to `player.setProgression`. Stored state is unchanged.
- A toggle in the progression controls — "Auto voice leading" — switches between the derived
  and the raw progression. Default **off**, so nothing changes until it is asked for.
- When on, the grid renders the derived notes so the visualizer agrees with what is heard.

**Verify:** toggle off → byte-identical playback to today. Toggle on → the same chords,
smoothly voiced. Toggle back off → the original voicings are intact, proving nothing was
overwritten.

**Step 1 gate:** `npm test` green (including the corpus test) · `npx tsc --noEmit` clean ·
`npm run build` clean · manual listening check on the default progression with the toggle
on and off.

---

## Risks

- **The corpus test is the load-bearing one.** If total cost does not beat the baseline, the
  cost weights are wrong, not the architecture. Tune `wMotion` against the corpus before
  suspecting anything else.
- **Round-tripping may not be total across all 7 modes.** Locrian and Phrygian spellings are
  the likely failures. If a pair genuinely cannot round-trip, document it as an explicit
  exception in the test rather than weakening the assertion.
- **Candidate explosion on extended chords.** The 200 cap is a guess (spec §15). If 13th
  chords are visibly slow in the corpus test, measure before raising or lowering it.
- **The toggle's default matters.** Shipping it on by default would silently change every
  existing user session. Off by default; make it opt-in.
