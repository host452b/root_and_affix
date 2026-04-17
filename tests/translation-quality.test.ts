import { describe, expect, test } from 'bun:test';
import { buildWordBank } from '../src/nlp/word-bank.js';
import { findMatches } from '../src/nlp/index.js';
import { readFileSync } from 'fs';

/**
 * Adversarial translation quality tests.
 *
 * These test real-world Chinese sentences to verify that Flipword
 * picks reasonable English translations. If a test fails, it means
 * the word bank has a mapping that produces an embarrassing/wrong
 * translation visible to the user.
 *
 * Add new cases whenever a user reports a bad translation.
 */

// Load real word banks
function loadBank(bankId: string) {
  const entries = JSON.parse(readFileSync(`data/word-banks/${bankId}.json`, 'utf-8'));
  return buildWordBank(entries);
}

describe('Translation quality — no embarrassing matches', () => {
  const bank = loadBank('ielts');

  test('表现 should not become "watch" (should be performance/behavior)', () => {
    const matches = findMatches('他的表现非常出色', bank);
    const m = matches.find(m => m.originalText === '表现');
    if (m) {
      expect(m.targetWord).not.toBe('watch');
      expect(m.targetWord).not.toBe('look');
    }
  });

  test('环境 should become environment, not context or milieu', () => {
    const matches = findMatches('保护环境是每个人的责任', bank);
    const m = matches.find(m => m.originalText === '环境');
    if (m) {
      expect(m.targetWord).toBe('environment');
    }
  });

  test('单字中文不应该被匹配 (Phase A cleanup)', () => {
    // Single chars like 多,肉,光 should have been removed
    const matches = findMatches('这里有很多人在吃肉看光', bank);
    const singleCharMatches = matches.filter(m => m.originalText.length === 1);
    expect(singleCharMatches.length).toBe(0);
  });

  test('标点符号不会触发匹配', () => {
    const matches = findMatches('这是一个"测试"，包含各种标点！', bank);
    for (const m of matches) {
      expect(m.originalText).not.toMatch(/^[""''，。！？]/);
    }
  });
});

describe('Translation quality — polysemous words pick reasonable candidate', () => {
  const bank = loadBank('ielts');

  test('开始 prefers common word over rare one', () => {
    const matches = findMatches('我们开始工作吧', bank);
    const m = matches.find(m => m.originalText === '开始');
    if (m) {
      // Should NOT be "inaugurate" or "embark" for casual context
      expect(['inaugurate']).not.toContain(m.targetWord);
    }
  });

  test('管理 in business context should be reasonable', () => {
    const matches = findMatches('公司的管理层做出了决策', bank);
    const m = matches.find(m => m.originalText === '管理');
    if (m) {
      // Any of these are acceptable
      expect(['manage', 'management', 'administer', 'administration', 'supervise', 'regulate', 'conduct', 'govern']).toContain(m.targetWord);
    }
  });
});

describe('Translation quality — no garbage data', () => {
  const banks = [
    'ielts', 'toefl', 'gre', 'sat', 'gmat',
    'cet4', 'cefr-b2', 'npee', 'academic', 'business',
    'tech', 'news', 'editorial',
    'finance', 'medical', 'legal', 'cybersec',
  ];

  for (const bankId of banks) {
    test(`${bankId}: no ASCII-only Chinese mappings`, () => {
      const entries = JSON.parse(readFileSync(`data/word-banks/${bankId}.json`, 'utf-8'));
      for (const entry of entries) {
        for (const m of entry.chineseMappings) {
          expect(m.chinese).not.toMatch(/^[\x00-\x7F]+$/);
        }
      }
    });

    test(`${bankId}: no single-char Chinese mappings`, () => {
      const entries = JSON.parse(readFileSync(`data/word-banks/${bankId}.json`, 'utf-8'));
      for (const entry of entries) {
        for (const m of entry.chineseMappings) {
          expect(m.chinese.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    test(`${bankId}: all entries have at least one Chinese mapping`, () => {
      const entries = JSON.parse(readFileSync(`data/word-banks/${bankId}.json`, 'utf-8'));
      for (const entry of entries) {
        expect(entry.chineseMappings.length).toBeGreaterThanOrEqual(1);
      }
    });

    test(`${bankId}: no empty word IDs`, () => {
      const entries = JSON.parse(readFileSync(`data/word-banks/${bankId}.json`, 'utf-8'));
      for (const entry of entries) {
        expect(entry.id).toBeTruthy();
        expect(entry.word).toBeTruthy();
      }
    });
  }
});
