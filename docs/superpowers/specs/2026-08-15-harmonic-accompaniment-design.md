# Harmonic Accompaniment Engine — Design

**Date:** 2026-08-15
**Status:** Approved design, not yet implemented
**Supersedes:** the ad-hoc generation in `theory/analysis.ts` and `theory/harmony.ts`

---

## 1. Context

Harmonicizer today is a hand-driven chord-grid editor. Chords play as block chords — every
note struck at once and held — with an arpeggiator that round-robins the voicing at a fixed
subdivision. There is no bass, no rhythm, and no voice leading: every generated or inserted
chord is built root-position from octave 4, so consecutive chords leap.

The generator is thinner than it appears. `generateRandomProgression` samples uniformly from
the two four-chord patterns in `COMMON_PATTERNS`, both starting on the tonic.
`getSuggestionsForChord` is a fixed dictionary lookup. Run either for an hour and it repeats.

We are turning Harmonicizer into a **live generative instrument**: harmony that generates and
evolves continuously, shaped in real time by continuous parameters, with a hold mode for
freezing and working a section. The chord grid becomes a monitor of — and an override on —
what the machine is doing, rather than the primary interface.

Design inspiration is drawn from Impro-Visor (brick dictionary, style files, parametric
voicing presets), Cognitone Synfire (harmony as a separate, re-assignable layer), and Ableton
Learning Music (making theory audible and legible).

## 2. Goals

- Generated harmony that stays musically interesting over a long unattended run.
- Accompaniment that sounds *played*: real voicings with voice leading, an independent bass
  voice, and rhythmic comping patterns.
- Continuous parametric control — every shaping dial morphs output smoothly rather than
  switching between presets.
- Legible output: the instrument can say what it is doing, in musicians' language.
- Hand edits survive as pinned overrides the generator works around.

## 3. Non-goals

- **Drums.** Not harmonic, and they drag in a sample library. Out of scope.
- **Melody or solo generation.** The performance/improvisation mode remains future work.
- **Explorer mode and PWA packaging.** Tracked separately in the README roadmap.
- **Audio-rate DSP changes.** The existing synth voices and effects are kept as they are.

## 4. Architecture

```
Parameters (normalized 0..1, observable)
     │
     ├──> HarmonyGenerator ──> HarmonicEvent[]      two-level brick grammar
     │                              │
     ├──> Voicer ───────────────────┤──> Voicing    scored search, prev-voicing aware
     │                              │
     ├──> Styler ───────────────────┴──> Strike[]   authored pattern library
     │                              │
     └──> Scheduler <───────────────┘               look-ahead, stream | hold
                  │
                  └──> Tone.js
```

Four pure stages plus one stateful scheduler. Harmony and voicing are model-driven scored
searches whose weights are the live dials. Rhythm is data-driven, because hand-authored
patterns beat search for groove. All four stages are pure functions of
`(input, previous state, parameters)` and testable without audio.

## 5. Data model — intent vs realization

The central change. Today a chord *is* its notes; there is nowhere to store what the chord
means. Re-voicing, re-keying and re-styling all require intent to be stored separately from
its realization.

```ts
// INTENT — survives re-voicing, re-keying, re-styling.
type HarmonicEvent = {
  id: string
  symbol: string            // canonical Tonal symbol, e.g. 'Cmaj7'
  degree: string            // quality-aware roman numeral, e.g. 'I', 'V7', 'bVI'
  brick: string             // originating brick name, e.g. 'Straight-Approach'
  durationBeats: number
  key: string               // per-event, so the stream can modulate
  mode: 'Major' | 'Minor'
  pinned?: Voicing          // hand edit; the voicer returns this untouched
}

// REALIZATION — derived, disposable, regenerated freely.
type VoiceRole = 'bass' | 'root' | 'guide' | 'ext' | 'top'
type Voice     = { role: VoiceRole; midi: number }
type Voicing   = { voices: Voice[]; sourceEventId: string }
```

