import React, { useState, useRef, useEffect, useCallback } from 'react';
import TransportControls from '../../components/TransportControls/TransportControls';
import ChordGrid from '../../components/ChordGrid/ChordGrid';
import ChordSelector from '../../components/ChordSelector/ChordSelector';
import GraphicalEnvelopeEditor from '../../components/GraphicalEnvelopeEditor/GraphicalEnvelopeEditor';
import { Player, SynthType, EnvelopeSettings } from '../../audio/player';
import './Composer.css';
// Fix: Add a type import for Tone to resolve the 'Cannot find namespace Tone' error for Tone.Unit.Time.
import type * as Tone from 'tone';

export interface Chord {
    id: string;
    name: string;
    duration: number; // in beats
}

const Composer = () => {
    console.log('Composer component rendering...');
    const [progression, setProgression] = useState<Chord[]>([
        { id: crypto.randomUUID(), name: 'Cmaj7', duration: 4 },
        { id: crypto.randomUUID(), name: 'Am7', duration: 4 },
        { id: crypto.randomUUID(), name: 'Dm7', duration: 4 },
        { id: crypto.randomUUID(), name: 'G7', duration: 4 },
    ]);

    const [isPlaying, setIsPlaying] = useState(false);
    const [tempo, setTempo] = useState(120);
    const [synthType, setSynthType] = useState<SynthType>('Rhodes'); // Changed default synth to Rhodes
    const [isLooping, setIsLooping] = useState(true);
    // Adjusted default envelope settings for a less percussive Rhodes sound
    const [envelope, setEnvelope] = useState<EnvelopeSettings>({ attack: 0.2, decay: 0.6, sustain: 0.7, release: 1.5 });
    
    // New states for master gain and reverb
    const [masterGain, setMasterGain] = useState(0.8);
    const [reverbWet, setReverbWet] = useState(0.2);
    const [reverbTime, setReverbTime] = useState(1.5);

    // New states for arpeggiator
    const [isArpeggiatorActive, setIsArpeggiatorActive] = useState(false);
    const [arpeggiatorTiming, setArpeggiatorTiming] = useState<Tone.Unit.Time>('16n');
    const [arpeggiatorRepeats, setArpeggiatorRepeats] = useState<number>(Infinity);


    const [currentlyPlayingChordId, setCurrentlyPlayingChordId] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChord, setEditingChord] = useState<Partial<Chord> | null>(null);
    const [contextualChord, setContextualChord] = useState<Chord | null>(null);

    const player = useRef<Player | null>(null);

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
            // We need to reset progression for duration calculation to be correct
            player.current.setProgression(progression);
        }
    }, [tempo, progression]);


    useEffect(() => {
        player.current?.setEnvelope(envelope);
    }, [envelope]);

    // New useEffects for gain and reverb
    useEffect(() => {
        player.current?.setGain(masterGain);
    }, [masterGain]);

    useEffect(() => {
        player.current?.setReverbWet(reverbWet);
    }, [reverbWet]);

    useEffect(() => {
        player.current?.setReverbTime(reverbTime);
    }, [reverbTime]);

    // Synth type useEffect remains, but the prop is passed to GraphicalEnvelopeEditor
    useEffect(() => {
        player.current?.setSynth(synthType);
    }, [synthType]);

    // New useEffects for arpeggiator
    useEffect(() => {
        if (player.current) {
            player.current.setArpeggiator(isArpeggiatorActive, arpeggiatorTiming, arpeggiatorRepeats);
            player.current.setProgression(progression); // Rebuild Tone.Part with new arpeggiator settings
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
        // Player update is handled by the useEffect for synthType
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
        // If the last chord is removed and playing, stop the player
        if (progression.length === 1 && progression[0].id === idToRemove && isPlaying) {
            player.current?.stop();
            setIsPlaying(false);
        }
    }, [currentlyPlayingChordId, isPlaying, progression.length]);

    const handleCardClick = useCallback((chord: Partial<Chord> | null) => {
        setEditingChord(chord || { id: crypto.randomUUID() });

        let contextChord: Chord | null = null;
        if (chord && chord.id) { // Editing an existing chord
            const chordIndex = progression.findIndex(c => c.id === chord.id);
            // Find the closest previous non-rest chord
            for (let i = chordIndex - 1; i >= 0; i--) {
                if (progression[i].name !== 'Rest') {
                    contextChord = progression[i];
                    break;
                }
            }
        } else { // Adding a new chord
            // Find the last non-rest chord in the whole progression
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

    return (
        <div className="composer">
            <header className="composer-header">
                <h1>Composer</h1>
                <p>Build your chord progression.</p>
            </header>
            <div className="chord-grid-wrapper">
                <ChordGrid 
                    progression={progression}
                    onCardClick={handleCardClick}
                    currentlyPlayingChordId={currentlyPlayingChordId}
                    onRemoveChord={handleRemoveChord}
                />
            </div>
            <div className="controls-container">
                <TransportControls 
                    isPlaying={isPlaying}
                    tempo={tempo}
                    // Removed synthType={synthType}
                    // Removed onSynthChange={handleSynthChange}
                    isLooping={isLooping}
                    onPlayToggle={handlePlayToggle}
                    onTempoChange={handleTempoChange}
                    onLoopToggle={handleLoopToggle}
                    onClearProgression={handleClearProgression}
                />
                <GraphicalEnvelopeEditor 
                    envelope={envelope} 
                    onEnvelopeChange={handleEnvelopeChange} 
                    masterGain={masterGain}
                    onMasterGainChange={setMasterGain}
                    reverbWet={reverbWet}
                    onReverbWetChange={setReverbWet}
                    reverbTime={reverbTime}
                    onReverbTimeChange={setReverbTime}
                    synthType={synthType} // Added synthType
                    onSynthChange={handleSynthChange} // Added onSynthChange
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
                chord={editingChord}
                previousChord={contextualChord}
            />
        </div>
    );
};

export default Composer;