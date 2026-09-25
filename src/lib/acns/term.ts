// Assembles the ACNS 2021 name for a Pattern and flags modifiers that do not
// apply to its type.

import { dynamics } from './dynamics';
import { durationCategory, formatDuration, prevalenceCategory, totalDuration } from './timing';
import type { Pattern, Plus } from './types';

export interface Issue {
  message: string;
  /** Glossary entry id in content/acns-2021.json. */
  ref: string;
}

/** The plus subtypes that apply to this pattern's type; the rest are ignored. */
export function effectivePlus(p: Pattern): Plus {
  return {
    F: p.plus.F && p.type !== 'SW',
    R: p.plus.R && p.type === 'PD',
    S: p.plus.S && p.type === 'RDA',
  };
}

export const hasPlus = (p: Pattern): boolean => Object.values(effectivePlus(p)).some(Boolean);

export function validate(p: Pattern): Issue[] {
  const issues: Issue[] = [];
  if (p.segments.length === 0) issues.push({ message: 'A pattern needs at least one segment.', ref: 'rpp-min-cycles' });
  if (p.type === 'SW' && (p.plus.F || p.plus.R || p.plus.S))
    issues.push({ message: 'Plus modifiers do not apply to SW.', ref: 'plus' });
  if (p.plus.R && p.type === 'RDA') issues.push({ message: '+R applies to PDs only.', ref: 'plus-r' });
  if (p.plus.S && p.type === 'PD') issues.push({ message: '+S applies to RDA only.', ref: 'plus-s' });
  if (p.triphasic && p.type === 'RDA')
    issues.push({ message: 'Triphasic morphology applies to PDs and SW, not RDA.', ref: 'triphasic' });
  if (p.type === 'RDA' && p.segments.some((s) => s.frequencyHz < 0.5))
    issues.push({ message: 'RDA is 0.5 to 4 Hz by definition.', ref: 'rda' });
  return issues;
}

const TYPE_NAME = { PD: 'PDs', RDA: 'RDA', SW: 'SW' } as const;

/** e.g. "LPDs+FR", "SI-GRDA+S", "BIPDs". */
export function mainTerm(p: Pattern): string {
  const plus = effectivePlus(p);
  const suffix = (plus.F ? 'F' : '') + (plus.R ? 'R' : '') + (plus.S ? 'S' : '');
  return `${p.stimulusInduced ? 'SI-' : ''}${p.location}${TYPE_NAME[p.type]}${suffix ? '+' + suffix : ''}`;
}

const formatHz = (hz: number) => `${Number(hz.toFixed(2))}`;

const LOCATION_WORD = {
  G: 'generalized',
  L: 'lateralized',
  BI: 'bilateral independent',
  UI: 'unilateral independent',
  Mf: 'multifocal',
} as const;

/**
 * The name to report. A pattern that meets seizure criteria is named as a
 * seizure, not by its RPP term: ACNS says PDs over 2.5 Hz for ≥10 s "should be
 * referred to as such rather than as PDs or SW".
 */
export function reportedTerm(p: Pattern, category: string): string {
  if (category !== 'ESz' && category !== 'ESE') return fullTerm(p);
  const name = category === 'ESE' ? 'electrographic status epilepticus' : 'electrographic seizure';
  const full = fullTerm(p).split(', ').slice(1); // drop "Prevalence TERM", keep frequency, duration, dynamics...
  const head = `${p.stimulusInduced ? 'SI-' : ''}${name}`;
  return `${head[0].toUpperCase()}${head.slice(1)}, ${LOCATION_WORD[p.location]}, ${full.join(', ')}`;
}

/** e.g. "Abundant LPDs+F, 1–2 Hz, brief (40 s), fluctuating, with triphasic morphology". */
export function fullTerm(p: Pattern): string {
  const prevalence = prevalenceCategory(p.prevalencePct);
  const freqs = p.segments.map((s) => s.frequencyHz);
  const lo = Math.min(...freqs);
  const hi = Math.max(...freqs);
  const freq = lo === hi ? `${formatHz(lo)} Hz` : `${formatHz(lo)}–${formatHz(hi)} Hz`;
  const sec = totalDuration(p.segments);
  const parts = [
    `${prevalence[0].toUpperCase()}${prevalence.slice(1)} ${mainTerm(p)}`,
    freq,
    `${durationCategory(sec)} (${formatDuration(sec)})`,
    dynamics(p.segments).overall,
  ];
  if (p.triphasic && p.type !== 'RDA') parts.push('with triphasic morphology');
  return parts.join(', ');
}
