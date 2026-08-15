# Harmonicizer

A browser-based workbench for **building, hearing and understanding chord progressions**.

You lay chords out on a grid, arrange them into song parts, and play them back through a
built-in synth. Alongside the grid, a theory panel tells you what key you are in, which
chords are diatonic, which are borrowed, and where the current chord usually wants to go
next.

Built with React 19 + Vite, [Tone.js](https://tonejs.github.io/) for audio and
[Tonal](https://github.com/tonaljs/tonal) for music theory. No backend, no build-time
services — it runs entirely in the browser.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static bundle in dist/
npm run preview  # serve the built bundle
```

Requires Node 18+. Audio only starts after the first click anywhere in the page — that is a
browser autoplay requirement, not a bug.

---

## What it does today

**Composing**

- A grid of chord cards. Each card is a set of concrete notes (`['C4','E4','G4','B4']`) plus
  a duration in beats — not a chord symbol. The symbol shown on the card is *detected* from
  the notes, so hand-edited voicings keep working even when they do not spell a textbook chord.
- Add or edit a chord through a modal: root note, chord type, octave, duration, or "rest".
- Reorder cards by drag and drop (desktop only — see *Known gaps*).
- Change a chord's voicing in place: next/previous inversion, or shuffle the upper voices.
- Edit notes directly on a piano-roll strip under each card, with scale degrees marked.
- Undo, for progression edits.

**Arranging**

- Multiple progressions, named `A`, `B`, `C`… ("song parts"). Add, duplicate, delete.
- A song structure strip that sequences those parts into a full arrangement (`A A B A`).
- Playback follows the arrangement and highlights the chord and the part currently sounding.

**Sound**

- Nine voices: a Rhodes-ish FM patch, Moog-style lead and bass (`MonoSynth` + ladder-ish
  filter settings), two VCS3-flavoured FM patches, raw FM/AM/basic synths, and sampled
  instruments loaded from a soundfont CDN.
- Per-voice ADSR with a graphical envelope editor, plus knobs for the voice-specific
  parameters (harmonicity, modulation index, filter cutoff/resonance and filter envelope).
- Master gain and a reverb send.
- An arpeggiator that cycles the chord's notes at a chosen subdivision.

**Theory panel**

- Key and mode picker (major, minor, and the five other diatonic modes).
- Scale degrees, mode description, diatonic seventh chords, and chords borrowed from the
  parallel major/minor. Click any of them to insert it.
- For the selected chord: a plain-language summary of its harmonic function and the common
  moves out of it, each with an "add these chords" button.
- Two scores: *Harmonic Richness* (average chord size) and *Consonance* (average number of
  common tones between adjacent chords).

**In / out**

- Export and import the whole session as readable JSON (v2 format, with a v1 fallback).
- Export the arrangement as a standard MIDI file.

---

## How it is put together

Three layers, cleanly separated:

| Layer | Where | Role |
|---|---|---|
| UI | [components/](components/) | Presentational React components; nearly all state comes in as props |
| State | [modes/composer/Composer.tsx](modes/composer/Composer.tsx) | Single source of truth — progressions, transport, synth settings, key/mode |
| Engines | [audio/player.ts](audio/player.ts), [theory/](theory/) | Tone.js wrapper, and pure music-theory functions over Tonal |

Data flows one way: components call prop callbacks → `Composer` updates state → `useEffect`
hooks push the change into the `Player` → the `Player` calls back through `onTick` to
highlight whatever is sounding.

The audio engine keeps one long-lived `Tone.Part`. Changing the progression clears and
refills that part rather than creating a new one, which avoids a class of scheduling race
conditions.

[architecture.md](architecture.md) has the longer version.

### The theory engine

- [theory/chords.ts](theory/chords.ts) — chord ↔ notes. Voicing construction, inversions,
  permutations, octave wrapping to C3–C6, and chord detection from arbitrary note sets.
- [theory/harmony.ts](theory/harmony.ts) — key context. Roman numerals in both directions,
  diatonic and borrowed chords, a small dictionary of common patterns.
- [theory/analysis.ts](theory/analysis.ts) — progression-level. Next-chord suggestions in
  four flavours (coherent / inventive / jazzy / classical), harmonic-function prose, and
  the richness and consonance scores.

---

## Known gaps

Honest list. Nothing here is hidden behind a "coming soon".

**Musical correctness**

- **Roman numerals render as prose.** The diatonic chord chips read `Imajor seventh`,
  `Vdominant seventh` instead of `Imaj7`, `V7`. Tonal returns `type: "major seventh"` where
  [theory/harmony.ts](theory/harmony.ts#L80) expects a short alias like `maj7`.
- **The dominant is minor in minor keys.** `getChordFromRomanNumeral` resolves a numeral to
  a scale degree and then returns whatever `Mode.seventhChords` puts there — so `V` in C
  minor yields `Gm7`, not `G7`. The numeral's own quality is ignored. The "Authentic
  Cadence" suggestion therefore proposes `v → i`, and the accompanying text still promises
  "the major V chord has a particularly strong pull".
- **Everything is a seventh chord.** The same function can only ever return the diatonic
  *seventh*. Plain triads are unreachable from the theory panel.
- **Jazz suggestions never appear.** The tritone-sub and altered-dominant branch tests
  `quality === 'Dominant'`, but Tonal reports `quality: "Major"` for `G7`. Dead code path.
- **Secondary dominants ignore the mode.** V/V and V/vi are computed from the tonic alone,
  so C minor is offered `A7` — a dominant of a chord that is not in the key.
- **`vii°` in minor resolves to `Bb7`** (the subtonic), and `'iio'` in the suggestion table
  is misspelled — it silently resolves to nothing.
- **"I feel lucky" has two outcomes.** Only two 4-chord patterns exist in `COMMON_PATTERNS`,
  and both start on the tonic.

**Accompaniment**

- Chords play as **block chords**: every note struck at once, held for the full duration.
- The arpeggiator cycles notes in voicing order at a fixed subdivision. There is no
  rhythmic pattern language, no bass line, no comping style.
- **No voice leading.** Generated and inserted chords are always built in root position from
  octave 4, so consecutive chords leap. Inversions exist, but only as manual buttons.
- The *Consonance* score measures common tones but nothing acts on it.

**Product**

- **The Explorer mode does not exist.** The original spec (below) describes a
  force-directed 3D graph of chords and notes. No `react-three-fiber` dependency is
  installed, and nothing renders it.
- **Not a PWA.** No manifest, no service worker, no icons, despite the spec.
- **Consonance-ranked chord picking was dropped.** The spec's colour-coded, consonance-sorted
  chord list never shipped; the selector shows a plain chromatic grid instead.
  [theory/consonance.ts](theory/consonance.ts) is the orphan of that feature — it is not
  imported anywhere.
- **MIDI import is missing** despite a commit claiming it. Only export exists.
- **Drag-and-drop is desktop-only.** [ChordGrid](components/ChordGrid/ChordGrid.tsx) uses the
  HTML5 drag events, which touch browsers do not fire. Reordering on a phone is impossible.

**Code health**

- No tests, no linter, no CI. The theory engine is pure functions over a stable library —
  it is the easiest thing in the project to test and the most valuable to lock down.
- [Composer.tsx](modes/composer/Composer.tsx) is ~960 lines and holds 25 `useState` calls,
  nine of which are near-identical synth-settings slots.
- `setProgressionsWithHistory` calls other setters *inside* a `setState` updater, which
  React may run twice in StrictMode — undo history can gain duplicate entries.
- Undo only covers progressions, not song structure, key/mode or tempo.
- Empty placeholder files are checked in: `PerformancePad`, `SelectionAnalyzer`,
  `EnvelopeControls` (0 bytes each, `.tsx` and `.css`).
- [vite.config.ts](vite.config.ts) injects `GEMINI_API_KEY` into the client bundle. Nothing
  in the app uses it; if a key is ever set in `.env`, the build will publish it.
- `index.html` declares `charset="utf-t"` — a typo; browsers fall back to a default.
- One 610 kB JS bundle, no code splitting.

---

## Roadmap

Near-term, in rough priority order:

1. **A real accompaniment engine** — a brick-based harmony generator, automatic voice
   leading, pattern-based comping and an independent bass voice, driven by live parameters
   over a streaming scheduler. Designed in
   [docs/superpowers/specs/2026-08-15-harmonic-accompaniment-design.md](docs/superpowers/specs/2026-08-15-harmonic-accompaniment-design.md).
2. **Fix the theory engine** — quality-aware Roman numerals both ways, triads as
   first-class citizens, mode-aware secondary dominants. Cover it with tests first.
3. **Touch-friendly editing** — replace HTML5 drag-and-drop with pointer events.
4. **Performance mode** — improvise melodies over the progression.
5. **Explorer mode** — the force-directed chord/note graph from the original vision.
6. **PWA packaging** — manifest, service worker, offline soundfont caching.

---

## Acknowledgements

**[Impro-Visor](https://github.com/Impro-Visor/Impro-Visor)** — by Robert Keller and students
at Harvey Mudd College, GPL v2 — is the main influence on where Harmonicizer is going. Three
of its ideas are being adapted here:

- The **brick dictionary** (`vocab/My.dictionary`), an implementation of Conrad Cork's
  *Harmony with LEGO Bricks*: harmony described as named, composable units — cadences,
  approaches, turnarounds, dropbacks — each carrying its own key, so that chaining them
  produces modulation for free.
- **Style files** (`styles/*.sty`), where accompaniment rhythm is weighted, sampled data
  rather than code.
- **Auto-voicing presets** (`voicings/*.fv`), which treat voicing as a parametric search —
  hand ranges, spread limits, minimum intervals, a rootless toggle, and an explicit
  preference for smooth motion.

Also informing the direction: **[Cognitone Synfire](https://www.cognitone.com/)**, for
treating harmony as a separate, re-assignable layer so that an arrangement stays adaptive
when the harmony changes; and **[Ableton Learning
Music](https://learningmusic.ableton.com/)**, for its learn-by-clicking approach to making
theory audible.

If Impro-Visor's data is adapted directly rather than reimplemented, Harmonicizer takes GPL
v2 along with it. That is an accepted outcome — this project is published, free to use, and
not for sale.

---

## Original vision

Kept for reference — this is the brief the project was built from. Items marked *(not built)*
are still open.

> The goal is to create and compose musical chord progression and to explore it.
>
> **The composer** — a grid of cards you can click. Selecting a card lets you choose a chord
> from a dictionary and its duration, or a silence. When the progression has at least one
> chord, the chord list should be colorized and hierarchised: most consonant first, in hotter
> colours; least common notes at the end, in colder colours. *(colorized list: not built)*
>
> **The explorer** — a self-organizing map. Chords are nodes, notes are smaller nodes, and a
> note attaches to every chord it belongs to rather than appearing twice. Nodes are masses,
> links are springs, simulation parameters are adjustable, and clicking a node plays it.
> *(not built)*
>
> **Features** — import/export as human-readable JSON, responsive landscape and portrait
> layouts, installable as a PWA. *(PWA: not built)*

The full LLM-facing build roadmap that came out of that brief is in [GEMINI.md](GEMINI.md).
Note that it is a *plan*, not a description of the code — it still describes `src/`, Zustand
and `r3f-forcegraph`, none of which are in the repo.

### Older TODO

- improve harmonic knowledge base
- fix editing on mobile (needs a long press to activate a note — the debounce may be too long)
- add a performance section to improvise melodies
