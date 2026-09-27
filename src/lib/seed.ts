// Quiz seeds: one 32-bit number fixes a quiz pattern and every pattern after
// it, so a shared link gives everyone the same run of patterns.

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
