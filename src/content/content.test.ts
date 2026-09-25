import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import glossary from './acns-2021.json';

const SOURCE = new URL('../../sources/acns-2021-hirsch.txt', import.meta.url);

/** Normalize quotes, footnote asterisks, and whitespace so line breaks in the source don't matter. */
const norm = (s: string) =>
  s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\*/g, '').replace(/\s+/g, ' ').trim();

describe('ACNS glossary', () => {
  it('has unique ids', () => {
    const ids = glossary.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The full text is copyrighted and kept out of git, so this runs only where it exists.
  // Allowed edits: figure/supplement cross-references omitted, first letter
  // capitalized, and a closing period where the paper's sentence continues.
  it.skipIf(!existsSync(SOURCE))('quotes the paper verbatim', () => {
    const source = norm(readFileSync(SOURCE, 'utf8'))
      .replace(/ ?\((?:see |Figs?\. |Section )[^)]*\)/g, '')
      .toLowerCase();
    const missing = glossary.entries.flatMap((e) =>
      e.quote
        .split(' ... ')
        .map((q) => norm(q).replace(/\.$/, '').toLowerCase())
        .filter((fragment) => !source.includes(fragment))
        .map((fragment) => `${e.id}: ${fragment}`),
    );
    expect(missing).toEqual([]);
  });

  it('has an entry for every ref the rules code cites', () => {
    const ids = new Set(glossary.entries.map((e) => e.id));
    const refs = ['classify.ts', 'term.ts'].flatMap((file) =>
      readFileSync(new URL(`../lib/acns/${file}`, import.meta.url), 'utf8')
        .split('\n')
        .filter((line) => line.includes('ref:'))
        .flatMap((line) => [...line.slice(line.indexOf('ref:')).matchAll(/'([^']+)'/g)].map((m) => m[1]))
        .filter((s) => s !== 'RDA' && s !== 'evolving'),
    );
    expect(refs.length).toBeGreaterThan(10);
    expect(refs.filter((r) => !ids.has(r))).toEqual([]);
  });
});
