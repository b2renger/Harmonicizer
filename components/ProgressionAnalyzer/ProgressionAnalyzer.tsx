import React from 'react';
import './ProgressionAnalyzer.css';
import { getDisplayChordName } from '../../theory/chords';

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
    };
}

interface ProgressionAnalyzerProps {
    analysis: AnalysisResults;
}

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


const ProgressionAnalyzer: React.FC<ProgressionAnalyzerProps> = ({ analysis }) => {
    const { chordFrequency, detectedPatterns, hints, richnessAnalysis } = analysis;

    const sortedFrequency = Object.entries(chordFrequency).sort(([, a], [, b]) => b - a);

    return (
        <div className="progression-analyzer" aria-live="polite">
            <h2>Harmonic Analysis</h2>
            <div className="analysis-sections">
                <section>
                    <h3>Chord Frequency</h3>
                    {sortedFrequency.length > 0 ? (
                        <ul className="frequency-list">
                            {sortedFrequency.map(([name, count]) => (
                                <li key={name}>
                                    <span className="chord-name">{getDisplayChordName(name)}</span>
                                    <span className="chord-count">x{count}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="placeholder-text">Add some chords to see frequency analysis.</p>
                    )}
                </section>
                <section>
                    <h3>Detected Patterns</h3>
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
                </section>
                <section>
                    <h3>Harmonic Richness</h3>
                    <RichnessScore score={richnessAnalysis.score} />
                    <div className="richness-tags">
                        {richnessAnalysis.tags.map(tag => (
                            <span key={tag} className="richness-tag">{tag}</span>
                        ))}
                    </div>
                </section>
                <section>
                    <h3>Key & Mode Info</h3>
                    <div className="hints-section">
                        <h4>{hints.modeInfo.name} Mode</h4>
                        <p>{hints.modeInfo.description}</p>
                        <div className="scale-notes">
                            {hints.scaleNotes.map(note => <span key={note} className="note-chip">{note}</span>)}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ProgressionAnalyzer;
