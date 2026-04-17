import { describe, test, expect } from 'bun:test';
import { validateBatchResult } from '../../scripts/our_roots_affixes/stage-1b-decompose.js';
import type { MorphemeInventory } from '../../scripts/our_roots_affixes/types.js';

const inv: MorphemeInventory = {
  roots: [
    { id: 'flat', canonical: 'flat', role: 'root', variants: ['flate'], coreMeaning: { cn: '吹' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial', memberWords: [], synonymMorphemes: [], antonymMorphemes: [] },
  ],
  affixes: [
    { id: 'in-', canonical: 'in-', role: 'prefix', variants: [], coreMeaning: { cn: '进入' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial', memberWords: [], synonymMorphemes: [], antonymMorphemes: [] },
    { id: '-ion', canonical: '-ion', role: 'suffix', variants: [], coreMeaning: { cn: '名词化' }, sentiment: { tags: ['中性'] }, positionTendency: 'final', memberWords: [], synonymMorphemes: [], antonymMorphemes: [] },
  ],
  linkers: [],
  variantToCanonical: { flate: 'flat' },
};

const goodEntry = {
  word: 'inflation', phonetic: '/x/', pos: ['n.'], coreMeaning: [{ cn: '通货膨胀' }],
  morphemes: [
    { order: 1, form: 'in-', role: 'prefix', canonical: 'in-', coreMeaning: { cn: '进入' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial' },
    { order: 2, form: 'flat', role: 'root', canonical: 'flat', coreMeaning: { cn: '吹' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial' },
    { order: 3, form: '-ion', role: 'suffix', canonical: '-ion', coreMeaning: { cn: '名词化' }, sentiment: { tags: ['中性'] }, positionTendency: 'final' },
  ],
  derivationChain: ['flat', 'inflation'], morphVariantOf: null,
  memorySemantics: { literal: 'x', imageChain: ['x'], mnemonicExpr: 'x' },
  wordLevel: { sentiment: { tags: ['贬义'] }, domain: ['economics'], registerFormality: 'formal' },
  relations: { sameRoot: [], sameAffix: [], synonyms: [], antonyms: [], domainCohort: [], derivationPair: [], morphVariants: [], sameImagery: [] },
};

describe('validateBatchResult', () => {
  test('accepts valid batch', () => {
    const r = validateBatchResult([goodEntry], ['inflation'], inv);
    expect(r.ok).toBe(true);
  });

  test('rejects count mismatch', () => {
    const r = validateBatchResult([goodEntry], ['inflation', 'foo'], inv);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('count'))).toBe(true);
  });

  test('rejects out-of-order word', () => {
    const r = validateBatchResult([goodEntry], ['wrong'], inv);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('mismatch'))).toBe(true);
  });

  test('rejects canonical not in inventory', () => {
    const bad = structuredClone(goodEntry) as any;
    bad.morphemes[0].canonical = 'bogus-';
    const r = validateBatchResult([bad], ['inflation'], inv);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('canonical'))).toBe(true);
  });
});
