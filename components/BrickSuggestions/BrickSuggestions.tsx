import React, { useMemo } from 'react';
import { suggestBricks } from '../../theory/bricks/suggest.js';
import type { Brick } from '../../theory/bricks/types.js';
import './BrickSuggestions.css';

interface BrickSuggestionsProps {
    /** The chord immediately before this slot, or null. */
    prev: string | null;
    /** The chord that will sound after this slot, or null. */
    next: string | null;
    musicalKey: string;
    musicalMode: string;
    onApply: (brick: Brick) => void;
    /** Wording for the action, since this is a replacement when editing. */
    actionLabel?: string;
    limit?: number;
}

/**
 * Bricks ranked by how well they fit this particular gap.
 *
 * The context line is shown deliberately: the ranking depends on both neighbours, and a
 * suggestion list whose reasoning is invisible is hard to trust or learn from.
 */
const BrickSuggestions: React.FC<BrickSuggestionsProps> = ({
    prev, next, musicalKey, musicalMode, onApply, actionLabel = 'Use', limit = 6,
}) => {
    const suggestions = useMemo(
        () => suggestBricks({ prev, next, key: musicalKey, mode: musicalMode }, { limit }),
        [prev, next, musicalKey, musicalMode, limit],
    );

    return (
        <div className="brick-suggestions">
            <p className="brick-suggestions-context">
                {prev ? <>after <strong>{prev}</strong></> : <>at the start</>}
                {' · '}
                {next ? <>before <strong>{next}</strong></> : <>nothing after</>}
            </p>

            <ul className="brick-suggestions-list">
                {suggestions.map(({ brick, chords, score, reasons }) => (
                    <li key={brick.name} className="brick-suggestion">
                        <button className="brick-suggestion-button" onClick={() => onApply(brick)}>
                            <span className="brick-suggestion-top">
                                <span className="brick-suggestion-name">
                                    {brick.name.replace(/-/g, ' ')}
                                </span>
                                <span
                                    className="brick-suggestion-fit"
                                    title={`Fit ${Math.round(score * 100)}%`}
                                    aria-label={`Fit ${Math.round(score * 100)} percent`}
                                >
                                    <span
                                        className="brick-suggestion-fit-bar"
                                        style={{ width: `${Math.round(score * 100)}%` }}
                                    />
                                </span>
                            </span>
                            <span className="brick-suggestion-chords">{chords.join(' · ')}</span>
                            <span className="brick-suggestion-reasons">{reasons.join(' · ')}</span>
                            <span className="brick-suggestion-action">
                                {actionLabel} ({chords.length} {chords.length === 1 ? 'chord' : 'chords'})
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default React.memo(BrickSuggestions);
