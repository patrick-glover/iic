// Quiz links (#quiz/<code>). A code is a version letter plus six base-62
// digits holding one 32-bit number, and is opaque by design: it names the
// pattern without giving the answer away.
//
//   a……  a random quiz seed.
//   c……  a pattern made in the composer, its settings packed into 26 bits and
//        scrambled so that neighbouring settings don't give neighbouring codes.
//
// Bump a letter when a change would make its old codes open a different
// pattern. Old codes then fail to parse instead of quietly showing the wrong one.

import type { Location, PatternType } from './acns/types';
import { DURATIONS, type BuilderSettings, type Shape } from './builder';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const DIGITS = 6; // 62^6 > 2^32

function toCode(letter: string, n: number): string {
  n >>>= 0;
  let s = '';
  for (let i = 0; i < DIGITS; i++) {
    s = ALPHABET[n % 62] + s;
    n = Math.floor(n / 62);
  }
  return letter + s;
}

function fromCode(letter: string, code: string): number | null {
  if (code.length !== DIGITS + 1 || code[0] !== letter) return null;
  let n = 0;
  for (const c of code.slice(1)) {
    const d = ALPHABET.indexOf(c);
    if (d < 0) return null;
    n = n * 62 + d;
  }
  return n <= 0xffffffff ? n : null;
}

export const encodeSeed = (seed: number) => toCode('a', seed);
export const decodeSeed = (code: string) => fromCode('a', code);

// A bijection on 32-bit numbers (xorshift and odd multiplies each undo).
const M1 = 0x9e3779b1;
const M2 = 0x85ebca6b;
/** Multiplicative inverse mod 2^32 by Newton's iteration. */
function inverse(a: number) {
  let x = a;
  for (let i = 0; i < 5; i++) x = Math.imul(x, 2 - Math.imul(a, x));
  return x;
}
const M1_INV = inverse(M1);
const M2_INV = inverse(M2);

function scramble(n: number) {
  n = Math.imul(n, M1);
  n ^= n >>> 16;
  n = Math.imul(n, M2);
  return (n ^ (n >>> 16)) >>> 0;
}
function unscramble(n: number) {
  n ^= n >>> 16;
  n = Math.imul(n, M2_INV);
  n ^= n >>> 16;
  return Math.imul(n, M1_INV) >>> 0;
}

const LOCATIONS: Location[] = ['G', 'L', 'BI', 'UI', 'Mf'];
const TYPES: PatternType[] = ['PD', 'RDA', 'SW'];
const SHAPES: Shape[] = ['static', 'fluctuating', 'evolving'];

// Bit fields, low to high: [width, value]. 26 bits in all; the top 6 stay zero.
type Fields = [number, number][];

function fields(s: BuilderSettings): Fields {
  return [
    [3, LOCATIONS.indexOf(s.location)],
    [2, TYPES.indexOf(s.type)],
    [1, +s.plus.F],
    [1, +s.plus.R],
    [1, +s.plus.S],
    [4, Math.round(s.frequencyHz / 0.25) - 1], // 0.25–4 Hz in 0.25 steps
    [3, DURATIONS.indexOf(s.durationSec)],
    [2, SHAPES.indexOf(s.shape)],
    [7, Math.round(s.prevalencePct)],
    [1, +s.stimulusInduced],
    [1, +s.triphasic],
  ];
}

export function encodeSettings(s: BuilderSettings): string {
  let n = 0;
  let shift = 0;
  for (const [w, v] of fields(s)) {
    if (v < 0 || v >= 1 << w) throw new Error(`setting out of range: ${v} in ${w} bits`);
    n += v * 2 ** shift;
    shift += w;
  }
  return toCode('c', scramble(n));
}

/** The composer settings a code names, or null if it isn't a composer code or names something the composer can't make. */
export function decodeSettings(code: string): BuilderSettings | null {
  const raw = fromCode('c', code);
  if (raw === null) return null;
  let n = unscramble(raw);
  if (n >>> 26) return null;
  const take = (w: number) => {
    const v = n & ((1 << w) - 1);
    n >>>= w;
    return v;
  };
  const location = LOCATIONS[take(3)];
  const type = TYPES[take(2)];
  const F = take(1) === 1;
  const R = take(1) === 1;
  const S = take(1) === 1;
  const frequencyHz = (take(4) + 1) * 0.25;
  const durationSec = DURATIONS[take(3)];
  const shape = SHAPES[take(2)];
  const prevalencePct = take(7);
  const stimulusInduced = take(1) === 1;
  const triphasic = take(1) === 1;

  // Only what the composer's controls allow.
  if (!location || !type || !durationSec || !shape || prevalencePct > 100) return null;
  if ((F && type === 'SW') || (R && type !== 'PD') || (S && type !== 'RDA')) return null;
  if (type === 'RDA' && (triphasic || frequencyHz < 0.5)) return null;

  return { location, type, plus: { F, R, S }, frequencyHz, durationSec, shape, prevalencePct, stimulusInduced, triphasic };
}

/** The number a code stands for, used to seed the patterns that follow it. */
export const codeNumber = (code: string): number | null => decodeSeed(code) ?? fromCode('c', code);
