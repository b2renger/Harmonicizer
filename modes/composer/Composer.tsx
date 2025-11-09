import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import TransportControls from '../../components/TransportControls/TransportControls';
import ChordGrid from '../../components/ChordGrid/ChordGrid';
import ChordSelector from '../../components/ChordSelector/ChordSelector';
import GraphicalEnvelopeEditor from '../../components/GraphicalEnvelopeEditor/GraphicalEnvelopeEditor';
import KeySignature from '../../components/KeySignature/KeySignature';
import ProgressionAnalyzer from '../../components/ProgressionAnalyzer/ProgressionAnalyzer';
import { Player, SynthType, EnvelopeSettings } from '../../audio/player';
import { analyzeProgression } from '../../theory/analysis';
import './Composer.css';
import type * as Tone from 'tone';
import { rootNotes, modes, invertChord, randomlyInvertChord } from '../../theory/chords';

export interface Chord {
    id: string;
    name: string;
    duration: number; // in beats
    octave: number;
}

const Composer = () => {
    console.log('Composer component rendering...');
    const [progression, setProgression] = useState<Chord[]>([
        { id: crypto.randomUUID(), name: 'Cmaj7', duration: 4, octave: 4 },
        { id: crypto.randomUUID(), name: 'Am7', duration: 4, octave: 4 },
        { id: crypto.randomUUID(), name: 'Dm7', duration: 4, octave: 4 },
        { id: crypto.randomUUID(), name: 'G7', duration: 4, octave: 4 },
    ]);

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
    
    const [isAnalyzerVisible, setIsAnalyzerVisible] = useState(false);

    const [currentlyPlayingChordId, setCurrentlyPlayingChordId] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChord, setEditingChord] = useState<Partial<Chord> | null>(null);
    const [contextualChord, setContextualChord] = useState<Chord | null>(null);

    const player = useRef<Player | null>(null);

    const analysisResults = useMemo(() => {
        return analyzeProgression(progression, musicalKey, musicalMode);
    }, [progression, musicalKey, musicalMode]);

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
        setProgression([]);
    }, []);

    const handleRemoveChord = useCallback((idToRemove: string) => {
        setProgression(currentProgression => 
            currentProgression.filter(chord => chord.id !== idToRemove)
        );
        if (currentlyPlayingChordId === idToRemove) {
            setCurrentlyPlayingChordId(null);
        }
        if (progression.length === 1 && progression[0].id === idToRemove && isPlaying) {
            player.current?.stop();
            setIsPlaying(false);
        }
    }, [currentlyPlayingChordId, isPlaying, progression.length]);

    const handleCardClick = useCallback((chord: Partial<Chord> | null) => {
        setEditingChord(chord || { id: crypto.randomUUID(), octave: 4 });

        let contextChord: Chord | null = null;
        if (chord && chord.id) {
            const chordIndex = progression.findIndex(c => c.id === chord.id);
            for (let i = chordIndex - 1; i >= 0; i--) {
                if (progression[i].name !== 'Rest') {
                    contextChord = progression[i];
                    break;
                }
            }
        } else {
            for (let i = progression.length - 1; i >= 0; i--) {
                if (progression[i].name !== 'Rest') {
                    contextChord = progression[i];
                    break;
                }
            }
        }
        setContextualChord(contextChord);
        setIsModalOpen(true);
    }, [progression]);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingChord(null);
        setContextualChord(null);
    }, []);

    const handleSaveChord = useCallback((savedChord: Omit<Chord, 'id'> & { id?: string }) => {
        setProgression(currentProgression => {
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
    }, [editingChord, handleCloseModal]);

    const handleReorderProgression = useCallback((newProgression: Chord[]) => {
        setProgression(newProgression);
    }, []);

    const handleAddPattern = useCallback((patternChords: string[]) => {
        const newChords = patternChords.map(name => ({ id: crypto.randomUUID(), name, duration: 4, octave: 4 }));
        
        setProgression(currentProgression => {
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
    }, [editingChord, handleCloseModal]);

    const handleInvertChord = useCallback((chordId: string, direction: 'up' | 'down') => {
        setProgression(currentProgression => {
            const chordIndex = currentProgression.findIndex(c => c.id === chordId);
            if (chordIndex === -1) return currentProgression;
            
            const currentChord = currentProgression[chordIndex];
            const newName = invertChord(currentChord.name, direction);

            const newProgression = [...currentProgression];
            newProgression[chordIndex] = { ...currentChord, name: newName };
            return newProgression;
        });
    }, []);

    const handlePermuteChord = useCallback((chordId: string) => {
        setProgression(currentProgression => {
            const chordIndex = currentProgression.findIndex(c => c.id === chordId);
            if (chordIndex === -1) return currentProgression;

            const currentChord = currentProgression[chordIndex];
            const newName = randomlyInvertChord(currentChord.name);

            const newProgression = [...currentProgression];
            newProgression[chordIndex] = { ...currentChord, name: newName };
            return newProgression;
        });
    }, []);

    return (
        <div className="composer">
            <header className="composer-header">
                <h1>Harmonicizer</h1>
                <p>Build and explore your chord progressions.</p>
            </header>
            <div className="chord-grid-wrapper">
                <ChordGrid 
                    progression={progression}
                    onCardClick={handleCardClick}
                    currentlyPlayingChordId={currentlyPlayingChordId}
                    onRemoveChord={handleRemoveChord}
                    onReorderProgression={handleReorderProgression}
                    onInvertChord={handleInvertChord}
                    onPermuteChord={handlePermuteChord}
                />
            </div>
            <div className="controls-container">
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
                        />
                        <KeySignature
                            currentKey={musicalKey}
                            currentMode={musicalMode}
                            onKeyChange={setMusicalKey}
                            onModeChange={setMusicalMode}
                            rootNotes={rootNotes}
                            modes={modes}
                        />
                    </div>
                     <button 
                        className={`control-button analysis-toggle-button ${isAnalyzerVisible ? 'active' : ''}`} 
                        onClick={() => setIsAnalyzerVisible(prev => !prev)}
                        aria-label="Toggle Progression Analyzer"
                        aria-expanded={isAnalyzerVisible}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-5h2v5zm4 0h-2v-3h2v3zm0-5h-2v-2h2v2zm4 5h-2V7h2v10z"/>
                        </svg>
                    </button>
                </div>

                {isAnalyzerVisible && (
                    <ProgressionAnalyzer 
                        analysis={analysisResults} 
                    />
                )}

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
            />
        </div>
    );
};

export default Composer;