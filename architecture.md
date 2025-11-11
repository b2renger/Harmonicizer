# Harmonicizer Application Architecture

This document provides a high-level overview of the Harmonicizer web app's architecture, its core components, and the data flow between them.

## 1. High-Level Overview

Harmonicizer is a single-page application (SPA) built with React. Its architecture is centered around a primary "smart" container component, `Composer.tsx`, which manages the majority of the application's state and logic.

The architecture can be broken down into three main layers:

1.  **UI Layer (React Components)**: A tree of React components responsible for rendering the user interface and capturing user input. Most of these are "dumb" or presentational components that receive data and callbacks as props.
2.  **State Management Layer (`Composer.tsx`)**: The central hub of the application. It uses React hooks (`useState`, `useRef`, `useCallback`, `useMemo`) to manage the chord progression, synth settings, playback state, and more. It acts as the single source of truth.
3.  **Engine Layer (TypeScript Classes & Functions)**:
    *   **Audio Engine (`audio/player.ts`)**: An abstraction layer over `Tone.js`. This class encapsulates all audio-related functionality, such as creating synthesizers, scheduling chord playback, managing effects, and controlling the transport (play/pause/tempo).
    *   **Music Theory Engine (`theory/*.ts`)**: A collection of pure utility functions that handle all music theory calculations. It leverages the `tonal` library to analyze progressions, suggest chords, detect chord names, and manage musical concepts like keys, modes, and inversions.

---

## 2. Component Breakdown

The application follows a component-based architecture. Here are the key components and their roles:

-   **`App.tsx`**: The root component of the application. It sets up the main container and currently only renders the `Composer` mode.

-   **`Composer.tsx`**: This is the most important component, acting as the orchestrator for the entire application.
    -   **Responsibilities**:
        -   Holds all major state variables: the chord progression, tempo, synth type, effect settings, musical key/mode, etc.
        -   Contains all the event handler logic for user interactions (e.g., adding a chord, changing tempo, toggling play).
        -   Initializes and holds the `Player` instance in a `useRef` to persist it across re-renders.
        -   Uses `useEffect` hooks to synchronize the `Player`'s state with the component's state (e.g., updating the audio engine when the progression changes).
        -   Passes state and memoized callbacks down to its child components.

-   **`ChordGrid.tsx`**:
    -   **Responsibilities**:
        -   Renders the list of `ChordCard` components from the `progression` array.
        -   Manages the drag-and-drop logic for reordering chords.
        -   Includes the "Add Chord" button.

-   **`ChordCard.tsx`**:
    -   **Responsibilities**:
        -   Displays a single chord's name and duration.
        -   Provides UI controls for editing, removing, selecting, and changing the chord's voicing (inversions/permutations).
        -   Visually indicates its selection and playback state.

-   **`ChordSelector.tsx` (Modal)**:
    -   **Responsibilities**:
        -   A complex modal for creating a new chord or editing an existing one.
        -   Provides UI for selecting root note, chord type, duration, and octave.
        -   Includes a `ChordTransitionVisualizer` to show how the new/edited chord relates to its neighbors in the progression.
        -   Uses the `Player` instance (passed as a prop) to preview chords.

-   **`TransportControls.tsx`**:
    -   **Responsibilities**: A simple, presentational component for the main playback controls (Play/Pause, Loop, Tempo slider).

-   **`GraphicalEnvelopeEditor.tsx`**:
    -   **Responsibilities**: A container for all synthesizer and effects controls.
        -   It dynamically renders specific controls (`Knob`s, `ADSRGraph`) based on the selected `synthType`.
        -   Manages controls for global effects (Reverb, Gain) and the arpeggiator.

-   **`ProgressionAnalyzer.tsx`**:
    -   **Responsibilities**: Displays the output of the music theory engine.
        -   Shows information about the current key and mode.
        -   Lists diatonic and borrowed chords that can be added to the progression.
        -   Provides harmonic theory context and suggestions for the currently selected chord.
        -   Displays analysis scores for "Richness" and "Consonance".

-   **Visualizer Components (`VerticalNoteVisualizer.tsx`, `ChordTransitionVisualizer.tsx`)**:
    -   **Responsibilities**: Render interactive piano-roll-style views of the notes within a chord, showing their relationship to the current musical scale.

---

## 3. Data Flow

The application uses a unidirectional data flow, which is typical for React applications.

1.  **State Initialization**: The `Composer` component initializes all state. It also creates an instance of the `Player` class and stores it in a `useRef`.

2.  **User Interaction**:
    -   A user interacts with a "dumb" child component (e.g., clicks the "Play" button in `TransportControls`).
    -   The component doesn't change its own state. Instead, it calls a function passed down to it via props (e.g., `onPlayToggle`).

3.  **State Update**:
    -   The callback function, which lives in `Composer`, is executed.
    -   This function updates the state in `Composer` using a `setState` hook (e.g., `setIsPlaying(!isPlaying)`).

4.  **Re-render**:
    -   The state change in `Composer` triggers a re-render of `Composer` and its children.
    -   The new state values (e.g., the new `isPlaying` boolean) are passed down as props to the child components.
    -   Child components wrapped in `React.memo` will only re-render if their props have actually changed, optimizing performance.

5.  **Side Effects (Audio Engine)**:
    -   A `useEffect` hook in `Composer` listens for changes in specific state variables (e.g., `progression`, `tempo`, `synthType`).
    -   When a relevant state variable changes, the effect runs and calls the appropriate method on the `player.current` object (e.g., `player.current.setProgression(newProgression)`).
    -   The `Player` class then interacts with the `Tone.js` library to update the audio schedule or synthesizer settings.

6.  **Feedback from Audio Engine**:
    -   During playback, the `Player` class uses a callback (`onTick`) provided by `Composer` during instantiation.
    -   On each scheduled chord, `onTick` is called with the ID of the playing chord.
    -   This callback updates the `currentlyPlayingChordId` state in `Composer`.
    -   This final state update causes a re-render that highlights the currently playing `ChordCard`, providing visual feedback to the user.

This architecture effectively separates concerns: React components handle the view, the `Composer` handles the state, the `Player` class handles the audio, and the `theory` functions handle the musical logic.
