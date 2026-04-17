import { describe, expect, test } from 'bun:test';
import { buildWordBank } from '../src/nlp/word-bank.js';
import { findMatches, selectWords } from '../src/nlp/index.js';
import type { WordEntry } from '../src/core/types.js';

const ENTRIES: WordEntry[] = [
  { id: 'environment', word: 'environment', phonetic: '', meanings: [], difficulty: [], chineseMappings: [{ chinese: '环境', partOfSpeech: 'n' }] },
  { id: 'policy', word: 'policy', phonetic: '', meanings: [], difficulty: [], chineseMappings: [{ chinese: '政策', partOfSpeech: 'n' }] },
];

const bank = buildWordBank(ENTRIES);

describe('selectWords deduplication', () => {
  test('same English word only appears once even if Chinese source repeats', () => {
    // Text has "环境" twice → should only get one "environment" match
    const matches = findMatches('保护环境是环境的政策', bank);
    const envMatches = matches.filter(m => m.targetWord === 'environment');
    // findMatches may return multiple, but selectWords deduplicates
    const selected = selectWords(matches, 10);
    const envSelected = selected.filter(m => m.targetWord === 'environment');
    expect(envSelected.length).toBe(1);
  });

  test('different English words both appear when spaced apart', () => {
    // Words spaced far apart should both appear
    const matches = findMatches('我们需要保护环境同时制定好的政策', bank);
    const selected = selectWords(matches, 10);
    expect(selected.length).toBe(2);
  });

  test('adjacent words get spaced — only one survives', () => {
    const matches = findMatches('环境政策', bank);
    const selected = selectWords(matches, 10);
    expect(selected.length).toBe(1); // too close, one dropped
  });

  test('respects maxWords after dedup', () => {
    const matches = findMatches('环境政策', bank);
    const selected = selectWords(matches, 1);
    expect(selected.length).toBe(1);
  });
});

describe('byChinese stores multiple candidates', () => {
  test('same Chinese maps to multiple English entries', () => {
    const entries: WordEntry[] = [
      { id: 'environment', word: 'environment', phonetic: '', meanings: [], difficulty: [], chineseMappings: [{ chinese: '环境', partOfSpeech: 'n' }] },
      { id: 'milieu', word: 'milieu', phonetic: '', meanings: [], difficulty: [], chineseMappings: [{ chinese: '环境', partOfSpeech: 'n' }] },
    ];
    const b = buildWordBank(entries);
    const candidates = b.byChinese.get('环境');
    expect(candidates).toBeTruthy();
    expect(candidates!.length).toBe(2);
  });
});
