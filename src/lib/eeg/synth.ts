// Synthetic EEG from a Pattern. Pure and deterministic: the same Pattern and
// window always give the same samples, so paging and redraws don't shimmer.
//
// Each focus is a source with a Gaussian field over the scalp. Its discharges
// follow the Pattern's segments, so a change in frequency on the trace is the
// same change the rules engine judged. Independent foci (BI, UI, Mf) drift
// slowly against each other so they are visibly not time-locked.

import type { Pattern } from '../acns/types';
import { totalDuration } from '../acns/timing';
import { doubleBanana, electrodes, channelLabel, type Chain } from './montage';
import {
  complexAt,
  complexLength,
  rhythmicDelta,
  sharpTransient,
  sharpWave,
  spikeAndWave,
  triphasicSpikeAndWave,
  triphasicWave,
  RDA_PEAK_PHASE,
  type Complex,
} from './waveforms';

/** Background before and after the pattern, so onset and offset are visible. */
export const LEAD_SEC = 2;

export const recordDuration = (p: Pattern) => totalDuration(p.segments) + 2 * LEAD_SEC;

interface Focus {
  /** Relative voltage at each electrode. */
  field: Record<string, number>;
  /** Starting phase, in cycles. */
  offset: number;
  /** Frequency offset in Hz; nonzero only for independent foci. */
  drift: number;
  seed: number;
}

