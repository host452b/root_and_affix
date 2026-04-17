import { describe, expect, test } from 'bun:test';
import { buildWordBank } from '../../src/nlp/word-bank.js';
import { findMatches, selectWords } from '../../src/nlp/index.js';
import type { WordEntry, UserWordState } from '../../src/core/types.js';

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

const ENTRIES: WordEntry[] = [
  makeEntry('environment', 'environment', ['环境']),
  makeEntry('policy', 'policy', ['政策']),
  makeEntry('innovation', 'innovation', ['创新']),
  makeEntry('development', 'development', ['发展']),
  makeEntry('education', 'education', ['教育']),
];

const bank = buildWordBank(ENTRIES);

describe('selectWords — 3x-clear mastered blacklist', () => {
  test('skips word cleared 3+ times', () => {
    const matches = findMatches('保护环境和制定政策', bank);
    const wordStates: Record<string, UserWordState> = {
      environment: {
        wordId: 'environment', status: 'mastered', exposureCount: 50,
        contextDiversity: 5, lastExposureAt: Date.now(), firstSeenAt: 0,
        clickCount: 10, hoverCount: 5, decodedAt: Date.now(), correctRecognitions: 20,
        clearedCount: 3, masteredAt: Date.now(), nextReviewAt: 0,
        easeFactor: 2.5, interval: 30, repetitions: 5,
      },
    };
    const selected = selectWords(matches, 10, wordStates);
    const envSelected = selected.filter(m => m.targetWord === 'environment');
    expect(envSelected.length).toBe(0);
  });

  test('keeps word cleared < 3 times', () => {
    const matches = findMatches('保护环境', bank);
    const wordStates: Record<string, UserWordState> = {
      environment: {
        wordId: 'environment', status: 'mastered', exposureCount: 20,
        contextDiversity: 3, lastExposureAt: Date.now(), firstSeenAt: 0,
        clickCount: 5, hoverCount: 2, decodedAt: Date.now(), correctRecognitions: 10,
        clearedCount: 2, masteredAt: Date.now(), nextReviewAt: 0,
        easeFactor: 2.5, interval: 15, repetitions: 3,
      },
    };
    const selected = selectWords(matches, 10, wordStates);
    const envSelected = selected.filter(m => m.targetWord === 'environment');
    expect(envSelected.length).toBe(1);
  });
});

describe('selectWords — deduplication', () => {
  test('same Chinese appearing twice yields one English word', () => {
    const matches = findMatches('环境保护需要好的环境政策', bank);
    const selected = selectWords(matches, 10);
    const envCount = selected.filter(m => m.targetWord === 'environment').length;
    expect(envCount).toBeLessThanOrEqual(1);
  });
});

describe('selectWords — maxWords', () => {
  test('respects maxWords limit', () => {
    const text = '环境和政策以及创新和发展需要教育';
    const matches = findMatches(text, bank);
    const selected = selectWords(matches, 2);
    expect(selected.length).toBeLessThanOrEqual(2);
  });

  test('maxWords 0 returns empty', () => {
    const matches = findMatches('环境和政策', bank);
    const selected = selectWords(matches, 0);
    expect(selected.length).toBe(0);
  });
});

describe('selectWords — random sampling', () => {
  test('different calls can produce different orderings', () => {
    const text = '我们需要保护环境同时推动创新同时也需要关注教育改革和经济发展';
    const matches = findMatches(text, bank);
    if (matches.length < 3) return; // skip if not enough matches

    // Run selection multiple times — at least one ordering should differ
    const orderings = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const selected = selectWords(matches, 3);
      orderings.add(selected.map(s => s.targetWord).join(','));
    }
    // With random sampling, we expect at least 2 different orderings in 20 tries
    expect(orderings.size).toBeGreaterThanOrEqual(2);
  });
});
