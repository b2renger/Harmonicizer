
import * as Tone from 'tone';
import { FMSynth, MonoSynth, AMSynth, Synth, PolySynthOptions, SynthOptions } from 'tone';
import { RecursivePartial } from 'tone/build/esm/core/util/Interface';

/**
 * The Player class is a controller for Tone.js, encapsulating all audio-related logic
 * for the Harmonicizer application. It manages the synthesizer, effects, and scheduling
 * of the chord progression.
 */
export class Player {
    /** The master output gain node. */
    gainNode: Tone.Gain;
    /** The master reverb effect. */
    reverb: Tone.Reverb;
    /** The current synthesizer instance. It's a PolySynth to handle multiple notes at once. */
    synth: Tone.PolySynth;
    /** A callback function to notify the UI which chord is currently playing. */
    onTick: (id: string | null) => void;
    /** The Tone.Part instance that schedules all musical events. */
    part: Tone.Part | null;
    /** Flag to determine if the arpeggiator is active. */
    isArpeggiatorActive: boolean;
    /** The timing interval for the arpeggiator (e.g., '8n', '16t'). */
    arpeggiatorTiming: string;
    /** The number of times the arpeggiator should repeat for a chord. Infinity for continuous. */
    arpeggiatorRepeats: number;
    /** The current chord progression data. */
    progression: any[];
    /** A string identifier for the current synth type (e.g., 'Rhodes'). */
    currentSynthType: string;

    constructor(onTick: (id: string | null) => void) {
        this.gainNode = new Tone.Gain(0.8).toDestination();
        this.reverb = new Tone.Reverb({ decay: 1.5, wet: 0.2, preDelay: 0.05 }).connect(this.gainNode);
        this.synth = new Tone.PolySynth(Tone.FMSynth).connect(this.reverb);
        this.onTick = onTick;
        this.part = null;
        this.isArpeggiatorActive = false;
        this.arpeggiatorTiming = '16n';
        this.arpeggiatorRepeats = Infinity;
        this.progression = [];
        this.currentSynthType = 'Rhodes';
        
        // Set initial loop state on transport
        Tone.Transport.loop = true;
    }

    /**
     * Plays a single chord immediately for previewing purposes.
     * @param notes An array of note names to play (e.g., ['C4', 'E4', 'G4']).
     */
    playOneShot(notes: string[]) {
        if (Tone.context.state !== 'running') {
            Tone.start();
        }
        if (notes.length === 0) return;
        this.synth.triggerAttackRelease(notes, "8n", Tone.now());
    }

    /**
     * Starts the Tone.js AudioContext if it's not already running.
     * This is required to be called after a user interaction.
     */
    async start() {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
    }

