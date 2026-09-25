import { describe, expect, it } from 'vitest';
import { classify } from './classify';
import { dynamics } from './dynamics';
import { fullTerm, mainTerm, reportedTerm, validate } from './term';
import { durationCategory, maxTenSecondAverage, prevalenceCategory } from './timing';
import type { Pattern, Segment } from './types';

/** Segments at one morphology and location, from [Hz, seconds] pairs. */
const freqs = (...steps: [number, number][]): Segment[] =>
  steps.map(([frequencyHz, durationSec]) => ({ frequencyHz, durationSec, morphology: 'sharp', electrodes: ['T7'] }));

const pattern = (over: Partial<Pattern> = {}): Pattern => ({
  location: 'L',
  type: 'PD',
  plus: { F: false, R: false, S: false },
  segments: freqs([1.5, 60]),
  prevalencePct: 5,
  stimulusInduced: false,
  triphasic: false,
  record: { sporadicEDs: false, BIRDs: false },
  clinical: { priorSeizure: false, etiology: 'other' },
  ...over,
});

describe('evolution and fluctuation (ACNS 2021 C3h worked examples)', () => {
  it('3 Hz ≥1 s, then 2 Hz ≥1.5 s, then 1.5 Hz ≥2 s is evolving', () => {
    expect(dynamics(freqs([3, 1], [2, 1.5], [1.5, 2])).frequency).toBe('evolving');
  });

  it('3 Hz 1 min, 2 Hz 7 min, 1.5 Hz 2 min is not evolving (five-minute rule)', () => {
    expect(dynamics(freqs([3, 60], [2, 420], [1.5, 120])).frequency).not.toBe('evolving');
  });

  it('a level under three cycles does not count', () => {
    // 2 Hz for 1 s is only two cycles, so 3 → 2 → 1.5 collapses to 3 → 1.5.
    expect(dynamics(freqs([3, 1], [2, 1], [1.5, 2])).frequency).toBe('static');
  });

  it('changes under 0.5 Hz are not changes', () => {
    expect(dynamics(freqs([2, 5], [2.25, 5], [2.5, 5])).frequency).toBe('static');
  });

  it('2 → 2.5 → 2 → 2.5 Hz within a minute is fluctuating', () => {
    expect(dynamics(freqs([2, 10], [2.5, 30], [2, 5], [2.5, 5])).frequency).toBe('fluctuating');
  });

  it('changes more than a minute apart are not fluctuating', () => {
    expect(dynamics(freqs([2, 30], [1.5, 30], [2, 180], [1.5, 30], [2, 300])).frequency).toBe('static');
  });

  it('1 → 1.5 → 1 → 1.5 Hz is fluctuating', () => {
    expect(dynamics(freqs([1, 5], [1.5, 5], [1, 5], [1.5, 5])).overall).toBe('fluctuating');
  });

  it('spiky → sharp → blunt, three cycles each, is evolving in morphology', () => {
    const segs: Segment[] = ['spiky', 'sharp', 'blunt'].map((morphology) => ({
      frequencyHz: 1, durationSec: 3, morphology, electrodes: ['T7'],
    }));
    expect(dynamics(segs).morphology).toBe('evolving');
  });

  it('alternating between two morphologies is fluctuating, not evolving', () => {
    const segs: Segment[] = ['a', 'b', 'a', 'b'].map((morphology) => ({
      frequencyHz: 1, durationSec: 5, morphology, electrodes: ['T7'],
    }));
    expect(dynamics(segs).morphology).toBe('fluctuating');
  });

  it('T7, then F7+T7, then F7+T7+P7 is evolving in location', () => {
    const segs: Segment[] = [['T7'], ['F7', 'T7'], ['F7', 'T7', 'P7']].map((electrodes) => ({
      frequencyHz: 1, durationSec: 3, morphology: 'sharp', electrodes,
    }));
    expect(dynamics(segs).location).toBe('evolving');
  });

  it('changes split across categories are not evolution', () => {
    const segs: Segment[] = [
      { frequencyHz: 1, durationSec: 5, morphology: 'a', electrodes: ['T7'] },
      { frequencyHz: 1.5, durationSec: 5, morphology: 'a', electrodes: ['T7'] },
      { frequencyHz: 1.5, durationSec: 5, morphology: 'b', electrodes: ['T7'] },
    ];
    expect(dynamics(segs).overall).toBe('static');
  });
});

