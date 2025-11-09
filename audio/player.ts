import * as Tone from 'tone';
import { Chord as TonalChord } from 'tonal';
import type { Chord } from '../modes/composer/Composer';
import { getChordNotesWithOctaves } from '../theory/chords';

export type SynthType = 'FMSynth' | 'AMSynth' | 'Synth' | 'Rhodes';

export interface EnvelopeSettings {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
}

export class Player {
    private synth: Tone.PolySynth;
    private part: Tone.Part | null = null;
    private onTick: (id: string | null) => void;
    private envelopeSettings: EnvelopeSettings = { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 };
    private gainNode: Tone.Gain;
    private reverb: Tone.Reverb;
    private isArpeggiatorActive: boolean = false;
    private arpeggiatorTiming: Tone.Unit.Time = '16n';
    private arpeggiatorRepeats: number = Infinity;
    private progression: Chord[] = []; // Store progression to rebuild Tone.Part


    constructor(onTick: (id: string | null) => void) {
        console.log('Player constructor called.');
        
        // Initialize effects and connect them to the destination
        this.gainNode = new Tone.Gain(0.8).toDestination(); // Master Gain -> Destination
        this.reverb = new Tone.Reverb({ decay: 1.5, wet: 0.2, preDelay: 0.05 }).connect(this.gainNode); // Reverb -> Gain

        // Initialized to a basic synth, will be overridden by setSynth in Composer useEffect
        this.synth = new Tone.PolySynth(Tone.Synth).connect(this.reverb); // Synth -> Reverb
        this.setEnvelope(this.envelopeSettings); // Apply default envelope
        this.onTick = onTick;
    }

    playOneShot(chordName: string, octave: number) {
        if (Tone.context.state !== 'running') {
            Tone.start();
        }
        if (chordName === 'Rest') return;
        
        const notes = getChordNotesWithOctaves(chordName, octave);
        if (notes.length > 0) {
            // Use an eighth note's duration relative to the current tempo for a musical preview
            this.synth.triggerAttackRelease(notes, "8n", Tone.now());
        }
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
        this.synth.releaseAll(); // Immediately stop any sounding notes
        // Go back to the beginning
        Tone.Transport.position = 0;
        if(this.part) {
            this.part.stop(0);
            // Re-add events so they play next time
            this.part.start(0);
        }
        this.onTick(null);
    }

