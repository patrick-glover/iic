// Where a Pattern falls by ACNS 2021 definitions: electrographic seizure,
// electrographic status epilepticus, IIC, or a rhythmic/periodic pattern that
// is none of these. Every decision carries the glossary entries behind it so
// views can show the resident why.

import { dynamics, type Dynamics } from './dynamics';
import { hasPlus } from './term';
import { formatDuration, maxTenSecondAverage, totalCycles, totalDuration } from './timing';
import type { Pattern } from './types';

export type Category =
  /** Under six cycles: not a rhythmic or periodic pattern at all. */
  | 'not-rpp'
  /** Over 4 Hz and under 10 s: BIRDs territory, which depends on features outside the Pattern. */
  | 'birds-range'
  | 'RPP'
  | 'IIC'
  | 'ESz'
  | 'ESE';

export interface Reason {
  text: string;
  /** Glossary entry id in content/acns-2021.json. */
  ref: string;
}

export interface Classification {
  category: Category;
  reasons: Reason[];
  durationSec: number;
  /** Highest 10-second average frequency, or null if the pattern is under 10 s. */
  maxAvgHz: number | null;
  dynamics: Dynamics;
  /**
   * IIC present long enough that a positive parenteral ASM trial (EEG better,
   * clinical state not) would make it possible electroclinical SE.
   */
  possibleECSEIfTrialPositive: boolean;
}

const ESE_CONTINUOUS_SEC = 600;
const ESE_HOURLY_PCT = 20;

export function classify(p: Pattern): Classification {
  const durationSec = totalDuration(p.segments);
  const maxAvgHz = maxTenSecondAverage(p.segments);
  const dyn = dynamics(p.segments);
  const reasons: Reason[] = [];
  const result = (category: Category, possibleECSEIfTrialPositive = false): Classification => ({
    category,
    reasons,
    durationSec,
    maxAvgHz,
    dynamics: dyn,
    possibleECSEIfTrialPositive,
  });
  const longOrBurdensome = durationSec >= ESE_CONTINUOUS_SEC || p.prevalencePct >= ESE_HOURLY_PCT;

  if (totalCycles(p.segments) < 6) {
    reasons.push({ text: 'Fewer than six cycles, so it does not qualify as rhythmic or periodic.', ref: 'rpp-min-cycles' });
    return result('not-rpp');
  }

  // Electrographic seizure, criterion B: definite evolution lasting ≥10 s.
  if (dyn.overall === 'evolving' && durationSec >= 10) {
    reasons.push({ text: `Evolves in ${evolvingCategories(dyn)} and lasts ${formatDuration(durationSec)} (≥10 s).`, ref: 'esz' });
  }
  // Criterion A: PDs or SW averaging >2.5 Hz over 10 s.
  if (maxAvgHz !== null && p.type !== 'RDA' && maxAvgHz > 2.5) {
    reasons.push({
      text: `Discharges average ${fmt(maxAvgHz)} Hz (above 2.5 Hz) and the pattern lasts ${formatDuration(durationSec)} (≥10 s).`,
      ref: 'pd-sw-above-2.5',
    });
  }
  // Any rhythmic pattern above 4 Hz for ≥10 s.
  if (maxAvgHz !== null && maxAvgHz > 4) {
    reasons.push({ text: `Averages ${fmt(maxAvgHz)} Hz (above 4 Hz) for ${formatDuration(durationSec)} (≥10 s).`, ref: 'rpp-above-4' });
  }
  if (reasons.length > 0) {
    if (longOrBurdensome) {
      reasons.push({
        text: durationSec >= ESE_CONTINUOUS_SEC
          ? 'Seizure lasts ≥10 continuous minutes.'
          : `Present ${fmt(p.prevalencePct)}% of the hour, at or above 20%.`,
        ref: 'ese',
      });
      return result('ESE');
    }
    return result('ESz');
  }

  if (durationSec < 10) {
    if (p.segments.some((s) => s.frequencyHz > 4)) {
      reasons.push({ text: 'Over 4 Hz but under 10 s: assess as possible BIRDs.', ref: 'birds' });
      return result('birds-range');
    }
    reasons.push({
      text: dyn.overall === 'evolving'
        ? `Evolves, but lasts ${formatDuration(durationSec)} (under 10 s): an evolving RPP, not a seizure.`
        : `Lasts ${formatDuration(durationSec)} (under 10 s), too short for seizure or IIC criteria.`,
      ref: dyn.overall === 'evolving' ? 'esz' : 'iic-a',
    });
    return result('RPP');
  }

  const hz = maxAvgHz as number;
  const plus = hasPlus(p);
  const fluct = dyn.overall === 'fluctuating';
  const plusOrFluct = [plus && 'a plus modifier', fluct && 'fluctuation'].filter(Boolean).join(' and ');

  if (p.type !== 'RDA' && hz > 1 && hz <= 2.5) {
    reasons.push({ text: `${typeName(p)} averaging ${fmt(hz)} Hz, in the >1 to 2.5 Hz band.`, ref: 'iic-a' });
  } else if (p.type !== 'RDA' && hz >= 0.5 && hz <= 1 && (plus || fluct)) {
    reasons.push({ text: `${typeName(p)} averaging ${fmt(hz)} Hz with ${plusOrFluct}.`, ref: 'iic-b' });
  } else if (p.type === 'RDA' && p.location !== 'G' && hz > 1 && (plus || fluct)) {
    reasons.push({ text: `Lateralized RDA averaging ${fmt(hz)} Hz with ${plusOrFluct}.`, ref: 'iic-c' });
  }
  if (reasons.length > 0) {
    reasons.push({ text: 'Does not meet seizure criteria.', ref: 'iic-not-seizure' });
    return result('IIC', longOrBurdensome);
  }

  reasons.push({ text: whyNotIIC(p, hz, plus || fluct), ref: p.type === 'RDA' ? 'iic-c' : 'iic-b' });
  return result('RPP');
}

function whyNotIIC(p: Pattern, hz: number, plusOrFluct: boolean): string {
  if (p.type === 'RDA' && p.location === 'G') return 'GRDA is not on the IIC at any frequency unless it becomes a seizure.';
  if (p.type === 'RDA' && hz <= 1) return `Lateralized RDA at ${fmt(hz)} Hz; the IIC needs >1 Hz with plus or fluctuation.`;
  if (p.type === 'RDA') return `Lateralized RDA at ${fmt(hz)} Hz without plus or fluctuation.`;
  if (hz < 0.5) return `${typeName(p)} at ${fmt(hz)} Hz, below the 0.5 Hz floor of the IIC.`;
  if (!plusOrFluct) return `${typeName(p)} at ${fmt(hz)} Hz without plus or fluctuation.`;
  return `${typeName(p)} at ${fmt(hz)} Hz.`;
}

const typeName = (p: Pattern) => (p.type === 'SW' ? 'SW' : 'PDs');
const fmt = (n: number) => `${Number(n.toFixed(2))}`;
const evolvingCategories = (d: Dynamics) =>
  (['frequency', 'morphology', 'location'] as const).filter((c) => d[c] === 'evolving').join(' and ');
