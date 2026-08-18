# Implementation Plan — Step 3b: Harmony Grammar and the Intent/Realization Migration

**Date:** 2026-08-15
**Spec:** [2026-08-15-harmonic-accompaniment-design.md](../specs/2026-08-15-harmonic-accompaniment-design.md) §5, §6.4, §10
**Follows:** step 3a (brick dictionary, expander, palette, contextual suggestions) — shipped.

Split into two phases for the same reason 3a was split from 3b: the audible part can land
and be listened to before the structural change that cannot easily be undone.

- **3b-i — the grammar.** Additive. Produces progressions on demand in the format the app
  already stores, so nothing about saved sessions changes. Wires the five harmony dials.
- **3b-ii — the migration.** `HarmonicEvent[]` becomes stored state, session format v3,
  MIDI export reads realizations, the grid becomes a view. This is the irreversible part.

Do not start 3b-ii until 3b-i has been listened to. If the grammar's output is wrong, it is
much cheaper to fix before the data model depends on it.

---

## Phase 3b-i — The section grammar

### Design decisions to settle first

**Brick-type transitions are a first-order Markov chain, not a flat weighted draw.** An
Approach wants a Cadence after it; an Opening does not follow an Ending. A flat draw over
`brick.weight` cannot express that, and it is what makes the difference between a stream of
plausible bricks and a stream that goes somewhere.

**The chain is over *types*, the choice within a type is over `brick.weight`.** Two levels,
mirroring the spec: pick what kind of gesture comes next, then pick which instance of it.
This is also why `weight` needs to be right — 3a only used it for tie-breaking.

**Duration is consumed, not divided.** Following Impro-Visor's melody grammars, the
generator loops while beats remain, choosing a brick and subtracting its length. That is how
cadences land on bar lines instead of drifting. `harmonicRhythm` scales each brick's
`defaultBeats` before it is consumed.

**Modulation is a brick-level decision, not a separate mechanism.** Each brick is placed in
a key; `modulationRate` is the probability that key differs from the current one, and
`brightness` biases the destination sharpward or flatward round the circle of fifths.

**The generator is seeded and pure.** `generate(request, params, rng)` takes an injected RNG
so output is reproducible in tests. `Math.random` is the default only at the call site.

### Tasks

**T1 — Generator types and state.** `theory/grammar/types.ts`:

```ts
type GeneratorState = { key: string; mode: 'Major' | 'Minor'; lastType: BrickType | null }
type GenerateRequest = { beats: number; key: string; mode: string }
type GeneratedChord = ExpandedChord & { key: string }   // key, for later display
```

**T2 — Transition matrix.** `theory/grammar/transitions.ts`. A `Record<BrickType | 'start',
Record<BrickType, number>>`. Rows must be non-empty so the chain can never dead-end — test
that every row sums above zero and that every type is reachable from `start`.

**T3 — Dial-weighted type selection.** `selectType(lastType, params, rng)`:
- base row from the matrix;
- `cadencePressure` multiplies `Cadence` and `Ending`, divides `Dropback` and `Turnaround`;
- an exhausted budget forces a terminating type.

Tests: with `cadencePressure` at 1 the chain reaches a Cadence sooner than at 0, over many
seeded runs; selection never returns a type with zero weight.

**T4 — Dial-weighted brick selection.** `selectBrick(type, state, params, rng)`:
- candidates are the dictionary entries of that type whose `mode` matches, plus off-mode
  ones scaled down;
- `chromaticism` gates `diatonic: false` bricks — below a threshold they are excluded
  entirely rather than merely unlikely;
- weighted draw over `brick.weight`.

Tests: `chromaticism: 0` yields no non-diatonic bricks across many runs; `chromaticism: 1`
yields some; a minor key yields mostly minor bricks.

**T5 — Key choice.** `selectKey(state, params, rng)`: with probability `modulationRate`,
move round the circle of fifths, direction biased by `brightness`. Tests: rate 0 never
modulates; rate 1 usually does; destinations stay within the 12 keys the app knows.

**T6 — The generator loop.** `generate(request, params, rng)`: while beats remain, select
type → brick → key, scale `defaultBeats` by `harmonicRhythm`, clamp to the remaining budget,
expand, append, advance state.

Guarantees to test: fills the requested beats exactly; always terminates; ends on a Cadence
or Ending; every chord parses; is reproducible for a given seed; and — the real test — over
many runs produces many distinct progressions, unlike the two that `generateRandomProgression`
could manage.

**T7 — Wire the dials.** Add `brightness`, `chromaticism`, `modulationRate`,
`harmonicRhythm`, `cadencePressure` to `WIRED_PARAMS`. The existing test pinning that list
must be updated deliberately, not incidentally.

**T8 — Replace "I feel lucky".** `handleFeelLucky` calls the generator. Keep the existing
chord format; delete `generateRandomProgression`, `COMMON_PATTERNS`, `DIATONIC_SUGGESTIONS`,
`getSuggestionsForChord` and `HARMONIC_FUNCTION_THEORY` **only if** nothing still renders
them — `ProgressionAnalyzer` currently does, so either it moves to brick suggestions in this
phase or the tables stay one more step. Decide when the code is in front of us; do not
delete something still wired to the UI.

**Phase gate:** `npm test` green · `npx tsc --noEmit` clean · `npm run build` clean ·
listening check on generated progressions at several dial settings.

---

## Phase 3b-ii — The intent/realization migration

Only after 3b-i is confirmed by ear.

**T9 — Storage.** Progressions become `HarmonicEvent[]` per part (spec §5). Each event keeps
`symbol`, `degree`, `brick`, `durationBeats`, `key`, `mode`, and an optional `pinned`
voicing.

**T10 — Session v3.** Export writes `version: 3`. Import must handle v3, v2 **and** v1:
- v2/v1 chords have notes but no symbol, so run `detectChordFromNotes` to recover one and
  attach the original notes as `pinned`. Nothing a user has already saved may change how it
  sounds — that is the acceptance criterion, and it needs a test with a real v2 fixture.

**T11 — The grid as a view.** `ChordCard` renders from an event plus its realization. The
note visualizer writes a pin rather than replacing notes. Inversion and permutation buttons
edit the pin.

**T12 — MIDI export** walks realizations, not stored notes.

**T13 — Delete what the migration makes dead**, including whatever survived T8.

**Phase gate:** everything above, plus round-tripping a v2 session file through import →
export → import and confirming the audible result is identical.

---

## Risks

- **The interim tables are still wired to `ProgressionAnalyzer`.** Deleting them because the
  spec says to, without checking the UI, breaks the app. T8 says decide with the code in
  front of us for exactly this reason.
- **A first-order chain may not be enough** to keep long runs interesting. If output feels
  aimless over minutes rather than bars, the fix is a longer memory or a section-level plan,
  not more bricks. Judge by ear before adding machinery.
- **`brick.weight` has never been tuned by ear.** 3b-i is the first phase where it materially
  shapes output. Expect to revise the dictionary weights after listening; that is cheap.
- **The v1/v2 import path is the one place a bug is silently destructive.** It must be tested
  against a real exported file, not a hand-written fixture that happens to match the parser.
