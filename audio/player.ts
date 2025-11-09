import * as Tone from 'tone';
import type { Chord } from '../modes/composer/Composer';

export type SynthType = 'Rhodes' | 'MoogLead' | 'MoogBass' | 'VCS3Drone' | 'VCS3FX' | 'FMSynth' | 'AMSynth' | 'Synth';

export interface EnvelopeSettings {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
}

// Base settings for all synths
interface BaseSynthSettings {
    envelope: EnvelopeSettings;
    volume: number; // in decibels
}

export interface MoogSynthSettings extends BaseSynthSettings {
    filterCutoff: number;
    filterResonance: number;
    filterAttack: number;
    filterDecay: number;
    filterSustain: number;
    filterRelease: number;
}

export interface VCS3SynthSettings extends BaseSynthSettings {
    harmonicity: number;
    modulationIndex: number;
}

export interface RhodesSynthSettings extends BaseSynthSettings {
    harmonicity: number;
    modulationIndex: number;
}
export interface FMSynthSettings extends BaseSynthSettings {
    harmonicity: number;
    modulationIndex: number;
}

export interface AMSynthSettings extends BaseSynthSettings {
    harmonicity: number;
    modulationType: 'sine' | 'square' | 'sawtooth' | 'triangle';
}

export interface BasicSynthSettings extends BaseSynthSettings {}


export class Player {
    private synth: Tone.PolySynth<any>;
    private part: Tone.Part | null = null;
    private onTick: (id: string | null) => void;
    private gainNode: Tone.Gain;
    private reverb: Tone.Reverb;
    private isArpeggiatorActive: boolean = false;
    private arpeggiatorTiming: Tone.Unit.Time = '16n';
    private arpeggiatorRepeats: number = Infinity;
    private progression: Chord[] = [];

    private currentSynthType: SynthType = 'Rhodes';

    constructor(onTick: (id: string | null) => void) {
        this.gainNode = new Tone.Gain(0.8).toDestination();
        this.reverb = new Tone.Reverb({ decay: 1.5, wet: 0.2, preDelay: 0.05 }).connect(this.gainNode);
        this.synth = new Tone.PolySynth(Tone.FMSynth).connect(this.reverb);
        this.onTick = onTick;
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
        Tone.Transport.position = 0;
        if(this.part) {
            this.part.stop(0);
            this.part.start(0);
        }
        this.onTick(null);
    }

    setProgression(progression: Chord[]) {
        const wasPlaying = Tone.Transport.state === 'started';
        const currentPosition = Tone.Transport.position;

        if (wasPlaying) {
            Tone.Transport.pause();
        }

        this.progression = progression;
        if (this.part) {
            this.part.clear();
            this.part.dispose();
            this.part = null;
        }

        if (progression.length === 0) {
            Tone.Transport.loopEnd = 0;
            this.onTick(null);
            if (wasPlaying) {
                this.stop();
            }
            return;
        }

        const allEvents: Array<{ time: Tone.Unit.Time; id: string; notes?: string[]; note?: string; duration: Tone.Unit.Time | number }> = [];
        let accumulatedBeats = 0;
        const timeSignature = 4;

        for (const chord of progression) {
            const bars = Math.floor(accumulatedBeats / timeSignature);
            const beats = accumulatedBeats % timeSignature;
            const eventStart = `${bars}:${beats}:0`;
            const chordDurationInBeats = chord.duration;
            
            const notes = chord.notes;

            if (notes.length === 0) {
                allEvents.push({ time: eventStart, id: chord.id, duration: chordDurationInBeats });
                accumulatedBeats += chordDurationInBeats;
                continue;
            }

            if (this.isArpeggiatorActive) {
                const arpeggioTimingAsSeconds = Tone.Time(this.arpeggiatorTiming).toSeconds();
                const beatDuration = 60 / Tone.Transport.bpm.value;
                const arpeggioTimingInBeats = arpeggioTimingAsSeconds / beatDuration;
                
                if (arpeggioTimingInBeats <= 0) {
                    accumulatedBeats += chordDurationInBeats;
                    continue;
                }

                const finalNoteDuration = Math.max(arpeggioTimingAsSeconds * 0.8, 0.05);
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
                        duration: finalNoteDuration,
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
                    duration: chordDurationInBeats,
                    id: chord.id,
                });
                accumulatedBeats += chordDurationInBeats;
            }
        }

        this.part = new Tone.Part((time, value) => {
            if (value.note) {
                this.synth.triggerAttackRelease(value.note, value.duration, time);
            } else if (value.notes && value.notes.length > 0) {
                const durationInSeconds = (60 / Tone.Transport.bpm.value) * (value.duration as number);
                this.synth.triggerAttackRelease(value.notes, durationInSeconds, time);
            }
            Tone.Draw.schedule(() => {
                this.onTick(value.id);
            }, time);
        }, allEvents).start(0);
        
        const totalBars = Math.floor(accumulatedBeats / timeSignature);
        const totalBeatsRemainder = accumulatedBeats % timeSignature;
        Tone.Transport.loopEnd = `${totalBars}:${totalBeatsRemainder}:0`;

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

    setArpeggiator(active: boolean, timing: Tone.Unit.Time, repeats: number) {
        this.isArpeggiatorActive = active;
        this.arpeggiatorTiming = timing;
        this.arpeggiatorRepeats = repeats;
    }

    public updateVoiceSettings(settings: any) {
        const { volume, ...voiceSettings } = settings;
        if (volume !== undefined && this.synth.volume) {
            this.synth.volume.value = volume;
        }
        this.synth.set(voiceSettings);
    }
    
    setSynth(synthType: SynthType, initialSettings: any) {
        const wasPlaying = Tone.Transport.state === 'started';
        const currentPosition = Tone.Transport.position;

        if (wasPlaying) {
            Tone.Transport.pause();
        }
        
        Tone.Transport.cancel(0);
        
        if (this.part) {
            this.part.clear();
            this.part.dispose();
            this.part = null;
        }
        
        this.synth.releaseAll();
        this.synth.dispose();
        
        this.currentSynthType = synthType;

        // Separate volume from the voice-specific options
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
        
        this.setProgression(this.progression);
        
        if (wasPlaying) {
            Tone.Transport.start(Tone.now(), currentPosition);
        }
    }

    setLoop(loop: boolean) {
        if (this.part) {
            this.part.loop = loop;
        }
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
