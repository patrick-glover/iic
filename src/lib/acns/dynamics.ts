// Evolving vs fluctuating vs static, per ACNS 2021 section C3h.
// Each category (frequency, morphology, location) is judged on its own; the
// two consecutive changes that make evolution must be in the same category.

import type { Segment } from './types';

export type Dynamic = 'evolving' | 'fluctuating' | 'static';
export type Category = 'frequency' | 'morphology' | 'location';

export interface Dynamics {
  overall: Dynamic;
  frequency: Dynamic;
  morphology: Dynamic;
  location: Dynamic;
}

const MIN_CYCLES = 3;
const MIN_FREQ_STEP = 0.5;
const EVOLUTION_MAX_UNCHANGED_SEC = 300;
const FLUCTUATION_MAX_GAP_SEC = 60;
const EPS = 1e-9;

interface Level<V> {
  value: V;
  durationSec: number;
  cycles: number;
}

interface CategoryRules<V> {
  value(s: Segment): V;
  /** Whether b is the same level as a (no qualifying change between them). */
  same(a: V, b: V): boolean;
  /** Whether levels a → b → c are two consecutive changes that count as evolution. */
  evolves(a: V, b: V, c: V): boolean;
}

const frequencyRules: CategoryRules<number> = {
  value: (s) => s.frequencyHz,
  same: (a, b) => Math.abs(a - b) < MIN_FREQ_STEP - EPS,
  evolves: (a, b, c) => {
    const d1 = b - a;
    const d2 = c - b;
    return Math.sign(d1) === Math.sign(d2) && Math.abs(d1) >= MIN_FREQ_STEP - EPS && Math.abs(d2) >= MIN_FREQ_STEP - EPS;
  },
};

const morphologyRules: CategoryRules<string> = {
  value: (s) => s.morphology,
  same: (a, b) => a === b,
  // "Two consecutive changes to a novel morphology": A → B → C, not A → B → A.
  evolves: (a, b, c) => a !== b && b !== c && a !== c,
};

const isStrictSubset = (a: string[], b: string[]) =>
  a.length < b.length && a.every((e) => b.includes(e));

const locationRules: CategoryRules<string[]> = {
  value: (s) => [...s.electrodes].sort(),
  same: (a, b) => a.length === b.length && a.every((e, i) => e === b[i]),
  // Sequentially spreading into, or sequentially out of, further electrodes.
  evolves: (a, b, c) =>
    (isStrictSubset(a, b) && isStrictSubset(b, c)) || (isStrictSubset(c, b) && isStrictSubset(b, a)),
};

/**
 * Collapse segments into levels of one category. Adjacent segments that are
 * the same level merge; a level lasting under three cycles does not count as
 * present, so it is dropped and its neighbours may merge.
 */
function levels<V>(segments: Segment[], rules: CategoryRules<V>): Level<V>[] {
  const merge = (items: Level<V>[]) => {
    const out: Level<V>[] = [];
    for (const item of items) {
      const last = out[out.length - 1];
      if (last && rules.same(last.value, item.value)) {
        last.durationSec += item.durationSec;
        last.cycles += item.cycles;
      } else {
        out.push({ ...item });
      }
    }
    return out;
  };
  const raw = segments.map((s) => ({
    value: rules.value(s),
    durationSec: s.durationSec,
    cycles: s.durationSec * s.frequencyHz,
  }));
  return merge(merge(raw).filter((l) => l.cycles >= MIN_CYCLES - EPS));
}

function judge<V>(segments: Segment[], rules: CategoryRules<V>): Dynamic {
  const ls = levels(segments, rules);

  for (let i = 0; i + 2 < ls.length; i++) {
    const [a, b, c] = [ls[i], ls[i + 1], ls[i + 2]];
    // The middle level is the stretch between the two changes; if it sits
    // unchanged for five minutes or more, the changes are not one evolution.
    if (rules.evolves(a.value, b.value, c.value) && b.durationSec < EVOLUTION_MAX_UNCHANGED_SEC) {
      return 'evolving';
    }
  }

  // Fluctuation: three or more changes, each within a minute of the last.
  // Between changes k and k+1 lies one whole level, so three changes need two
  // consecutive interior levels of at most a minute each.
  for (let i = 1; i + 2 < ls.length; i++) {
    if (ls[i].durationSec <= FLUCTUATION_MAX_GAP_SEC && ls[i + 1].durationSec <= FLUCTUATION_MAX_GAP_SEC) {
      return 'fluctuating';
    }
  }

  return 'static';
}

export function dynamics(segments: Segment[]): Dynamics {
  const frequency = judge(segments, frequencyRules);
  const morphology = judge(segments, morphologyRules);
  const location = judge(segments, locationRules);
  const all = [frequency, morphology, location];
  const overall: Dynamic = all.includes('evolving')
    ? 'evolving'
    : all.includes('fluctuating')
      ? 'fluctuating'
      : 'static';
  return { overall, frequency, morphology, location };
}