    /**
     * Starts playback of the scheduled progression via Tone.Transport.
     */
    play() {
        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }
    }

    /**
     * Stops playback and releases all synthesizer notes.
     */
    stop() {
        Tone.Transport.stop();
        this.synth.releaseAll();
        // Reset transport position and part state.
        Tone.Transport.position = 0;
        this.part?.stop(0); 
        this.onTick(null);
    }
    
    /**
     * Rebuilds the Tone.Part schedule from the current progression.
     * This private method is the core of the scheduling logic and is called
     * whenever the progression, synth, or arpeggiator settings change.
     */
    _rebuildPart() {
        // 1. Clean up the existing part to prevent memory leaks or duplicate events.
        if (this.part) {
            this.part.clear();
            this.part.dispose();
            this.part = null;
        }

        // 2. If the progression is empty, there's nothing to schedule.
        if (this.progression.length === 0) {
            Tone.Transport.loopEnd = 0;
            this.onTick(null);
            return;
        }

        // 3. Build an array of events for Tone.Part from the progression data.
        const allEvents: any[] = [];
        let accumulatedBeats = 0;
        const timeSignature = 4; // Assuming 4/4 time

        for (const chord of this.progression) {
            // Calculate musical time in "Bar:Beat:Sixteenths" format.
            const bars = Math.floor(accumulatedBeats / timeSignature);
            const beats = accumulatedBeats % timeSignature;
            const eventStart = `${bars}:${beats}:0`;
            const chordDurationInBeats = chord.duration;
            
            const notes = chord.notes;

            // Handle rests (chords with no notes)
            if (notes.length === 0) {
                 allEvents.push({ time: eventStart, id: chord.id, noteDuration: chordDurationInBeats });
                accumulatedBeats += chordDurationInBeats;
                continue;
            }

            // Handle Arpeggiator Logic
            if (this.isArpeggiatorActive) {
                // Convert arpeggiator timing (e.g., '16n') to seconds, then to beats.
                const arpeggioTimingAsSeconds = Tone.Time(this.arpeggiatorTiming).toSeconds();
                const beatDurationInSeconds = 60 / Tone.Transport.bpm.value;
                const arpeggioTimingInBeats = arpeggioTimingAsSeconds / beatDurationInSeconds;
                
                if (arpeggioTimingInBeats <= 0) {
                    accumulatedBeats += chordDurationInBeats;
                    continue; // Avoid infinite loops if timing is invalid
                }

                // Make notes slightly staccato to prevent them from blurring together.
                const finalNoteDurationInSeconds = Math.max(arpeggioTimingAsSeconds * 0.8, 0.05);
                const finalNoteDurationInBeats = finalNoteDurationInSeconds / beatDurationInSeconds;
                
                const chordStartBeats = accumulatedBeats;
                const chordEndBeats = chordStartBeats + chordDurationInBeats;

                const maxRepetitions = this.arpeggiatorRepeats * notes.length;
                let notesPlayedInArpeggio = 0;

                // Schedule individual notes for the duration of the chord.
                let noteIndex = 0;
                for (let currentTimeInBeats = chordStartBeats; currentTimeInBeats < chordEndBeats; currentTimeInBeats += arpeggioTimingInBeats) {
                    if (notesPlayedInArpeggio >= maxRepetitions) {
                        break;
                    }
                    
                    const note = notes[noteIndex % notes.length];
                    const noteBars = Math.floor(currentTimeInBeats / timeSignature);
                    const noteBeatsInBar = currentTimeInBeats % timeSignature;
                    const noteTimeNotation = `${noteBars}:${noteBeatsInBar}:0`;

                    allEvents.push({
                        time: noteTimeNotation,
                        note: note,
                        noteDuration: finalNoteDurationInBeats,
                        id: chord.id,
                    });
                    
                    noteIndex++;
                    notesPlayedInArpeggio++;
                }
                
                accumulatedBeats += chordDurationInBeats;
            } else {
                // Schedule a regular block chord.
                allEvents.push({
                    time: eventStart,
                    notes: notes,
                    noteDuration: chordDurationInBeats,
                    id: chord.id,
                });
                accumulatedBeats += chordDurationInBeats;
            }
        }

        // 4. Create the new Tone.Part instance with the generated events.
        this.part = new Tone.Part((time, value) => {
            // This callback is executed for each event when its time is reached.
            if (typeof value.noteDuration !== 'number') return;
            // Convert duration from beats to seconds based on the current tempo.
            const durationInSeconds = (60 / Tone.Transport.bpm.value) * value.noteDuration;

            // Trigger the synth.
            if (value.note) { // For single arpeggiated notes
                this.synth.triggerAttackRelease(value.note, durationInSeconds, time);
            } else if (value.notes && value.notes.length > 0) { // For block chords
                this.synth.triggerAttackRelease(value.notes, durationInSeconds, time);
            }
            // Use Tone.Draw to schedule a UI update synchronized with the audio thread.
            Tone.Draw.schedule(() => {
                this.onTick(value.id);
            }, time);
        }, allEvents).start(0);
        
        // 5. Set the transport's loop points based on the total length of the progression.
        const totalBars = Math.floor(accumulatedBeats / timeSignature);
        const totalBeatsRemainder = accumulatedBeats % timeSignature;
        Tone.Transport.loopEnd = `${totalBars}:${totalBeatsRemainder}:0`;
        this.part.loop = false; // The Transport handles looping, not the part itself.
    }

    /**
     * Updates the player with a new chord progression.
     * Rebuilds the schedule while ensuring smooth playback.
     * @param progression The new progression data.
     */
    setProgression(progression: any[]) {
        const wasPlaying = Tone.Transport.state === 'started';
        const currentPosition = Tone.Transport.position;

        if (wasPlaying) {
            Tone.Transport.pause();
            this.synth.releaseAll(); // Avoid hanging notes on progression change
        }

        this.progression = progression;
        this._rebuildPart();

        if (wasPlaying) {
            if (this.progression.length === 0) {
                // If the progression was cleared while playing, stop everything.
                this.stop();
            } else {
                // Resume playback from the previous position.
                Tone.Transport.start(Tone.now(), currentPosition);
            }
        }
    }
    
    /**
     * Changes the synthesizer voice. This is a complex operation that involves
     * disposing of the old synth and creating a new one, then rebuilding the schedule.
     * @param synthType A string identifier for the new synth.
     * @param initialSettings The initial parameters for the new synth.
     */
    setSynth(synthType: string, initialSettings: any) {
        if (this.currentSynthType === synthType) {
            return; // No change needed
        }

        const wasPlaying = Tone.Transport.state === 'started';
        const currentPosition = Tone.Transport.position;

        if (wasPlaying) {
            Tone.Transport.pause();
        }

        // CRITICAL: The Tone.Part holds references to the synth it schedules events for.
        // We MUST dispose of the Part *before* disposing of the synth itself.
        // Failure to do so can cause a race condition where a scheduled event tries to
        // access the already-disposed synth, leading to errors.
        if (this.part) {
            this.part.clear();
            this.part.dispose();
            this.part = null;
        }
        
        // Now it's safe to release any hanging notes and dispose of the old synth.
        this.synth.releaseAll();
        this.synth.dispose();
        
        this.currentSynthType = synthType;
        const { volume, ...voiceOptions } = initialSettings;

        // Select the Tone.js voice constructor based on the type string.
        let voice: any = Tone.Synth;
        if (synthType === 'Rhodes' || synthType === 'FMSynth' || synthType === 'VCS3Drone' || synthType === 'VCS3FX') {
            voice = Tone.FMSynth;
        } else if (synthType === 'MoogLead' || synthType === 'MoogBass') {
            voice = Tone.MonoSynth;
        } else if (synthType === 'AMSynth') {
            voice = Tone.AMSynth;
        } else if (synthType === 'Synth') {
            voice = Tone.Synth;
        }

        // Create the new PolySynth instance.
        this.synth = new Tone.PolySynth(voice, voiceOptions).connect(this.reverb);
        if (volume !== undefined) {
            this.synth.volume.value = volume;
        }
        
        // Rebuild the part with the new synth.
        this._rebuildPart();
        
        if (wasPlaying) {
            Tone.Transport.start(Tone.now(), currentPosition);
        }
    }

    /** Sets the playback tempo. */
    setTempo(bpm: number) {
        Tone.Transport.bpm.value = bpm;
    }

    /** Sets the master gain (volume). */
    setGain(value: number) {
        this.gainNode.gain.value = value;
    }

    /** Sets the wet/dry mix of the reverb. */
    setReverbWet(value: number) {
        this.reverb.wet.value = value;
    }

    /** Sets the decay time of the reverb. */
    setReverbTime(value: number) {
        this.reverb.decay = value;
        this.reverb.preDelay = value * 0.03;
    }

    /** Configures the arpeggiator settings. */
    setArpeggiator(active: boolean, timing: string, repeats: number) {
        this.isArpeggiatorActive = active;
        this.arpeggiatorTiming = timing;
        this.arpeggiatorRepeats = repeats;
    }

    /**
     * Updates the parameters of the current synthesizer voice in real-time.
     * @param settings An object containing the new synth parameters.
     */
    updateVoiceSettings(settings: any) {
        const { volume, ...voiceSettings } = settings;
        if (volume !== undefined && this.synth.volume) {
            this.synth.volume.value = volume;
        }
        this.synth.set(voiceSettings);
    }
    
    /** Toggles the transport's loop state. */
    setLoop(loop: boolean) {
        Tone.Transport.loop = loop;
    }

    /**
     * Cleans up all Tone.js resources to prevent memory leaks.
     * Should be called when the component is unmounted.
     */
    dispose() {
        this.stop();
        Tone.Transport.cancel(0);

        if (this.part) {
            this.part.dispose();
            this.part = null;
        }
        this.synth.dispose();
        this.gainNode.dispose();
        this.reverb.dispose();
    }
}
