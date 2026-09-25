// Scalp geometry and the longitudinal bipolar ("double banana") montage.
// The trace simulates a potential at each 10-20 electrode, then derives each
// channel as the difference of its pair, so phase reversals and fields fall out
// of the geometry instead of being drawn by hand.

/** Approximate 10-20 positions on a unit disc, nose up (+y), left hemisphere at -x. */
export const electrodes: Record<string, [number, number]> = {
  Fp1: [-0.3, 0.95],
  Fp2: [0.3, 0.95],
  F7: [-0.8, 0.58],
  F3: [-0.4, 0.5],
  Fz: [0, 0.45],
  F4: [0.4, 0.5],
  F8: [0.8, 0.58],
  T7: [-1, 0],
  C3: [-0.5, 0],
  Cz: [0, 0],
  C4: [0.5, 0],
  T8: [1, 0],
  P7: [-0.8, -0.58],
  P3: [-0.4, -0.5],
  Pz: [0, -0.45],
  P4: [0.4, -0.5],
  P8: [0.8, -0.58],
  O1: [-0.3, -0.95],
  O2: [0.3, -0.95],
};

export type Chain = 'LT' | 'LP' | 'Z' | 'RP' | 'RT';

export interface Channel {
  a: string;
  b: string;
  chain: Chain;
}

const chain = (names: string[], c: Chain): Channel[] =>
  names.slice(1).map((b, i) => ({ a: names[i], b, chain: c }));

/** Left temporal, left parasagittal, midline, right parasagittal, right temporal. */
export const doubleBanana: Channel[] = [
  ...chain(['Fp1', 'F7', 'T7', 'P7', 'O1'], 'LT'),
  ...chain(['Fp1', 'F3', 'C3', 'P3', 'O1'], 'LP'),
  ...chain(['Fz', 'Cz', 'Pz'], 'Z'),
  ...chain(['Fp2', 'F4', 'C4', 'P4', 'O2'], 'RP'),
  ...chain(['Fp2', 'F8', 'T8', 'P8', 'O2'], 'RT'),
];

export const channelLabel = (c: Channel) => `${c.a}-${c.b}`;