describe('10-second average frequency', () => {
  it('is null under 10 s', () => {
    expect(maxTenSecondAverage(freqs([3, 8]))).toBeNull();
  });

  it('finds the densest window', () => {
    // Best window: 5 s at 4 Hz + 5 s at 1 Hz = 25 discharges.
    expect(maxTenSecondAverage(freqs([1, 5], [4, 5], [1, 10]))).toBeCloseTo(2.5);
  });
});

describe('classification', () => {
  it('LPDs at 1.5 Hz are IIC by criterion A', () => {
    const c = classify(pattern());
    expect(c.category).toBe('IIC');
    expect(c.reasons.map((r) => r.ref)).toContain('iic-a');
  });

  it('exactly 2.5 Hz is IIC, not seizure', () => {
    expect(classify(pattern({ segments: freqs([1, 5], [4, 5], [1, 10]) })).category).toBe('IIC');
  });

  it('LPDs at 0.75 Hz need plus or fluctuation', () => {
    expect(classify(pattern({ segments: freqs([0.75, 60]) })).category).toBe('RPP');
    const plus = classify(pattern({ segments: freqs([0.75, 60]), plus: { F: true, R: false, S: false } }));
    expect(plus.category).toBe('IIC');
    expect(plus.reasons.map((r) => r.ref)).toContain('iic-b');
  });

  it('PDs below 0.5 Hz are not IIC even with plus', () => {
    expect(classify(pattern({ segments: freqs([0.4, 60]), plus: { F: true, R: false, S: false } })).category).toBe('RPP');
  });

  it('GRDA is never IIC, even fast and with plus', () => {
    const c = classify(pattern({ location: 'G', type: 'RDA', segments: freqs([3, 60]), plus: { F: true, R: false, S: true } }));
    expect(c.category).toBe('RPP');
  });

  it('LRDA >1 Hz needs plus or fluctuation', () => {
    const lrda = { type: 'RDA', segments: freqs([1.5, 60]) } as const;
    expect(classify(pattern(lrda)).category).toBe('RPP');
    expect(classify(pattern({ ...lrda, plus: { F: false, R: false, S: true } })).category).toBe('IIC');
    expect(classify(pattern({ ...lrda, segments: freqs([1.5, 5], [2, 5], [1.5, 5], [2, 5]) })).category).toBe('IIC');
  });

  it('+S on PDs does not count toward the IIC', () => {
    expect(classify(pattern({ segments: freqs([0.75, 60]), plus: { F: false, R: false, S: true } })).category).toBe('RPP');
  });

  it('PDs above 2.5 Hz for ≥10 s are a seizure, not IIC', () => {
    const c = classify(pattern({ segments: freqs([3, 12]) }));
    expect(c.category).toBe('ESz');
    expect(c.reasons.map((r) => r.ref)).toContain('pd-sw-above-2.5');
  });

  it('PDs above 2.5 Hz for under 10 s are not a seizure', () => {
    expect(classify(pattern({ segments: freqs([3, 8]) })).category).toBe('RPP');
  });

  it('RDA above 2.5 Hz is not a seizure by frequency alone', () => {
    expect(classify(pattern({ type: 'RDA', segments: freqs([3, 60]) })).category).toBe('RPP');
  });

  it('evolution for ≥10 s is a seizure regardless of frequency', () => {
    const c = classify(pattern({ type: 'RDA', segments: freqs([1, 5], [1.5, 5], [2, 5]) }));
    expect(c.category).toBe('ESz');
    expect(c.reasons.map((r) => r.ref)).toContain('esz');
  });

  it('evolution under 10 s is an evolving RPP', () => {
    expect(classify(pattern({ segments: freqs([3, 1], [2, 1.5], [1.5, 2]) })).category).toBe('RPP');
  });

  it('a seizure for ≥10 continuous minutes is ESE', () => {
    expect(classify(pattern({ segments: freqs([3, 660]) })).category).toBe('ESE');
  });

  it('a seizure pattern present ≥20% of the hour is ESE', () => {
    expect(classify(pattern({ segments: freqs([3, 30]), prevalencePct: 25 })).category).toBe('ESE');
  });

  it('flags when a positive ASM trial would make IIC possible ECSE', () => {
    expect(classify(pattern({ prevalencePct: 30 })).possibleECSEIfTrialPositive).toBe(true);
    expect(classify(pattern({ prevalencePct: 5 })).possibleECSEIfTrialPositive).toBe(false);
  });

  it('over 4 Hz and under 10 s is BIRDs territory', () => {
    expect(classify(pattern({ type: 'RDA', segments: freqs([5, 3]) })).category).toBe('birds-range');
  });

  it('under six cycles is not a rhythmic or periodic pattern', () => {
    expect(classify(pattern({ segments: freqs([1, 5]) })).category).toBe('not-rpp');
  });
});

