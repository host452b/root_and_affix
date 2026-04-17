import { describe, test, expect } from 'bun:test';
import { backfillMemberWords, buildWordIndex } from '../../scripts/our_roots_affixes/stage-2-morpheme-index.js';
import type { WordEntry, MorphemeEntry } from '../../scripts/our_roots_affixes/types.js';

const w1: WordEntry = {
  word: 'vision', phonetic: '/x/', pos: ['n.'], coreMeaning: [{ cn: 'x' }],
  morphemes: [
    { order: 1, form: 'vis', role: 'root', canonical: 'vis', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial' },
    { order: 2, form: '-ion', role: 'suffix', canonical: '-ion', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'final' },
  ],
  derivationChain: [], morphVariantOf: null,
  memorySemantics: { literal: 'x', imageChain: [], mnemonicExpr: 'x' },
  wordLevel: { sentiment: { tags: ['中性'] }, domain: ['general'], registerFormality: 'neutral' },
  relations: { sameRoot: [], sameAffix: [], synonyms: [], antonyms: [], domainCohort: [], derivationPair: [], morphVariants: [], sameImagery: [] },
};
const w2: WordEntry = { ...w1, word: 'revision', morphemes: [{ order: 1, form: 're-', role: 'prefix', canonical: 're-', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial' }, ...w1.morphemes] };

const morphemes: MorphemeEntry[] = [
  { id: 'vis', canonical: 'vis', role: 'root', variants: [], coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial', memberWords: [], synonymMorphemes: [], antonymMorphemes: [] },
  { id: '-ion', canonical: '-ion', role: 'suffix', variants: [], coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'final', memberWords: [], synonymMorphemes: [], antonymMorphemes: [] },
  { id: 're-', canonical: 're-', role: 'prefix', variants: [], coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial', memberWords: [], synonymMorphemes: [], antonymMorphemes: [] },
];

describe('backfillMemberWords', () => {
  test('aggregates all words using each morpheme', () => {
    const r = backfillMemberWords([w1, w2], morphemes);
    expect(r.find(m => m.id === 'vis')?.memberWords.sort()).toEqual(['revision', 'vision']);
    expect(r.find(m => m.id === '-ion')?.memberWords.sort()).toEqual(['revision', 'vision']);
    expect(r.find(m => m.id === 're-')?.memberWords).toEqual(['revision']);
  });

  test('dedupes when word references same morpheme twice', () => {
    const w3 = structuredClone(w1);
    w3.morphemes.push({ order: 3, form: 'vis', role: 'root', canonical: 'vis', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial' });
    const r = backfillMemberWords([w3], morphemes);
    expect(r.find(m => m.id === 'vis')?.memberWords).toEqual(['vision']);
  });
});

describe('buildWordIndex', () => {
  test('maps word to bucket id', () => {
    const idx = buildWordIndex([
      { bucketId: 'v-001', words: [w1, w2] },
    ]);
    expect(idx).toEqual({ vision: 'v-001', revision: 'v-001' });
  });
});
