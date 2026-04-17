import { describe, expect, test } from 'bun:test';
import { enrichWordBank } from '../src/nlp/enrich.js';
import type { WordEntry } from '../src/core/types.js';

const MOCK_ROOTS = [
  { root: 'soph', meaning: 'wise', meaningCn: '智慧', examples: ['sophisticated', 'philosophy'] },
  { root: 'form', meaning: 'shape', meaningCn: '形态', examples: ['conform', 'transform', 'conformist'] },
];

const MOCK_AFFIXES = [
  { type: 'prefix' as const, affix: 'con-', meaning: 'together', meaningCn: '一起', examples: ['connect'] },
  { type: 'suffix' as const, affix: '-ist', meaning: 'person', meaningCn: '…的人', examples: ['scientist'] },
  { type: 'suffix' as const, affix: '-ic', meaning: 'relating to', meaningCn: '…的', examples: ['classic'] },
  { type: 'suffix' as const, affix: '-ate', meaning: 'to make', meaningCn: '使…', examples: ['generate'] },
];

function makeEntry(word: string): WordEntry {
  return { id: word, word, phonetic: '', meanings: [], difficulty: [], chineseMappings: [] };
}

describe('enrichWordBank — compound words', () => {
  test('welfare decomposes to well + fare', () => {
    const entries = [makeEntry('welfare')];
    const enriched = enrichWordBank(entries, [], MOCK_ROOTS, MOCK_AFFIXES);
    expect(enriched[0].morphology).toBeTruthy();
    expect(enriched[0].morphology!.root.part).toBe('well');
    expect(enriched[0].morphology!.mnemonic).toContain('福利');
  });

  test('understand decomposes to under + stand', () => {
    const entries = [makeEntry('understand')];
    const enriched = enrichWordBank(entries, [], MOCK_ROOTS, MOCK_AFFIXES);
    expect(enriched[0].morphology).toBeTruthy();
    expect(enriched[0].morphology!.root.part).toBe('under');
  });

  test('breakthrough decomposes to break + through', () => {
    const entries = [makeEntry('breakthrough')];
    const enriched = enrichWordBank(entries, [], MOCK_ROOTS, MOCK_AFFIXES);
    expect(enriched[0].morphology).toBeTruthy();
    expect(enriched[0].morphology!.mnemonic).toContain('突破');
  });
});

describe('enrichWordBank — root+affix analysis', () => {
  test('conformist → con + form + ist', () => {
    const entries = [makeEntry('conformist')];
    const enriched = enrichWordBank(entries, [], MOCK_ROOTS, MOCK_AFFIXES);
    const m = enriched[0].morphology;
    expect(m).toBeTruthy();
    expect(m!.prefix).toBeTruthy();
    expect(m!.prefix![0].meaning).toBe('一起');
    expect(m!.root.meaning).toBe('形态');
    expect(m!.suffix).toBeTruthy();
  });

  test('preserves existing morphology', () => {
    const entries = [{ ...makeEntry('test'), morphology: { root: { part: 'test', meaning: '测试' }, mnemonic: '测试' } }];
    const enriched = enrichWordBank(entries, [], MOCK_ROOTS, MOCK_AFFIXES);
    expect(enriched[0].morphology!.root.meaning).toBe('测试'); // not overwritten
  });

  test('short words (<5 chars) skipped', () => {
    const entries = [makeEntry('form')];
    const enriched = enrichWordBank(entries, [], MOCK_ROOTS, MOCK_AFFIXES);
    expect(enriched[0].morphology).toBeUndefined();
  });
});

describe('enrichWordBank — etymology', () => {
  test('adds etymology from data', () => {
    const entries = [makeEntry('test')];
    const etymData = [{ wordId: 'test', origin: 'Latin', originalMeaning: 'vessel', story: 'From Latin testum', entryPeriod: '~1300' }];
    const enriched = enrichWordBank(entries, etymData);
    expect(enriched[0].etymology).toBeTruthy();
    expect(enriched[0].etymology!.origin).toBe('Latin');
  });
});
