// Quiz seeds: one 32-bit number fixes a quiz pattern and every pattern after
// it, so a shared link gives everyone the same run of patterns. The code in the
// URL is opaque by design: it names the seed, not the answer.

/** Deterministic PRNG, uniform on [0, 1). */
export function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The seed after this one (murmur3 finalizer), so Next is the same for everyone. */
export function nextSeed(seed: number): number {
  let h = (seed + 0x9e3779b9) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0];

/**
 * Bump when a change to the quiz generator would turn an old seed into a
 * different pattern. Old codes then fail to parse instead of quietly showing
 * the wrong pattern.
 */
const VERSION = 'a';
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const DIGITS = 6; // 62^6 > 2^32

export function encodeSeed(seed: number): string {
  let n = seed >>> 0;
  let s = '';
  for (let i = 0; i < DIGITS; i++) {
    s = ALPHABET[n % 62] + s;
    n = Math.floor(n / 62);
  }
  return VERSION + s;
}

/** The seed a code names, or null if it isn't a code for this generator. */
export function decodeSeed(code: string): number | null {
  if (code.length !== DIGITS + 1 || code[0] !== VERSION) return null;
  let n = 0;
  for (const c of code.slice(1)) {
    const d = ALPHABET.indexOf(c);
    if (d < 0) return null;
    n = n * 62 + d;
  }
  return n <= 0xffffffff ? n : null;
}
