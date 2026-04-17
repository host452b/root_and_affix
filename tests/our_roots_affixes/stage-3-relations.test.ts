import { describe, test, expect } from 'bun:test';
import { buildRelationsGraph } from '../../scripts/our_roots_affixes/stage-3-relations.js';
import type { WordEntry, MorphemeEntry } from '../../scripts/our_roots_affixes/types.js';

const base: WordEntry = {
  word: '', phonetic: '', pos: ['n.'], coreMeaning: [{ cn: 'x' }],
  morphemes: [], derivationChain: [], morphVariantOf: null,
  memorySemantics: { literal: 'x', imageChain: [], mnemonicExpr: 'x' },
  wordLevel: { sentiment: { tags: ['中性'] }, domain: ['general'], registerFormality: 'neutral' },
  relations: { sameRoot: [], sameAffix: [], synonyms: [], antonyms: [], domainCohort: [], derivationPair: [], morphVariants: [], sameImagery: [] },
};
const mk = (word: string, patch: Partial<WordEntry>): WordEntry => ({ ...base, word, ...patch, relations: { ...base.relations, ...(patch.relations ?? {}) } });

describe('buildRelationsGraph', () => {
  test('sameRoot derived from morpheme memberWords', () => {
    const words = [
      mk('vision', { morphemes: [{ order: 1, form: 'vis', role: 'root', canonical: 'vis', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial' }] }),
      mk('revise', { morphemes: [{ order: 1, form: 'vis', role: 'root', canonical: 'vis', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial' }] }),
    ];
    const morphemes: MorphemeEntry[] = [
      { id: 'vis', canonical: 'vis', role: 'root', variants: [], coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial', memberWords: ['vision', 'revise'], synonymMorphemes: ['spec'], antonymMorphemes: [] },
    ];
    const g = buildRelationsGraph(words, morphemes);
    expect(g.edges.sameRoot).toEqual([{ root: 'vis', members: ['revise', 'vision'] }]);
  });

  test('synonyms deduped and bidirectional', () => {
    const words = [
      mk('big', { relations: { ...base.relations, synonyms: ['large'] } }),
      mk('large', { relations: { ...base.relations, synonyms: ['big'] } }),
    ];
    const g = buildRelationsGraph(words, []);
    expect(g.edges.synonyms).toEqual([['big', 'large']]);
  });

  test('derivationPair from derivationChain adjacent pairs', () => {
    const w = mk('inflation', { derivationChain: ['flat', 'inflate', 'inflation'] });
    const g = buildRelationsGraph([w], []);
    expect(g.edges.derivationPair.sort()).toEqual([['flat', 'inflate'], ['inflate', 'inflation']]);
  });

  test('domainCohort grouped by domain', () => {
    const words = [
      mk('inflation', { wordLevel: { ...base.wordLevel, domain: ['economics'] } }),
      mk('tariff', { wordLevel: { ...base.wordLevel, domain: ['economics'] } }),
    ];
    const g = buildRelationsGraph(words, []);
    expect(g.edges.domainCohort).toContainEqual({ domain: 'economics', members: ['inflation', 'tariff'] });
  });

  test('morphVariants from morphVariantOf field', () => {
    const words = [
      mk('analyze', {}),
      mk('analyse', { morphVariantOf: 'analyze' }),
    ];
    const g = buildRelationsGraph(words, []);
    expect(g.edges.morphVariants).toEqual([['analyse', 'analyze']]);
  });

  test('affixSynonyms from morpheme synonymMorphemes', () => {
    const morphemes: MorphemeEntry[] = [
      { id: 'pre-', canonical: 'pre-', role: 'prefix', variants: [], coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial', memberWords: [], synonymMorphemes: ['ante-', 'pro-'], antonymMorphemes: ['post-'] },
    ];
    const g = buildRelationsGraph([], morphemes);
    expect(g.edges.affixSynonyms).toEqual([{ affix: 'pre-', synonyms: ['ante-', 'pro-'] }]);
    expect(g.edges.affixAntonyms).toEqual([{ affix: 'pre-', antonyms: ['post-'] }]);
  });

  test('rootVariants and rootSynonyms from morpheme', () => {
    const morphemes: MorphemeEntry[] = [
      { id: 'vis', canonical: 'vis', role: 'root', variants: ['vid', 'vise'], coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial', memberWords: [], synonymMorphemes: ['spec'], antonymMorphemes: [] },
    ];
    const g = buildRelationsGraph([], morphemes);
    expect(g.edges.rootVariants).toEqual([{ root: 'vis', variants: ['vid', 'vise'] }]);
    expect(g.edges.rootSynonyms).toEqual([{ root: 'vis', synonyms: ['spec'] }]);
  });

  test('sameImagery groups words sharing an image keyword', () => {
    const words = [
      mk('inflate', { memorySemantics: { literal: 'x', imageChain: ['吹气膨胀'], mnemonicExpr: 'x' } }),
      mk('deflate', { memorySemantics: { literal: 'x', imageChain: ['吹气膨胀'], mnemonicExpr: 'x' } }),
      mk('balloon', { memorySemantics: { literal: 'x', imageChain: ['吹气膨胀'], mnemonicExpr: 'x' } }),
    ];
    const g = buildRelationsGraph(words, []);
    expect(g.edges.sameImagery).toContainEqual({ image: '吹气膨胀', members: ['balloon', 'deflate', 'inflate'] });
  });
});