Voices are **labelled**, not a flat note list. This is what lets the rhythm stage stay
separate from the voicing stage without flattening the result: a comping pattern selects by
role ("beat 2.5: guide tones only") rather than receiving a finished chord it can only
decide *when* to strike.

Hand edits in the note visualizer write a `pinned` voicing onto the event. The generator may
still replace the event's harmony; the voicer never overrides a pin.

**Migration.** The session JSON gains `version: 3`, storing `HarmonicEvent[]` per part. v2
files load by running chord detection over each stored note array to recover a symbol, and
attaching the original notes as a pin — so nothing a user has already made changes how it
sounds. MIDI export reads realizations, not intent, and needs only to walk the new structure.

## 6. Harmony generator — two-level brick grammar

### 6.1 Why bricks

A flat functional model (`tonic → predominant → dominant`) generates chord chains that are
correct and characterless. Impro-Visor instead uses a dictionary of named harmonic units —
Conrad Cork's "bricks" — each with a type, a mode, a key, and an ordered list of sub-blocks
that are either literal chords or *other bricks*. Real cadence shapes, composable, and named.

Three properties matter for this project:

- **Modulation is free.** Each brick carries a key; chaining bricks in different keys *is*
  modulation, with no separate mechanism.
- **Output is legible.** The instrument can display "Dropback → Starlight Cadence in Eb"
  while it plays — a good visual for an installation, and the pedagogical thread arriving
  without building a teaching mode.
- **One dial gives live tension.** Biasing type weights toward Cadence/Ending is a "resolve"
  control; biasing toward Dropback/Turnaround is "keep me hanging".

### 6.2 Dictionary format

```ts
type BrickType = 'Opening' | 'Approach' | 'Cadence' | 'Turnaround'
               | 'Dropback' | 'OnOff' | 'Ending'

type SubBlock =
  | { kind: 'chord'; symbol: string; dur: number | '*' }   // '*' absorbs the remainder
  | { kind: 'brick'; name: string; key: string; dur: number }

type Brick = {
  name: string
  type: BrickType
  mode: 'Major' | 'Minor'
  key: string          // dictionary entries are always written in C
  blocks: SubBlock[]
  weight: number       // base selection weight
  diatonic: boolean    // false = requires the chromaticism dial to be open
}
```

Stored as JSON in `theory/bricks/`. Entries are written in C and transposed at expansion
time. Base weights derive from Impro-Visor's parse costs inverted — they use cost for
*analysis* (cheapest parse wins: Turnaround 20, Cadence 25, Opening 25, Dropback 30, Ending
30, Approach 45); we run it backwards and use the inverse for *generation*.

Target size for the first dictionary is 25–40 bricks, enough to cover major and minor
cadences, common approaches, turnarounds and dropbacks. We write our own against the
published theory rather than transcribing `vocab/My.dictionary`; adapting theirs is
permitted (see §12) but a smaller hand-checked set is easier to debug and to weight.

### 6.3 Expansion

```ts
expandBrick(brick: Brick, targetKey: string, totalBeats: number, depth: number)
  : HarmonicEvent[]
```

Transpose each chord symbol by the interval from `brick.key` to `targetKey`. Distribute
`totalBeats` across blocks proportionally to their `dur` values, with `'*'` absorbing the
remainder. Nested bricks recurse; **depth is capped at 3** and a brick may not reference
itself transitively.

### 6.4 Section grammar

Impro-Visor's melody grammars fill an exact duration by recursive consumption —
`(rule (P Y) ((BRICK 480) (P (- Y 480))) 1.0)`. We take that semantics, not its Lisp: the
same duration-parameterized weighted expansion, written imperatively because it is far
easier to debug and to instrument in TypeScript.

