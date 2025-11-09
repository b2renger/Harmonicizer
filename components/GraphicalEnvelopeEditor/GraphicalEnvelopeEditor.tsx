import React from 'react';
import './GraphicalEnvelopeEditor.css';
import Knob from '../Knob/Knob.tsx';
import ADSRGraph from '../ADSRGraph/ADSRGraph.tsx';

const GraphicalEnvelopeEditor = (props) => {
    
    const renderSynthSpecificKnobs = () => {
        switch (props.synthType) {
            case 'Rhodes':
                return (
                    <div className="synth-parameters-content">
                        <h4>Parameters</h4>
                        <div className="knob-grid">
                            <Knob label="Harmonicity" value={props.rhodesSettings.harmonicity} min={0.5} max={10} step={0.1} onChange={(v) => props.onRhodesSettingsChange(s => ({ ...s, harmonicity: v }))} />
                            <Knob label="Mod Index" value={props.rhodesSettings.modulationIndex} min={1} max={40} step={0.5} onChange={(v) => props.onRhodesSettingsChange(s => ({ ...s, modulationIndex: v }))} />
                            <Knob label="Volume" value={props.rhodesSettings.volume} min={-40} max={6} step={0.1} onChange={(v) => props.onRhodesSettingsChange(s => ({ ...s, volume: v }))} unit="dB" />
                        </div>
                    </div>
                );
            
            case 'MoogLead':
            case 'MoogBass':
                const settings = props.synthType === 'MoogLead' ? props.moogLeadSettings : props.moogBassSettings;
                const setSettings = props.synthType === 'MoogLead' ? props.onMoogLeadSettingsChange : props.onMoogBassSettingsChange;
                
                const handleFilterEnvelopeChange = (newEnv) => {
                    setSettings(s => ({
                        ...s,
                        filterAttack: newEnv.attack,
                        filterDecay: newEnv.decay,
                        filterSustain: newEnv.sustain,
                        filterRelease: newEnv.release
                    }));
                };

                 return (
                    <div className="synth-parameters-content moog-layout">
                        <div className="moog-filter-params">
                            <h4>Filter</h4>
                            <div className="knob-grid">
                                <Knob label="Cutoff" value={settings.filterCutoff} min={100} max={10000} step={10} onChange={(v) => setSettings(s => ({ ...s, filterCutoff: v }))} unit="Hz"/>
                                <Knob label="Resonance" value={settings.filterResonance} min={0} max={10} step={0.1} onChange={(v) => setSettings(s => ({ ...s, filterResonance: v }))} />
                                <Knob label="Volume" value={settings.volume} min={-40} max={6} step={0.1} onChange={(v) => setSettings(s => ({ ...s, volume: v }))} unit="dB"/>
                            </div>
                        </div>
                         <div className="moog-filter-env">
                            <h4>Filter Envelope</h4>
                             <ADSRGraph
                                envelope={{
                                    attack: settings.filterAttack,
                                    decay: settings.filterDecay,
                                    sustain: settings.filterSustain,
                                    release: settings.filterRelease,
                                }}
                                onEnvelopeChange={handleFilterEnvelopeChange}
                            />
                        </div>
                    </div>
                );

            case 'VCS3Drone':
            case 'VCS3FX':
                const vcs3_settings = props.synthType === 'VCS3Drone' ? props.vcs3DroneSettings : props.vcs3FxSettings;
                const set_vcs3_Settings = props.synthType === 'VCS3Drone' ? props.onVcs3DroneSettingsChange : props.onVcs3FxSettingsChange;
                return (
                     <div className="synth-parameters-content">
                        <h4>Parameters</h4>
                         <div className="knob-grid">
                            <Knob label="Harmonicity" value={vcs3_settings.harmonicity} min={0.1} max={10} step={0.1} onChange={(v) => set_vcs3_Settings(s => ({ ...s, harmonicity: v }))} />
                            <Knob label="Mod Index" value={vcs3_settings.modulationIndex} min={1} max={40} step={0.5} onChange={(v) => set_vcs3_Settings(s => ({ ...s, modulationIndex: v }))} />
                            <Knob label="Volume" value={vcs3_settings.volume} min={-40} max={6} step={0.1} onChange={(v) => set_vcs3_Settings(s => ({ ...s, volume: v }))} unit="dB"/>
                        </div>
                    </div>
                );
            case 'FMSynth':
                return (
                    <div className="synth-parameters-content">
                        <h4>Parameters</h4>
                        <div className="knob-grid">
                            <Knob label="Harmonicity" value={props.fmSettings.harmonicity} min={0.5} max={10} step={0.1} onChange={(v) => props.onFmSettingsChange(s => ({ ...s, harmonicity: v }))} />
                            <Knob label="Mod Index" value={props.fmSettings.modulationIndex} min={1} max={40} step={0.5} onChange={(v) => props.onFmSettingsChange(s => ({ ...s, modulationIndex: v }))} />
                            <Knob label="Volume" value={props.fmSettings.volume} min={-40} max={6} step={0.1} onChange={(v) => props.onFmSettingsChange(s => ({ ...s, volume: v }))} unit="dB"/>
                        </div>
                    </div>
                );
            case 'AMSynth':
                return (
                     <div className="synth-parameters-content">
                        <h4>Parameters</h4>
                         <div className="knob-grid">
                            <Knob label="Harmonicity" value={props.amSettings.harmonicity} min={0.5} max={10} step={0.1} onChange={(v) => props.onAmSettingsChange(s => ({ ...s, harmonicity: v }))} />
                             <div className="control-group select-group">
                                 <label htmlFor="amModType">Mod Type</label>
                                <select id="amModType" value={props.amSettings.modulationType} onChange={(e) => props.onAmSettingsChange(s => ({ ...s, modulationType: e.target.value }))}>
                                    <option value="sine">Sine</option>
                                    <option value="square">Square</option>
                                    <option value="sawtooth">Sawtooth</option>
                                    <option value="triangle">Triangle</option>
                                </select>
                            </div>
                            <Knob label="Volume" value={props.amSettings.volume} min={-40} max={6} step={0.1} onChange={(v) => props.onAmSettingsChange(s => ({ ...s, volume: v }))} unit="dB"/>
                        </div>
                    </div>
                );
            case 'Synth':
                return (
                    <div className="synth-parameters-content">
                        <h4>Parameters</h4>
                        <div className="knob-grid">
                            <Knob label="Volume" value={props.basicSynthSettings.volume} min={-40} max={6} step={0.1} onChange={(v) => props.onBasicSynthSettingsChange(s => ({ ...s, volume: v }))} unit="dB"/>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const getCurrentEnvelope = () => {
        switch (props.synthType) {
            case 'Rhodes': return props.rhodesSettings.envelope;
            case 'MoogLead': return props.moogLeadSettings.envelope;
            case 'MoogBass': return props.moogBassSettings.envelope;
            case 'VCS3Drone': return props.vcs3DroneSettings.envelope;
            case 'VCS3FX': return props.vcs3FxSettings.envelope;
            case 'FMSynth': return props.fmSettings.envelope;
            case 'AMSynth': return props.amSettings.envelope;
            case 'Synth': return props.basicSynthSettings.envelope;
            default: return { attack: 0, decay: 0, sustain: 0, release: 0 };
        }
    };
    
    const onEnvelopeChange = (newEnvelope) => {
        switch (props.synthType) {
            case 'Rhodes': props.onRhodesSettingsChange(s => ({ ...s, envelope: newEnvelope })); break;
            case 'MoogLead': props.onMoogLeadSettingsChange(s => ({ ...s, envelope: newEnvelope })); break;
            case 'MoogBass': props.onMoogBassSettingsChange(s => ({ ...s, envelope: newEnvelope })); break;
            case 'VCS3Drone': props.onVcs3DroneSettingsChange(s => ({ ...s, envelope: newEnvelope })); break;
            case 'VCS3FX': props.onVcs3FxSettingsChange(s => ({ ...s, envelope: newEnvelope })); break;
            case 'FMSynth': props.onFmSettingsChange(s => ({ ...s, envelope: newEnvelope })); break;
            case 'AMSynth': props.onAmSettingsChange(s => ({ ...s, envelope: newEnvelope })); break;
            case 'Synth': props.onBasicSynthSettingsChange(s => ({ ...s, envelope: newEnvelope })); break;
        }
    };
    
    return (
        <div className="graphical-envelope-editor">
             <div className="synth-selector">
                <label htmlFor="synth">Synth:</label>
                <select 
                    id="synth" 
                    name="synth" 
                    value={props.synthType}
                    onChange={(e) => props.onSynthChange(e.target.value)}
                >
                    <option value="Rhodes">Rhodes EP</option>
                    <option value="MoogLead">Moog Lead</option>
                    <option value="MoogBass">Moog Bass</option>
                    <option value="VCS3Drone">VCS3 Drone</option>
                    <option value="VCS3FX">VCS3 FX</option>
                    <option value="FMSynth">FM Synth</option>
                    <option value="AMSynth">AM Synth</option>
                    <option value="Synth">Basic Synth</option>
                </select>
            </div>

            <div className="synth-main-panel">
                <div className="synth-parameters-panel">
                    {renderSynthSpecificKnobs()}
                </div>
                <div className="amplitude-envelope-panel">
                    <h4>Amplitude Envelope</h4>
                    <ADSRGraph envelope={getCurrentEnvelope()} onEnvelopeChange={onEnvelopeChange} />
                </div>
            </div>

            <div className="global-controls-panel">
                 <div className="arpeggiator-controls">
                    <label className="arpeggiator-toggle-label">Arpeggiator:</label>
                    <button
                        className={`arpeggiator-toggle-button ${props.isArpeggiatorActive ? 'active' : ''}`}
                        onClick={props.onArpeggiatorToggle}
                        aria-pressed={props.isArpeggiatorActive}
                        aria-label="Toggle Arpeggiator"
                    >
                        {props.isArpeggiatorActive ? 'ON' : 'OFF'}
                    </button>

                    <label htmlFor="arpeggiatorTiming">Timing:</label>
                    <select
                        id="arpeggiatorTiming"
                        name="arpeggiatorTiming"
                        value={props.arpeggiatorTiming}
                        onChange={(e) => props.onArpeggiatorTimingChange(e.target.value)}
                        aria-label="Arpeggiator Timing"
                        disabled={!props.isArpeggiatorActive}
                    >
                        <option value="4n">1/4 note</option>
                        <option value="8n">1/8 note</option>
                        <option value="8t">1/8 triplet</option>
                        <option value="16n">1/16 note</option>
                        <option value="16t">1/16 triplet</option>
                        <option value="32n">1/32 note</option>
                    </select>

                    <label htmlFor="arpeggiatorRepeats">Repeats:</label>
                    <input
                        id="arpeggiatorRepeats"
                        type="number"
                        className="arpeggiator-input"
                        value={isFinite(props.arpeggiatorRepeats) ? props.arpeggiatorRepeats : ''}
                        onChange={(e) => {
                            const value = e.target.value;
                            props.onArpeggiatorRepeatsChange(value === '' ? Infinity : Math.max(1, parseInt(value, 10) || 1));
                        }}
                        placeholder="∞"
                        min="1"
                        step="1"
                        disabled={!props.isArpeggiatorActive}
                        aria-label="Arpeggiator Repeats"
                    />
                </div>
                <div className="effect-controls">
                    <Knob label="Reverb Mix" value={props.reverbWet * 100} min={0} max={100} step={1} onChange={(v) => props.onReverbWetChange(v / 100)} unit="%"/>
                    <Knob label="Reverb Time" value={props.reverbTime} min={0.5} max={10} step={0.1} onChange={props.onReverbTimeChange} unit="s"/>
                    <Knob label="Master Gain" value={props.masterGain} min={0} max={2} step={0.01} onChange={props.onMasterGainChange} />
                </div>
            </div>
        </div>
    );
};

export default GraphicalEnvelopeEditor;