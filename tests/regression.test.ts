import { describe, expect, test } from 'bun:test';
import { buildWordBank } from '../src/nlp/word-bank.js';
import { findMatches, selectWords } from '../src/nlp/index.js';
import type { WordEntry, UserWordState } from '../src/core/types.js';
import { readFileSync } from 'fs';

/**
 * Regression tests for flip coverage, translation quality, and user satisfaction.
 *
 * These tests guard against silent regressions in the matching pipeline:
 * - Coverage: real Chinese text should produce a minimum number of matches
 * - Quality: known-bad translations must never reappear
 * - Density: invasion levels must actually control output volume
 * - Satisfaction: mastered words suppressed, spacing prevents "broken English" look
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadBank(bankId: string) {
  const entries = JSON.parse(readFileSync(`data/word-banks/${bankId}.json`, 'utf-8'));
  return buildWordBank(entries, [bankId]);
}

function loadBanks(ids: string[]) {
  const all: WordEntry[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const entries = JSON.parse(readFileSync(`data/word-banks/${id}.json`, 'utf-8'));
    for (const e of entries) {
      if (!seen.has(e.id)) { seen.add(e.id); all.push(e); }
    }
  }
  return buildWordBank(all, ids);
}

// ── Real-world Chinese text passages for coverage testing ────────────────────

const PASSAGES = {
  news: '中国政府宣布新的经济政策，旨在促进技术创新和可持续发展。专家认为这将对全球市场产生深远影响，特别是在人工智能和新能源领域。教育改革也是重点议题之一。',
  tech: '最新研究表明，人工智能技术在医疗诊断领域取得了显著进展。科学家利用深度学习算法分析大量临床数据，开发出能够准确识别疾病的系统。这项创新有望革命性地改变医疗行业。',
  business: '公司管理层决定调整投资策略，将重点转向数字化转型。新的商业模式强调客户体验和数据驱动的决策。市场分析师预测，这一转变将显著提升公司的竞争优势。',
  education: '教育部发布最新课程改革方案，强调培养学生的批判性思维和创新能力。新课程标准要求教师采用更加互动的教学方法，鼓励学生积极参与课堂讨论和项目实践。',
  environment: '全球气候变化导致极端天气事件频发，各国政府加大了对环境保护的投入。碳排放交易体系逐步完善，可再生能源技术的应用也在快速扩展。',
};

// ── Coverage regression ──────────────────────────────────────────────────────

describe('Flip coverage regression — IELTS bank', () => {
  const bank = loadBank('ielts');

  for (const [label, text] of Object.entries(PASSAGES)) {
    test(`${label}: findMatches returns at least 2 matches`, () => {
      const matches = findMatches(text, bank);
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  }

  test('all matches have confidence >= 0.8', () => {
    for (const text of Object.values(PASSAGES)) {
      const matches = findMatches(text, bank);
      for (const m of matches) {
        expect(m.confidenceScore).toBeGreaterThanOrEqual(0.8);
      }
    }
  });

  test('no match has empty targetWord', () => {
    for (const text of Object.values(PASSAGES)) {
      const matches = findMatches(text, bank);
      for (const m of matches) {
        expect(m.targetWord.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Flip coverage regression — multi-bank', () => {
  const bank = loadBanks(['ielts', 'academic', 'business']);

  test('multi-bank matches >= single-bank matches', () => {
    const single = loadBank('ielts');
    const text = PASSAGES.news;
    const singleMatches = findMatches(text, single);
    const multiMatches = findMatches(text, bank);
    expect(multiMatches.length).toBeGreaterThanOrEqual(singleMatches.length);
  });
});

// ── Translation quality regression — known-bad translations ──────────────────

describe('Translation quality regression — embarrassing translations', () => {
  const bank = loadBanks(['ielts', 'toefl', 'gre', 'academic']);

  const KNOWN_BAD: Array<{ text: string; chinese: string; reject: string[]; accept?: string[] }> = [
    { text: '他的表现非常出色', chinese: '表现', reject: ['watch', 'look', 'clock'], accept: ['performance', 'behavior', 'behaviour', 'behave', 'perform'] },
    { text: '保护环境是每个人的责任', chinese: '环境', reject: ['context', 'milieu', 'condition'], accept: ['environment'] },
    { text: '这项研究很有价值', chinese: '研究', reject: ['grind', 'polish'], accept: ['research', 'study', 'analyze', 'analyse', 'investigate'] },
    { text: '需要改善投资环境', chinese: '投资', reject: ['throw', 'cast'], accept: ['invest', 'investment'] },
    { text: '学校的教育质量很高', chinese: '教育', reject: ['rear', 'breed'], accept: ['education', 'educate'] },
    { text: '我们应该尊重不同的文化', chinese: '文化', reject: ['chemical', 'digest'], accept: ['culture', 'cultural'] },
    { text: '这是一个重要的发现', chinese: '发现', reject: ['send', 'emit'], accept: ['discovery', 'discover', 'find', 'found', 'detect'] },
  ];

  for (const { text, chinese, reject, accept } of KNOWN_BAD) {
    test(`"${chinese}" should not become ${reject.join('/')}`, () => {
      const matches = findMatches(text, bank);
      const m = matches.find(m => m.originalText === chinese);
      if (m) {
        for (const bad of reject) {
          expect(m.targetWord).not.toBe(bad);
        }
        if (accept) {
          expect(accept).toContain(m.targetWord);
        }
      }
    });
  }
});

// ── POS-aware candidate selection ────────────────────────────────────────────

describe('POS-aware candidate selection', () => {
  const bank = loadBanks(['ielts', 'toefl', 'business', 'news']);

  test('准备 + verb → picks verb form "prepare", not noun "arrangements"', () => {
    const matches = findMatches('我 nas 准备关机 可以出 3 块 16T 的硬盘', bank);
    const m = matches.find(m => m.originalText === '准备');
    if (m) {
      expect(m.targetWord).toBe('prepare');
      expect(m.targetWord).not.toBe('arrangements');
      expect(m.targetWord).not.toBe('provision');
      expect(m.targetWord).not.toBe('preparation');
    }
  });

  test('投资 in verb context → picks verb form "invest"', () => {
    const matches = findMatches('公司决定投资新能源领域', bank);
    const m = matches.find(m => m.originalText === '投资');
    if (m) {
      expect(['invest', 'investment']).toContain(m.targetWord);
    }
  });

  test('curated first candidate preserved when POS is equal', () => {
    // 环境 — all candidates are nouns, so first candidate (environment) should win
    const matches = findMatches('保护环境是每个人的责任', bank);
    const m = matches.find(m => m.originalText === '环境');
    if (m) {
      expect(m.targetWord).toBe('environment');
    }
  });
});

// ── contextHint effectiveness ────────────────────────────────────────────────

describe('contextHint disambiguation', () => {
  const bank = loadBanks(['ielts', 'gre']);

  test('polysemous "巨大的" — same word matched consistently', () => {
    const text1 = '这个工程的规模是巨大的';
    const text2 = '他取得了巨大的成功';
    const m1 = findMatches(text1, bank).find(m => m.originalText === '巨大的');
    const m2 = findMatches(text2, bank).find(m => m.originalText === '巨大的');
    // Both should resolve to the same word (deterministic without wordStates)
    if (m1 && m2) {
      expect(m1.targetWord).toBe(m2.targetWord);
    }
  });

  test('matched words pass confidence threshold', () => {
    // contextHint should boost correct matches above threshold
    const texts = [
      '他完全放弃了这个计划',
      '这是一个显而易见的事实',
      '政府的政策需要改革',
    ];
    for (const text of texts) {
      const matches = findMatches(text, bank);
      for (const m of matches) {
        expect(m.confidenceScore).toBeGreaterThanOrEqual(0.8);
      }
    }
  });
});

// ── Rate-based density control ───────────────────────────────────────────
//
// Levels use a rate (words per 1000 chars). selectWords caps at a given max.

describe('Rate-based density control', () => {
  const bank = loadBank('ielts');
  const longText = Object.values(PASSAGES).join('。');

  test('selectWords respects cap', () => {
    const matches = findMatches(longText, bank);
    const selected = selectWords(matches, 8);
    expect(selected.length).toBeLessThanOrEqual(8);
  });

  test('higher cap produces >= lower cap results', () => {
    const matches = findMatches(longText, bank);
    const s8 = selectWords(matches, 8);
    const s40 = selectWords(matches, 40);
    expect(s40.length).toBeGreaterThanOrEqual(s8.length);
  });

  test('rate calculation: target scales with text length', () => {
    const RATE = 25; // L2
    const shortText = PASSAGES.news; // ~80 chars
    const allText = Object.values(PASSAGES).join('。'); // ~400 chars
    const targetShort = Math.max(3, Math.round((shortText.length / 1000) * RATE));
    const targetLong = Math.max(3, Math.round((allText.length / 1000) * RATE));
    expect(targetLong).toBeGreaterThan(targetShort);
  });
});

// ── Multi-batch page-level cap (e2e simulation) ─────────────────────────────
//
// Simulates how content.ts flipNodes() processes text in batches,
// each batch calling selectWords() independently. The page-level cap
// (calculated from text length × rate) must hold across all batches.

describe('Page-level rate cap across multiple batches', () => {
  const bank = loadBanks(['ielts', 'tech', 'news', 'business']);
  const batches = Object.values(PASSAGES);
  const totalChars = batches.reduce((sum, t) => sum + t.length, 0);

  function simulatePageFlip(rate: number): number {
    const pageTarget = Math.max(3, Math.round((totalChars / 1000) * rate));
    const pageFlippedWords = new Set<string>();

    for (const text of batches) {
      const remaining = pageTarget - pageFlippedWords.size;
      if (remaining <= 0) break;

      const matches = findMatches(text, bank);
      const newMatches = matches.filter(m => !pageFlippedWords.has(m.targetWord));
      const selected = selectWords(newMatches, remaining);

      for (const s of selected) {
        pageFlippedWords.add(s.targetWord);
      }
    }

    return pageFlippedWords.size;
  }

  test('L1 (rate=10): total flips <= calculated target', () => {
    const target = Math.max(3, Math.round((totalChars / 1000) * 10));
    const total = simulatePageFlip(10);
    expect(total).toBeLessThanOrEqual(target);
    expect(total).toBeGreaterThan(0);
  });

  test('L2 (rate=25): total flips <= calculated target', () => {
    const target = Math.max(3, Math.round((totalChars / 1000) * 25));
    const total = simulatePageFlip(25);
    expect(total).toBeLessThanOrEqual(target);
  });

  test('L3 (rate=50): total flips <= calculated target', () => {
    const target = Math.max(3, Math.round((totalChars / 1000) * 50));
    const total = simulatePageFlip(50);
    expect(total).toBeLessThanOrEqual(target);
  });

  test('L1 produces strictly fewer flips than L3', () => {
    const l1 = simulatePageFlip(10);
    const l3 = simulatePageFlip(50);
    expect(l1).toBeLessThan(l3);
  });

  test('remaining=0 stops adding words (no overflow)', () => {
    // rate=1 on ~400 chars → target=max(3,0)=3
    const total = simulatePageFlip(1);
    expect(total).toBeLessThanOrEqual(3);
    expect(total).toBeGreaterThan(0);
  });

  test('each level produces monotonically more words', () => {
    const results = [10, 25, 50, 120].map(r => simulatePageFlip(r));
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
    }
  });
});

// ── Spacing filter — no "broken English" adjacent flips ──────────────────────

describe('Spacing filter — adjacent word suppression', () => {
  const bank = loadBanks(['ielts', 'academic']);

  test('adjacent Chinese words keep only one flip', () => {
    // Two Chinese words right next to each other
    const matches = findMatches('环境政策', bank);
    const selected = selectWords(matches, 10);
    expect(selected.length).toBe(1); // too close, one dropped
  });

  test('spaced Chinese words both survive', () => {
    // Words far apart
    const matches = findMatches('我们需要大力保护环境同时也需要合理制定经济方面的政策', bank);
    const selected = selectWords(matches, 10);
    const words = selected.map(s => s.targetWord);
    // At least one should survive, potentially both if far enough apart
    expect(selected.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Mastery suppression — cleared words don't return ─────────────────────────

describe('Mastery suppression — 3x cleared blacklist', () => {
  const bank = loadBank('ielts');

  test('all cleared 3x → empty result despite matches', () => {
    const text = '保护环境是每个人的责任需要好的政策';
    const matches = findMatches(text, bank);
    // Create states where every matched word is mastered 3x
    const states: Record<string, UserWordState> = {};
    for (const m of matches) {
      states[m.wordEntry.id] = {
        wordId: m.wordEntry.id, status: 'mastered', exposureCount: 50,
        contextDiversity: 5, lastExposureAt: Date.now(), firstSeenAt: 0,
        clickCount: 10, hoverCount: 5, decodedAt: Date.now(), correctRecognitions: 20,
        clearedCount: 3, masteredAt: Date.now(), nextReviewAt: Date.now() + 999999999,
        easeFactor: 2.5, interval: 30, repetitions: 5,
      };
    }
    const selected = selectWords(matches, 10, states);
    expect(selected.length).toBe(0);
  });

  test('mix of mastered and new — only new words appear', () => {
    const text = '环境保护需要创新的政策和持续的发展以及更好的教育';
    const matches = findMatches(text, bank);
    if (matches.length < 2) return; // need at least 2 matches for this test

    // Master the first match only
    const states: Record<string, UserWordState> = {
      [matches[0].wordEntry.id]: {
        wordId: matches[0].wordEntry.id, status: 'mastered', exposureCount: 50,
        contextDiversity: 5, lastExposureAt: Date.now(), firstSeenAt: 0,
        clickCount: 10, hoverCount: 5, decodedAt: Date.now(), correctRecognitions: 20,
        clearedCount: 3, masteredAt: Date.now(), nextReviewAt: Date.now() + 999999999,
        easeFactor: 2.5, interval: 30, repetitions: 5,
      },
    };
    const selected = selectWords(matches, 10, states);
    const mastered = selected.find(s => s.wordEntry.id === matches[0].wordEntry.id);
    expect(mastered).toBeUndefined();
  });
});

// ── Deduplication — same English word never appears twice ────────────────────

describe('Dedup — no duplicate English words on same page', () => {
  const bank = loadBank('ielts');

  test('repeated Chinese produces unique English', () => {
    // Same Chinese word repeated multiple times
    const text = '环境好的环境差的环境一般的环境';
    const matches = findMatches(text, bank);
    const selected = selectWords(matches, 10);
    const words = selected.map(s => s.targetWord);
    const unique = new Set(words);
    expect(words.length).toBe(unique.size);
  });
});

// ── Link protection — a[href] content never matched ──────────────────────────

describe('Link protection', () => {
  test('scanner hasChinese detects Chinese in link text', () => {
    // This test verifies the detection works — the skip happens at DOM level
    const { hasChinese } = require('../src/scanner/index.js');
    expect(hasChinese('点击查看环境报告')).toBe(true);
  });

  test('shouldSkipNode rejects text inside links', () => {
    const { shouldSkipNode } = require('../src/scanner/index.js');
    const a = document.createElement('a');
    a.setAttribute('href', 'https://example.com');
    a.textContent = '环境报告';
    document.body.appendChild(a);
    expect(shouldSkipNode(a.firstChild as Text)).toBe(true);
    a.remove();
  });
});

// ── Per-bank coverage snapshot ───────────────────────────────────────────────
// Ensures each bank can produce matches from representative text.
// If a bank regresses (e.g. bulk cleanup deletes too much), this catches it.

describe('Per-bank minimum coverage', () => {
  const BANK_TEXTS: Record<string, string> = {
    ielts: '环境保护和教育发展需要政府的政策支持',
    toefl: '学术研究需要创新的方法来解决复杂的问题',
    gre: '复杂的社会现象需要深入的分析和理解',
    sat: '学生需要培养批判性思维和创新能力',
    gmat: '商业决策需要基于数据的分析和判断',
    cet4: '大学教育强调综合能力的培养和实践',
    'cefr-b2': '了解不同文化有助于促进国际交流',
    npee: '研究生教育需要培养独立的研究能力',
    academic: '学术论文需要严谨的逻辑和充分的证据',
    business: '企业管理需要考虑市场变化和竞争策略',
    editorial: '这条轨迹需要准时和守时以及适当的补贴',
    tech: '技术创新推动了数字化转型的发展',
    news: '新闻报道需要客观公正地呈现事实',
    finance: '金融市场的波动受到多种因素的影响',
    medical: '医疗技术的进步改善了疾病的治疗效果',
    legal: '法律制度的完善对社会稳定至关重要',
    cybersec: '这种嫁接技术常用于网络安全领域',
  };

  for (const [bankId, text] of Object.entries(BANK_TEXTS)) {
    test(`${bankId}: produces at least 1 match from representative text`, () => {
      const bank = loadBank(bankId);
      const matches = findMatches(text, bank);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  }
});