```
generateSection(beatsRemaining, state, params) -> HarmonicEvent[]

  while beatsRemaining > 0:
    type  = sampleBrickType(state.lastType, params)     // transition matrix × dials
    brick = sampleBrick(type, state.mode, params)       // base weight × chromaticism filter
    len   = chooseLength(brick, beatsRemaining, params.harmonicRhythm)
    key   = chooseKey(state.key, params.modulationRate, brick)
    emit(expandBrick(brick, key, len, 0))
    state.advance(brick, key, type)
    beatsRemaining -= len
```

Brick-type selection is a **first-order Markov transition matrix** over types, so an Approach
tends to be followed by a Cadence and an Opening does not follow an Ending. The dials
reweight that matrix rather than replacing it.

`cadencePressure` multiplies the weights of Cadence and Ending and divides those of Dropback
and Turnaround. Driven manually it is a resolve control; ramped slowly it produces arcs over
a long run with no explicit form model.

Guarantees, enforced by test: a section fills exactly the requested beats, always terminates,
and ends on a Cadence or Ending.

## 7. Voicing engine

A direct port of the idea behind Impro-Visor's `.fv` presets — hand ranges, spread limits,
note counts, minimum intervals, a rootless toggle, and motion preference weights — expressed
as a scored search rather than a preset file.

```ts
voice(event: HarmonicEvent, previous: Voicing | null, p: VoicingParams): Voicing
```

**Candidates.** Chord tones from Tonal for the symbol, crossed with:
subsets (full / rootless / shell = root+3rd+7th / quartal), inversions (each rotation), and
octave placements that put the lowest voice inside the configured register. Capped at 200
candidates per event.

**Cost.** Lower is better; `argmin` wins.

```
cost = wMotion   · Σ |midi − nearest previous voice|      // voice leading
     + wRange    · Σ distance outside [low, high]
     + wSpread   · max(0, (top − bottom) − maxSpread)
     + wInterval · count(adjacent intervals below the minimum for their register)
     + wOpen     · |actual spread − target spread|
     + wTop      · |top voice − previous top voice|        // keeps the upper line coherent
```

`previous` is an input, which is where voice leading comes from — this stage is necessarily
sequential. It is otherwise deterministic given `(event, previous, params)`, so it golden-tests
cleanly. If `event.pinned` is set, return it unchanged and use it as `previous` for the next
event.

Roles are assigned after selection: lowest voice `bass` (or `root` when a separate bass voice
is active and this is not the lowest sounding note), 3rd and 7th `guide`, 9/11/13 `ext`,
highest `top`.

The **bass voice** is voiced separately in its own register: root by default, 3rd or 5th when
the pattern calls for an inversion or a walking approach note. When a bass voice is active,
the chord voicer prefers rootless candidates — that is what the `rootless` dial controls.

## 8. Style and rhythm

```ts
type VoiceSelector = 'all' | 'bass' | 'upper' | 'guide' | 'top' | 'root'
type Strike  = { atBeat: number; durBeats: number; select: VoiceSelector; velocity: number }
type Pattern = { name: string; lengthBeats: number; strikes: Strike[]; weight: number }
type Style   = { name: string; chordPatterns: Pattern[]; bassPatterns: Pattern[]; swing: number }
```

Authored JSON in `audio/styles/`. Patterns are sampled per bar by weight, as Impro-Visor
does. A pattern shorter than the bar tiles; longer than the remaining event is truncated.

The realizer combines the three inputs into scheduleable notes:

```ts
realize(event: HarmonicEvent, voicing: Voicing, pattern: Pattern, p: Params): NoteEvent[]
type NoteEvent = { midi: number; atBeat: number; durBeats: number
                   velocity: number; voice: 'chord' | 'bass' }
```

