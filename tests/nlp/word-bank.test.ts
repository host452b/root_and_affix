import { describe, expect, test } from 'bun:test';
import { buildWordBank, mergeCustomWords } from '../../src/nlp/word-bank.js';
import type { WordEntry } from '../../src/core/types.js';
import type { CustomWordEntry } from '../../src/core/storage.js';

function makeEntry(id: string, word: string, chinese: string[]): WordEntry {
  return {
    id,
    word,
    phonetic: '',
    meanings: [],
    difficulty: [],
    chineseMappings: chinese.map(c => ({ chinese: c, partOfSpeech: 'n' })),
  };
}

describe('buildWordBank', () => {
  test('indexes entries by id', () => {
    const entries = [makeEntry('apple', 'apple', ['苹果']), makeEntry('book', 'book', ['书籍'])];
    const bank = buildWordBank(entries);
    expect(bank.byId.get('apple')?.word).toBe('apple');
    expect(bank.byId.get('book')?.word).toBe('book');
    expect(bank.byId.has('missing')).toBe(false);
  });

  test('indexes entries by Chinese mapping', () => {
    const entries = [makeEntry('apple', 'apple', ['苹果']), makeEntry('book', 'book', ['书籍'])];
    const bank = buildWordBank(entries);
    expect(bank.byChinese.get('苹果')?.[0].word).toBe('apple');
    expect(bank.byChinese.get('书籍')?.[0].word).toBe('book');
  });

  test('same Chinese maps to multiple English entries (polysemy)', () => {
    const entries = [
      makeEntry('environment', 'environment', ['环境']),
      makeEntry('milieu', 'milieu', ['环境']),
    ];
    const bank = buildWordBank(entries);
    const candidates = bank.byChinese.get('环境');
    expect(candidates?.length).toBe(2);
    expect(candidates?.map(c => c.word).sort()).toEqual(['environment', 'milieu']);
  });

  test('does not duplicate same entry in byChinese', () => {
    const entry = makeEntry('env', 'environment', ['环境', '环境']);
    const bank = buildWordBank([entry]);
    // Two identical mappings should still produce only one entry in the candidates list
    const candidates = bank.byChinese.get('环境');
    expect(candidates?.length).toBe(1);
  });

  test('one entry with multiple Chinese mappings registers under each', () => {
    const entry = makeEntry('manage', 'manage', ['管理', '经营']);
    const bank = buildWordBank([entry]);
    expect(bank.byChinese.get('管理')?.[0].word).toBe('manage');
    expect(bank.byChinese.get('经营')?.[0].word).toBe('manage');
  });

  test('stores bankIds', () => {
    const bank = buildWordBank([], ['ielts', 'toefl']);
    expect(bank.bankIds).toEqual(['ielts', 'toefl']);
  });

  test('empty input produces empty bank', () => {
    const bank = buildWordBank([]);
    expect(bank.entries.length).toBe(0);
    expect(bank.byId.size).toBe(0);
    expect(bank.byChinese.size).toBe(0);
  });
});

describe('mergeCustomWords', () => {
  const baseEntries = [makeEntry('apple', 'apple', ['苹果'])];

  test('adds new custom word to bank', () => {
    const bank = buildWordBank(baseEntries);
    const custom: CustomWordEntry[] = [
      { id: 'grape', word: 'grape', chinese: '葡萄', tags: ['CUSTOM'], addedAt: Date.now() },
    ];
    const merged = mergeCustomWords(bank, custom);
    expect(merged.byId.has('grape')).toBe(true);
    expect(merged.byChinese.get('葡萄')?.[0].word).toBe('grape');
    expect(merged.entries.length).toBe(2);
  });

  test('skips custom word that duplicates existing entry', () => {
    const bank = buildWordBank(baseEntries);
    const custom: CustomWordEntry[] = [
      { id: 'apple', word: 'apple', chinese: '苹果', tags: [], addedAt: Date.now() },
    ];
    const merged = mergeCustomWords(bank, custom);
    expect(merged.entries.length).toBe(1); // no duplicate added
  });

  test('multiple custom words added', () => {
    const bank = buildWordBank(baseEntries);
    const custom: CustomWordEntry[] = [
      { id: 'grape', word: 'grape', chinese: '葡萄', tags: [], addedAt: Date.now() },
      { id: 'peach', word: 'peach', chinese: '桃子', tags: [], addedAt: Date.now() },
    ];
    const merged = mergeCustomWords(bank, custom);
    expect(merged.entries.length).toBe(3);
    expect(merged.byChinese.get('葡萄')).toBeTruthy();
    expect(merged.byChinese.get('桃子')).toBeTruthy();
  });

  test('custom word creates correct WordEntry structure', () => {
    const bank = buildWordBank([]);
    const custom: CustomWordEntry[] = [
      { id: 'example', word: 'Example', chinese: '例子', tags: ['TEST'], addedAt: Date.now() },
    ];
    const merged = mergeCustomWords(bank, custom);
    const entry = merged.byId.get('example');
    expect(entry).toBeTruthy();
    expect(entry!.word).toBe('Example');
    expect(entry!.meanings[0].definitionCn).toBe('例子');
    expect(entry!.difficulty).toEqual(['TEST']);
    expect(entry!.chineseMappings[0].chinese).toBe('例子');
  });

  test('preserves original bank bankIds', () => {
    const bank = buildWordBank(baseEntries, ['ielts']);
    const merged = mergeCustomWords(bank, []);
    expect(merged.bankIds).toEqual(['ielts']);
  });

  test('empty custom words returns equivalent bank', () => {
    const bank = buildWordBank(baseEntries, ['ielts']);
    const merged = mergeCustomWords(bank, []);
    expect(merged.entries.length).toBe(1);
    expect(merged.byId.get('apple')?.word).toBe('apple');
  });
});
