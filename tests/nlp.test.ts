import { describe, expect, test } from 'bun:test';
import { buildWordBank } from '../src/nlp/word-bank.js';
import { findMatches, selectWords } from '../src/nlp/index.js';
import type { WordEntry } from '../src/core/types.js';

const MOCK_ENTRIES: WordEntry[] = [
  {
    id: 'environment', word: 'environment', phonetic: '', meanings: [],
    difficulty: [], chineseMappings: [{ chinese: '环境', partOfSpeech: 'n' }],
  },
  {
    id: 'policy', word: 'policy', phonetic: '', meanings: [],
    difficulty: [], chineseMappings: [{ chinese: '政策', partOfSpeech: 'n' }],
  },
  {
    id: 'innovation', word: 'innovation', phonetic: '', meanings: [],
    difficulty: [], chineseMappings: [{ chinese: '创新', partOfSpeech: 'n' }],
  },
];

const bank = buildWordBank(MOCK_ENTRIES);

describe('findMatches', () => {
  test('finds Chinese words that match word bank', () => {
    const matches = findMatches('保护环境是一项重要的政策', bank);
    expect(matches.length).toBe(2);
    expect(matches.map(m => m.targetWord).sort()).toEqual(['environment', 'policy']);
  });

  test('returns empty for text with no matches', () => {
    const matches = findMatches('今天天气很好', bank);
    expect(matches.length).toBe(0);
  });

  test('includes sentence context', () => {
    const matches = findMatches('保护环境很重要', bank);
    expect(matches[0].sentenceContext).toBe('保护环境很重要');
  });
});

describe('selectWords', () => {
  test('respects maxWords limit', () => {
    const matches = findMatches('我们需要保护环境同时也需要制定好的政策同时推动科技创新', bank);
    const selected = selectWords(matches, 2);
    expect(selected.length).toBeLessThanOrEqual(2);
  });

  test('returns matches under limit', () => {
    const matches = findMatches('我们需要保护环境同时也需要制定好的政策同时推动科技创新', bank);
    const selected = selectWords(matches, 10);
    expect(selected.length).toBeGreaterThan(0);
  });

  test('spaces out adjacent words — keeps higher value one', () => {
    // Adjacent words "环境政策" should only keep one
    const matches = findMatches('环境政策', bank);
    const selected = selectWords(matches, 10);
    expect(selected.length).toBe(1);
  });
});
