// Name-that-pattern mode: draw a random pattern, let the resident name it
// from the trace alone, then grade each part of the name against what the
// rules engine computes. Grading always reads the Pattern, never the settings
// that made it, so a short "evolving" run that doesn't actually evolve is
// graded as the static pattern it is.

import { classify, type Category } from './acns/classify';
import { categoryLabel } from './labels';
import { dynamics, type Dynamic } from './acns/dynamics';
import { effectivePlus } from './acns/term';
import { durationCategory, prevalenceCategory, totalDuration, type DurationCategory } from './acns/timing';
import type { Location, Pattern, PatternType, Plus, Prevalence } from './acns/types';
import { runsInHour, toPattern, type BuilderSettings, type Shape } from './builder';

/** The categories a quiz pattern can land in. */
export type QuizCategory = Extract<Category, 'ESE' | 'ESz' | 'IIC' | 'RPP'>;

export interface Answer {
  prevalence: Prevalence | null;
  location: Location | null;
  type: PatternType | null;
  plus: Plus;
  frequencyHz: number;
  duration: DurationCategory | null;
  dynamic: Dynamic | null;
  triphasic: boolean;
  category: QuizCategory | null;
}

export const blankAnswer = (): Answer => ({
  prevalence: null,
  location: null,
  type: null,
  plus: { F: false, R: false, S: false },
  frequencyHz: 1,
  duration: null,
  dynamic: null,
  triphasic: false,
  category: null,
});

type Rng = () => number;
const pick = <T>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];

const LOCATIONS: Location[] = ['G', 'L', 'BI', 'UI', 'Mf'];
const TYPES: PatternType[] = ['PD', 'RDA', 'SW'];
const SHAPES: Shape[] = ['static', 'fluctuating', 'evolving'];
const DURATIONS = [8, 15, 60, 300, 900, 3600];
const PREVALENCE_BANDS: [number, number][] = [
  [0, 1],
  [1, 10],
  [10, 50],
  [50, 90],
  [90, 100],
];
const CATEGORIES: QuizCategory[] = ['ESE', 'ESz', 'IIC', 'RPP'];

/**
 * A random pattern the builder could make. Stimulus-induced is left off: the
 * trace has no stimulus marker, so it can't be read from the EEG.
 */
export function randomSettings(rng: Rng = Math.random): BuilderSettings {
  const type = pick(TYPES, rng);
  const minHz = type === 'RDA' ? 0.5 : 0.25;
  const durationSec = pick(DURATIONS, rng);
  const [lo, hi] = pick(PREVALENCE_BANDS, rng);
  // Prevalence is what the hour strip shows, whole runs and all, so the
  // resident can read the right category off it.
  const runs = runsInHour({ durationSec, prevalencePct: lo + rng() * (hi - lo) });
  const prevalencePct = (runs.reduce((t, r) => t + r.durationSec, 0) / 3600) * 100;
  return {
    location: pick(LOCATIONS, rng),
    type,
    plus: {
      F: type !== 'SW' && rng() < 0.3,
      R: type === 'PD' && rng() < 0.25,
      S: type === 'RDA' && rng() < 0.3,
    },
    frequencyHz: minHz + 0.25 * Math.floor(rng() * ((4 - minHz) / 0.25 + 1)),
    durationSec,
    shape: pick(SHAPES, rng),
    prevalencePct,
    stimulusInduced: false,
    triphasic: type !== 'RDA' && rng() < 0.2,
  };
}

/** A pattern whose category is drawn evenly from seizure, status, IIC, and not IIC. */
export function randomPattern(rng: Rng = Math.random): Pattern {
  const target = pick(CATEGORIES, rng);
  let p = toPattern(randomSettings(rng));
  for (let i = 0; i < 500; i++) {
    if (classify(p).category === target) return p;
    p = toPattern(randomSettings(rng));
  }
  return p;
}

export interface Mark {
  label: string;
  given: string;
  truth: string;
  correct: boolean;
}

/** Answers within a quarter hertz of the pattern's frequency range count. */
const HZ_TOLERANCE = 0.25;

const plusText = (p: Plus) => {
  const s = (p.F ? 'F' : '') + (p.R ? 'R' : '') + (p.S ? 'S' : '');
  return s ? `+${s}` : 'none';
};
const hzText = (lo: number, hi: number) => (lo === hi ? `${lo} Hz` : `${lo}–${hi} Hz`);
const or = (v: string | null) => v ?? '—';

export function grade(p: Pattern, a: Answer): Mark[] {
  const truePlus = effectivePlus(p);
  const freqs = p.segments.map((s) => s.frequencyHz);
  const lo = Math.min(...freqs);
  const hi = Math.max(...freqs);
  const prevalence = prevalenceCategory(p.prevalencePct);
  const duration = durationCategory(totalDuration(p.segments));
  const dynamic = dynamics(p.segments).overall;
  const category = classify(p).category;
  const triphasic = p.triphasic && p.type !== 'RDA';
  const typeText = (t: PatternType | null) => (t === 'PD' ? 'PDs' : or(t));
  const yesNo = (b: boolean) => (b ? 'yes' : 'no');

  return [
    { label: 'Prevalence', given: or(a.prevalence), truth: prevalence, correct: a.prevalence === prevalence },
    { label: 'Location', given: or(a.location), truth: p.location, correct: a.location === p.location },
    { label: 'Pattern', given: typeText(a.type), truth: typeText(p.type), correct: a.type === p.type },
    {
      label: 'Plus',
      given: plusText(a.plus),
      truth: plusText(truePlus),
      correct: a.plus.F === truePlus.F && a.plus.R === truePlus.R && a.plus.S === truePlus.S,
    },
    {
      label: 'Frequency',
      given: `${a.frequencyHz} Hz`,
      truth: hzText(lo, hi),
      correct: a.frequencyHz >= lo - HZ_TOLERANCE && a.frequencyHz <= hi + HZ_TOLERANCE,
    },
    { label: 'Duration', given: or(a.duration), truth: duration, correct: a.duration === duration },
    { label: 'Over time', given: or(a.dynamic), truth: dynamic, correct: a.dynamic === dynamic },
    { label: 'Triphasic', given: yesNo(a.triphasic), truth: yesNo(triphasic), correct: a.triphasic === triphasic },
    {
      label: 'Classification',
      given: a.category ? categoryLabel[a.category] : '—',
      truth: categoryLabel[category],
      correct: a.category === category,
    },
  ];
}
