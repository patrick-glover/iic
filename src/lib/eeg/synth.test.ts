import { describe, expect, it } from 'vitest';
import type { Location, Pattern } from '../acns/types';
import { defaultSettings, toPattern, type BuilderSettings } from '../builder';
import { LEAD_SEC, recordDuration, synthesize } from './synth';

const pattern = (over: Partial<BuilderSettings> = {}): Pattern => toPattern({ ...defaultSettings, ...over });

const channel = (w: ReturnType<typeof synthesize>, label: string) => {
  const c = w.channels.find((c) => c.label === label);
  if (!c) throw new Error(`no channel ${label}`);
  return c.samples;
};

const peak = (xs: Float32Array) => xs.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
/** Most extreme value, keeping its sign. */
const extreme = (xs: Float32Array) => xs.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0);

/** Upward peaks above a threshold, as times, with a refractory gap so one complex counts once. */
function peaks(xs: Float32Array, fs: number, threshold: number, gapSec = 0.15): number[] {
  const out: number[] = [];
  let last = -Infinity;
  for (let i = 1; i < xs.length - 1; i++) {
    if (xs[i] > threshold && xs[i] >= xs[i - 1] && xs[i] > xs[i + 1] && i - last > gapSec * fs) {
      out.push(i / fs);
      last = i;
    }
  }
  return out;
}

describe('synthetic EEG', () => {
  it('is deterministic, and a page matches the same span of a longer render', () => {
    const p = pattern({ shape: 'fluctuating' });
    const long = synthesize(p, 0, 20);
    const page = synthesize(p, 10, 20);
    expect(synthesize(p, 0, 20).channels[0].samples).toEqual(long.channels[0].samples);
    const a = channel(long, 'F7-T7').subarray(2500);
    const b = channel(page, 'F7-T7');
    for (let i = 0; i < b.length; i++) expect(b[i]).toBeCloseTo(a[i], 5);
  });

  it('shows only background before onset and after offset', () => {
    const p = pattern({ durationSec: 15 });
    const w = synthesize(p, 0, recordDuration(p));
    const before = channel(w, 'F7-T7').subarray(0, (LEAD_SEC - 0.1) * w.fs);
    const during = channel(w, 'F7-T7').subarray(LEAD_SEC * w.fs, (LEAD_SEC + 15) * w.fs);
    expect(peak(before)).toBeLessThan(peak(during) / 3);
  });

  it('LPDs at T7 phase-reverse at T7 and stay out of the right hemisphere', () => {
    const w = synthesize(pattern({ location: 'L' }), LEAD_SEC, LEAD_SEC + 10);
    // Surface-negative focus: the channel into T7 goes down, the one out of it goes up.
    expect(extreme(channel(w, 'F7-T7'))).toBeLessThan(-0.5);
    expect(extreme(channel(w, 'T7-P7'))).toBeGreaterThan(0.5);
    expect(peak(channel(w, 'F8-T8'))).toBeLessThan(peak(channel(w, 'F7-T7')) / 3);
  });

  it('generalized patterns are symmetric', () => {
    const w = synthesize(pattern({ location: 'G' }), LEAD_SEC, LEAD_SEC + 10);
    const l = peak(channel(w, 'F3-C3'));
    const r = peak(channel(w, 'F4-C4'));
    expect(l).toBeGreaterThan(0.5);
    expect(r / l).toBeGreaterThan(0.8);
    expect(r / l).toBeLessThan(1.25);
  });

  it('draws one discharge per cycle at the pattern frequency', () => {
    for (const frequencyHz of [0.5, 1, 2, 2.5]) {
      const w = synthesize(pattern({ frequencyHz, location: 'L' }), LEAD_SEC, LEAD_SEC + 10);
      const n = peaks(channel(w, 'T7-P7'), w.fs, 0.6).length;
      expect(Math.abs(n - frequencyHz * 10), `${frequencyHz} Hz: ${n}`).toBeLessThanOrEqual(1);
    }
  });

  it('draws evolution as a rising discharge rate', () => {
    const p = pattern({ frequencyHz: 1, shape: 'evolving', durationSec: 60 });
    const [a, b, c] = p.segments;
    const w = synthesize(p, 0, recordDuration(p));
    const times = peaks(channel(w, 'T7-P7'), w.fs, 0.6);
    const rate = (from: number, len: number) =>
      times.filter((t) => t >= LEAD_SEC + from && t < LEAD_SEC + from + len).length / len;
    expect(rate(0, a.durationSec)).toBeCloseTo(1, 0);
    expect(rate(a.durationSec, b.durationSec)).toBeCloseTo(1.5, 0);
    expect(rate(a.durationSec + b.durationSec, 10)).toBeCloseTo(2, 0);
    expect(c.frequencyHz).toBe(2);
  });

  it('independent foci are not time-locked', () => {
    for (const location of ['BI', 'Mf'] as Location[]) {
      const w = synthesize(pattern({ location }), LEAD_SEC, LEAD_SEC + 20);
      const left = peaks(channel(w, 'T7-P7'), w.fs, 0.6);
      const right = peaks(channel(w, location === 'BI' ? 'T8-P8' : 'F8-T8'), w.fs, 0.6).concat(
        peaks(channel(w, location === 'BI' ? 'T8-P8' : 'Fp2-F8'), w.fs, 0.6),
      );
      const lags = left.map((t) => Math.min(...right.map((r) => Math.abs(r - t))));
      expect(Math.max(...lags) - Math.min(...lags), location).toBeGreaterThan(0.2);
    }
  });

  it('+F adds fast activity in the theta-or-faster range', () => {
    for (const type of ['PD', 'RDA'] as const) {
      const plain = channel(synthesize(pattern({ type }), LEAD_SEC, LEAD_SEC + 10), 'T7-P7');
      const plus = channel(synthesize(pattern({ type, plus: { F: true, R: false, S: false } }), LEAD_SEC, LEAD_SEC + 10), 'T7-P7');
      const added = plus.map((x, i) => x - plain[i]);
      expect(peak(added), type).toBeGreaterThan(0.2);
      // Rising zero crossings of the added activity, per second of time it is present.
      let rises = 0;
      let active = 0;
      for (let i = 1; i < added.length; i++) {
        if (added[i - 1] < 0 && added[i] >= 0) rises++;
        if (Math.abs(added[i]) > 0.02) active++;
      }
      expect(rises / (active / 250), type).toBeGreaterThan(4);
    }
  });

  it('triphasic complexes have their largest phase positive (drawn down)', () => {
    const w = synthesize(pattern({ triphasic: true, location: 'L' }), LEAD_SEC, LEAD_SEC + 10);
    // T7-P7 displays T7 negativity upward, so the positive phase at T7 is the most negative value.
    expect(extreme(channel(w, 'T7-P7'))).toBeLessThan(0);
  });
});
