import { describe, expect, it } from 'vitest';
import { classify } from './acns/classify';
import { dynamics } from './acns/dynamics';
import { totalDuration } from './acns/timing';
import { defaultSettings, minPrevalencePct, runsInHour, toPattern, toSegments, type Shape } from './builder';

describe('builder segments', () => {
  const shapes: Shape[] = ['static', 'fluctuating', 'evolving'];
  const frequencies = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

  it('fills the chosen duration exactly', () => {
    for (const shape of shapes)
      for (const frequencyHz of frequencies)
        for (const durationSec of [15, 60, 600, 3600])
          expect(totalDuration(toSegments({ shape, frequencyHz, durationSec }))).toBeCloseTo(durationSec);
  });

  // The control must produce what it says, or the builder would teach the wrong thing.
  it('produces the shape the resident picked, whenever the pattern is long enough', () => {
    for (const shape of shapes)
      for (const frequencyHz of frequencies)
        for (const durationSec of [60, 600, 3600])
          expect(dynamics(toSegments({ shape, frequencyHz, durationSec })).overall, `${shape} ${frequencyHz} Hz ${durationSec} s`).toBe(shape);
  });

  it('never goes above 4 Hz', () => {
    for (const shape of shapes)
      expect(Math.max(...toSegments({ shape, frequencyHz: 4, durationSec: 60 }).map((s) => s.frequencyHz))).toBeLessThanOrEqual(4);
  });

  it('evolving LRDA at 1 Hz is a seizure; static is not', () => {
    const lrda = { ...defaultSettings, type: 'RDA' as const, frequencyHz: 1 };
    expect(classify(toPattern({ ...lrda, shape: 'evolving' })).category).toBe('ESz');
    expect(classify(toPattern({ ...lrda, shape: 'static' })).category).toBe('RPP');
  });
});

describe('prevalence and runs', () => {
  it('a single run sets the prevalence floor', () => {
    expect(minPrevalencePct(3600)).toBe(100);
    expect(minPrevalencePct(900)).toBe(25);
    expect(minPrevalencePct(60)).toBe(2);
    expect(minPrevalencePct(15)).toBe(0);
  });

  // Whole runs only, so the total lands within half a run of the prevalence.
  it('lays out runs that add up to the prevalence and fit in the hour', () => {
    for (const durationSec of [8, 15, 60, 300, 900, 3600])
      for (let prevalencePct = minPrevalencePct(durationSec); prevalencePct <= 100; prevalencePct += 7) {
        const runs = runsInHour({ durationSec, prevalencePct });
        const total = runs.reduce((t, r) => t + r.durationSec, 0);
        const target = Math.max((prevalencePct / 100) * 3600, durationSec);
        expect(Math.abs(total - target), `${durationSec} s at ${prevalencePct}%`).toBeLessThanOrEqual(durationSec / 2 + 1e-9);
        for (let i = 0; i < runs.length; i++) {
          expect(runs[i].startSec).toBeGreaterThanOrEqual(0);
          expect(runs[i].startSec + runs[i].durationSec).toBeLessThanOrEqual(3600 + 1e-9);
          if (i) expect(runs[i].startSec).toBeGreaterThanOrEqual(runs[i - 1].startSec + runs[i - 1].durationSec - 1e-9);
        }
      }
  });

  it('5% of the hour in 1-minute runs is three runs', () => {
    expect(runsInHour({ durationSec: 60, prevalencePct: 5 })).toHaveLength(3);
  });
});
