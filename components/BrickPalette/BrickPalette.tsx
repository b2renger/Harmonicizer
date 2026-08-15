import React, { useMemo } from 'react';
import { BRICK_DICTIONARY } from '../../theory/bricks/dictionary.js';
import { expandBrick } from '../../theory/bricks/expand.js';
import type { Brick } from '../../theory/bricks/types.js';
import './BrickPalette.css';

interface BrickPaletteProps {
    musicalKey: string;
    musicalMode: string;
    onAddBrick: (brick: Brick) => void;
}

const MINOR_MODES = ['minor', 'aeolian', 'dorian', 'phrygian', 'locrian'];

/**
 * Named harmonic units, expanded into the current key.
 *
 * Each card shows the chords it will actually insert, so the brick's shape is visible
 * before committing to it. Bricks written for the other mode are still offered — using a
 * minor cadence in a major key is a borrowing, not a mistake — but marked.
 */
const BrickPalette: React.FC<BrickPaletteProps> = ({ musicalKey, musicalMode, onAddBrick }) => {
    const currentFamily = MINOR_MODES.includes(musicalMode) ? 'Minor' : 'Major';

    const previews = useMemo(
        () => BRICK_DICTIONARY.map(brick => ({
            brick,
            chords: expandBrick(brick, musicalKey, brick.defaultBeats).map(c => c.symbol),
            matchesMode: brick.mode === currentFamily,
        })),
        [musicalKey, currentFamily],
    );

    // Bricks for the current mode first; stable order within each group.
    const ordered = useMemo(
        () => [...previews].sort((a, b) => Number(b.matchesMode) - Number(a.matchesMode)),
        [previews],
    );

    return (
        <div className="brick-palette">
            <p className="brick-palette-intro">
                Named harmonic units, shown in <strong>{musicalKey}</strong>. Click one to add it
                to the progression.
            </p>
            <div className="brick-grid">
                {ordered.map(({ brick, chords, matchesMode }) => (
                    <button
                        key={brick.name}
                        className={`brick-card ${matchesMode ? '' : 'other-mode'}`}
                        onClick={() => onAddBrick(brick)}
                        title={`${brick.description} (${brick.type})`}
                    >
                        <span className="brick-card-header">
                            <span className="brick-card-name">{brick.name.replace(/-/g, ' ')}</span>
                            <span className="brick-card-type">{brick.type}</span>
                        </span>
                        <span className="brick-card-chords">{chords.join(' · ')}</span>
                        <span className="brick-card-description">{brick.description}</span>
                        {!matchesMode && (
                            <span className="brick-card-borrowed">borrowed from {brick.mode.toLowerCase()}</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default React.memo(BrickPalette);
