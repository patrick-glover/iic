// The waveform library. Values are surface negativity: positive numbers are
// negative on the scalp and draw upward, following EEG convention.
//
// Each complex is a sum of Gaussian bumps. Components marked `scales` stretch
// or shrink with the interdischarge interval so fast patterns don't overlap
// themselves; spikes keep their width so they stay sharp.

interface Bump {
  amp: number;
  /** Center, seconds after the discharge starts. */
  c: number;
  /** Width before and after the center, seconds. */
  rise: number;
  fall: number;
  scales?: boolean;
}

export type Complex = Bump[];

/** Sharp wave, a small positive dip, then an aftergoing slow wave. */
export const sharpWave: Complex = [
  { amp: 1, c: 0.04, rise: 0.012, fall: 0.028 },
  { amp: -0.3, c: 0.1, rise: 0.03, fall: 0.03, scales: true },
  { amp: 0.35, c: 0.24, rise: 0.07, fall: 0.07, scales: true },
];

/**
 * ACNS 2021: three phases, negative-positive-negative, each longer than the
 * one before, with the positive phase of highest voltage.
 */
export const triphasicWave: Complex = [
  { amp: 0.35, c: 0.03, rise: 0.014, fall: 0.014 },
  { amp: -1, c: 0.1, rise: 0.035, fall: 0.035, scales: true },
  { amp: 0.55, c: 0.24, rise: 0.06, fall: 0.06, scales: true },
];

/** Spike followed by a surface-negative slow wave. */
export const spikeAndWave: Complex = [
  { amp: 1, c: 0.025, rise: 0.007, fall: 0.012 },
  { amp: -0.3, c: 0.06, rise: 0.015, fall: 0.015, scales: true },
  { amp: 0.75, c: 0.2, rise: 0.065, fall: 0.065, scales: true },
];

/** Triphasic complex with the slow wave that makes it SW. */
export const triphasicSpikeAndWave: Complex = [
  ...triphasicWave,
  { amp: 0.6, c: 0.4, rise: 0.07, fall: 0.07, scales: true },
];

/** A lone sharp transient, used for RDA+S. */
export const sharpTransient: Complex = [{ amp: 0.9, c: 0, rise: 0.012, fall: 0.025 }];

/** Seconds from discharge start to the end of the complex at full width. */
export const complexLength = (cx: Complex) => Math.max(...cx.map((b) => b.c + 3 * b.fall));

/** Value of a complex `dt` seconds after it starts, with scalable parts shrunk by `k`. */
export function complexAt(cx: Complex, dt: number, k = 1): number {
  let v = 0;
  for (const b of cx) {
    const s = b.scales ? k : 1;
    const x = dt - b.c * s;
    const w = (x < 0 ? b.rise : b.fall) * s;
    v += b.amp * Math.exp(-0.5 * (x / w) ** 2);
  }
  return v;
}

/** Rhythmic delta: a sine with a little second harmonic so it isn't perfectly smooth. */
export const rhythmicDelta = (phase: number) =>
  Math.sin(2 * Math.PI * phase) + 0.25 * Math.sin(4 * Math.PI * phase + 0.8);

/** Phase within each RDA cycle where the wave peaks, for placing +S sharp transients. */
export const RDA_PEAK_PHASE = 0.17;