    setProgression(progression: Chord[]) {
        const wasPlaying = Tone.Transport.state === 'started';
        const currentPosition = Tone.Transport.position;

        // Pause the transport to safely swap out the Part
        if (wasPlaying) {
            Tone.Transport.pause();
        }

        this.progression = progression; // Store the progression
        console.log('Player.setProgression called with:', progression);
        if (this.part) {
            this.part.clear();
            this.part.dispose();
            this.part = null; // Clear reference after disposing
        }

        if (progression.length === 0) {
            Tone.Transport.loopEnd = 0;
            this.onTick(null);
            if (wasPlaying) {
                // If it was playing, now it's an empty progression, so stop it.
                this.stop();
            }
            return;
        }

        const allEvents: Array<{ time: Tone.Unit.Time; id: string; notes?: string[]; note?: string; duration: Tone.Unit.Time | number }> = [];
        let accumulatedBeats = 0;
        const timeSignature = 4; // Assuming 4/4 time

        for (const chord of progression) {
            const bars = Math.floor(accumulatedBeats / timeSignature);
            const beats = accumulatedBeats % timeSignature;
            const eventStart = `${bars}:${beats}:0`;
            const chordDurationInBeats = chord.duration;
            
            const notes = getChordNotesWithOctaves(chord.name, chord.octave);

            if (chord.name === 'Rest' || notes.length === 0) {
                // For rests or chords with no notes, simply advance time
                allEvents.push({ time: eventStart, id: chord.id, duration: chordDurationInBeats });
                accumulatedBeats += chordDurationInBeats;
                continue;
            }

            if (this.isArpeggiatorActive) {
                const arpeggioTimingAsSeconds = Tone.Time(this.arpeggiatorTiming).toSeconds();
                const beatDuration = 60 / Tone.Transport.bpm.value;
                const arpeggioTimingInBeats = arpeggioTimingAsSeconds / beatDuration;
                
                if (arpeggioTimingInBeats <= 0) { // Avoid infinite loop if timing is invalid
                    accumulatedBeats += chordDurationInBeats;
                    continue;
                }

                const finalNoteDuration = Math.max(arpeggioTimingAsSeconds * 0.8, 0.05);
                const chordStartBeats = accumulatedBeats;
                const chordEndBeats = chordStartBeats + chordDurationInBeats;

                const maxRepetitions = this.arpeggiatorRepeats * notes.length; // Max number of notes to play
                let notesPlayedInArpeggio = 0;

                let noteIndex = 0;
                for (let currentTimeInBeats = chordStartBeats; currentTimeInBeats < chordEndBeats; currentTimeInBeats += arpeggioTimingInBeats) {
                    if (notesPlayedInArpeggio >= maxRepetitions) {
                        break; // Stop if we've played enough notes
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
                // Schedule full chord
                allEvents.push({
                    time: eventStart,
                    notes: notes,
                    duration: chordDurationInBeats, // Duration in beats for triggerAttackRelease calculation
                    id: chord.id,
                });
                accumulatedBeats += chordDurationInBeats;
            }
        }

        this.part = new Tone.Part((time, value) => {
            if (value.note) { // Individual arpeggiated note
                // `value.duration` for arpeggiated notes is now always a number (seconds)
                this.synth.triggerAttackRelease(value.note, value.duration, time);
            } else if (value.notes && value.notes.length > 0) { // Full chord
                // The duration for full chord is in beats, convert to seconds
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

        // Restart the transport from where it was
        if (wasPlaying) {
            Tone.Transport.start(Tone.now(), currentPosition);
        }
    }

    setTempo(bpm: number) {
        Tone.Transport.bpm.value = bpm;
    }

    setEnvelope(envelope: EnvelopeSettings) {
        this.envelopeSettings = envelope;
        this.synth.set({ envelope });
    }

    setGain(value: number) {
        this.gainNode.gain.value = value;
    }

    setReverbWet(value: number) {
        this.reverb.wet.value = value;
    }

    setReverbTime(value: number) {
        // Adjust decay and preDelay together for a coherent reverb sound
        this.reverb.decay = value;
        this.reverb.preDelay = value * 0.03; // Simple heuristic for preDelay relative to decay
    }

    setArpeggiator(active: boolean, timing: Tone.Unit.Time, repeats: number) {
        this.isArpeggiatorActive = active;
        this.arpeggiatorTiming = timing;
        this.arpeggiatorRepeats = repeats;
        // The Tone.Part needs to be rebuilt whenever arpeggiator settings change
        // This is handled in Composer.tsx by calling setProgression on change.
    }
    
    setSynth(synthType: SynthType) {
        const wasPlaying = Tone.Transport.state === 'started';
        if (wasPlaying) {
            Tone.Transport.pause();
        }

        this.synth.releaseAll();
        this.synth.dispose();
        
        if (synthType === 'Rhodes') {
            this.synth = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 3.01,
                modulationIndex: 14,
                modulationEnvelope: {
                    attack: 0.002,
                    decay: 0.2,
                    sustain: 0,
                    release: 0.2
                }
            }).connect(this.reverb); // Connect new synth to reverb
        } else {
            this.synth = new Tone.PolySynth(Tone[synthType] as any).connect(this.reverb); // Connect new synth to reverb
        }
        
        // Always apply the stored envelope settings to the new synth
        this.setEnvelope(this.envelopeSettings);
        
        if (wasPlaying) {
            Tone.Transport.start();
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
        this.synth.dispose();
        if (this.part) {
            this.part.dispose();
        }
        this.gainNode.dispose();
        this.reverb.dispose();
        Tone.Transport.cancel();
    }
}