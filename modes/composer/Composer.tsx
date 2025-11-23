

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import { Note } from 'tonal';
import TransportControls from '../../components/TransportControls/TransportControls.tsx';
import ChordGrid from '../../components/ChordGrid/ChordGrid.tsx';
import ChordSelector from '../../components/ChordSelector/ChordSelector.tsx';
import GraphicalEnvelopeEditor from '../../components/GraphicalEnvelopeEditor/GraphicalEnvelopeEditor.tsx';
import KeySignature from '../../components/KeySignature/KeySignature.tsx';
import ProgressionAnalyzer from '../../components/ProgressionAnalyzer/ProgressionAnalyzer.tsx';
import CollapsibleSection from '../../components/CollapsibleSection/CollapsibleSection.tsx';
import ProgressionTabs from '../../components/ProgressionTabs/ProgressionTabs.tsx';
import SongStructure from '../../components/SongStructure/SongStructure.tsx';
import { Player } from '../../audio/player.js';
import { soundfonts } from '../../audio/soundfonts.js';
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
const DEFAULT_SOUNDFONT_SETTINGS = {
    volume: -6,
    instrument: 'acoustic_grand_piano',
};

/**
 * The Composer component is the main container and orchestrator for the application.
 * It manages all application state, handles user interactions, and communicates with the
 * audio player engine.
 */
