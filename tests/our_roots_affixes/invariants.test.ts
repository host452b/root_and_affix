import { describe, test, expect } from 'bun:test';
import { runInvariants } from '../../scripts/our_roots_affixes/invariants.js';
import type { WordEntry, MorphemeEntry, RelationsGraph } from '../../scripts/our_roots_affixes/types.js';

const word: WordEntry = {
  word: 'inflation', phonetic: '/x/', pos: ['n.'],
  coreMeaning: [{ cn: '通货膨胀' }],
  morphemes: [
    { order: 1, form: 'in-', role: 'prefix', canonical: 'in-', coreMeaning: { cn: '进入' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial' },
    { order: 2, form: 'flat', role: 'root', canonical: 'flat', coreMeaning: { cn: '吹' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial' },
  ],
  derivationChain: ['flat', 'inflation'], morphVariantOf: null,
  memorySemantics: { literal: 'x', imageChain: ['x'], mnemonicExpr: 'x' },
  wordLevel: { sentiment: { tags: ['中性'] }, domain: ['economics'], registerFormality: 'formal' },
  relations: { sameRoot: [], sameAffix: [], synonyms: [], antonyms: [], domainCohort: [], derivationPair: [], morphVariants: [], sameImagery: [] },
};

const morphemesOk: MorphemeEntry[] = [
  { id: 'in-', canonical: 'in-', role: 'prefix', variants: [], coreMeaning: { cn: '进入' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial', memberWords: ['inflation'], synonymMorphemes: [], antonymMorphemes: [] },
  { id: 'flat', canonical: 'flat', role: 'root', variants: [], coreMeaning: { cn: '吹' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial', memberWords: ['inflation'], synonymMorphemes: [], antonymMorphemes: [] },
];

const graphOk: RelationsGraph = {
  version: '1.0',
  stats: { totalWords: 1, totalMorphemes: 2, totalEdges: 0 },
  edges: {
    sameRoot: [], sameAffix: [], synonyms: [], antonyms: [], domainCohort: [],
    derivationPair: [], morphVariants: [], sameImagery: [],
    affixSynonyms: [], affixAntonyms: [], rootVariants: [], rootSynonyms: [],
  },
};

describe('runInvariants', () => {
  test('all pass on consistent data', () => {
    const r = runInvariants({ words: [word], morphemes: morphemesOk, graph: graphOk });
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  test('INV-1 fails when morpheme canonical missing', () => {
    const orphan: WordEntry = {
      ...word,
      morphemes: [...word.morphemes, { order: 3, form: '-ion', role: 'suffix', canonical: '-ion', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'final' }],
    };
    const r = runInvariants({ words: [orphan], morphemes: morphemesOk, graph: graphOk });
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.startsWith('INV-1'))).toBe(true);
  });

  test('INV-2 fails when memberWords references missing word', () => {
    const m: MorphemeEntry[] = [
      { ...morphemesOk[0], memberWords: ['ghost'] }, morphemesOk[1],
    ];
    const r = runInvariants({ words: [word], morphemes: m, graph: graphOk });
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.startsWith('INV-2'))).toBe(true);
  });

  test('INV-5 fails when id appears in another entry variants', () => {
    const m: MorphemeEntry[] = [
      { ...morphemesOk[0], variants: ['flat'] }, morphemesOk[1],
    ];
    const r = runInvariants({ words: [word], morphemes: m, graph: graphOk });
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.startsWith('INV-5'))).toBe(true);
  });

  test('INV-7 fails when positionTendency bad', () => {
    const w = structuredClone(word);
    (w.morphemes[0].positionTendency as any) = 'middle';
    const r = runInvariants({ words: [w], morphemes: morphemesOk, graph: graphOk });
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.startsWith('INV-7'))).toBe(true);
  });
});
