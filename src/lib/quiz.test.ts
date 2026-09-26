import { describe, expect, it } from 'vitest';
import { classify } from './acns/classify';
import { fullTerm, validate } from './acns/term';
import { durationCategory, prevalenceCategory, totalDuration } from './acns/timing';
import { runsInHour } from './builder';
import { blankAnswer, grade, randomPattern, type Answer } from './quiz';

/** Seeded so failures reproduce. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('quiz patterns', () => {
  const rng = mulberry32(42);
  const patterns = Array.from({ length: 400 }, () => randomPattern(rng));

  it('are valid and never stimulus-induced', () => {
    for (const p of patterns) {
      expect(validate(p), fullTerm(p)).toEqual([]);
      expect(p.stimulusInduced).toBe(false);
    }
  });

  it('land in all four categories', () => {
    const seen = new Set(patterns.map((p) => classify(p).category));
    expect([...seen].sort()).toEqual(['ESE', 'ESz', 'IIC', 'RPP']);
  });

  // The resident reads prevalence off the hour strip, so the two must agree.
  it('have a prevalence category the hour strip shows', () => {
    for (const p of patterns) {
      const d = p.segments.reduce((t, s) => t + s.durationSec, 0);
      const shown = (runsInHour({ durationSec: d, prevalencePct: p.prevalencePct }).reduce((t, r) => t + r.durationSec, 0) / 3600) * 100;
      expect(prevalenceCategory(shown)).toBe(prevalenceCategory(p.prevalencePct));
    }
  });
});

describe('grading', () => {
  const p = randomPattern(mulberry32(7));

  const perfect = (): Answer => {
    const r = classify(p);
    return {
      prevalence: prevalenceCategory(p.prevalencePct),
      location: p.location,
      type: p.type,
      plus: { F: p.plus.F && p.type !== 'SW', R: p.plus.R && p.type === 'PD', S: p.plus.S && p.type === 'RDA' },
      frequencyHz: p.segments[0].frequencyHz,
      duration: durationCategory(totalDuration(p.segments)),
      dynamic: r.dynamics.overall,
      triphasic: p.triphasic && p.type !== 'RDA',
      category: r.category as Answer['category'],
    };
  };

  it('marks the true answer fully correct', () => {
    expect(grade(p, perfect()).filter((m) => !m.correct)).toEqual([]);
  });

  it('marks a blank answer wrong on every categorical field', () => {
    const wrong = grade(p, blankAnswer()).filter((m) => !m.correct).map((m) => m.label);
    for (const label of ['Prevalence', 'Location', 'Pattern', 'Duration', 'Over time', 'Classification']) expect(wrong).toContain(label);
  });

  it('accepts a frequency within a quarter hertz of the range, not beyond', () => {
    const freqs = p.segments.map((s) => s.frequencyHz);
    const at = (hz: number) => grade(p, { ...perfect(), frequencyHz: hz }).find((m) => m.label === 'Frequency')!.correct;
    expect(at(Math.max(...freqs) + 0.25)).toBe(true);
    expect(at(Math.max(...freqs) + 0.5)).toBe(false);
  });
});
