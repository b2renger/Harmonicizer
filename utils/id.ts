/**
 * Generates a unique id for progression chords, song parts and the like.
 *
 * `crypto.randomUUID` exists only in a **secure context** — HTTPS or localhost. The dev
 * server binds 0.0.0.0, so reaching it over a LAN address (from a phone, say) puts the
 * page in an insecure context where `crypto.randomUUID` is undefined and every call site
 * throws on first render.
 *
 * `crypto.getRandomValues` has no such restriction, so a proper v4 UUID is still
 * available; the last resort covers environments with no Web Crypto at all.
 */
export function newId(): string {
    const webCrypto = globalThis.crypto;

    if (typeof webCrypto?.randomUUID === 'function') {
        return webCrypto.randomUUID();
    }

    if (typeof webCrypto?.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        webCrypto.getRandomValues(bytes);
        // Set the version (4) and variant (10xx) bits per RFC 4122.
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        return formatUuid([...bytes]);
    }

    // No Web Crypto at all. Ids only need to be unique within a session, not unguessable.
    const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return formatUuid(bytes);
}

const formatUuid = (bytes: number[]): string => {
    const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join('-');
};
