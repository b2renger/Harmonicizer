import { Interval, Note, Chord } from 'tonal';
import { findBrick } from './dictionary.js';
import { getAbbreviatedChordName } from '../chords.js';
import { MAX_BRICK_DEPTH, type Brick, type ExpandedChord } from './types.js';

/** Resolves a brick name to a definition. Injectable so tests can supply their own. */
export type BrickLookup = (name: string) => Brick | undefined;

/**
 * Expands a brick into concrete chords filling an exact number of beats.
 *
 * Sub-block `dur` values are relative weights, scaled to the span. Nested bricks recurse,
 * transposed along with their parent, up to MAX_BRICK_DEPTH.
 *
 * @param brick - The brick to expand.
 * @param targetKey - The key to transpose into.
 * @param totalBeats - The span to fill exactly.
 * @param lookup - How to resolve nested brick references.
 * @param depth - Recursion guard; callers leave this alone.
 * @param seen - Brick names already on the stack, to break reference cycles.
 */
export function expandBrick(
    brick: Brick,
    targetKey: string,
    totalBeats: number,
    lookup: BrickLookup = findBrick,
    depth = 0,
    seen: ReadonlySet<string> = new Set(),
): ExpandedChord[] {
    if (totalBeats <= 0 || depth > MAX_BRICK_DEPTH || seen.has(brick.name)) return [];

    const interval = Interval.distance(brick.key, targetKey);
    const nested = new Set(seen).add(brick.name);

    // Resolve each block to its content first, so blocks that turn out to be empty (a
    // dangling brick reference, a cycle) do not consume any of the span.
    const resolved = brick.blocks.map(block => {
        if (block.kind === 'chord') {
            return { weight: block.dur, produce: (beats: number) => transposeChord(block, brick, interval, beats) };
        }

        const child = lookup(block.name);
        if (!child) return { weight: block.dur, produce: () => [] as ExpandedChord[] };

        const childKey = Note.transpose(block.key, interval) || block.key;
        return {
            weight: block.dur,
            produce: (beats: number) => expandBrick(child, childKey, beats, lookup, depth + 1, nested),
        };
    });

    // A block that will produce nothing forfeits its share.
    const usable = resolved.filter(r => r.produce(1).length > 0);
    const totalWeight = usable.reduce((sum, r) => sum + r.weight, 0);
    if (totalWeight <= 0) return [];

    const out: ExpandedChord[] = [];
    let allocated = 0;
    usable.forEach((r, i) => {
        // Give the last block the remainder so the total is exact despite rounding.
        const beats = i === usable.length - 1
            ? totalBeats - allocated
            : (r.weight / totalWeight) * totalBeats;
        allocated += beats;
        out.push(...r.produce(beats));
    });

    return out;
}

/** Transposes one literal chord block and stamps it with its originating brick. */
function transposeChord(
    block: { symbol: string; dur: number },
    brick: Brick,
    interval: string,
    beats: number,
): ExpandedChord[] {
    const chord = Chord.get(block.symbol);
    if (chord.empty || !chord.tonic) return [];

    const tonic = Note.transpose(chord.tonic, interval);
    if (!tonic) return [];

    const alias = chord.aliases?.[0] ?? '';
    const type = (alias === 'M' || alias === '') ? '' : alias;
    const symbol = getAbbreviatedChordName(`${tonic}${type}`);

    return [{ symbol, durationBeats: beats, brick: brick.name }];
}