describe('terms', () => {
  it('assembles ACNS names', () => {
    expect(mainTerm(pattern({ plus: { F: true, R: true, S: false } }))).toBe('LPDs+FR');
    expect(mainTerm(pattern({ location: 'G', type: 'RDA', stimulusInduced: true, plus: { F: false, R: false, S: true } }))).toBe('SI-GRDA+S');
    expect(mainTerm(pattern({ location: 'BI', type: 'RDA', plus: { F: true, R: false, S: true } }))).toBe('BIRDA+FS');
  });

  it('drops plus subtypes that do not apply, and reports them', () => {
    const sw = pattern({ location: 'G', type: 'SW', plus: { F: true, R: false, S: false } });
    expect(mainTerm(sw)).toBe('GSW');
    expect(validate(sw).map((i) => i.ref)).toEqual(['plus']);
    expect(validate(pattern({ type: 'RDA', triphasic: true })).map((i) => i.ref)).toEqual(['triphasic']);
  });

  it('writes the full description', () => {
    const p = pattern({ prevalencePct: 60, plus: { F: true, R: false, S: false }, segments: freqs([1, 5], [1.5, 5], [1, 5], [1.5, 5]) });
    expect(fullTerm(p)).toBe('Abundant LPDs+F, 1–1.5 Hz, brief (20 s), fluctuating');
  });

  it('names a seizure as a seizure, not by its RPP term', () => {
    const gpds = pattern({ location: 'G', segments: freqs([3, 60]) });
    expect(reportedTerm(gpds, classify(gpds).category)).toBe('Electrographic seizure, generalized, 3 Hz, intermediate duration (1 min), static');
    const brief = pattern({ location: 'G', segments: freqs([3, 8]) });
    expect(reportedTerm(brief, classify(brief).category)).toBe('Occasional GPDs, 3 Hz, very brief (8 s), static');
  });

  it('uses ACNS duration cutoffs', () => {
    expect([9.9, 10, 59, 60, 599, 600, 3599, 3600].map(durationCategory)).toEqual([
      'very brief', 'brief', 'brief', 'intermediate duration', 'intermediate duration', 'long', 'long', 'very long',
    ]);
  });

  it('uses ACNS prevalence cutoffs', () => {
    expect([95, 90, 89, 50, 10, 9, 1, 0.5].map(prevalenceCategory)).toEqual([
      'continuous', 'continuous', 'abundant', 'abundant', 'frequent', 'occasional', 'occasional', 'rare',
    ]);
  });
});
