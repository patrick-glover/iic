// The Pattern object every view reads from. Terms and thresholds follow
// Hirsch et al., ACNS Standardized Critical Care EEG Terminology 2021.

/** ACNS main term 1. */
export type Location = 'G' | 'L' | 'BI' | 'UI' | 'Mf';

/** ACNS main term 2: periodic discharges, rhythmic delta, spike/sharp-and-wave. */
export type PatternType = 'PD' | 'RDA' | 'SW';

/** Plus subtypes. F applies to PDs and RDA, R to PDs only, S to RDA only, none to SW. */
export interface Plus {
  F: boolean;
  R: boolean;
  S: boolean;
}

/**
 * A stretch of the pattern during which frequency, morphology, and location
 * are constant. A static pattern is one segment; evolution and fluctuation are
 * sequences of segments, and are computed from them rather than stored.
 */
export interface Segment {
  durationSec: number;
  frequencyHz: number;
  /** Label for the discharge shape; any change in label counts as a morphology change. */
  morphology: string;
  /** Involved standard 10-20 electrodes, e.g. ['F7', 'T7']. */
  electrodes: string[];
}

export type Etiology =
  | 'anoxic'
  | 'TBI'
  | 'ICH/SAH'
  | 'stroke'
  | 'infection'
  | 'metabolic'
  | 'toxic'
  | 'other';

export interface Pattern {
  location: Location;
  type: PatternType;
  plus: Plus;
  segments: Segment[];
  /**
   * Percent of the epoch that includes the pattern. The epoch is treated as a
   * 60-minute window so the ESE 20% rule can apply to it.
   */
  prevalencePct: number;
  stimulusInduced: boolean;
  /** Minor modifier; applies to PDs and SW, not RDA. */
  triphasic: boolean;
  /** EEG findings elsewhere in the record, used by 2HELPS2B. */
  record: {
    sporadicEDs: boolean;
    BIRDs: boolean;
  };
  clinical: {
    priorSeizure: boolean;
    etiology: Etiology;
  };
}

export type Prevalence = 'continuous' | 'abundant' | 'frequent' | 'occasional' | 'rare';
