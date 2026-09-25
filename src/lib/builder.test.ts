import { describe, expect, it } from 'vitest';
import { classify } from './acns/classify';
import { dynamics } from './acns/dynamics';
import { totalDuration } from './acns/timing';
import { defaultSettings, toPattern, toSegments, type Shape } from './builder';

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
