import React from 'react';
import './ProgressionAnalyzer.css';
import { getDisplayChordName } from '../../theory/chords';
import type { Chord } from '../../modes/composer/Composer';
import type { getSuggestionsForChord, getPatternSuggestionsForChord } from '../../theory/analysis';

interface AnalysisResults {
    chordFrequency: Record<string, number>;
    detectedPatterns: { name: string; chords: string[] }[];
    richnessAnalysis: {
        score: number;
        tags: string[];
    };
    hints: {
        scaleNotes: string[];
        modeInfo: { name: string; description: string };
        diatonicChords: { name: string; roman: string }[];
        borrowedChords: { name: string; roman: string }[];
    };
}

interface ProgressionAnalyzerProps {
    analysis: AnalysisResults;
    onAddSuggestedChords: (chords: string[]) => void;
    suggestions: {
        categorized: ReturnType<typeof getSuggestionsForChord>;
        patterns: ReturnType<typeof getPatternSuggestionsForChord>;
    };
    suggestionContextChord: Chord | null;
}

const SuggestionCategory: React.FC<{ title: string; chords: string[]; onAdd: (name: string) => void }> = ({ title, chords, onAdd }) => {
    if (!chords || chords.length === 0) return null;
    return (
        <div className="suggestion-category">
            <h5>{title}</h5>
            <div className="suggestion-grid">
                {chords.map(chordName => (
                    <button key={chordName} onClick={() => onAdd(chordName)} className="suggestion-button">
                        {getDisplayChordName(chordName)}
                    </button>
                ))}
            </div>
        </div>
    );
};

const RichnessScore: React.FC<{ score: number }> = ({ score }) => {
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
    onAddSuggestedChords,
    suggestions,
    suggestionContextChord
}) => {
    const { detectedPatterns, hints, richnessAnalysis } = analysis;
    const { categorized, patterns } = suggestions;

    const hasCategorizedSuggestions = Object.values(categorized).some(arr => arr.length > 0);
    const hasSuggestions = hasCategorizedSuggestions || patterns.length > 0;
    
    return (
        <div className="progression-analyzer" aria-live="polite">
            <div className="analysis-grid">
                <section className="analysis-cell">
                    <h3>Key & Mode Info</h3>
                    <div className="hints-section">
                        <h4>{hints.modeInfo.name} Mode</h4>
                        <p>{hints.modeInfo.description}</p>
                        
                        <h4 className="info-subheader">Scale Degrees</h4>
                        <div className="scale-notes">
                            {hints.scaleNotes.map(note => <span key={note} className="note-chip">{note}</span>)}
                        </div>

                        <h4 className="info-subheader">Diatonic Chords</h4>
                        <div className="chord-info-grid">
                            {hints.diatonicChords.map(({ name, roman }) => (
                                <div key={name} className="chord-info-chip">
                                    <span className="chord-info-name">{getDisplayChordName(name)}</span>
                                    <span className="chord-info-roman">{roman}</span>
                                </div>
                            ))}
                        </div>

                        {hints.borrowedChords.length > 0 && (
                            <>
                                <h4 className="info-subheader">Borrowed Chords</h4>
                                <div className="chord-info-grid">
                                    {hints.borrowedChords.map(({ name, roman }) => (
                                        <div key={name} className="chord-info-chip">
                                            <span className="chord-info-name">{getDisplayChordName(name)}</span>
                                            <span className="chord-info-roman">{roman}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </section>
                <section className="analysis-cell">
                    <h3>Harmonic Patterns</h3>
                    
                    <h4>Detected</h4>
                    {detectedPatterns.length > 0 ? (
                        <ul className="patterns-list">
                            {detectedPatterns.map((pattern, index) => (
                                <li key={`${pattern.name}-${index}`}>
                                    <span className="pattern-name">{pattern.name}</span>
                                    <span className="pattern-chords">{pattern.chords.map(name => getDisplayChordName(name)).join(' → ')}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="placeholder-text">No common patterns detected yet.</p>
                    )}

                    <h4 className="suggestion-header">
                        Next Chord Ideas
                        {suggestionContextChord && suggestionContextChord.name !== 'Rest' && (
                            <span className="suggestion-context"> after {getDisplayChordName(suggestionContextChord.name)}</span>
                        )}
                    </h4>
                    {!hasSuggestions ? (
                         <p className="placeholder-text">Add a chord or select one to see suggestions.</p>
                    ) : (
                        <div className="suggestions-container">
                            <SuggestionCategory title="Coherent" chords={categorized.coherent} onAdd={(name) => onAddSuggestedChords([name])} />
                            <SuggestionCategory title="Jazzy" chords={categorized.jazzy} onAdd={(name) => onAddSuggestedChords([name])} />
                            <SuggestionCategory title="Classical" chords={categorized.classical} onAdd={(name) => onAddSuggestedChords([name])} />
                            <SuggestionCategory title="Inventive" chords={categorized.inventive} onAdd={(name) => onAddSuggestedChords([name])} />
                            
                            {patterns.length > 0 && (
                                <div className="suggestion-category">
                                    <h5>Pattern Completions</h5>
                                    <ul className="patterns-list suggestions-list">
                                        {patterns.map((suggestion, index) => (
                                            <li key={`${suggestion.name}-${index}`} className="suggestion-item">
                                                <div className="suggestion-info">
                                                    <span className="pattern-name">{suggestion.name}</span>
                                                    <span className="pattern-chords">
                                                        Add: {suggestion.chordsToAdd.map(name => getDisplayChordName(name)).join(' → ')}
                                                    </span>
                                                </div>
                                                <button 
                                                    className="add-suggestion-button" 
                                                    onClick={() => onAddSuggestedChords(suggestion.chordsToAdd)}
                                                    aria-label={`Add suggested chords for ${suggestion.name}`}
                                                >
                                                    Add
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </section>
                <section className="analysis-cell">
                    <h3>Harmonic Richness</h3>
                    <RichnessScore score={richnessAnalysis.score} />
                    <div className="richness-tags">
                        {richnessAnalysis.tags.map(tag => (
                            <span key={tag} className="richness-tag">{tag}</span>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ProgressionAnalyzer;