/** Deterministic hash to [0, 1). */
function rand(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function gaussianField(cx: number, cy: number, sigma: number, floor = 0): Record<string, number> {
  const f: Record<string, number> = {};
  for (const [name, [x, y]] of Object.entries(electrodes)) {
    const d2 = (x - cx) ** 2 + (y - cy) ** 2;
    f[name] = floor + (1 - floor) * Math.exp(-d2 / (2 * sigma * sigma));
  }
  return f;
}

const focalField = (e: string) => gaussianField(...electrodes[e], 0.42);

/** Bifrontally predominant and symmetric, falling off toward the occiput. */
function generalizedField(): Record<string, number> {
  const l = gaussianField(-0.4, 0.5, 0.55);
  const r = gaussianField(0.4, 0.5, 0.55);
  const f: Record<string, number> = {};
  for (const k in l) f[k] = (l[k] + r[k]) / (1 + Math.exp(-(0.8 ** 2) / (2 * 0.55 ** 2)));
  return f;
}

/** Where each location puts its sources. L uses the Pattern's own electrode when it has one. */
export function focusSites(p: Pattern): string[] {
  switch (p.location) {
    case 'G':
      return [];
    case 'L': {
      const e = p.segments[0]?.electrodes[0];
      return [e && e in electrodes ? e : 'T7'];
    }
    case 'BI':
      return ['T7', 'T8'];
    case 'UI':
      return ['F7', 'P3'];
    case 'Mf':
      return ['T7', 'F8', 'P3'];
  }
}

// Generalized discharges are higher voltage and their smooth field partly
// cancels in bipolar pairs, so they get more gain than a focus.
const GENERALIZED_GAIN = 2.4;
const FOCAL_GAIN = 1.5;

function foci(p: Pattern): Focus[] {
  const sites = focusSites(p);
  if (sites.length === 0) {
    const field = generalizedField();
    for (const k in field) field[k] *= GENERALIZED_GAIN;
    return [{ field, offset: 0, drift: 0, seed: 1 }];
  }
  const independent = sites.length > 1;
  return sites.map((e, i) => {
    const field = focalField(e);
    for (const k in field) field[k] *= FOCAL_GAIN;
    return {
      field,
      offset: independent ? rand(i, 11) : 0,
      drift: independent ? [0, 0.07, -0.05][i] : 0,
      seed: 100 + i,
    };
  });
}

/** Piecewise-linear phase of one focus across the pattern. */
class Phase {
  starts: number[] = [];
  phases: number[] = [];
  rates: number[] = [];
  end: number;
  private i = 0;

  constructor(p: Pattern, focus: Focus) {
    let t = LEAD_SEC;
    let ph = focus.offset;
    for (const s of p.segments) {
      const rate = s.frequencyHz + focus.drift;
      this.starts.push(t);
      this.phases.push(ph);
      this.rates.push(rate);
      t += s.durationSec;
      ph += s.durationSec * rate;
    }
    this.end = t;
  }

  /** Phase at t. Fastest when called with increasing t. */
  at(t: number): number {
    if (this.starts.length === 0) return 0;
    if (t < this.starts[this.i]) this.i = 0;
    while (this.i + 1 < this.starts.length && t >= this.starts[this.i + 1]) this.i++;
    return this.phases[this.i] + (t - this.starts[this.i]) * this.rates[this.i];
  }

  /** Times where the phase crosses a whole cycle, within [t0, t1). */
  crossings(t0: number, t1: number): { t: number; n: number; rate: number }[] {
    const out: { t: number; n: number; rate: number }[] = [];
    for (let s = 0; s < this.starts.length; s++) {
      const start = this.starts[s];
      const end = s + 1 < this.starts.length ? this.starts[s + 1] : this.end;
      if (end <= t0 || start >= t1) continue;
      const rate = this.rates[s];
      const ph0 = this.phases[s];
      const from = Math.max(start, t0);
      for (let n = Math.ceil(ph0 + (from - start) * rate); ; n++) {
        const t = start + (n - ph0) / rate;
        if (t >= Math.min(end, t1)) break;
        out.push({ t, n, rate });
      }
    }
    return out;
  }
}

function complexFor(p: Pattern): Complex {
  if (p.type === 'SW') return p.triphasic ? triphasicSpikeAndWave : spikeAndWave;
  return p.triphasic ? triphasicWave : sharpWave;
}

/** Superimposed fast activity for +F. Theta or faster per ACNS; drawn at 14 Hz. */
const FAST_HZ = 14;
const FAST_AMP = 0.28;
/** Superimposed delta for PDs+R. */
const PLUS_R_HZ = 1.6;
const PLUS_R_AMP = 0.4;
/** Continuous delta reads bigger than intermittent discharges at the same voltage. */
const RDA_AMP = 0.55;
/** RDA+S: a sharp transient on every other wave, well inside ACNS's once per 10 s. */
const PLUS_S_EVERY = 2;

/** Source waveform of one focus over [t0, t1), before it is spread over the scalp. */
function sourceSignal(p: Pattern, focus: Focus, t0: number, n: number, fs: number): Float32Array {
  const out = new Float32Array(n);
  const phase = new Phase(p, focus);
  const onset = LEAD_SEC;
  const offset = phase.end;
  const t1 = t0 + n / fs;
  const idx = (t: number) => Math.round((t - t0) * fs);

  // Taper continuous activity over 150 ms at onset and offset.
  const envelope = (t: number) => Math.max(0, Math.min(1, (t - onset) / 0.15, (offset - t) / 0.15));

  // Lay one complex into the buffer starting at time t.
  const stamp = (cx: Complex, t: number, amp: number, k: number, fast: boolean) => {
    const len = complexLength(cx);
    for (let i = Math.max(0, idx(t - 0.05)); i < Math.min(n, idx(t + len)); i++) {
      const dt = t0 + i / fs - t;
      out[i] += amp * complexAt(cx, dt, k);
      if (fast) {
        const env = Math.exp(-0.5 * ((dt - 0.08 * k) / (0.09 * k)) ** 2);
        out[i] += FAST_AMP * env * Math.sin(2 * Math.PI * FAST_HZ * dt);
      }
    }
  };

  if (p.type === 'RDA') {
    for (let i = 0; i < n; i++) {
      const t = t0 + i / fs;
      const e = envelope(t);
      if (e === 0) continue;
      const w = rhythmicDelta(phase.at(t));
      out[i] = e * RDA_AMP * w;
      if (p.plus.F) out[i] += e * FAST_AMP * (0.6 + 0.4 * Math.max(0, w)) * Math.sin(2 * Math.PI * FAST_HZ * t);
    }
    if (p.plus.S) {
      // Wave peaks fall RDA_PEAK_PHASE of a cycle after each crossing.
      for (const c of phase.crossings(t0 - 1, t1)) {
        if (c.n % PLUS_S_EVERY !== 0) continue;
        const t = c.t + RDA_PEAK_PHASE / c.rate;
        if (t >= onset && t < offset) stamp(sharpTransient, t, 1, 1, false);
      }
    }
    return out;
  }

  const cx = complexFor(p);
  const full = complexLength(cx);
  for (const c of phase.crossings(t0 - full, t1)) {
    const period = 1 / c.rate;
    const k = Math.min(1, (0.85 * period) / full);
    const jitter = (rand(c.n, focus.seed) - 0.5) * 0.06 * period;
    const amp = 0.95 + 0.1 * rand(c.n, focus.seed + 7);
    stamp(cx, c.t + jitter, amp, k, p.type === 'PD' && p.plus.F);
  }

  if (p.type === 'PD' && p.plus.R) {
    for (let i = 0; i < n; i++) {
      const t = t0 + i / fs;
      out[i] += envelope(t) * PLUS_R_AMP * rhythmicDelta(PLUS_R_HZ * (t - onset) + focus.offset);
    }
  }
  return out;
}

/** Low-voltage mixed theta-delta, different at every electrode. */
function background(t0: number, n: number, fs: number): Record<string, Float32Array> {
  const out: Record<string, Float32Array> = {};
  Object.keys(electrodes).forEach((name, e) => {
    const buf = new Float32Array(n);
    const comps = [0, 1, 2, 3].map((j) => ({
      f: 1.2 + 6 * rand(e, j),
      ph: 2 * Math.PI * rand(e, j + 10),
      a: 0.025 + 0.02 * rand(e, j + 20),
      mod: 2 * Math.PI * rand(e, j + 30),
    }));
    for (let i = 0; i < n; i++) {
      const t = t0 + i / fs;
      let v = 0;
      for (const c of comps) v += c.a * (0.7 + 0.3 * Math.sin(0.8 * t + c.mod)) * Math.sin(2 * Math.PI * c.f * t + c.ph);
      buf[i] = v;
    }
    out[name] = buf;
  });
  return out;
}

export interface TraceChannel {
  label: string;
  chain: Chain;
  /** Upward-positive display values: negativity at the first electrode minus the second. */
  samples: Float32Array;
}

export interface TraceWindow {
  t0: number;
  t1: number;
  fs: number;
  channels: TraceChannel[];
}

/** Synthesize [t0, t1) of the record, in seconds from the start of the lead-in. */
export function synthesize(p: Pattern, t0: number, t1: number, fs = 250): TraceWindow {
  const n = Math.max(0, Math.round((t1 - t0) * fs));
  const potentials = background(t0, n, fs);
  for (const focus of foci(p)) {
    const src = sourceSignal(p, focus, t0, n, fs);
    for (const [name, gain] of Object.entries(focus.field)) {
      if (gain < 0.01) continue;
      const v = potentials[name];
      for (let i = 0; i < n; i++) v[i] += gain * src[i];
    }
  }
  const channels = doubleBanana.map((c) => {
    const a = potentials[c.a];
    const b = potentials[c.b];
    const samples = new Float32Array(n);
    for (let i = 0; i < n; i++) samples[i] = a[i] - b[i];
    return { label: channelLabel(c), chain: c.chain, samples };
  });
  return { t0, t1, fs, channels };
}

/** Where the pattern changes, for marking on the trace: record time and the new frequency. */
export function segmentMarks(p: Pattern): { t: number; frequencyHz: number }[] {
  const marks: { t: number; frequencyHz: number }[] = [];
  let t = LEAD_SEC;
  let prev: number | null = null;
  for (const s of p.segments) {
    if (s.frequencyHz !== prev) marks.push({ t, frequencyHz: s.frequencyHz });
    prev = s.frequencyHz;
    t += s.durationSec;
  }
  return marks;
}
