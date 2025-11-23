

import * as Tone from 'tone';
import { FMSynth, MonoSynth, AMSynth, Synth, PolySynthOptions, Sampler } from 'tone';
import { RecursivePartial } from 'tone/build/esm/core/util/Interface';
import { soundfonts } from './soundfonts.js';
import { Note } from 'tonal';


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
    /** The current synthesizer instance. It could be a PolySynth or a Sampler. */
    synth: any;
    /** A callback function to notify the UI which chord is currently playing. */
    onTick: (id: string | null, songPartInstanceId?: string | null) => void;
    /** A callback to notify the UI of the synthesizer's loading state. */
    onLoadingStateChange: (isLoading: boolean) => void;
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

    constructor(
        onTick: (id: string | null, songPartInstanceId?: string | null) => void,
        onLoadingStateChange: (isLoading: boolean) => void
    ) {
        this.gainNode = new Tone.Gain(0.8).toDestination();
        this.reverb = new Tone.Reverb({ decay: 1.5, wet: 0.2, preDelay: 0.05 }).connect(this.gainNode);
        this.synth = new Tone.PolySynth(Tone.FMSynth).connect(this.reverb);
        this.onTick = onTick;
        this.onLoadingStateChange = onLoadingStateChange;
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
     * Transposes an array of notes to fit within an instrument's defined MIDI range.
     * Notes are shifted by octaves until they fit. Notes that cannot fit are removed.
     * @param {string[]} notes - The notes to process.
     * @param {string} instrumentName - The key of the instrument in the `soundfonts` object.
     * @returns {string[]} An array of notes guaranteed to be within the instrument's range.
     */
    private _transposeNotesToRange(notes: string[], instrumentName: keyof typeof soundfonts): string[] {
        const instrument = soundfonts[instrumentName];
        if (!instrument || !instrument.minMidi || !instrument.maxMidi) {
            return notes; // If no range is defined, return original notes.
        }

        const { minMidi, maxMidi } = instrument;

        return notes.map(note => {
            let midi = Note.midi(note);
            if (midi === null) return null;

            while (midi < minMidi) { midi += 12; }
            while (midi > maxMidi) { midi -= 12; }
            
            // Final check: if the range is smaller than an octave, transposition might not be enough.
            if (midi >= minMidi && midi <= maxMidi) {
                return Note.fromMidi(midi);
            }
            return null; // Note cannot be played on this instrument.
        }).filter((n): n is string => n !== null); // Filter out nulls.
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

        let notesToPlay = notes;
        if (this.currentSynthType === 'SoundFont' && this.synth.name) {
            notesToPlay = this._transposeNotesToRange(notes, this.synth.name);
        }

        if (notesToPlay.length > 0) {
            this.synth.triggerAttackRelease(notesToPlay, "8n", Tone.now());
        }
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
        this.onTick(null, null);
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
            this.onTick(null, null);
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
                 allEvents.push({ time: eventStart, id: chord.id, noteDuration: chordDurationInBeats, songPartInstanceId: chord.songPartInstanceId });
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
                        songPartInstanceId: chord.songPartInstanceId,
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
                    songPartInstanceId: chord.songPartInstanceId,
                });
                accumulatedBeats += chordDurationInBeats;
            }
        }

        // If the Part hasn't been created yet, create it now. This happens only once.
        if (!this.part) {
            this.part = new Tone.Part((time, value) => {
                if (this.synth.disposed || typeof value.noteDuration !== 'number') return;
                
                const durationInSeconds = (60 / Tone.Transport.bpm.value) * value.noteDuration;

                // Prepare notes by transposing if needed for the current instrument.
                let notesToPlay = [];
                if (value.note) {
                    notesToPlay = [value.note];
                } else if (value.notes) {
                    notesToPlay = value.notes;
                }

                if (this.currentSynthType === 'SoundFont' && this.synth.name) {
                    notesToPlay = this._transposeNotesToRange(notesToPlay, this.synth.name);
                }

                if (notesToPlay.length > 0) {
                     if (value.note) {
                        this.synth.triggerAttackRelease(notesToPlay[0], durationInSeconds, time);
                    } else {
                        this.synth.triggerAttackRelease(notesToPlay, durationInSeconds, time);
                    }
                }
                
                Tone.Draw.schedule(() => { this.onTick(value.id, value.songPartInstanceId); }, time);
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
     * Transforms the flat Moog settings from the UI state into the nested
     * object structure required by Tone.MonoSynth.
     * @param settings The flat settings object.
     * @returns A nested settings object for Tone.MonoSynth.
     */
    private _transformMoogSettings(settings: any) {
        const {
            envelope,
            filterCutoff, filterResonance,
            filterAttack, filterDecay, filterSustain, filterRelease
        } = settings;

        return {
            envelope,
            filter: {
                // The filter type for a Moog is a lowpass filter.
                type: 'lowpass',
                // Rolloff determines how steep the filter cutoff is. -24dB/octave is characteristic of a Moog.
                rolloff: -24,
                frequency: filterCutoff,
                Q: filterResonance,
            },
            filterEnvelope: {
                attack: filterAttack,
                decay: filterDecay,
                sustain: filterSustain,
                release: filterRelease,
                // These are sensible defaults for a synth filter envelope.
                baseFrequency: 200, 
                octaves: 7
            }
        };
    }

    /**
     * Changes the synthesizer voice. This method performs a robust, multi-step teardown
     * of the old synth and its scheduled events before swapping to the new one to prevent race conditions.
     * It is now asynchronous to handle the loading time of soundfont samples.
     * @param synthType A string identifier for the new synth.
     * @param initialSettings The initial parameters for the new synth.
     */
    async setSynth(synthType: string, initialSettings: any) {
        // Step 0: Abort if we are not actually changing the synth type.
        if (this.currentSynthType === synthType) {
            return;
        }

        this.onLoadingStateChange(true); // Signal that a synth change has started.

        try {
            const wasPlaying = Tone.Transport.state === 'started';
            const position = Tone.Transport.position;
        
            if (wasPlaying) { Tone.Transport.stop(); }
            Tone.Transport.cancel();
            this.synth.releaseAll();
        
            if (this.part) {
                this.part.dispose();
                this.part = null;
            }
        
            const oldSynth = this.synth;
            const { volume, ...voiceOptions } = initialSettings;
            
            let newSynth;

            if (synthType === 'SoundFont') {
                const instrumentConfig = soundfonts[initialSettings.instrument];
                if (!instrumentConfig) {
                    console.error(`Soundfont instrument "${initialSettings.instrument}" not found.`);
                    return;
                }
                
                // CRITICAL FIX: Wrap sampler creation in a promise that resolves upon loading.
                newSynth = await new Promise<Tone.Sampler>((resolve, reject) => {
                    const sampler = new Tone.Sampler({
                        urls: instrumentConfig.notes,
                        baseUrl: instrumentConfig.baseUrl,
                        release: 1,
                        attack: 0.01,
                        onload: () => {
                            console.log(`${instrumentConfig.name} samples loaded.`);
                            resolve(sampler);
                        },
                        onerror: (err) => {
                            console.error("Error loading soundfont samples:", err);
                            reject(err);
                        },
                    }).connect(this.reverb);
                    // The 'name' property is not standard on Tone.Sampler, but we add it for our own tracking.
                    (sampler as any).name = initialSettings.instrument;
                });

            } else {
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

                let finalOptions = voiceOptions;
                if (synthType === 'MoogLead' || synthType === 'MoogBass') {
                    finalOptions = this._transformMoogSettings(voiceOptions);
                }

                // CORRECTED INSTANTIATION: Create PolySynth with polyphony options, then set voice options.
                // FIX: Property 'polyphony' does not exist on type 'Partial<PolySynthOptions<any>>'. Changed to 'maxPolyphony'.
                const polySynthOptions: Partial<PolySynthOptions<any>> = { maxPolyphony: 64 };
                newSynth = new Tone.PolySynth(voice, polySynthOptions).connect(this.reverb);
                newSynth.set(finalOptions);
            }
            
            if (volume !== undefined && newSynth.volume) {
                newSynth.volume.value = volume;
            }
            
            this.synth = newSynth;
            this.currentSynthType = synthType;
        
            setTimeout(() => {
                if (!oldSynth.disposed) {
                    // oldSynth.dispose(); // Temporarily commented out as it caused issues in some environments.
                }
            }, 50);
        
            this._rebuildPart();
        
            if (wasPlaying) {
                Tone.Transport.start(Tone.now(), position);
            }
        } catch (error) {
            console.error("Failed to set new synthesizer:", error);
            // In case of error, you might want to revert to a default synth or handle it gracefully.
        } finally {
            this.onLoadingStateChange(false); // Signal that loading is complete, even if it failed.
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
    async updateVoiceSettings(settings: any) {
        const { volume, ...voiceSettings } = settings;
        if (volume !== undefined && this.synth.volume) {
            this.synth.volume.value = volume;
        }

        if (this.currentSynthType === 'SoundFont') {
            // Check if the instrument has changed. If so, a full async synth swap is required.
            if (voiceSettings.instrument && this.synth.name !== voiceSettings.instrument) {
                const oldType = this.currentSynthType;
                this.currentSynthType = ''; // Force `setSynth` to run by clearing the current type.
                await this.setSynth(oldType, settings);
            }
            return;
        }
        
        if (this.currentSynthType === 'MoogLead' || this.currentSynthType === 'MoogBass') {
            if (typeof voiceSettings.filterCutoff === 'number') {
                this.synth.set({ 'filter.frequency': voiceSettings.filterCutoff });
            }
            if (typeof voiceSettings.filterResonance === 'number') {
                this.synth.set({ 'filter.Q': voiceSettings.filterResonance });
            }
            this.synth.set({
                envelope: voiceSettings.envelope,
                filterEnvelope: {
                    attack: voiceSettings.filterAttack,
                    decay: voiceSettings.filterDecay,
                    sustain: voiceSettings.filterSustain,
                    release: voiceSettings.filterRelease,
                }
            });
            return;
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