First styles: sustained (today's behaviour, as a baseline), straight-eighths comp, ballad,
bossa-flavoured syncopation, and a walking-bass pattern. Five is enough to prove the format;
more are data, not code.

## 9. Runtime — look-ahead scheduler

Replaces the whole-progression-up-front `Tone.Part` in `audio/player.ts`.

`Tone.Transport.scheduleRepeat` fires at each bar. On each tick, if fewer than
`LOOKAHEAD_BARS` of material are scheduled ahead of the playhead, generate → voice → realize
→ schedule the missing bars. Buffer depth **2 bars** initially: deep enough never to
underrun, shallow enough that a dial move lands within a bar or two.

Parameters are read **at generation time**, not continuously, so a change applies cleanly at
the next generated bar rather than glitching material already scheduled.

**Modes.**

- `stream` — the generator advances indefinitely.
- `hold` — the harmony buffer freezes to the last *N* bars and cycles. **Realization still
  regenerates on every pass**, so voicings and comping keep breathing under the dials while
  the chords are locked. This falls out of the intent/realization split for free and is a
  more musical hold than freezing output outright.

Entering hold snapshots the current buffer; leaving it resumes generation from the held
buffer's final generator state.

## 10. Parameter bus

```ts
type ParamName =
  | 'brightness'       // target mode (Minor↔Major) + modulation destinations biased
                       //   flatward (dark) or sharpward (bright) on the circle of fifths
  | 'chromaticism'     // eligibility of non-diatonic bricks and substitutions
  | 'modulationRate'   // probability a brick is placed in a new key
  | 'harmonicRhythm'   // scales brick durations
  | 'cadencePressure'  // bias toward Cadence/Ending vs Dropback/Turnaround
  | 'voicingOpenness'  // target spread
  | 'register'         // centre of the voicing range
  | 'rootless'         // preference for rootless voicings
  | 'motionWeight'     // wMotion — how hard voice leading is enforced
  | 'density'          // pattern selection toward busier patterns
  | 'swing'

type Params = Record<ParamName, number>   // all normalized 0..1
```

A small observable store with `get`, `set`, `subscribe`. Every value is normalized so that
screen dials, MIDI CC, OSC or sensor input all map on without redesign. Screen dials are the
only surface built now.

Dials do not map one-to-one onto cost weights. `motionWeight` drives `wMotion` directly;
`voicingOpenness` sets the target spread that `wOpen` measures against; `register` shifts the
`[low, high]` window that `wRange` penalises; `rootless` biases subset selection. The
remaining weights (`wSpread`, `wInterval`, `wTop`) are fixed constants tuned once, not
exposed — they encode "don't sound bad" rather than "sound like this".

## 11. Prerequisite theory fixes

Narrow, and needed because a grammar over harmonic function requires correct primitives. Only
these; the surrounding dictionaries are deleted rather than repaired.

- **`getChordFromRomanNumeral`** currently resolves a numeral to a scale-degree index and
  returns whatever `Mode.seventhChords` has there, discarding the numeral's own quality. `V`
  in C minor yields `Gm7`, not `G7`; `vii°` yields `Bb7`. Rewrite it to *parse* the numeral
  (accidental, degree, case, `°`, `+`, suffix) and *build* the chord, with an explicit
  triad-or-seventh argument so plain triads become reachable.
- **`getRomanNumeralForChord`** uses Tonal's `type`, which is prose — `"major seventh"`, not
  `"maj7"` — so the diatonic chips currently render `Imajor seventh` and `Vdominant seventh`.
  Map through `Chord.get(x).aliases[0]` instead.
- **Delete:** `DIATONIC_SUGGESTIONS`, `COMMON_PATTERNS`, `getSuggestionsForChord` and its four
  suggestion flavours, `theory/consonance.ts` (unreferenced), and `getChordTensionScore`
  (never called; its `quality === 'Dominant'` branch is unreachable because Tonal reports
  `"Major"` for `G7` — the same mismatch that makes the jazzy suggestions dead code today).

## 12. Licensing

Impro-Visor is **GPL v2** (Robert Keller, Harvey Mudd College). The project owner accepts
GPL: Harmonicizer will be published, free to use, and not sold. Adapting Impro-Visor's
dictionary, style or voicing data is therefore permitted, and Harmonicizer takes GPL v2 if we
do. We still write our own first dictionary — a smaller hand-checked set is easier to debug
and weight — but this is a choice, not a constraint. Impro-Visor is acknowledged in the README.

Conrad Cork's brick theory (*Harmony with LEGO Bricks*) is published musical theory and free
to implement regardless.

## 13. Testing

Vitest. The four engine stages are pure, which is the point of the decomposition.

- **Theory primitives** — table tests over all 12 roots × 7 modes for numeral round-tripping,
  and explicit cases for the bugs in §11 so they cannot regress.
- **Brick expansion** — durations sum to the requested total, `'*'` absorbs the remainder,
  transposition is correct across all 12 target keys, nesting depth is capped, self-reference
  is rejected.
- **Section grammar** — over many seeded runs: fills exactly the requested beats, always
  terminates, always ends on Cadence or Ending, and respects the transition matrix.
- **Voicer** — golden tests on fixed `(event, previous, params)` triples; plus a property
  test asserting total voice-leading cost over a corpus is lower than a root-position
  baseline. Pinned voicings pass through untouched.
- **Realizer** — strikes land on the right beats, selectors pick the right roles, patterns
  tile and truncate correctly.

The scheduler is tested with Tone's transport mocked: assert that a tick schedules exactly
the missing bars, that hold cycles without advancing the generator, and that leaving hold
resumes from the right state.

## 14. Delivery sequence

Each step below gets its **own implementation plan**; this spec is too large for a single
one. Steps 0–2 are additive and land against the app as it stands, so the instrument sounds
better before any rewrite.

0. **Test harness + theory primitive fixes** (§11, §13). Small; unblocks everything.
1. **Voicing engine** (§7). Pure function, no architecture change — plugs into today's loop
   player and existing progressions immediately sound played rather than typed. Biggest
   audible win per unit work.

   The `HarmonicEvent` *type* lands here, but not yet the storage migration: at this step
   events are synthesized on the fly from the existing `{id, notes, duration}` chords by
   running `detectChordFromNotes` to recover a symbol. Chords whose notes spell nothing
   nameable are treated as already-pinned and pass through untouched. Storage changes at
   step 3.
2. **Parameter bus + dials** (§10), wired to voicing first: openness, register, rootless,
   motion weight.
3. **Brick dictionary + grammar generator** (§6), replacing `generateRandomProgression`. The
   data-model migration (§5) lands here.
4. **Look-ahead scheduler, stream + hold** (§9). `audio/player.ts` is rewritten.
5. **Style patterns + bass voice** (§8).
6. **Legibility overlay** — display the current brick, type and key while playing.

## 15. To revisit after human testing

Deliberately fixed as single constants so they are cheap to change once heard:

- **Five voice roles.** May be too coarse (no separate 9th vs 13th) or too fine.
- **Two bars of look-ahead.** May feel laggy for live dial work; the alternative is one bar
  with a mid-bar regeneration point.
- **Dictionary size**, 25–40 bricks. Likely the first thing that needs growing.
- **Whether `cadencePressure` should auto-ramp** on a slow LFO by default, or stay purely
  manual.
- **Candidate cap of 200** in the voicer — a performance guess, not a measured one.

## 16. References

- [Impro-Visor](https://github.com/Impro-Visor/Impro-Visor) — brick dictionary
  (`vocab/My.dictionary`), style files (`styles/*.sty`), parametric voicing presets
  (`voicings/*.fv`), grammars (`grammars/*.grammar`). GPL v2.
- Conrad Cork, *Harmony with LEGO Bricks* — the brick theory behind the dictionary.
- [Cognitone Synfire](https://www.cognitone.com/) — parametric, adaptive arrangement;
  harmony as a re-assignable layer.
- [Ableton Learning Music](https://learningmusic.ableton.com/) — learn-by-clicking pedagogy.