const Composer = ({ screenWidth, screenHeight }) => {
    // --- STATE MANAGEMENT ---
    
    // Core progression data and history for undo functionality
    const [progressions, setProgressions] = useState({
        'A': [
            { id: crypto.randomUUID(), notes: ['C4', 'E4', 'G4', 'B4'], duration: 4 }, // Cmaj7
            { id: crypto.randomUUID(), notes: ['A3', 'C4', 'E4', 'G4'], duration: 4 }, // Am7
            { id: crypto.randomUUID(), notes: ['D4', 'F4', 'A4', 'C5'], duration: 4 }, // Dm7
            { id: crypto.randomUUID(), notes: ['G4', 'B4', 'D5', 'F5'], duration: 4 }, // G7
        ]
    });
    const [activeProgressionId, setActiveProgressionId] = useState('A');
    // FIX: Explicitly type songStructure state to avoid type inference issues with crypto.randomUUID()
    const [songStructure, setSongStructure] = useState<{ id: string; progressionId: string; }[]>([{ id: crypto.randomUUID(), progressionId: 'A' }]);
    const [progressionsHistory, setProgressionsHistory] = useState([]);
    
    const [selectedChordId, setSelectedChordId] = useState(null);

    // Transport and playback state
    const [playbackState, setPlaybackState] = useState<'stopped' | 'playing'>('stopped');
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
    const [soundFontSettings, setSoundFontSettings] = useState(DEFAULT_SOUNDFONT_SETTINGS);

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
    const [currentlyPlayingChordId, setCurrentlyPlayingChordId] = useState<string | null>(null);
    const [currentlyPlayingSongPartInstanceId, setCurrentlyPlayingSongPartInstanceId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChord, setEditingChord] = useState(null);
    const [isNoteVisualizerVisible, setIsNoteVisualizerVisible] = useState(false);
    const [isSynthLoading, setIsSynthLoading] = useState(false);

    // Refs for audio engine and file input
    const player = useRef<Player | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- DERIVED STATE & MEMOIZED COMPUTATIONS ---

    const activeProgression = useMemo(() => progressions[activeProgressionId] || [], [progressions, activeProgressionId]);

    // Memoizes the analysis of the entire progression. Re-calculates only when the progression or key changes.
    const analysisResults = useMemo(() => analyzeProgression(activeProgression, musicalKey, musicalMode), [activeProgression, musicalKey, musicalMode]);
    
    // Memoizes the currently selected chord for providing context to other components.
    const selectionContext = useMemo(() => {
        if (!selectedChordId || activeProgression.length === 0) return null;
        const selectedIndex = activeProgression.findIndex(c => c.id === selectedChordId);
        if (selectedIndex === -1) return null;
        return activeProgression[selectedIndex];
    }, [selectedChordId, activeProgression]);

    // Memoizes chord suggestions. Suggestions are based on the selected chord, or the last chord if none is selected.
    const exhaustiveSuggestions = useMemo(() => {
        const contextChord = selectionContext 
            ? selectionContext
            : activeProgression.length > 0 ? activeProgression[activeProgression.length - 1] : null;
        const contextChordName = contextChord && contextChord.notes.length > 0 ? detectChordFromNotes(contextChord.notes) : null;
        const categorized = getSuggestionsForChord(contextChordName, musicalKey, musicalMode);
        const harmonicTheory = contextChordName
            ? getHarmonicTheoryForChord(contextChordName, musicalKey, musicalMode)
            : null;
        return { categorized, harmonicTheory };
    }, [selectionContext, activeProgression, musicalKey, musicalMode]);

    // Memoizes the settings object for the currently active synthesizer.
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
            case 'SoundFont': return soundFontSettings;
            default: return basicSynthSettings;
        }
    }, [synthType, rhodesSettings, moogLeadSettings, moogBassSettings, vcs3DroneSettings, vcs3FxSettings, fmSettings, amSettings, basicSynthSettings, soundFontSettings]);

    // --- CALLBACKS & HANDLERS ---
    
    /**
     * A wrapper for setProgressions that also saves the previous state to a history buffer for undo functionality.
     */
    const setProgressionsWithHistory = useCallback((newProgressionsOrFn) => {
        setProgressions(currentProgressions => {
            // Push the current state to history before updating.
            setProgressionsHistory(prevHistory => {
                const newHistory = [...prevHistory, currentProgressions];
                 if (newHistory.length > MAX_HISTORY_SIZE) {
                    return newHistory.slice(1); // Keep history size bounded.
                }
                return newHistory;
            });

            // Calculate the new progression state.
            const newProgressions = typeof newProgressionsOrFn === 'function' 
                ? newProgressionsOrFn(currentProgressions) 
                : newProgressionsOrFn;

            // If the currently selected chord was removed from the active progression, reset the selection.
            const newActiveProgression = newProgressions[activeProgressionId] || [];
            if (selectedChordId && !newActiveProgression.some(c => c.id === selectedChordId)) {
                setSelectedChordId(null);
            }
            return newProgressions;
        });
    }, [selectedChordId, activeProgressionId]);

    /**
     * Reverts the progression to its previous state from the history buffer.
     */
    const handleUndo = useCallback(() => {
        if (progressionsHistory.length === 0) return;
        const previousProgressions = progressionsHistory[progressionsHistory.length - 1];
        const newHistory = progressionsHistory.slice(0, -1);
        setProgressions(previousProgressions);
        setProgressionsHistory(newHistory);

        const previousActiveProgression = previousProgressions[activeProgressionId] || [];
        // Deselect chord if it no longer exists in the reverted state.
        if (selectedChordId && !previousActiveProgression.some(c => c.id === selectedChordId)) {
            setSelectedChordId(null);
        }
    }, [progressionsHistory, selectedChordId, activeProgressionId]);

    // --- SIDE EFFECTS (`useEffect`) ---

    // This effect runs only once on component mount to initialize the audio player.
    useEffect(() => {
        // Create the Player instance and store it in a ref.
        player.current = new Player(
            (chordId, songPartInstanceId) => {
                setCurrentlyPlayingChordId(chordId);
                setCurrentlyPlayingSongPartInstanceId(songPartInstanceId || null);
            },
            (isLoading) => {
                setIsSynthLoading(isLoading);
            }
        );
        
        // Set initial parameters on the player.
        player.current.setTempo(tempo);
        player.current.setLoop(isLooping);
        player.current.setGain(masterGain);
        player.current.setReverbWet(reverbWet);
        player.current.setReverbTime(reverbTime);
        player.current.setArpeggiator(isArpeggiatorActive, arpeggiatorTiming, arpeggiatorRepeats);
        player.current.setSynth(synthType, currentSynthSettings);
        player.current.setProgression(activeProgression);

        // Cleanup function to dispose of the player and its resources on component unmount.
        return () => {
            player.current?.dispose();
        }
    }, []); // Empty dependency array ensures this runs only once.

    // These effects synchronize the audio player's state with the component's state whenever a property changes.
    useEffect(() => { player.current?.setTempo(tempo); }, [tempo]);

    useEffect(() => { player.current?.setGain(masterGain); }, [masterGain]);
    useEffect(() => { player.current?.setReverbWet(reverbWet); }, [reverbWet]);
    useEffect(() => { player.current?.setReverbTime(reverbTime); }, [reverbTime]);

    // When the synthType changes, a more complex `setSynth` method is called in the player.
    useEffect(() => {
        const changeSynth = async () => {
            if (player.current) {
                await player.current.setSynth(synthType, currentSynthSettings);
            }
        };
        changeSynth();
    }, [synthType]);

    // When only the settings of the current synth change, a simpler update method is called.
    useEffect(() => {
        const updateSettings = async () => {
            if (player.current) {
                await player.current.updateVoiceSettings(currentSynthSettings);
            }
        };
        updateSettings();
    }, [currentSynthSettings]);

    // Sync arpeggiator settings with the audio player.
    useEffect(() => {
        if (player.current) {
            player.current.setArpeggiator(isArpeggiatorActive, arpeggiatorTiming, arpeggiatorRepeats);
            // Re-send the currently playing progression to rebuild the part with/without arpeggiator logic.
            if (playbackState === 'playing') {
                const fullSongProgression = songStructure.flatMap(part => 
                    (progressions[part.progressionId] || []).map(chord => ({
                        ...chord,
                        songPartInstanceId: part.id
                    }))
                );
                player.current.setProgression(fullSongProgression);
            }
        }
    }, [isArpeggiatorActive, arpeggiatorTiming, arpeggiatorRepeats, songStructure, progressions, playbackState]);
    
    /**
     * A centralized function to stop all playback.
     */
    const handleStop = useCallback(() => {
        if (!player.current) return;
        player.current.stop();
        setPlaybackState('stopped');
        setCurrentlyPlayingChordId(null);
        setCurrentlyPlayingSongPartInstanceId(null);
    }, []);

    /**
     * Toggles playback of the full song structure.
     */
    const handlePlayToggle = useCallback(async () => {
        if (isSynthLoading || !player.current || songStructure.length === 0) return;
        
        if (playbackState === 'playing') {
            handleStop();
            return;
        }

        const fullSongProgressionWithContext = songStructure.flatMap(part => {
            const progressionChords = progressions[part.progressionId] || [];
            return progressionChords.map(chord => ({
                ...chord,
                songPartInstanceId: part.id
            }));
        });
        
        if (fullSongProgressionWithContext.length === 0) return;

        player.current.setProgression(fullSongProgressionWithContext);
        await player.current.start();
        player.current.play();
        setPlaybackState('playing');
    }, [playbackState, songStructure, progressions, handleStop, isSynthLoading]);

    // --- Event Handlers for UI elements ---
    const handleTempoChange = useCallback((newTempo) => { setTempo(newTempo); }, []);
    const handleSynthChange = useCallback((newSynth) => { setSynthType(newSynth); }, []);
    const handleLoopToggle = useCallback(() => {
        const newIsLooping = !isLooping;
        setIsLooping(newIsLooping);
        player.current?.setLoop(newIsLooping);
    }, [isLooping]);

    const handleClearProgression = useCallback(() => {
        handleStop(); // Good practice to stop playback
        setProgressionsWithHistory(currents => ({
            ...currents,
            [activeProgressionId]: []
        }));
        setSelectedChordId(null);
    }, [activeProgressionId, setProgressionsWithHistory, handleStop]);

    /**
     * Generates new chords based on context. If the progression is empty, it creates a full random
     * progression. If not, it intelligently suggests and appends 4 new chords.
     */
    const handleFeelLucky = useCallback(() => {
        const currentProgression = progressions[activeProgressionId] || [];
        if (currentProgression.length === 0) {
            // Generate a full new progression from scratch.
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
                setProgressionsWithHistory(currents => ({ ...currents, [activeProgressionId]: newChords }));
            }
        } else {
            // Append 4 new chords based on the last chord in the progression.
            const generatedChords = [];
            let currentContextChord = currentProgression[currentProgression.length - 1];

            for (let i = 0; i < 4; i++) {
                if (!currentContextChord || currentContextChord.notes.length === 0) break;
                const currentContextChordName = detectChordFromNotes(currentContextChord.notes);
                if (!currentContextChordName) break;
                // Get harmonically coherent suggestions.
                const suggestions = getSuggestionsForChord(currentContextChordName, musicalKey, musicalMode);
                let candidateChords = suggestions.coherent;
                // Fallback to any diatonic chord if no specific suggestions are found.
                if (candidateChords.length === 0) {
                    const diatonicChords = getDiatonicChords(musicalKey, musicalMode).map(c => c.name);
                    candidateChords = diatonicChords.filter(c => c !== currentContextChordName);
                }
                if (candidateChords.length === 0) break;
                
                // Pick a random chord from the candidates and create the new chord object.
                const nextChordName = candidateChords[Math.floor(Math.random() * candidateChords.length)];
                const newChord = { id: crypto.randomUUID(), notes: getChordNotesWithOctaves(nextChordName, 4), duration: 4 };
                generatedChords.push(newChord);
                currentContextChord = newChord; // The new chord becomes the context for the next iteration.
            }

            if (generatedChords.length > 0) {
                setProgressionsWithHistory(currents => ({
                    ...currents,
                    [activeProgressionId]: [...currents[activeProgressionId], ...generatedChords]
                }));
            }
        }
    }, [progressions, activeProgressionId, musicalKey, musicalMode, setProgressionsWithHistory]);

    const handleRemoveChord = useCallback((idToRemove) => {
        setProgressionsWithHistory(currents => ({
            ...currents,
            [activeProgressionId]: currents[activeProgressionId].filter(chord => chord.id !== idToRemove)
        }));

        if (currentlyPlayingChordId === idToRemove) {
            setCurrentlyPlayingChordId(null);
        }
    }, [currentlyPlayingChordId, activeProgressionId, setProgressionsWithHistory, handleStop]);

    const handleEditChord = useCallback((chord) => {
        setEditingChord(chord || { id: crypto.randomUUID(), notes: [] });
        setIsModalOpen(true);
    }, []);

    const handleSelectChord = useCallback((chordId) => {
        // Toggle selection: selecting the same chord twice deselects it.
        setSelectedChordId(currentId => (currentId === chordId ? null : chordId));
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingChord(null);
    }, []);

    const handleSaveChord = useCallback((savedChord) => {
        setProgressionsWithHistory(currents => {
            const currentProg = currents[activeProgressionId] || [];
            const existingIndex = currentProg.findIndex(c => c.id === editingChord?.id);
            let newProg;
            if (existingIndex > -1) {
                // If editing an existing chord, replace it in the array.
                newProg = [...currentProg];
                newProg[existingIndex] = { ...savedChord, id: editingChord.id };
            } else {
                // If adding a new chord, append it.
                newProg = [...currentProg, { ...savedChord, id: editingChord.id }];
            }
            return { ...currents, [activeProgressionId]: newProg };
        });
        handleCloseModal();
    }, [editingChord, handleCloseModal, activeProgressionId, setProgressionsWithHistory]);

    const handleReorderProgression = useCallback((newProgression) => { 
        setProgressionsWithHistory(currents => ({
            ...currents,
            [activeProgressionId]: newProgression
        }));
    }, [activeProgressionId, setProgressionsWithHistory]);

    const handleAddChords = useCallback((chordNames) => {
        const newChords = chordNames.map(name => ({
            id: crypto.randomUUID(),
            notes: getChordNotesWithOctaves(name, 4),
            duration: 4,
        }));
        setProgressionsWithHistory(currents => {
            const currentProg = currents[activeProgressionId] || [];
            // If a chord is selected, insert the new chords after it.
            if (selectedChordId) {
                const selectedIndex = currentProg.findIndex(c => c.id === selectedChordId);
                if (selectedIndex > -1) {
                    const newProgression = [...currentProg];
                    newProgression.splice(selectedIndex + 1, 0, ...newChords);
                    return { ...currents, [activeProgressionId]: newProgression };
                }
            }
            // Otherwise, append them to the end.
            return { ...currents, [activeProgressionId]: [...currentProg, ...newChords] };
        });
    }, [selectedChordId, activeProgressionId, setProgressionsWithHistory]);

    // This handler is called from the interactive note visualizer to update a chord's notes directly.
    const handleChordNotesUpdate = useCallback((chordId, newNotes) => {
        setProgressionsWithHistory(currents => {
            const currentProg = currents[activeProgressionId] || [];
            const index = currentProg.findIndex(c => c.id === chordId);
            if (index === -1) return currents;
            const newProgression = [...currentProg];
            newProgression[index] = { ...newProgression[index], notes: newNotes };
            return { ...currents, [activeProgressionId]: newProgression };
        });
    }, [activeProgressionId, setProgressionsWithHistory]);

    // Handlers for changing a chord's voicing (inversions, permutations).
    const handleNextInvertChord = useCallback((chordId) => {
        setProgressionsWithHistory(currents => {
            const currentProg = currents[activeProgressionId] || [];
            const index = currentProg.findIndex(c => c.id === chordId);
            if (index === -1) return currents;
            const chordToInvert = currentProg[index];
            const newNotes = getNextInversion(chordToInvert.notes);
            const newProgression = [...currentProg];
            newProgression[index] = { ...chordToInvert, notes: newNotes };
            return { ...currents, [activeProgressionId]: newProgression };
        });
    }, [activeProgressionId, setProgressionsWithHistory]);

    const handlePreviousInvertChord = useCallback((chordId) => {
        setProgressionsWithHistory(currents => {
            const currentProg = currents[activeProgressionId] || [];
            const index = currentProg.findIndex(c => c.id === chordId);
            if (index === -1) return currents;
            const chordToInvert = currentProg[index];
            const newNotes = getPreviousInversion(chordToInvert.notes);
            const newProgression = [...currentProg];
            newProgression[index] = { ...chordToInvert, notes: newNotes };
            return { ...currents, [activeProgressionId]: newProgression };
        });
    }, [activeProgressionId, setProgressionsWithHistory]);


    const handlePermuteChord = useCallback((chordId) => {
        setProgressionsWithHistory(currents => {
            const currentProg = currents[activeProgressionId] || [];
            const index = currentProg.findIndex(c => c.id === chordId);
            if (index === -1) return currents;
            const chordToPermute = currentProg[index];
            const newNotes = getPermutedVoicing(chordToPermute.notes);
            const newProgression = [...currentProg];
            newProgression[index] = { ...chordToPermute, notes: newNotes };
            return { ...currents, [activeProgressionId]: newProgression };
        });
    }, [activeProgressionId, setProgressionsWithHistory]);

    const suggestionContextChord = useMemo(() => {
        const chord = selectionContext || (activeProgression.length > 0 ? activeProgression[activeProgression.length - 1] : null)
        if (!chord) return null;
        return {
            name: detectChordFromNotes(chord.notes),
            notes: chord.notes,
        }
    }, [selectionContext, activeProgression]);

    // --- Song Structure Handlers ---
    const handleAddNewProgression = useCallback(() => {
        const existingLetters = Object.keys(progressions);
        let nextLetterCode = 65; // Start with 'A'
        while (existingLetters.includes(String.fromCharCode(nextLetterCode))) {
            nextLetterCode++;
        }
        const nextLetter = String.fromCharCode(nextLetterCode);
        
        setProgressionsWithHistory(currents => ({
            ...currents,
            [nextLetter]: []
        }));
        setActiveProgressionId(nextLetter);
    }, [progressions, setProgressionsWithHistory]);
    
    const handleDuplicateProgression = useCallback(() => {
        const currentProgression = progressions[activeProgressionId];
        if (!currentProgression) return;

        const existingLetters = Object.keys(progressions);
        let nextLetterCode = 65; // 'A'
        while (existingLetters.includes(String.fromCharCode(nextLetterCode))) {
            nextLetterCode++;
        }
        const nextLetter = String.fromCharCode(nextLetterCode);
        
        const newChords = currentProgression.map(chord => ({
            ...chord,
            id: crypto.randomUUID() 
        }));

        setProgressionsWithHistory(currents => ({
            ...currents,
            [nextLetter]: newChords
        }));
        setActiveProgressionId(nextLetter);
    }, [progressions, activeProgressionId, setProgressionsWithHistory]);

    const handleDeleteProgression = useCallback((idToDelete: string) => {
        const currentProgressionIds = Object.keys(progressions);
        if (currentProgressionIds.length <= 1) {
            alert("Cannot delete the last song part.");
            return;
        }

        const newProgressions = { ...progressions };
        delete newProgressions[idToDelete];
        
        setProgressionsWithHistory(newProgressions);
        setSongStructure(prev => prev.filter(part => part.progressionId !== idToDelete));
    
        if (activeProgressionId === idToDelete) {
            setActiveProgressionId(Object.keys(newProgressions)[0] || '');
        }
    }, [progressions, activeProgressionId, setProgressionsWithHistory]);

    // --- Import / Export Handlers ---

    /**
     * Gathers the entire session state into an object and triggers a JSON file download.
     */
    const handleExport = useCallback(() => {
        const sessionData = {
            version: 2,
            progressions,
            songStructure,
            tempo,
            synthType,
            isLooping,
            masterGain,
            reverbWet,
            reverbTime,
            isArpeggiatorActive,
            arpeggiatorTiming,
            arpeggiatorRepeats,
            musicalKey,
            musicalMode,
            synthSettings: {
                Rhodes: rhodesSettings,
                MoogLead: moogLeadSettings,
                MoogBass: moogBassSettings,
                VCS3Drone: vcs3DroneSettings,
                VCS3FX: vcs3FxSettings,
                FMSynth: fmSettings,
                AMSynth: amSettings,
                Synth: basicSynthSettings,
                SoundFont: soundFontSettings,
            }
        };

        const jsonString = JSON.stringify(sessionData, null, 2); // Pretty print
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `harmonicizer-session-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [
        progressions, songStructure, tempo, synthType, isLooping, masterGain, reverbWet, reverbTime,
        isArpeggiatorActive, arpeggiatorTiming, arpeggiatorRepeats, musicalKey, musicalMode,
        rhodesSettings, moogLeadSettings, moogBassSettings, vcs3DroneSettings, vcs3FxSettings,
        fmSettings, amSettings, basicSynthSettings, soundFontSettings
    ]);
    
    /**
     * Exports the current progression to a standard MIDI file.
     */
    const handleExportMidi = useCallback(async () => {
        const midi = new Midi();
        const track = midi.addTrack();
        track.name = "Harmonicizer Progression";
        midi.header.setTempo(tempo);
    
        let progressionToExport = songStructure.flatMap(part => progressions[part.progressionId] || []);
        if (progressionToExport.length === 0) {
            progressionToExport = activeProgression;
        }

        let currentTime = 0; // Time in seconds
    
        for (const chord of progressionToExport) {
            const chordDurationInSeconds = (60 / tempo) * chord.duration;
            const notes = chord.notes;
    
            if (notes.length > 0) {
                if (isArpeggiatorActive) {
                    const arpeggioTimingAsSeconds = Tone.Time(arpeggiatorTiming).toSeconds();
                    if (arpeggioTimingAsSeconds > 0) {
                        const numNotesInArp = Math.floor(chordDurationInSeconds / arpeggioTimingAsSeconds);
                        const finalNoteDuration = Math.min(arpeggioTimingAsSeconds * 0.9, 0.5); 
                        
                        for (let i = 0; i < numNotesInArp; i++) {
                            const note = notes[i % notes.length];
                            track.addNote({
                                name: note,
                                time: currentTime + (i * arpeggioTimingAsSeconds),
                                duration: finalNoteDuration,
                                velocity: 0.8
                            });
                        }
                    }
                } else {
                    notes.forEach(note => {
                        track.addNote({
                            name: note,
                            time: currentTime,
                            duration: chordDurationInSeconds,
                            velocity: 0.8
                        });
                    });
                }
            }
            currentTime += chordDurationInSeconds;
        }
        
        const blob = new Blob([midi.toArray()], { type: "audio/midi" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `harmonicizer-progression-${new Date().toISOString().slice(0, 10)}.mid`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [progressions, songStructure, activeProgression, tempo, isArpeggiatorActive, arpeggiatorTiming]);

    /**
     * Opens the file dialog by programmatically clicking the hidden file input.
     */
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    /**
     * Reads and parses the selected JSON file, then updates the application state.
     */
    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = e.target?.result;
                if (typeof result !== 'string') return;
                const importedData = JSON.parse(result);

                // --- Safely update state from imported data ---
                if (importedData.version === 2 && importedData.progressions && typeof importedData.progressions === 'object') {
                    // v2 format with multiple progressions
                     const progressionsWithNewIds = {};
                    for (const key in importedData.progressions) {
                        progressionsWithNewIds[key] = importedData.progressions[key].map(chord => ({
                            ...chord,
                            id: crypto.randomUUID()
                        }));
                    }
                    setProgressionsWithHistory(progressionsWithNewIds);
                    setActiveProgressionId(Object.keys(progressionsWithNewIds)[0] || 'A');
                } else if (importedData.progression && Array.isArray(importedData.progression)) {
                    // Legacy v1 format with single progression
                    const progressionWithNewIds = importedData.progression.map(chord => ({
                        ...chord,
                        id: crypto.randomUUID()
                    }));
                    setProgressionsWithHistory({ 'A': progressionWithNewIds });
                    setActiveProgressionId('A');
                }

                if (importedData.songStructure && Array.isArray(importedData.songStructure)) {
                    const structureWithNewIds = importedData.songStructure.map(part => ({
                        ...part,
                        id: crypto.randomUUID()
                    }));
                    setSongStructure(structureWithNewIds);
                }


                if (typeof importedData.tempo === 'number') setTempo(importedData.tempo);
                if (typeof importedData.synthType === 'string') setSynthType(importedData.synthType);
                if (typeof importedData.isLooping === 'boolean') setIsLooping(importedData.isLooping);
                if (typeof importedData.masterGain === 'number') setMasterGain(importedData.masterGain);
                if (typeof importedData.reverbWet === 'number') setReverbWet(importedData.reverbWet);
                if (typeof importedData.reverbTime === 'number') setReverbTime(importedData.reverbTime);
                if (typeof importedData.isArpeggiatorActive === 'boolean') setIsArpeggiatorActive(importedData.isArpeggiatorActive);
                if (typeof importedData.arpeggiatorTiming === 'string') setArpeggiatorTiming(importedData.arpeggiatorTiming);
                if (typeof importedData.arpeggiatorRepeats === 'number') setArpeggiatorRepeats(importedData.arpeggiatorRepeats);
                if (typeof importedData.musicalKey === 'string') setMusicalKey(importedData.musicalKey);
                if (typeof importedData.musicalMode === 'string') setMusicalMode(importedData.musicalMode);

                if (importedData.synthSettings) {
                    setRhodesSettings(c => ({...c, ...importedData.synthSettings.Rhodes}));
                    setMoogLeadSettings(c => ({...c, ...importedData.synthSettings.MoogLead}));
                    setMoogBassSettings(c => ({...c, ...importedData.synthSettings.MoogBass}));
                    setVcs3DroneSettings(c => ({...c, ...importedData.synthSettings.VCS3Drone}));
                    setVcs3FxSettings(c => ({...c, ...importedData.synthSettings.VCS3FX}));
                    setFmSettings(c => ({...c, ...importedData.synthSettings.FMSynth}));
                    setAmSettings(c => ({...c, ...importedData.synthSettings.AMSynth}));
                    setBasicSynthSettings(c => ({...c, ...importedData.synthSettings.Synth}));
                    setSoundFontSettings(c => ({...c, ...importedData.synthSettings.SoundFont}));
                }

            } catch (error) {
                console.error("Error importing session file:", error);
                alert("Could not import the session file. It may be corrupted or in the wrong format.");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    return (
        <div className="composer">
            <header className="composer-header">
                <h1>Harmonicizer</h1>
                <p>Build and explore your chord progressions.</p>
            </header>

            <CollapsibleSection title="Import / Export" defaultOpen={true}>
                 <div className="io-controls">
                    <div className="io-group">
                        <span className="io-label">Session</span>
                        <div className="io-buttons">
                            <button className="control-button" aria-label="Import session from JSON" onClick={handleImportClick} title="Import Session (JSON)">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleFileImport} style={{ display: 'none' }} accept="application/json" />
                            <button className="control-button" aria-label="Export session to JSON" onClick={handleExport} title="Export Session (JSON)">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>
                            </button>
                        </div>
                    </div>
                    <div className="io-group">
                        <span className="io-label">MIDI export</span>
                        <div className="io-buttons">
                            <button className="control-button" aria-label="Export progression to MIDI" onClick={handleExportMidi} title="Export Progression (MIDI)">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18 8H6c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zm-2 5h-2v-2h2v2zm-4-2H8v-1h4v1zm-2 2H8v-1h2v1zm6-1h-2v-1h2v1zM6 9.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm12 0c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5z"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Playback & Tempo" defaultOpen={true}>
                <TransportControls 
                    playbackState={playbackState}
                    tempo={tempo}
                    isLooping={isLooping}
                    onPlayToggle={handlePlayToggle}
                    onTempoChange={handleTempoChange}
                    onLoopToggle={handleLoopToggle}
                    playDisabled={isSynthLoading}
                />
                <SongStructure
                    structure={songStructure}
                    onStructureChange={setSongStructure}
                    progressionIds={Object.keys(progressions)}
                    currentlyPlayingPartId={playbackState === 'playing' ? currentlyPlayingSongPartInstanceId : null}
                />
            </CollapsibleSection>
            
            <CollapsibleSection title="Song Parts" defaultOpen={true}>
                <ProgressionTabs
                    progressionIds={Object.keys(progressions)}
                    activeId={activeProgressionId}
                    onSelect={setActiveProgressionId}
                    onAdd={handleAddNewProgression}
                    onDelete={handleDeleteProgression}
                    onDuplicate={handleDuplicateProgression}
                />
            </CollapsibleSection>

            <CollapsibleSection title={`Chord Progression (Part ${activeProgressionId})`} defaultOpen={true} key={activeProgressionId}>
                <div className="progression-controls">
                    <button className={`control-button ${isNoteVisualizerVisible ? 'active' : ''}`} onClick={() => setIsNoteVisualizerVisible(prev => !prev)} title="Toggle Note Visualizer" aria-pressed={isNoteVisualizerVisible}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-8zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                    </button>
                    <KeySignature currentKey={musicalKey} currentMode={musicalMode} onKeyChange={setMusicalKey} onModeChange={setMusicalMode} rootNotes={rootNotes} modes={modes} />
                    <button className="control-button" aria-label="Undo last action" onClick={handleUndo} disabled={progressionsHistory.length === 0} title="Undo">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
                    </button>
                    <button className="control-button clear-button" aria-label="Clear Part" onClick={handleClearProgression} title="Clear current progression">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                    <button className="control-button lucky-button" aria-label="I feel lucky" onClick={handleFeelLucky} title="Generate Random Progression">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M19,3H5C3.89,3 3,3.89 3,5V19C3,20.11 3.9,21 5,21H19C20.11,21 21,20.11 21,19V5C21,3.89 20.1,3 19,3M6,8.5C6,7.67 6.67,7 7.5,7S9,7.67 9,8.5C9,9.33 8.33,10 7.5,10S6,9.33 6,8.5M15,15.5C15,14.67 15.67,14 16.5,14S18,14.67 18,15.5C18,16.33 17.33,17 16.5,17S15,16.33 15,15.5M10.5,12C10.5,11.17 11.17,10.5 12,10.5S13.5,11.17 13.5,12C13.5,12.83 12.83,13.5 12,13.5S10.5,12.83 10.5,12M15,8.5C15,7.67 15.67,7 16.5,7S18,7.67 18,8.5C18,9.33 17.33,10 16.5,10S15,9.33 15,8.5M6,15.5C6,14.67 6.67,14 7.5,14S9,14.67 9,15.5C9,16.33 8.33,17 7.5,17S6,16.33 6,15.5Z"/></svg>
                    </button>
                </div>
                <ChordGrid 
                    progression={activeProgression}
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

            <CollapsibleSection title="Synthesizer & Effects" defaultOpen={false}>
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
                    rhodesSettings={rhodesSettings} onRhodesSettingsChange={setRhodesSettings}
                    moogLeadSettings={moogLeadSettings} onMoogLeadSettingsChange={setMoogLeadSettings}
                    moogBassSettings={moogBassSettings} onMoogBassSettingsChange={setMoogBassSettings}
                    vcs3DroneSettings={vcs3DroneSettings} onVcs3DroneSettingsChange={setVcs3DroneSettings}
                    vcs3FxSettings={vcs3FxSettings} onVcs3FxSettingsChange={setVcs3FxSettings}
                    fmSettings={fmSettings} onFmSettingsChange={setFmSettings}
                    amSettings={amSettings} onAmSettingsChange={setAmSettings}
                    basicSynthSettings={basicSynthSettings} onBasicSynthSettingsChange={setBasicSynthSettings}
                    soundFontSettings={soundFontSettings} onSoundFontSettingsChange={setSoundFontSettings}
                    soundfonts={soundfonts}
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