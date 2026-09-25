import type { Prevalence, Segment } from './types';

export const totalDuration = (segments: Segment[]): number =>
  segments.reduce((sum, s) => sum + s.durationSec, 0);

export const totalCycles = (segments: Segment[]): number =>
  segments.reduce((sum, s) => sum + s.durationSec * s.frequencyHz, 0);

/** Number of discharges or waves between t0 and t1 seconds from pattern onset. */
function cyclesBetween(segments: Segment[], t0: number, t1: number): number {
  let start = 0;
  let cycles = 0;
  for (const s of segments) {
    const end = start + s.durationSec;
    const overlap = Math.min(end, t1) - Math.max(start, t0);
    if (overlap > 0) cycles += overlap * s.frequencyHz;
    start = end;
  }
  return cycles;
}

/**
 * Highest average frequency over any 10-second window, the quantity ACNS uses
 * for the seizure and IIC criteria ("averages >2.5 Hz over 10 seconds").
 * Returns null if the pattern lasts under 10 seconds.
 *
 * Frequency is piecewise constant, so the cycle count is piecewise linear in
 * the window position and its maximum falls where a window edge meets a
 * segment boundary. Checking those positions is exact.
 */
export function maxTenSecondAverage(segments: Segment[], windowSec = 10): number | null {
  const total = totalDuration(segments);
  if (total < windowSec) return null;
  const boundaries = [0];
  for (const s of segments) boundaries.push(boundaries[boundaries.length - 1] + s.durationSec);
  const starts = new Set<number>();
  for (const b of boundaries) {
    if (b + windowSec <= total) starts.add(b);
    if (b - windowSec >= 0) starts.add(b - windowSec);
  }
  let best = 0;
  for (const t of starts) best = Math.max(best, cyclesBetween(segments, t, t + windowSec) / windowSec);
  return best;
}

export type DurationCategory = 'very brief' | 'brief' | 'intermediate duration' | 'long' | 'very long';

/** Cutoffs from ACNS 2021 section C3b. */
export function durationCategory(sec: number): DurationCategory {
  if (sec < 10) return 'very brief';
  if (sec < 60) return 'brief';
  if (sec < 600) return 'intermediate duration';
  if (sec < 3600) return 'long';
  return 'very long';
}

/** e.g. "8 s", "1.5 min", "2 h". */
export function formatDuration(sec: number): string {
  const round = (n: number) => `${Number(n.toFixed(1))}`;
  if (sec < 60) return `${round(sec)} s`;
  if (sec < 3600) return `${round(sec / 60)} min`;
  return `${round(sec / 3600)} h`;
}

/** Cutoffs from ACNS 2021 section C3a. */
export function prevalenceCategory(pct: number): Prevalence {
  if (pct >= 90) return 'continuous';
  if (pct >= 50) return 'abundant';
  if (pct >= 10) return 'frequent';
  if (pct >= 1) return 'occasional';
  return 'rare';
}
