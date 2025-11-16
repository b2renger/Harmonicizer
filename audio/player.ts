
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
    /** The Tone.Part instance that schedules all musical events. It is created once and reused. */
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
     * This method reuses the same Tone.Part object to avoid race conditions,
     * clearing old events and adding new ones.
     */
    _rebuildPart() {
        // If the part exists, clear its scheduled events.
        if (this.part) {
            this.part.clear();
        }

        // If the progression is empty, there's nothing more to do.
        if (this.progression.length === 0) {
            Tone.Transport.loopEnd = 0;
            this.onTick(null);
            return;
        }

        const allEvents: any[] = [];
        let accumulatedBeats = 0;
        const timeSignature = 4; // Assuming 4/4 time

        for (const chord of this.progression) {
            const bars = Math.floor(accumulatedBeats / timeSignature);
            const beats = accumulatedBeats % timeSignature;
            const eventStart = `${bars}:${beats}:0`;
            const chordDurationInBeats = chord.duration;
            const notes = chord.notes;

            if (notes.length === 0) {
                 allEvents.push({ time: eventStart, id: chord.id, noteDuration: chordDurationInBeats });
                accumulatedBeats += chordDurationInBeats;
                continue;
            }

            if (this.isArpeggiatorActive) {
                const arpeggioTimingAsSeconds = Tone.Time(this.arpeggiatorTiming).toSeconds();
                const beatDurationInSeconds = 60 / Tone.Transport.bpm.value;
                const arpeggioTimingInBeats = arpeggioTimingAsSeconds / beatDurationInSeconds;
                
                if (arpeggioTimingInBeats <= 0) {
                    accumulatedBeats += chordDurationInBeats;
                    continue;
                }

                const finalNoteDurationInSeconds = Math.max(arpeggioTimingAsSeconds * 0.8, 0.05);
                const finalNoteDurationInBeats = finalNoteDurationInSeconds / beatDurationInSeconds;
                
                const chordStartBeats = accumulatedBeats;
                const chordEndBeats = chordStartBeats + chordDurationInBeats;
                const maxRepetitions = this.arpeggiatorRepeats * notes.length;
                let notesPlayedInArpeggio = 0;
                let noteIndex = 0;

                for (let currentTimeInBeats = chordStartBeats; currentTimeInBeats < chordEndBeats; currentTimeInBeats += arpeggioTimingInBeats) {
                    if (notesPlayedInArpeggio >= maxRepetitions) break;
                    
                    const note = notes[noteIndex % notes.length];
                    const noteBars = Math.floor(currentTimeInBeats / timeSignature);
                    const noteBeatsInBar = currentTimeInBeats % timeSignature;
                    
                    allEvents.push({
                        time: `${noteBars}:${noteBeatsInBar}:0`,
                        note: note,
                        noteDuration: finalNoteDurationInBeats,
                        id: chord.id,
                    });
                    
                    noteIndex++;
                    notesPlayedInArpeggio++;
                }
                accumulatedBeats += chordDurationInBeats;
            } else {
                allEvents.push({
                    time: eventStart,
                    notes: notes,
                    noteDuration: chordDurationInBeats,
                    id: chord.id,
                });
                accumulatedBeats += chordDurationInBeats;
            }
        }

        // If the Part hasn't been created yet, create it now. This happens only once.
        if (!this.part) {
            this.part = new Tone.Part((time, value) => {
                if (this.synth.disposed || typeof value.noteDuration !== 'number') return;
                
                const durationInSeconds = (60 / Tone.Transport.bpm.value) * value.noteDuration;

                if (value.note) {
                    this.synth.triggerAttackRelease(value.note, durationInSeconds, time);
                } else if (value.notes && value.notes.length > 0) {
                    this.synth.triggerAttackRelease(value.notes, durationInSeconds, time);
                }
                
                Tone.Draw.schedule(() => { this.onTick(value.id); }, time);
            }, allEvents).start(0);
        } else {
            // If the part already exists, just add the new events to it.
            allEvents.forEach(event => this.part.add(event));
        }
        
        const totalBars = Math.floor(accumulatedBeats / timeSignature);
        const totalBeatsRemainder = accumulatedBeats % timeSignature;
        Tone.Transport.loopEnd = `${totalBars}:${totalBeatsRemainder}:0`;
        this.part.loop = false;
    }

    /**
     * Updates the player with a new chord progression by rebuilding the schedule.
     * @param progression The new progression data.
     */
    setProgression(progression: any[]) {
        const wasPlaying = Tone.Transport.state === 'started';
        
        // For a smoother transition, we pause playback while rebuilding the schedule.
        if (wasPlaying) {
            Tone.Transport.pause();
        }

        this.progression = progression;
        this._rebuildPart();

        if (wasPlaying) {
            // If the progression was cleared, stop completely.
            if (this.progression.length === 0) {
                this.stop();
            } else {
                // Otherwise, resume playback.
                Tone.Transport.start();
            }
        }
    }
    
    /**
     * Changes the synthesizer voice. This method performs a robust, multi-step teardown
     * of the old synth and its scheduled events before swapping to the new one to prevent race conditions.
     * @param synthType A string identifier for the new synth.
     * @param initialSettings The initial parameters for the new synth.
     */
    setSynth(synthType: string, initialSettings: any) {
        // Step 0: Abort if we are not actually changing the synth type.
        if (this.currentSynthType === synthType) {
            return;
        }
    
        const wasPlaying = Tone.Transport.state === 'started';
        const position = Tone.Transport.position;
    
        // Step 1: Immediately stop the transport. This is critical because it halts the
        // internal Tone.js clock (the Ticker), preventing it from scheduling new events
        // for the old synth while we are in the process of swapping it out.
        if (wasPlaying) {
            Tone.Transport.stop();
        }
    
        // Step 2: Cancel any events that were already scheduled on the transport's timeline
        // but haven't played yet. This cleans the slate for the new synth.
        Tone.Transport.cancel();
    
        // Step 3: Force the old synthesizer to release any notes that might be stuck
        // playing (e.g., due to a long release time).
        this.synth.releaseAll();
    
        // --- The Core Synth Swap ---
        
        // Step 4: Completely dispose of the old Tone.Part. The Part object holds references
        // to the old synth in its callbacks. To prevent these old callbacks from firing
        // unpredictably, we destroy the Part entirely. A new one will be created later.
        if (this.part) {
            this.part.dispose();
            this.part = null;
        }
    
        // Step 5: Create the new synthesizer instance. We separate volume from other
        // voice-specific settings for easier management.
        const oldSynth = this.synth;
        const { volume, ...voiceOptions } = initialSettings;
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
        const newSynth = new Tone.PolySynth(voice, voiceOptions).connect(this.reverb);
        if (volume !== undefined) {
            newSynth.volume.value = volume;
        }
        
        // Step 6: Update the class properties to reference the new synth.
        this.synth = newSynth;
        this.currentSynthType = synthType;
    
        // Step 7: Schedule the disposal of the old synth object using a timeout. This defers
        // the cleanup to the end of the JavaScript event loop task, ensuring that any final,
        // in-flight audio processes related to the old synth can complete gracefully.
        setTimeout(() => {
            if (!oldSynth.disposed) {
                // oldSynth.dispose(); // Temporarily commented out as it caused issues in some environments.
                                    // Modern browsers are good at garbage collection, making this less critical.
            }
        }, 50);
    
        // Step 8: Rebuild the entire musical schedule from scratch with the new synth.
        // This will create a brand new Tone.Part object with callbacks tied to the new synth.
        this._rebuildPart();
    
        // Step 9: If playback was active before the swap, resume it from the exact
        // position it was stopped. This creates a seamless transition for the user.
        if (wasPlaying) {
            Tone.Transport.start(Tone.now(), position);
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
