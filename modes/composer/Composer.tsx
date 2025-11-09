import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import TransportControls from '../../components/TransportControls/TransportControls';
import ChordGrid from '../../components/ChordGrid/ChordGrid';
import ChordSelector from '../../components/ChordSelector/ChordSelector';
import GraphicalEnvelopeEditor from '../../components/GraphicalEnvelopeEditor/GraphicalEnvelopeEditor';
import KeySignature from '../../components/KeySignature/KeySignature';
import ProgressionAnalyzer from '../../components/ProgressionAnalyzer/ProgressionAnalyzer';
import CollapsibleSection from '../../components/CollapsibleSection/CollapsibleSection';
import { Player, SynthType, EnvelopeSettings } from '../../audio/player';
import { analyzeProgression, getSuggestionsForChord, getPatternSuggestionsForChord } from '../../theory/analysis';
import { generateRandomProgression, getDiatonicChords } from '../../theory/harmony';
import './Composer.css';
import type * as Tone from 'tone';
import { rootNotes, modes } from '../../theory/chords';

export interface Chord {
    id: string;
    name: string;
    duration: number; // in beats
    octave: number;
}

const MAX_HISTORY_SIZE = 30;

const Composer = () => {
    console.log('Composer component rendering...');
    const [progression, setProgression] = useState<Chord[]>([
        { id: crypto.randomUUID(), name: 'Cmaj7', duration: 4, octave: 4 },
        { id: crypto.randomUUID(), name: 'Am7', duration: 4, octave: 4 },
        { id: crypto.randomUUID(), name: 'Dm7', duration: 4, octave: 4 },
        { id: crypto.randomUUID(), name: 'G7', duration: 4, octave: 4 },
    ]);
    const [progressionHistory, setProgressionHistory] = useState<Chord[][]>([]);
    const [selectedChordId, setSelectedChordId] = useState<string | null>(null);


    const [isPlaying, setIsPlaying] = useState(false);
    const [tempo, setTempo] = useState(120);
    const [synthType, setSynthType] = useState<SynthType>('Rhodes');
    const [isLooping, setIsLooping] = useState(true);
    const [envelope, setEnvelope] = useState<EnvelopeSettings>({ attack: 0.2, decay: 0.6, sustain: 0.7, release: 1.5 });
    
    const [masterGain, setMasterGain] = useState(0.8);
    const [reverbWet, setReverbWet] = useState(0.2);
    const [reverbTime, setReverbTime] = useState(1.5);

    const [isArpeggiatorActive, setIsArpeggiatorActive] = useState(false);
    const [arpeggiatorTiming, setArpeggiatorTiming] = useState<Tone.Unit.Time>('16n');
    const [arpeggiatorRepeats, setArpeggiatorRepeats] = useState<number>(Infinity);

    const [musicalKey, setMusicalKey] = useState('C');
    const [musicalMode, setMusicalMode] = useState('major');
    
    const [currentlyPlayingChordId, setCurrentlyPlayingChordId] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChord, setEditingChord] = useState<Partial<Chord> | null>(null);
    const [contextualChord, setContextualChord] = useState<Chord | null>(null);
    const [nextChordInProgression, setNextChordInProgression] = useState<Chord | null>(null);
    const [isNoteVisualizerVisible, setIsNoteVisualizerVisible] = useState(false);


    const player = useRef<Player | null>(null);

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

        const contextChordName = contextChord && contextChord.name !== 'Rest' ? contextChord.name : null;

        const categorized = getSuggestionsForChord(contextChordName, musicalKey, musicalMode);
        const patterns = contextChordName
            ? getPatternSuggestionsForChord(contextChordName, musicalKey, musicalMode)
            : [];
            
        return { categorized, patterns };

    }, [selectionContext, progression, musicalKey, musicalMode]);

    const setProgressionWithHistory = useCallback((newProgressionOrFn: React.SetStateAction<Chord[]>) => {
        setProgression(currentProgression => {
            // Add the current state to history BEFORE updating
            setProgressionHistory(prevHistory => {
                const newHistory = [...prevHistory, currentProgression];
                 if (newHistory.length > MAX_HISTORY_SIZE) {
                    return newHistory.slice(1); // slice from start to keep array size manageable
                }
                return newHistory;
            });
    
            // Now, calculate and return the new state
            const newProgression = typeof newProgressionOrFn === 'function' 
                ? newProgressionOrFn(currentProgression) 
                : newProgressionOrFn;

            // If the selected chord was removed, deselect it
            if (selectedChordId && !newProgression.some(c => c.id === selectedChordId)) {
                setSelectedChordId(null);
            }
            
            return newProgression;
        });
    }, [selectedChordId]);

    const handleUndo = useCallback(() => {
        if (progressionHistory.length === 0) return;
        
        const previousProgression = progressionHistory[progressionHistory.length - 1];
        const newHistory = progressionHistory.slice(0, -1);
    
        // When undoing, we set the state directly without adding to history again.
        setProgression(previousProgression);
        setProgressionHistory(newHistory);
         // If the selected chord is no longer in the progression, deselect it
        if (selectedChordId && !previousProgression.some(c => c.id === selectedChordId)) {
            setSelectedChordId(null);
        }
    }, [progressionHistory, selectedChordId]);

    useEffect(() => {
        console.log('Composer initial useEffect running...');
        player.current = new Player((id) => setCurrentlyPlayingChordId(id));
        player.current.setProgression(progression);
        player.current.setTempo(tempo);
        player.current.setSynth(synthType);
        player.current.setLoop(isLooping);
        player.current.setEnvelope(envelope);
        player.current.setGain(masterGain);
        player.current.setReverbWet(reverbWet);
        player.current.setReverbTime(reverbTime);
        player.current.setArpeggiator(isArpeggiatorActive, arpeggiatorTiming, arpeggiatorRepeats);


        return () => {
            player.current?.dispose();
        }
    }, []);

    useEffect(() => {
        console.log('Progression changed, updating player:', progression);
        if(player.current) {
            player.current.setProgression(progression);
        }
    }, [progression]);

     useEffect(() => {
        if(player.current) {
            player.current.setTempo(tempo);
            player.current.setProgression(progression);
        }
    }, [tempo, progression]);


    useEffect(() => {
        player.current?.setEnvelope(envelope);
    }, [envelope]);

    useEffect(() => {
        player.current?.setGain(masterGain);
    }, [masterGain]);

    useEffect(() => {
        player.current?.setReverbWet(reverbWet);
    }, [reverbWet]);

    useEffect(() => {
        player.current?.setReverbTime(reverbTime);
    }, [reverbTime]);

    useEffect(() => {
        player.current?.setSynth(synthType);
    }, [synthType]);

    useEffect(() => {
        if (player.current) {
            player.current.setArpeggiator(isArpeggiatorActive, arpeggiatorTiming, arpeggiatorRepeats);
            player.current.setProgression(progression);
        }
    }, [isArpeggiatorActive, arpeggiatorTiming, arpeggiatorRepeats, progression]);


    const handlePlayToggle = useCallback(async () => {
        if (!player.current) return;
        
        if (progression.length === 0) return;

        await player.current.start();
        
        if (isPlaying) {
            player.current.stop();
            setIsPlaying(false);
            setCurrentlyPlayingChordId(null);
        } else {
            player.current.play();
            setIsPlaying(true);
        }
    }, [isPlaying, progression.length]);
    
    const handleTempoChange = useCallback((newTempo: number) => {
        setTempo(newTempo);
    }, []);

    const handleSynthChange = useCallback((newSynth: SynthType) => {
        setSynthType(newSynth);
    }, []);

    const handleLoopToggle = useCallback(() => {
        const newIsLooping = !isLooping;
        setIsLooping(newIsLooping);
        player.current?.setLoop(newIsLooping);
    }, [isLooping]);

    const handleEnvelopeChange = useCallback((newEnvelope: EnvelopeSettings) => {
        setEnvelope(newEnvelope);
    }, []);

    const handleClearProgression = useCallback(() => {
        setProgressionWithHistory([]);
    }, [setProgressionWithHistory]);

    const handleFeelLucky = useCallback(() => {
        if (progression.length === 0) {
            // Case 1: Empty progression. Create a fresh start.
            const newTempo = Math.floor(Math.random() * (160 - 80 + 1)) + 80;
            const newKey = rootNotes[Math.floor(Math.random() * rootNotes.length)];
            const newMode = modes[Math.floor(Math.random() * modes.length)];
            const newChordNames = generateRandomProgression(newKey, newMode);
    
            if (newChordNames.length > 0) {
                const newChords = newChordNames.map(name => ({
                    id: crypto.randomUUID(),
                    name,
                    duration: 4,
                    octave: 4,
                }));
    
                setTempo(newTempo);
                setMusicalKey(newKey);
                setMusicalMode(newMode);
                setProgressionWithHistory(newChords); // Set, not append
            }
        } else {
            // Case 2: Progression exists. Append a harmonically related sequence.
            const generatedChords: Chord[] = [];
            let currentContextChord: Chord | null = progression[progression.length - 1];

            for (let i = 0; i < 4; i++) {
                if (!currentContextChord || currentContextChord.name === 'Rest') break;

                const suggestions = getSuggestionsForChord(currentContextChord.name, musicalKey, musicalMode);
                let candidateChords = suggestions.coherent;

                if (candidateChords.length === 0) {
                    const diatonicChords = getDiatonicChords(musicalKey, musicalMode).map(c => c.name);
                    candidateChords = diatonicChords.filter(c => c !== currentContextChord!.name);
                }
                
                if (candidateChords.length === 0) break;

                const nextChordName = candidateChords[Math.floor(Math.random() * candidateChords.length)];
                
                const newChord: Chord = {
                    id: crypto.randomUUID(),
                    name: nextChordName,
                    duration: 4,
                    octave: 4,
                };

                generatedChords.push(newChord);
                currentContextChord = newChord;
            }

            if (generatedChords.length > 0) {
                setProgressionWithHistory(current => [...current, ...generatedChords]);
            }
        }
    }, [progression, musicalKey, musicalMode, setProgressionWithHistory]);

    const handleRemoveChord = useCallback((idToRemove: string) => {
        setProgressionWithHistory(currentProgression => 
            currentProgression.filter(chord => chord.id !== idToRemove)
        );
        if (currentlyPlayingChordId === idToRemove) {
            setCurrentlyPlayingChordId(null);
        }
        if (progression.length === 1 && progression[0].id === idToRemove && isPlaying) {
            player.current?.stop();
            setIsPlaying(false);
        }
    }, [currentlyPlayingChordId, isPlaying, progression.length, setProgressionWithHistory]);

    const handleEditChord = useCallback((chord: Partial<Chord> | null) => {
        setEditingChord(chord || { id: crypto.randomUUID(), octave: 4 });
    
        // If editing existing chord, find its index. If adding new, index is at the end.
        const chordIndex = chord && chord.id ? progression.findIndex(c => c.id === chord.id) : progression.length;
    
        let contextChord: Chord | null = null;
        // Find previous non-rest chord
        for (let i = chordIndex - 1; i >= 0; i--) {
            if (progression[i].name !== 'Rest') {
                contextChord = progression[i];
                break;
            }
        }
    
        let nextChord: Chord | null = null;
        // Find next non-rest chord (only if editing an existing chord)
        if (chord && chord.id) {
            for (let i = chordIndex + 1; i < progression.length; i++) {
                if (progression[i].name !== 'Rest') {
                    nextChord = progression[i];
                    break;
                }
            }
        }
        
        setContextualChord(contextChord);
        setNextChordInProgression(nextChord);
        setIsModalOpen(true);
    }, [progression]);

    const handleSelectChord = useCallback((chordId: string) => {
        setSelectedChordId(currentId => (currentId === chordId ? null : chordId));
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingChord(null);
        setContextualChord(null);
        setNextChordInProgression(null);
    }, []);

    const handleSaveChord = useCallback((savedChord: Omit<Chord, 'id'> & { id?: string }) => {
        setProgressionWithHistory(currentProgression => {
            const existingIndex = currentProgression.findIndex(c => c.id === editingChord?.id);
            if (existingIndex > -1) {
                const newProgression = [...currentProgression];
                newProgression[existingIndex] = { ...savedChord, id: editingChord!.id! };
                return newProgression;
            } else {
                return [...currentProgression, { ...savedChord, id: editingChord!.id! }];
            }
        });
        handleCloseModal();
    }, [editingChord, handleCloseModal, setProgressionWithHistory]);

    const handleReorderProgression = useCallback((newProgression: Chord[]) => {
        setProgressionWithHistory(newProgression);
    }, [setProgressionWithHistory]);

    const handleAddPattern = useCallback((patternChords: string[]) => {
        const newChords = patternChords.map(name => ({ id: crypto.randomUUID(), name, duration: 4, octave: 4 }));
        
        setProgressionWithHistory(currentProgression => {
            // If we were editing a chord, replace it. Otherwise, append.
            const editingIndex = currentProgression.findIndex(c => c.id === editingChord?.id);
            if (editingIndex > -1) {
                const newProgression = [...currentProgression];
                newProgression.splice(editingIndex, 1, ...newChords);
                return newProgression;
            } else {
                return [...currentProgression, ...newChords];
            }
        });
        handleCloseModal(); // Close the modal after adding the pattern
    }, [editingChord, handleCloseModal, setProgressionWithHistory]);

    const handleAddSuggestedChords = useCallback((chordNames: string[]) => {
        const newChords: Chord[] = chordNames.map(name => ({
            id: crypto.randomUUID(),
            name,
            duration: 4, // Default duration
            octave: 4,   // Default octave
        }));
        setProgressionWithHistory(currentProgression => [...currentProgression, ...newChords]);
    }, [setProgressionWithHistory]);

    const suggestionContextChord = useMemo(() => 
        selectionContext || (progression.length > 0 ? progression[progression.length - 1] : null),
    [selectionContext, progression]);

    return (
        <div className="composer">
            <header className="composer-header">
                <h1>Harmonicizer</h1>
                <p>Build and explore your chord progressions.</p>
            </header>

            <div className="main-controls-wrapper">
                <div className="main-controls-left">
                    <TransportControls 
                        isPlaying={isPlaying}
                        tempo={tempo}
                        isLooping={isLooping}
                        onPlayToggle={handlePlayToggle}
                        onTempoChange={handleTempoChange}
                        onLoopToggle={handleLoopToggle}
                        onClearProgression={handleClearProgression}
                        onUndo={handleUndo}
                        onFeelLucky={handleFeelLucky}
                        canUndo={progressionHistory.length > 0}
                    />
                    <KeySignature
                        currentKey={musicalKey}
                        currentMode={musicalMode}
                        onKeyChange={setMusicalKey}
                        onModeChange={setMusicalMode}
                        rootNotes={rootNotes}
                        modes={modes}
                    />
                    <button 
                        className={`control-button ${isNoteVisualizerVisible ? 'active' : ''}`}
                        onClick={() => setIsNoteVisualizerVisible(prev => !prev)}
                        title="Toggle Note Visualizer"
                        aria-pressed={isNoteVisualizerVisible}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-8zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
                        </svg>
                    </button>
                </div>
            </div>

            <div className="chord-grid-wrapper">
                <ChordGrid 
                    progression={progression}
                    onEditChord={handleEditChord}
                    onSelectChord={handleSelectChord}
                    selectedChordId={selectedChordId}
                    currentlyPlayingChordId={currentlyPlayingChordId}
                    onRemoveChord={handleRemoveChord}
                    onReorderProgression={handleReorderProgression}
                    isNoteVisualizerVisible={isNoteVisualizerVisible}
                />
            </div>
            
            <div className="analysis-effects-container">
                <CollapsibleSection title="Harmonic Analysis" defaultOpen={true}>
                    <ProgressionAnalyzer 
                        analysis={analysisResults} 
                        onAddSuggestedChords={handleAddSuggestedChords}
                        suggestions={exhaustiveSuggestions}
                        suggestionContextChord={suggestionContextChord}
                    />
                </CollapsibleSection>

                <CollapsibleSection title="Synthesizer & Effects">
                    <GraphicalEnvelopeEditor 
                        envelope={envelope} 
                        onEnvelopeChange={handleEnvelopeChange} 
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
                    />
                </CollapsibleSection>
            </div>

            <ChordSelector
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveChord}
                onAddPattern={handleAddPattern}
                chord={editingChord}
                musicalKey={musicalKey}
                musicalMode={musicalMode}
                contextualChord={contextualChord}
                nextChord={nextChordInProgression}
                player={player.current}
            />
        </div>
    );
};

export default Composer;