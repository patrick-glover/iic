import { describe, expect, it } from 'vitest';
import { classify } from './acns/classify';
import { fullTerm, validate } from './acns/term';
import { durationCategory, prevalenceCategory, totalDuration } from './acns/timing';
import { runsInHour } from './builder';
import { toPattern } from './builder';
import { blankAnswer, grade, minGapSec, nextCode, patternFromCode, patternFromSeed, randomPattern, randomSettings, type Answer } from './quiz';
import { mulberry32, nextSeed } from './seed';
import { decodeSeed, decodeSettings, encodeSeed, encodeSettings } from './share';

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

  it('space runs far enough apart to read as separate runs', () => {
    for (const p of patterns) {
      const d = p.segments.reduce((t, s) => t + s.durationSec, 0);
      const runs = runsInHour({ durationSec: d, prevalencePct: p.prevalencePct });
      if (d >= 3600) continue;
      expect(3600 / runs.length - d, fullTerm(p)).toBeGreaterThanOrEqual(minGapSec(d) - 1e-9);
      if (prevalenceCategory(p.prevalencePct) === 'continuous') expect.fail(`continuous with ${d} s runs: ${fullTerm(p)}`);
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

describe('quiz seeds', () => {
  const seeds = [0, 1, 42, 0x7fffffff, 0xffffffff, 3_141_592_653];

  it('round-trip through a short opaque code', () => {
    for (const s of seeds) {
      const code = encodeSeed(s);
      expect(code).toMatch(/^a[0-9A-Za-z]{6}$/);
      expect(decodeSeed(code)).toBe(s);
    }
  });

  it('reject codes that are not for this generator', () => {
    for (const bad of ['', 'quiz', 'a12345', 'a1234567', 'b000000', 'a00000!', 'azzzzzz']) expect(decodeSeed(bad)).toBeNull();
  });

  it('give the same pattern for the same seed', () => {
    for (const s of seeds) expect(patternFromSeed(s)).toEqual(patternFromSeed(s));
  });

  it('step to a fixed next seed that gives a different pattern', () => {
    expect(nextSeed(42)).toBe(nextSeed(42));
    const chain = [42];
    for (let i = 0; i < 20; i++) chain.push(nextSeed(chain[i]));
    expect(new Set(chain).size).toBe(chain.length);
    expect(patternFromSeed(chain[1])).not.toEqual(patternFromSeed(chain[0]));
  });
});

describe('composer quiz codes', () => {
  const rng = mulberry32(99);
  const made = Array.from({ length: 2000 }, () => {
    const s = randomSettings(rng);
    return { ...s, prevalencePct: Math.round(s.prevalencePct), stimulusInduced: rng() < 0.5 };
  });

  it('round-trip every setting the composer can make', () => {
    for (const s of made) {
      const code = encodeSettings(s);
      expect(code).toMatch(/^c[0-9A-Za-z]{6}$/);
      expect(decodeSettings(code)).toEqual(s);
    }
  });

  it('open the composed pattern in the quiz', () => {
    for (const s of made.slice(0, 50)) expect(patternFromCode(encodeSettings(s))).toEqual(toPattern(s));
  });

  it("don't read like the settings: one step in frequency changes most of the code", () => {
    const diffs = made.slice(0, 200).map((s) => {
      const a = encodeSettings(s);
      const b = encodeSettings({ ...s, frequencyHz: s.frequencyHz === 4 ? 3.75 : s.frequencyHz + 0.25 });
      return [...a].filter((c, i) => c !== b[i]).length;
    });
    expect(diffs.reduce((t, d) => t + d, 0) / diffs.length).toBeGreaterThan(4);
  });

  it('reject seed codes, garbage, and most random c-codes', () => {
    expect(decodeSettings(encodeSeed(42))).toBeNull();
    expect(decodeSettings('c!!!!!!')).toBeNull();
    const r = mulberry32(5);
    let accepted = 0;
    for (let i = 0; i < 1000; i++) if (decodeSettings('c' + encodeSeed(Math.floor(r() * 2 ** 32)).slice(1))) accepted++;
    expect(accepted).toBeLessThan(50);
  });

  it('lead on to the same next pattern for everyone', () => {
    const c = encodeSettings(made[0]);
    expect(nextCode(c)).toBe(nextCode(c));
    expect(nextCode(c)).toMatch(/^a/);
  });
});

describe('seed codes already shared', () => {
  it('keep their meaning', () => {
    expect(decodeSeed('a0000G8')).toBe(1000);
    expect(nextCode('a0000G8')).toBe(encodeSeed(nextSeed(1000)));
  });
});
