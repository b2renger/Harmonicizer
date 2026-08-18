/**
 * Lexicographic enumeration of orderings, so an arpeggio shape can be addressed by number.
 *
 * Index 0 is always ascending and the final index always descending, which gives the two
 * shapes people reach for first a stable address.
 */

export const factorial = (n: number): number => {
    let out = 1;
    for (let i = 2; i <= n; i++) out *= i;
    return out;
};

/** How many distinct orderings exist for a figure of `steps` notes. */
export const permutationCount = (steps: number): number =>
    steps < 1 ? 0 : factorial(steps);

/**
 * The `index`-th ordering of [0..steps-1] in lexicographic order.
 *
 * Uses the factorial number system: index is decomposed into a Lehmer code, whose digits
 * select successively from the remaining elements.
 *
 * @param steps - Length of the ordering.
 * @param index - Which ordering. Taken modulo the count, so any integer is valid.
 * @returns A permutation of [0..steps-1].
 */
export function permutationAt(steps: number, index: number): number[] {
    if (steps < 1) return [];

    const count = permutationCount(steps);
    // Normalize into range, handling negatives too.
    let remaining = ((Math.trunc(index) % count) + count) % count;

    const available = Array.from({ length: steps }, (_, i) => i);
    const out: number[] = [];

    for (let position = steps - 1; position >= 0; position--) {
        const block = factorial(position);
        const choice = Math.floor(remaining / block);
        remaining -= choice * block;
        out.push(...available.splice(choice, 1));
    }
    return out;
}

/** The index of a given ordering, inverse of `permutationAt`. */
export function permutationIndexOf(order: number[]): number {
    const available = Array.from({ length: order.length }, (_, i) => i);
    let index = 0;

    for (let position = 0; position < order.length; position++) {
        const choice = available.indexOf(order[position]);
        if (choice === -1) return -1;   // not a permutation of [0..n-1]
        index += choice * factorial(order.length - 1 - position);
        available.splice(choice, 1);
    }
    return index;
}

/** Named shapes, as indices, so the UI can offer the obvious starting points. */
export const presetIndex = {
    up: (): number => 0,
    down: (steps: number): number => permutationCount(steps) - 1,
    /** Outside-in: lowest, highest, second lowest, second highest, ... */
    converging: (steps: number): number => {
        const order: number[] = [];
        let low = 0;
        let high = steps - 1;
        while (low <= high) {
            order.push(low++);
            if (low <= high) order.push(high--);
        }
        return permutationIndexOf(order);
    },
};
