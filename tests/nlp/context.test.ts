import { describe, expect, test } from 'bun:test';
import { analyzeContext, scoreMatch } from '../../src/nlp/context.js';

describe('analyzeContext', () => {
  test('detects economy domain', () => {
    const result = analyzeContext('市场经济和投资贸易的发展');
    expect(result.domain).toBe('economy');
    expect(result.domainScore).toBeGreaterThan(0.5);
  });

  test('detects environment domain', () => {
    const result = analyzeContext('气候变化导致环境污染加剧');
    expect(result.domain).toBe('environment');
  });

  test('returns null domain for generic text', () => {
    const result = analyzeContext('今天是个好日子');
    expect(result.domainScore).toBe(0);
  });
});

describe('scoreMatch', () => {
  test('returns higher score with domain context', () => {
    const entry = { id: 'policy', word: 'policy', phonetic: '', meanings: [], difficulty: [], chineseMappings: [{ chinese: '政策', partOfSpeech: 'n' }] };
    const ctx = analyzeContext('政府的经济政策正在改革');
    const score = scoreMatch('政策', '政府的经济政策正在改革', entry as any, ctx);
    expect(score).toBeGreaterThan(0.7);
  });

  test('returns base score without context', () => {
    const entry = { id: 'policy', word: 'policy', phonetic: '', meanings: [], difficulty: [], chineseMappings: [{ chinese: '政策', partOfSpeech: 'n' }] };
    const ctx = analyzeContext('今天天气很好');
    const score = scoreMatch('政策', '今天天气很好的政策', entry as any, ctx);
    expect(score).toBeGreaterThanOrEqual(0.5);
  });

  test('boosts score when contextHint matches surrounding text', () => {
    const entry = {
      id: 'performance', word: 'performance', phonetic: '', meanings: [],
      difficulty: [],
      chineseMappings: [{ chinese: '表现', partOfSpeech: 'n', contextHint: '成绩/表演' }],
    };
    const ctx = analyzeContext('他的表现和成绩都很出色');
    const score = scoreMatch('表现', '他的表现和成绩都很出色', entry as any, ctx);
    // Should be boosted above base 0.85
    expect(score).toBeGreaterThan(0.9);
  });

  test('penalizes score when contextHint does not match', () => {
    const entry = {
      id: 'performance', word: 'performance', phonetic: '', meanings: [],
      difficulty: [],
      chineseMappings: [{ chinese: '水平', partOfSpeech: 'n', contextHint: '成绩/表演' }],
    };
    // Sentence contains none of the hint chars (成,绩,表,演)
    const ctx = analyzeContext('今天下午开会讨论');
    const score = scoreMatch('水平', '今天下午开会讨论水平问题', entry as any, ctx);
    // Should be penalized below base 0.85
    expect(score).toBeLessThan(0.85);
  });

  test('no contextHint leaves base score unchanged', () => {
    const entry = {
      id: 'policy', word: 'policy', phonetic: '', meanings: [],
      difficulty: [],
      chineseMappings: [{ chinese: '政策', partOfSpeech: 'n' }], // no contextHint
    };
    const ctx = analyzeContext('普通的一段文字');
    const score = scoreMatch('政策', '普通的一段文字有政策', entry as any, ctx);
    expect(score).toBe(0.85); // base score, no domain boost (0 domainScore)
  });

  test('score clamped to [0, 1]', () => {
    const entry = {
      id: 'env', word: 'environment', phonetic: '', meanings: [],
      difficulty: [],
      chineseMappings: [{ chinese: '环境', partOfSpeech: 'n', contextHint: '气候/生态/污染' }],
    };
    // Strong domain boost + contextHint match
    const ctx = analyzeContext('气候变化导致环境污染加剧生态危机');
    const score = scoreMatch('环境', '气候变化导致环境污染加剧生态危机', entry as any, ctx);
    expect(score).toBeLessThanOrEqual(1.0);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
