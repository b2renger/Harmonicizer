
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import TransportControls from '../../components/TransportControls/TransportControls.tsx';
import ChordGrid from '../../components/ChordGrid/ChordGrid.tsx';
import ChordSelector from '../../components/ChordSelector/ChordSelector.tsx';
import GraphicalEnvelopeEditor from '../../components/GraphicalEnvelopeEditor/GraphicalEnvelopeEditor.tsx';
import KeySignature from '../../components/KeySignature/KeySignature.tsx';
import ProgressionAnalyzer from '../../components/ProgressionAnalyzer/ProgressionAnalyzer.tsx';
import CollapsibleSection from '../../components/CollapsibleSection/CollapsibleSection.tsx';
import { Player } from '../../audio/player.js';
import { analyzeProgression, getSuggestionsForChord, getHarmonicTheoryForChord } from '../../theory/analysis.js';
import { generateRandomProgression, getDiatonicChords } from '../../theory/harmony.js';
import './Composer.css';
import { rootNotes, modes, detectChordFromNotes, getChordNotesWithOctaves, getNextInversion, getPreviousInversion, getPermutedVoicing } from '../../theory/chords.js';

const MAX_HISTORY_SIZE = 30;

// Default Synth Settings
const DEFAULT_ENVELOPE = { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 };

const DEFAULT_RHODES_SETTINGS = { 
    envelope: { attack: 0.01, decay: 1.4, sustain: 0, release: 0.2 },
    volume: -10,
    harmonicity: 5.01,
    modulationIndex: 12,
};
const DEFAULT_MOOG_LEAD_SETTINGS = { 
    envelope: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.8 },
    volume: -6,
    filterCutoff: 4000, filterResonance: 3, filterAttack: 0.02, filterDecay: 0.4, filterSustain: 0.5, filterRelease: 0.6 
};
const DEFAULT_MOOG_BASS_SETTINGS = { 
    envelope: { attack: 0.03, decay: 0.2, sustain: 0.2, release: 0.3 },
    volume: -4,
    filterCutoff: 1500, filterResonance: 4, filterAttack: 0.01, filterDecay: 0.2, filterSustain: 0.2, filterRelease: 0.3 
};
const DEFAULT_VCS3_DRONE_SETTINGS = { 
    envelope: { attack: 0.4, decay: 0.01, sustain: 1, release: 0.5 },
    volume: -9,
    harmonicity: 0.5, 
    modulationIndex: 5 
};
const DEFAULT_VCS3_FX_SETTINGS = { 
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.4 },
    volume: -9,
    harmonicity: 3.5, 
    modulationIndex: 20 
};
const DEFAULT_FM_SETTINGS = {
    envelope: DEFAULT_ENVELOPE,
    volume: -9,
    harmonicity: 3,
    modulationIndex: 10,
};
const DEFAULT_AM_SETTINGS = {
    envelope: DEFAULT_ENVELOPE,
    volume: -9,
    harmonicity: 3,
    modulationType: 'square',
};
const DEFAULT_BASIC_SYNTH_SETTINGS = {
    envelope: DEFAULT_ENVELOPE,
    volume: -9,
};

/**
 * The Composer component is the main container and orchestrator for the application.
 * It manages all application state, handles user interactions, and communicates with the
 * audio player engine.
 */
