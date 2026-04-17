import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  validateWordEntry,
  validateMorphemeEntry,
  validateRelationsGraph,
} from '../../scripts/our_roots_affixes/schema.js';

const MOCK_WORD: any = JSON.parse(
  readFileSync(resolve(import.meta.dir, 'fixtures/mock-word-entry.json'), 'utf-8')
);

describe('validateWordEntry', () => {
  test('accepts valid WordEntry', () => {
    const r = validateWordEntry(MOCK_WORD);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('rejects missing required field', () => {
    const bad = { ...MOCK_WORD, word: undefined };
    const r = validateWordEntry(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('word'))).toBe(true);
  });

  test('rejects invalid role', () => {
    const bad = structuredClone(MOCK_WORD);
    bad.morphemes[0].role = 'bogus';
    const r = validateWordEntry(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('role'))).toBe(true);
  });

  test('rejects invalid positionTendency', () => {
    const bad = structuredClone(MOCK_WORD);
    bad.morphemes[0].positionTendency = 'middle';
    const r = validateWordEntry(bad);
    expect(r.ok).toBe(false);
  });

  test('rejects sentiment tag not in vocab', () => {
    const bad = structuredClone(MOCK_WORD);
    bad.wordLevel.sentiment.tags = ['super-bad'];
    const r = validateWordEntry(bad);
    expect(r.ok).toBe(false);
  });
});

describe('validateMorphemeEntry', () => {
  test('accepts valid MorphemeEntry', () => {
    const entry = {
      id: 'vis',
      canonical: 'vis',
      role: 'root',
      variants: ['vid'],
      coreMeaning: { cn: '看', en: 'to see' },
      sentiment: { tags: ['中性'], intensity: 0 },
      positionTendency: 'medial',
      memberWords: ['vision'],
      synonymMorphemes: [],
      antonymMorphemes: [],
    };
    const r = validateMorphemeEntry(entry);
    expect(r.ok).toBe(true);
  });
});

describe('validateRelationsGraph', () => {
  test('accepts minimal graph', () => {
    const g = {
      version: '1.0',
      stats: { totalWords: 0, totalMorphemes: 0, totalEdges: 0 },
      edges: {
        sameRoot: [], sameAffix: [], synonyms: [], antonyms: [],
        domainCohort: [], derivationPair: [], morphVariants: [], sameImagery: [],
        affixSynonyms: [], affixAntonyms: [], rootVariants: [], rootSynonyms: [],
      },
    };
    const r = validateRelationsGraph(g);
    expect(r.ok).toBe(true);
  });
});
