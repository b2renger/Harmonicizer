import React from 'react';
import './ProgressionAnalyzer.css';
import { getDisplayChordName, getAbbreviatedNameFromNotes } from '../../theory/chords';
import type { Chord } from '../../modes/composer/Composer';
// FIX: Changed type-only import to a value import to allow use with `typeof` for ReturnType.
import { getSuggestionsForChord, getHarmonicTheoryForChord } from '../../theory/analysis';
import CollapsibleSection from '../CollapsibleSection/CollapsibleSection';

interface AnalysisResults {
    chordFrequency: Record<string, number>;
    detectedPatterns: { name: string; chords: string[] }[];
    analysis: {
        richnessScore: number;
        consonanceScore: number;
        richnessTags: string[];
        consonanceTags: string[];
    };
    hints: {
        scaleNotes: string[];
        modeInfo: { name: string; description: string };
        diatonicChords: { name: string; roman: string }[];
        borrowedChords: { name: string; roman: string }[];
    };
}

interface SuggestionContextChord {
    name: string | null;
    notes: string[];
}

interface ProgressionAnalyzerProps {
    analysis: AnalysisResults;
    onAddChords: (chords: string[]) => void;
    suggestions: {
        categorized: ReturnType<typeof getSuggestionsForChord>;
        // FIX: Corrected a typo from `typeof typeof` to a single `typeof`.
        harmonicTheory: ReturnType<typeof getHarmonicTheoryForChord>;
    };
    suggestionContextChord: SuggestionContextChord | null;
}

const ScoreDial: React.FC<{ score: number }> = ({ score }) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    const scoreColor = score > 66 ? '#4facfe' : score > 33 ? '#ffbd6a' : '#e52e71';

    return (
        <div className="richness-score-wrapper">
            <svg className="richness-score-svg" viewBox="0 0 120 120">
                <circle
                    className="score-background"
                    cx="60"
                    cy="60"
                    r={radius}
                />
                <circle
                    className="score-foreground"
                    cx="60"
                    cy="60"
                    r={radius}
                    stroke={scoreColor}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
                <text x="50%" y="50%" className="richness-score-text" dominantBaseline="middle" textAnchor="middle">
                    {score}
                </text>
            </svg>
        </div>
    );
};


const ProgressionAnalyzer: React.FC<ProgressionAnalyzerProps> = ({ 
    analysis, 
    onAddChords,
    suggestions,
    suggestionContextChord
}) => {
    const { hints, analysis: progressionAnalysis } = analysis;
    const { harmonicTheory } = suggestions;
    
    return (
        <div className="progression-analyzer" aria-live="polite">
            <div className="analysis-grid">
                <section className="analysis-cell analysis-cell-left">
                    <h3>Key & Mode Info</h3>
                     <div className="mode-info">
                        <h4>{hints.modeInfo.name} Mode</h4>
                        <p>{hints.modeInfo.description}</p>
                        
                        <h4 className="info-subheader">Scale Degrees</h4>
                        <div className="scale-notes">
                            {hints.scaleNotes.map(note => <span key={note} className="note-chip">{note}</span>)}
                        </div>
                    </div>

                    <CollapsibleSection title="Diatonic Chords" defaultOpen={true}>
                        <div className="chord-info-grid">
                            {hints.diatonicChords.map(({ name, roman }) => (
                                <div 
                                    key={name} 
                                    className="chord-info-chip interactive"
                                    onClick={() => onAddChords([name])}
                                    role="button"
                                    tabIndex={0}
                                    onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && onAddChords([name])}
                                    aria-label={`Add ${getDisplayChordName(name)} chord`}
                                >
                                    <span className="chord-info-name">{getDisplayChordName(name)}</span>
                                    <span className="chord-info-roman">{roman}</span>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    {hints.borrowedChords.length > 0 && (
                        <CollapsibleSection title="Borrowed Chords">
                            <div className="chord-info-grid">
                                {hints.borrowedChords.map(({ name, roman }) => (
                                    <div 
                                        key={name} 
                                        className="chord-info-chip interactive"
                                        onClick={() => onAddChords([name])}
                                        role="button"
                                        tabIndex={0}
                                        onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && onAddChords([name])}
                                        aria-label={`Add ${getDisplayChordName(name)} chord`}
                                    >
                                        <span className="chord-info-name">{getDisplayChordName(name)}</span>
                                        <span className="chord-info-roman">{roman}</span>
                                    </div>
                                ))}
                            </div>
                        </CollapsibleSection>
                    )}
                </section>
                <div className="analysis-cell-right">
                    <section className="analysis-cell">
                        <h3>Harmonic Movement</h3>
                        {suggestionContextChord && suggestionContextChord.name ? (
                            <div className="harmonic-theory-section">
                                <h4 className="suggestion-header">
                                    From {getAbbreviatedNameFromNotes(suggestionContextChord.notes)}
                                </h4>
                                {harmonicTheory ? (
                                    <>
                                        <p className="harmonic-summary">{harmonicTheory.summary}</p>
                                        <ul className="harmonic-movements-list">
                                            {harmonicTheory.movements.map(movement => (
                                                <li key={movement.name} className="harmonic-movement-item">
                                                    <div className="movement-header">
                                                        <span className="movement-name">{movement.name}</span>
                                                        <button 
                                                            className="add-movement-button"
                                                            onClick={() => onAddChords(movement.chordsToAdd)}
                                                        >
                                                            Add: {movement.chordsToAdd.map(getDisplayChordName).join(', ')}
                                                        </button>
                                                    </div>
                                                    <p className="movement-description">{movement.description}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                ) : (
                                    <p className="placeholder-text">This chord is chromatic or outside the current key. Try experimenting!</p>
                                )}
                            </div>
                        ) : (
                            <p className="placeholder-text">Select a chord in the grid to see theory and suggestions for harmonic movement.</p>
                        )}
                    </section>
                    <section className="analysis-cell">
                        <h3>Progression Characteristics</h3>
                        <div className="scores-container">
                            <div className="score-item">
                                <h4>Harmonic Richness</h4>
                                <ScoreDial score={progressionAnalysis.richnessScore} />
                                <div className="richness-tags">
                                    {progressionAnalysis.richnessTags.map(tag => (
                                        <span key={tag} className="richness-tag">{tag}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="score-item">
                                <h4>Consonance Score</h4>
                                <ScoreDial score={progressionAnalysis.consonanceScore} />
                                <div className="richness-tags">
                                    {progressionAnalysis.consonanceTags.map(tag => (
                                        <span key={tag} className="richness-tag">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ProgressionAnalyzer;