const Composer = ({ screenWidth, screenHeight }) => {
    // --- STATE MANAGEMENT ---
    
    // Core progression data and history for undo functionality
    const [progression, setProgression] = useState([
        { id: crypto.randomUUID(), notes: ['C4', 'E4', 'G4', 'B4'], duration: 4 }, // Cmaj7
        { id: crypto.randomUUID(), notes: ['A3', 'C4', 'E4', 'G4'], duration: 4 }, // Am7
        { id: crypto.randomUUID(), notes: ['D4', 'F4', 'A4', 'C5'], duration: 4 }, // Dm7
        { id: crypto.randomUUID(), notes: ['G4', 'B4', 'D5', 'F5'], duration: 4 }, // G7
    ]);
    const [progressionHistory, setProgressionHistory] = useState([]);
    const [selectedChordId, setSelectedChordId] = useState(null);

    // Transport and playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [tempo, setTempo] = useState(120);
    const [synthType, setSynthType] = useState('Rhodes');
    const [isLooping, setIsLooping] = useState(true);
    
    // State for individual synthesizer settings
    const [rhodesSettings, setRhodesSettings] = useState(DEFAULT_RHODES_SETTINGS);
    const [moogLeadSettings, setMoogLeadSettings] = useState(DEFAULT_MOOG_LEAD_SETTINGS);
    const [moogBassSettings, setMoogBassSettings] = useState(DEFAULT_MOOG_BASS_SETTINGS);
    const [vcs3DroneSettings, setVcs3DroneSettings] = useState(DEFAULT_VCS3_DRONE_SETTINGS);
    const [vcs3FxSettings, setVcs3FxSettings] = useState(DEFAULT_VCS3_FX_SETTINGS);
    const [fmSettings, setFmSettings] = useState(DEFAULT_FM_SETTINGS);
    const [amSettings, setAmSettings] = useState(DEFAULT_AM_SETTINGS);
    const [basicSynthSettings, setBasicSynthSettings] = useState(DEFAULT_BASIC_SYNTH_SETTINGS);

    // Global effects state
    const [masterGain, setMasterGain] = useState(0.8);
    const [reverbWet, setReverbWet] = useState(0.2);
    const [reverbTime, setReverbTime] = useState(1.5);

    // Arpeggiator state
    const [isArpeggiatorActive, setIsArpeggiatorActive] = useState(false);
    const [arpeggiatorTiming, setArpeggiatorTiming] = useState('16n');
    const [arpeggiatorRepeats, setArpeggiatorRepeats] = useState(Infinity);

    // Music theory context state
    const [musicalKey, setMusicalKey] = useState('C');
    const [musicalMode, setMusicalMode] = useState('major');
    
    // UI state
    const [currentlyPlayingChordId, setCurrentlyPlayingChordId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChord, setEditingChord] = useState(null);
    const [isNoteVisualizerVisible, setIsNoteVisualizerVisible] = useState(false);

    // A ref to hold the Player class instance, persisting it across re-renders without causing them.
    const player = useRef(null);

    // --- MEMOIZED COMPUTATIONS ---
    // These values are re-calculated only when their dependencies change, improving performance.

    const analysisResults = useMemo(() => {
        return analyzeProgression(progression, musicalKey, musicalMode);
    }, [progression, musicalKey, musicalMode]);

    const selectionContext = useMemo(() => {
        if (!selectedChordId || progression.length === 0) return null;
        const selectedIndex = progression.findIndex(c => c.id === selectedChordId);
        if (selectedIndex === -1) return null;
        return progression[selectedIndex];
    }, [selectedChordId, progression]);

    const exhaustiveSuggestions = useMemo(() => {
        const contextChord = selectionContext 
            ? selectionContext
            : progression.length > 0 ? progression[progression.length - 1] : null;
        const contextChordName = contextChord && contextChord.notes.length > 0 ? detectChordFromNotes(contextChord.notes) : null;
        const categorized = getSuggestionsForChord(contextChordName, musicalKey, musicalMode);
        const harmonicTheory = contextChordName
            ? getHarmonicTheoryForChord(contextChordName, musicalKey, musicalMode)
            : null;
        return { categorized, harmonicTheory };
    }, [selectionContext, progression, musicalKey, musicalMode]);

    // Memoize the current synth settings object to prevent unnecessary updates to the audio player.
    const currentSynthSettings = useMemo(() => {
        switch (synthType) {
            case 'Rhodes': return rhodesSettings;
            case 'MoogLead': return moogLeadSettings;
            case 'MoogBass': return moogBassSettings;
            case 'VCS3Drone': return vcs3DroneSettings;
            case 'VCS3FX': return vcs3FxSettings;
            case 'FMSynth': return fmSettings;
            case 'AMSynth': return amSettings;
            case 'Synth': return basicSynthSettings;
            default: return basicSynthSettings;
        }
    }, [synthType, rhodesSettings, moogLeadSettings, moogBassSettings, vcs3DroneSettings, vcs3FxSettings, fmSettings, amSettings, basicSynthSettings]);

    // --- CALLBACKS & HANDLERS ---
    // `useCallback` is used extensively to memoize event handlers, preventing child components
    // from re-rendering unnecessarily when the Composer's state changes.

    /**
     * A wrapper for setProgression that also saves the previous state to history for undo.
     */
    const setProgressionWithHistory = useCallback((newProgressionOrFn) => {
        setProgression(currentProgression => {
            // Save the state *before* the update to the history.
            setProgressionHistory(prevHistory => {
                const newHistory = [...prevHistory, currentProgression];
                 if (newHistory.length > MAX_HISTORY_SIZE) {
                    return newHistory.slice(1); // Keep history size manageable
                }
                return newHistory;
            });

            // Get the new progression, whether it's a value or a function.
            const newProgression = typeof newProgressionOrFn === 'function' 
                ? newProgressionOrFn(currentProgression) 
                : newProgressionOrFn;

            // If the currently selected chord was removed, reset the selection.
            if (selectedChordId && !newProgression.some(c => c.id === selectedChordId)) {
                setSelectedChordId(null);
            }
            return newProgression;
        });
    }, [selectedChordId]); // Dependency on selectedChordId is needed for the reset logic.

    /**
     * Reverts the progression to its previous state from the history stack.
     */
    const handleUndo = useCallback(() => {
        if (progressionHistory.length === 0) return;
        const previousProgression = progressionHistory[progressionHistory.length - 1];
        const newHistory = progressionHistory.slice(0, -1);
        setProgression(previousProgression); // Note: we don't use the history wrapper here
        setProgressionHistory(newHistory);
        if (selectedChordId && !previousProgression.some(c => c.id === selectedChordId)) {
            setSelectedChordId(null);
        }
    }, [progressionHistory, selectedChordId]);

    // --- SIDE EFFECTS (`useEffect`) ---
    // These hooks synchronize the React component state with the audio player engine (Player class).

    // Effect for initial setup and teardown of the Player. Runs only once.
    useEffect(() => {
        // The callback passed to Player allows it to update React state from the audio thread.
        player.current = new Player((id) => setCurrentlyPlayingChordId(id));
        
        // Initialize player with default state
        player.current.setTempo(tempo);
        player.current.setLoop(isLooping);
        player.current.setGain(masterGain);
        player.current.setReverbWet(reverbWet);
        player.current.setReverbTime(reverbTime);
        player.current.setArpeggiator(isArpeggiatorActive, arpeggiatorTiming, arpeggiatorRepeats);
        player.current.setSynth(synthType, currentSynthSettings);
        player.current.setProgression(progression);

        // Cleanup function: dispose of the player and all Tone.js resources on unmount.
        return () => {
            player.current?.dispose();
        }
    }, []); // Empty dependency array ensures this runs only on mount and unmount.

    // Effect to update the player when the progression or tempo changes.
    useEffect(() => {
        if(player.current) {
            player.current.setTempo(tempo);
            player.current.setProgression(progression);
        }
    }, [tempo, progression]);

    // Effects for individual global settings
    useEffect(() => { player.current?.setGain(masterGain); }, [masterGain]);
    useEffect(() => { player.current?.setReverbWet(reverbWet); }, [reverbWet]);
    useEffect(() => { player.current?.setReverbTime(reverbTime); }, [reverbTime]);

    // Effect to change the synth engine (a more expensive operation).
    useEffect(() => {
        player.current?.setSynth(synthType, currentSynthSettings);
    }, [synthType]); // Note: currentSynthSettings is NOT a dependency to avoid changing the whole synth on knob tweaks.

    // Effect to update the current synth's parameters in real-time.
    useEffect(() => {
        player.current?.updateVoiceSettings(currentSynthSettings);
    }, [currentSynthSettings]);

    // Effect to update the player when arpeggiator settings change.
    useEffect(() => {
        if (player.current) {
            player.current.setArpeggiator(isArpeggiatorActive, arpeggiatorTiming, arpeggiatorRepeats);
            // The progression must be re-processed to apply new arpeggiator settings.
            player.current.setProgression(progression);
        }
    }, [isArpeggiatorActive, arpeggiatorTiming, arpeggiatorRepeats, progression]);

    const handlePlayToggle = useCallback(async () => {
        if (!player.current || progression.length === 0) return;
        await player.current.start(); // Ensure AudioContext is running
        if (isPlaying) {
            player.current.stop();
            setIsPlaying(false);
            setCurrentlyPlayingChordId(null);
        } else {
            player.current.play();
            setIsPlaying(true);
        }
    }, [isPlaying, progression.length]);
    
    const handleTempoChange = useCallback((newTempo) => { setTempo(newTempo); }, []);
    
    const handleSynthChange = useCallback((newSynth) => { setSynthType(newSynth); }, []);
    
    const handleLoopToggle = useCallback(() => {
        const newIsLooping = !isLooping;
        setIsLooping(newIsLooping);
        player.current?.setLoop(newIsLooping);
    }, [isLooping]);

    const handleClearProgression = useCallback(() => { setProgressionWithHistory([]); }, [setProgressionWithHistory]);

    const handleFeelLucky = useCallback(() => {
        // If progression is empty, generate a brand new one.
        if (progression.length === 0) {
            const newTempo = Math.floor(Math.random() * (160 - 80 + 1)) + 80;
            const newKey = rootNotes[Math.floor(Math.random() * rootNotes.length)];
            const newMode = modes[Math.floor(Math.random() * modes.length)];
            const newChordNames = generateRandomProgression(newKey, newMode);
    
            if (newChordNames.length > 0) {
                const newChords = newChordNames.map(name => ({
                    id: crypto.randomUUID(),
                    notes: getChordNotesWithOctaves(name, 4),
                    duration: 4,
                }));
                setTempo(newTempo);
                setMusicalKey(newKey);
                setMusicalMode(newMode);
                setProgressionWithHistory(newChords);
            }
        } else { // Otherwise, append 4 new suggested chords.
            const generatedChords = [];
            let currentContextChord = progression[progression.length - 1];

            for (let i = 0; i < 4; i++) {
                if (!currentContextChord || currentContextChord.notes.length === 0) break;
                const currentContextChordName = detectChordFromNotes(currentContextChord.notes);
                if (!currentContextChordName) break;
                const suggestions = getSuggestionsForChord(currentContextChordName, musicalKey, musicalMode);
                // Prioritize coherent suggestions, but fall back to any diatonic chord.
                let candidateChords = suggestions.coherent;
                if (candidateChords.length === 0) {
                    const diatonicChords = getDiatonicChords(musicalKey, musicalMode).map(c => c.name);
                    candidateChords = diatonicChords.filter(c => c !== currentContextChordName);
                }
                if (candidateChords.length === 0) break;
                
                const nextChordName = candidateChords[Math.floor(Math.random() * candidateChords.length)];
                const newChord = { id: crypto.randomUUID(), notes: getChordNotesWithOctaves(nextChordName, 4), duration: 4 };
                generatedChords.push(newChord);
                currentContextChord = newChord;
            }

            if (generatedChords.length > 0) {
                setProgressionWithHistory(current => [...current, ...generatedChords]);
            }
        }
    }, [progression, musicalKey, musicalMode, setProgressionWithHistory]);

    const handleRemoveChord = useCallback((idToRemove) => {
        setProgressionWithHistory(currentProgression => 
            currentProgression.filter(chord => chord.id !== idToRemove)
        );
        if (currentlyPlayingChordId === idToRemove) {
            setCurrentlyPlayingChordId(null);
        }
        // If the last chord is removed while playing, stop playback.
        if (progression.length === 1 && progression[0].id === idToRemove && isPlaying) {
            player.current?.stop();
            setIsPlaying(false);
        }
    }, [currentlyPlayingChordId, isPlaying, progression.length, setProgressionWithHistory]);

    const handleEditChord = useCallback((chord) => {
        setEditingChord(chord || { id: crypto.randomUUID(), notes: [] });
        setIsModalOpen(true);
    }, []);

    const handleSelectChord = useCallback((chordId) => {
        // Toggle selection
        setSelectedChordId(currentId => (currentId === chordId ? null : chordId));
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingChord(null);
    }, []);

    const handleSaveChord = useCallback((savedChord) => {
        setProgressionWithHistory(currentProgression => {
            const existingIndex = currentProgression.findIndex(c => c.id === editingChord?.id);
            // If chord exists, update it.
            if (existingIndex > -1) {
                const newProgression = [...currentProgression];
                newProgression[existingIndex] = { ...savedChord, id: editingChord.id };
                return newProgression;
            } else { // Otherwise, add it to the end.
                return [...currentProgression, { ...savedChord, id: editingChord.id }];
            }
        });
        handleCloseModal();
    }, [editingChord, handleCloseModal, setProgressionWithHistory]);

    const handleReorderProgression = useCallback((newProgression) => { setProgressionWithHistory(newProgression); }, [setProgressionWithHistory]);

    const handleAddChords = useCallback((chordNames) => {
        const newChords = chordNames.map(name => ({
            id: crypto.randomUUID(),
            notes: getChordNotesWithOctaves(name, 4),
            duration: 4,
        }));
        setProgressionWithHistory(currentProgression => {
            // If a chord is selected, insert new chords after it.
            if (selectedChordId) {
                const selectedIndex = currentProgression.findIndex(c => c.id === selectedChordId);
                if (selectedIndex > -1) {
                    const newProgression = [...currentProgression];
                    newProgression.splice(selectedIndex + 1, 0, ...newChords);
                    return newProgression;
                }
            }
            // Otherwise, append to the end.
            return [...currentProgression, ...newChords];
        });
    }, [selectedChordId, setProgressionWithHistory]);

    const handleChordNotesUpdate = useCallback((chordId, newNotes) => {
        setProgressionWithHistory(currentProgression => {
            const index = currentProgression.findIndex(c => c.id === chordId);
            if (index === -1) return currentProgression;
            const newProgression = [...currentProgression];
            newProgression[index] = { ...newProgression[index], notes: newNotes };
            return newProgression;
        });
    }, [setProgressionWithHistory]);

    // --- Voicing Change Handlers ---
    const handleNextInvertChord = useCallback((chordId) => {
        setProgressionWithHistory(currentProgression => {
            const index = currentProgression.findIndex(c => c.id === chordId);
            if (index === -1) return currentProgression;
            const chordToInvert = currentProgression[index];
            const newNotes = getNextInversion(chordToInvert.notes);
            const newProgression = [...currentProgression];
            newProgression[index] = { ...chordToInvert, notes: newNotes };
            return newProgression;
        });
    }, [setProgressionWithHistory]);

    const handlePreviousInvertChord = useCallback((chordId) => {
        setProgressionWithHistory(currentProgression => {
            const index = currentProgression.findIndex(c => c.id === chordId);
            if (index === -1) return currentProgression;
            const chordToInvert = currentProgression[index];
            const newNotes = getPreviousInversion(chordToInvert.notes);
            const newProgression = [...currentProgression];
            newProgression[index] = { ...chordToInvert, notes: newNotes };
            return newProgression;
        });
    }, [setProgressionWithHistory]);


    const handlePermuteChord = useCallback((chordId) => {
        setProgressionWithHistory(currentProgression => {
            const index = currentProgression.findIndex(c => c.id === chordId);
            if (index === -1) return currentProgression;
            const chordToPermute = currentProgression[index];
            const newNotes = getPermutedVoicing(chordToPermute.notes);
            const newProgression = [...currentProgression];
            newProgression[index] = { ...chordToPermute, notes: newNotes };
            return newProgression;
        });
    }, [setProgressionWithHistory]);

    /** The context chord for the suggestion engine. Prefers the selected chord,
     *  otherwise falls back to the last chord in the progression.
     */
    const suggestionContextChord = useMemo(() => {
        const chord = selectionContext || (progression.length > 0 ? progression[progression.length - 1] : null)
        if (!chord) return null;
        return {
            name: detectChordFromNotes(chord.notes),
            notes: chord.notes,
        }
    }, [selectionContext, progression]);

    return (
        <div className="composer">
            <header className="composer-header">
                <h1>Harmonicizer</h1>
                <p>Build and explore your chord progressions.</p>
            </header>

            <CollapsibleSection title="Playback & Tempo" defaultOpen={true}>
                <div className="playback-controls-container">
                    <TransportControls 
                        isPlaying={isPlaying}
                        tempo={tempo}
                        isLooping={isLooping}
                        onPlayToggle={handlePlayToggle}
                        onTempoChange={handleTempoChange}
                        onLoopToggle={handleLoopToggle}
                    />
                    <div className="secondary-controls">
                        <button className="control-button" aria-label="Undo last action" onClick={handleUndo} disabled={progressionHistory.length === 0}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
                        </button>
                        <button className="control-button clear-button" aria-label="Clear Progression" onClick={handleClearProgression}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                        <button className="control-button lucky-button" aria-label="I feel lucky" onClick={handleFeelLucky} title="Generate Random Progression">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M19,3H5C3.89,3 3,3.89 3,5V19C3,20.11 3.9,21 5,21H19C20.11,21 21,20.11 21,19V5C21,3.89 20.1,3 19,3M6,8.5C6,7.67 6.67,7 7.5,7S9,7.67 9,8.5C9,9.33 8.33,10 7.5,10S6,9.33 6,8.5M15,15.5C15,14.67 15.67,14 16.5,14S18,14.67 18,15.5C18,16.33 17.33,17 16.5,17S15,16.33 15,15.5M10.5,12C10.5,11.17 11.17,10.5 12,10.5S13.5,11.17 13.5,12C13.5,12.83 12.83,13.5 12,13.5S10.5,12.83 10.5,12M15,8.5C15,7.67 15.67,7 16.5,7S18,7.67 18,8.5C18,9.33 17.33,10 16.5,10S15,9.33 15,8.5M6,15.5C6,14.67 6.67,14 7.5,14S9,14.67 9,15.5C9,16.33 8.33,17 7.5,17S6,16.33 6,15.5Z"/></svg>
                        </button>
                        <KeySignature currentKey={musicalKey} currentMode={musicalMode} onKeyChange={setMusicalKey} onModeChange={setMusicalMode} rootNotes={rootNotes} modes={modes} />
                        <button className={`control-button ${isNoteVisualizerVisible ? 'active' : ''}`} onClick={() => setIsNoteVisualizerVisible(prev => !prev)} title="Toggle Note Visualizer" aria-pressed={isNoteVisualizerVisible}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-8zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                        </button>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Chord Progression" defaultOpen={true}>
                <ChordGrid 
                    progression={progression}
                    onEditChord={handleEditChord}
                    onSelectChord={handleSelectChord}
                    selectedChordId={selectedChordId}
                    currentlyPlayingChordId={currentlyPlayingChordId}
                    onRemoveChord={handleRemoveChord}
                    onReorderProgression={handleReorderProgression}
                    onNextInvertChord={handleNextInvertChord}
                    onPreviousInvertChord={handlePreviousInvertChord}
                    onPermuteChord={handlePermuteChord}
                    isNoteVisualizerVisible={isNoteVisualizerVisible}
                    onChordNotesUpdate={handleChordNotesUpdate}
                    musicalKey={musicalKey}
                    musicalMode={musicalMode}
                    screenWidth={screenWidth}
                    screenHeight={screenHeight}
                />
            </CollapsibleSection>
            
            <CollapsibleSection title="Harmonic Analysis" defaultOpen={false}>
                <ProgressionAnalyzer 
                    analysis={analysisResults} 
                    onAddChords={handleAddChords}
                    suggestions={exhaustiveSuggestions}
                    suggestionContextChord={suggestionContextChord}
                    screenWidth={screenWidth}
                />
            </CollapsibleSection>

            <CollapsibleSection title="Synthesizer & Effects" defaultOpen={true}>
                <GraphicalEnvelopeEditor 
                    masterGain={masterGain}
                    onMasterGainChange={setMasterGain}
                    reverbWet={reverbWet}
                    onReverbWetChange={setReverbWet}
                    reverbTime={reverbTime}
                    onReverbTimeChange={setReverbTime}
                    synthType={synthType}
                    onSynthChange={handleSynthChange}
                    isArpeggiatorActive={isArpeggiatorActive}
                    onArpeggiatorToggle={() => setIsArpeggiatorActive(prev => !prev)}
                    arpeggiatorTiming={arpeggiatorTiming}
                    onArpeggiatorTimingChange={setArpeggiatorTiming}
                    arpeggiatorRepeats={arpeggiatorRepeats}
                    onArpeggiatorRepeatsChange={setArpeggiatorRepeats}
                    // Pass all synth settings down
                    rhodesSettings={rhodesSettings} onRhodesSettingsChange={setRhodesSettings}
                    moogLeadSettings={moogLeadSettings} onMoogLeadSettingsChange={setMoogLeadSettings}
                    moogBassSettings={moogBassSettings} onMoogBassSettingsChange={setMoogBassSettings}
                    vcs3DroneSettings={vcs3DroneSettings} onVcs3DroneSettingsChange={setVcs3DroneSettings}
                    vcs3FxSettings={vcs3FxSettings} onVcs3FxSettingsChange={setVcs3FxSettings}
                    fmSettings={fmSettings} onFmSettingsChange={setFmSettings}
                    amSettings={amSettings} onAmSettingsChange={setAmSettings}
                    basicSynthSettings={basicSynthSettings} onBasicSynthSettingsChange={setBasicSynthSettings}
                    screenWidth={screenWidth}
                />
            </CollapsibleSection>

            <ChordSelector
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveChord}
                chord={editingChord}
                musicalKey={musicalKey}
                musicalMode={musicalMode}
                player={player.current}
                screenWidth={screenWidth}
                screenHeight={screenHeight}
            />
        </div>
    );
};

export default Composer;
