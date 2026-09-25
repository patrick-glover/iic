// Turns the builder's controls into a Pattern. The resident picks a starting
// frequency, a duration, and static / fluctuating / evolving; this lays out the
// timed segments that make it so, and the rules engine judges the result.

import type { Location, Pattern, PatternType, Plus, Segment } from './acns/types';

export type Shape = 'static' | 'fluctuating' | 'evolving';

export interface BuilderSettings {
  location: Location;
  type: PatternType;
  plus: Plus;
  frequencyHz: number;
  durationSec: number;
  shape: Shape;
  prevalencePct: number;
  stimulusInduced: boolean;
  triphasic: boolean;
}

export const defaultSettings: BuilderSettings = {
  location: 'L',
  type: 'PD',
  plus: { F: false, R: false, S: false },
  frequencyHz: 1,
  durationSec: 60,
  shape: 'static',
  prevalencePct: 5,
  stimulusInduced: false,
  triphasic: false,
};

const STEP_HZ = 0.5;
const MAX_HZ = 4;

const segment = (frequencyHz: number, durationSec: number): Segment => ({
  frequencyHz,
  durationSec,
  morphology: 'typical',
  electrodes: ['T7'],
});

/** Seconds per level: long enough for comfortably more than three cycles at the slowest frequency. */
const levelSec = (slowestHz: number) => Math.max(5, 3.5 / slowestHz);

export function toSegments(s: Pick<BuilderSettings, 'frequencyHz' | 'durationSec' | 'shape'>): Segment[] {
  const f = s.frequencyHz;
  const total = s.durationSec;

  if (s.shape === 'static') return [segment(f, total)];

  if (s.shape === 'fluctuating') {
    // Back and forth by 0.5 Hz, each level well under a minute.
    const other = f + STEP_HZ <= MAX_HZ ? f + STEP_HZ : f - STEP_HZ;
    const len = levelSec(Math.min(f, other));
    const segs: Segment[] = [];
    for (let t = 0, i = 0; t < total; t += len, i++) {
      segs.push(segment(i % 2 === 0 ? f : other, Math.min(len, total - t)));
    }
    return segs;
  }

  // Evolving: two 0.5 Hz steps in one direction, then hold at the last level.
  const dir = f + 2 * STEP_HZ <= MAX_HZ ? 1 : -1;
  const freqs = [f, f + dir * STEP_HZ, f + dir * 2 * STEP_HZ];
  const len = Math.min(levelSec(Math.min(...freqs)), total / 3);
  return [segment(freqs[0], len), segment(freqs[1], len), segment(freqs[2], total - 2 * len)];
}

const HOUR_SEC = 3600;

/**
 * Lowest prevalence a run of this length allows: one run alone is that share
 * of the hour. Under 1% it rounds down so rare stays reachable.
 */
export const minPrevalencePct = (durationSec: number) => {
  const pct = (100 * Math.min(durationSec, HOUR_SEC)) / HOUR_SEC;
  return pct < 1 ? 0 : Math.ceil(pct);
};

export interface Run {
  startSec: number;
  durationSec: number;
}

/**
 * Where the runs fall in the hour: as many runs of the chosen length as the
 * prevalence implies, spread evenly. The spacing is schematic; ACNS only
 * counts the total.
 */
export function runsInHour(s: Pick<BuilderSettings, 'durationSec' | 'prevalencePct'>): Run[] {
  const d = Math.min(s.durationSec, HOUR_SEC);
  const wanted = Math.round((s.prevalencePct / 100) * HOUR_SEC / d);
  const n = Math.max(1, Math.min(wanted, Math.floor(HOUR_SEC / d)));
  const slot = HOUR_SEC / n;
  return Array.from({ length: n }, (_, i) => ({ startSec: i * slot + (slot - d) / 2, durationSec: d }));
}

export function toPattern(s: BuilderSettings): Pattern {
  return {
    location: s.location,
    type: s.type,
    plus: s.plus,
    segments: toSegments(s),
    prevalencePct: s.prevalencePct,
    stimulusInduced: s.stimulusInduced,
    triphasic: s.triphasic,
    record: { sporadicEDs: false, BIRDs: false },
    clinical: { priorSeizure: false, etiology: 'other' },
  };
}
