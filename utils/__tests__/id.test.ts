import { describe, it, expect, afterEach } from 'vitest';
import { newId } from '../id.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const realCrypto = globalThis.crypto;

/** Replaces globalThis.crypto for one test. */
const withCrypto = (replacement: unknown) => {
    Object.defineProperty(globalThis, 'crypto', { value: replacement, configurable: true, writable: true });
};

afterEach(() => withCrypto(realCrypto));

describe('newId', () => {
    it('returns a v4 UUID', () => {
        expect(newId()).toMatch(UUID_V4);
    });

    it('does not repeat', () => {
        const ids = new Set(Array.from({ length: 5000 }, newId));
        expect(ids.size).toBe(5000);
    });

    // The bug: reaching the dev server over a LAN address is an insecure context, where
    // crypto.randomUUID is undefined and every call site threw on first render.
    it('works in an insecure context, where randomUUID is missing', () => {
        withCrypto({ getRandomValues: realCrypto.getRandomValues.bind(realCrypto) });
        expect(newId()).toMatch(UUID_V4);
        expect(new Set(Array.from({ length: 1000 }, newId)).size).toBe(1000);
    });

    it('works with no Web Crypto at all', () => {
        withCrypto(undefined);
        expect(newId()).toMatch(UUID_V4);
        expect(new Set(Array.from({ length: 1000 }, newId)).size).toBe(1000);
    });
});

describe('no direct crypto.randomUUID in application code', () => {
    it('every id comes from newId', async () => {
        const { readdirSync, readFileSync, statSync } = await import('node:fs');
        const { join } = await import('node:path');

        const offenders: string[] = [];
        const skip = new Set(['node_modules', 'dist', '.git', '__tests__', 'utils']);

        const walk = (dir: string) => {
            for (const entry of readdirSync(dir)) {
                if (skip.has(entry)) continue;
                const path = join(dir, entry);
                if (statSync(path).isDirectory()) walk(path);
                else if (/\.tsx?$/.test(entry) && readFileSync(path, 'utf8').includes('crypto.randomUUID')) {
                    offenders.push(path);
                }
            }
        };
        walk(process.cwd());

        expect(offenders).toEqual([]);
    });
});
