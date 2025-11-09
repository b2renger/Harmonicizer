
import * as Tone from 'tone';
import { FMSynth, MonoSynth, AMSynth, Synth, PolySynthOptions, SynthOptions } from 'tone';
import { RecursivePartial } from 'tone/build/esm/core/util/Interface';

export class Player {
    // FIX: Declare class properties to resolve TypeScript errors
    gainNode: Tone.Gain;
    reverb: Tone.Reverb;
    synth: Tone.PolySynth;
    onTick: (id: string | null) => void;
    part: Tone.Part | null;
    isArpeggiatorActive: boolean;
    arpeggiatorTiming: string;
    arpeggiatorRepeats: number;
    progression: any[];
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

    playOneShot(notes: string[]) {
        if (Tone.context.state !== 'running') {
            Tone.start();
        }
        if (notes.length === 0) return;
        this.synth.triggerAttackRelease(notes, "8n", Tone.now());
    }

    async start() {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
    }

    play() {
        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }
    }

    stop() {
        Tone.Transport.stop();
        this.synth.releaseAll();
        // Reset transport position and part state.
        Tone.Transport.position = 0;
        this.part?.stop(0); 
        this.onTick(null);
    }
    
    // NEW private method for rebuilding the schedule
    _rebuildPart() {
        // 1. Clean up existing part
        if (this.part) {
            this.part.clear();
            this.part.dispose();
            this.part = null;
        }

        // 2. Handle empty progression
        if (this.progression.length === 0) {
            Tone.Transport.loopEnd = 0;
            this.onTick(null);
            return;
        }

        // 3. Build events array
        const allEvents: any[] = [];
        let accumulatedBeats = 0;
        const timeSignature = 4;

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
                allEvents.push({
                    time: eventStart,
                    notes: notes,
                    noteDuration: chordDurationInBeats,
                    id: chord.id,
                });
                accumulatedBeats += chordDurationInBeats;
            }
        }

        // 4. Create and configure the new part
        this.part = new Tone.Part((time, value) => {
            if (typeof value.noteDuration !== 'number') return;
            const durationInSeconds = (60 / Tone.Transport.bpm.value) * value.noteDuration;

            if (value.note) {
                this.synth.triggerAttackRelease(value.note, durationInSeconds, time);
            } else if (value.notes && value.notes.length > 0) {
                this.synth.triggerAttackRelease(value.notes, durationInSeconds, time);
            }
            Tone.Draw.schedule(() => {
                this.onTick(value.id);
            }, time);
        }, allEvents).start(0);
        
        // 5. Set loop properties
        const totalBars = Math.floor(accumulatedBeats / timeSignature);
        const totalBeatsRemainder = accumulatedBeats % timeSignature;
        Tone.Transport.loopEnd = `${totalBars}:${totalBeatsRemainder}:0`;
        this.part.loop = false; // The Transport handles looping, not the part itself.
    }

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
                // Resume from where it was.
                Tone.Transport.start(Tone.now(), currentPosition);
            }
        }
    }
    
    setSynth(synthType: string, initialSettings: any) {
        if (this.currentSynthType === synthType) {
            return;
        }

        const wasPlaying = Tone.Transport.state === 'started';
        const currentPosition = Tone.Transport.position;

        if (wasPlaying) {
            Tone.Transport.pause();
        }

        // CRITICAL FIX: Dispose of the Part that schedules events for the old synth *before* disposing the synth itself.
        // This prevents a race condition where a scheduled event tries to access the already-disposed synth.
        if (this.part) {
            this.part.clear();
            this.part.dispose();
            this.part = null;
        }
        
        // Now it's safe to release hanging notes and dispose the old synth.
        this.synth.releaseAll();
        this.synth.dispose();
        
        this.currentSynthType = synthType;
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

        this.synth = new Tone.PolySynth(voice, voiceOptions).connect(this.reverb);
        if (volume !== undefined) {
            this.synth.volume.value = volume;
        }
        
        // Rebuild the part with the new synth. Since this.part is null, it will just create a new one.
        this._rebuildPart();
        
        if (wasPlaying) {
            Tone.Transport.start(Tone.now(), currentPosition);
        }
    }

    setTempo(bpm: number) {
        Tone.Transport.bpm.value = bpm;
    }

    setGain(value: number) {
        this.gainNode.gain.value = value;
    }

    setReverbWet(value: number) {
        this.reverb.wet.value = value;
    }

    setReverbTime(value: number) {
        this.reverb.decay = value;
        this.reverb.preDelay = value * 0.03;
    }

    setArpeggiator(active: boolean, timing: string, repeats: number) {
        this.isArpeggiatorActive = active;
        this.arpeggiatorTiming = timing;
        this.arpeggiatorRepeats = repeats;
    }

    updateVoiceSettings(settings: any) {
        const { volume, ...voiceSettings } = settings;
        if (volume !== undefined && this.synth.volume) {
            this.synth.volume.value = volume;
        }
        this.synth.set(voiceSettings);
    }
    
    setLoop(loop: boolean) {
        Tone.Transport.loop = loop;
    }

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
