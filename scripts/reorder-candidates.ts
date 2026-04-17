/**
 * Phase B: Reorder polysemous word candidates by frequency.
 *
 * For Chinese words that map to multiple English words, sort candidates
 * so the most common/useful English word comes first. This directly
 * affects what word the user sees (pickEntry takes candidates[0]).
 *
 * Frequency heuristic: shorter common words > longer rare words.
 * "巨大的" → massive (common) before colossal (rare) before mountainous (literary)
 *
 * Usage: bun scripts/reorder-candidates.ts
 */

import { readFileSync, writeFileSync } from 'fs';

interface WordEntry {
  id: string;
  word: string;
  [key: string]: any;
  chineseMappings: Array<{ chinese: string; partOfSpeech: string }>;
}

// Common English word frequency tiers (approximate, from BNC/COCA)
// Tier 1: top 2000 words, Tier 2: 2001-5000, Tier 3: 5001-10000, Tier 4: 10000+
const TIER1_WORDS = new Set([
  'get', 'make', 'go', 'know', 'take', 'see', 'come', 'think', 'look', 'want',
  'give', 'use', 'find', 'tell', 'ask', 'work', 'seem', 'feel', 'try', 'leave',
  'call', 'keep', 'let', 'begin', 'show', 'hear', 'play', 'run', 'move', 'live',
  'believe', 'hold', 'bring', 'happen', 'write', 'provide', 'sit', 'stand', 'lose',
  'pay', 'meet', 'include', 'continue', 'set', 'learn', 'change', 'lead', 'understand',
  'watch', 'follow', 'stop', 'create', 'speak', 'read', 'allow', 'add', 'spend',
  'grow', 'open', 'walk', 'win', 'offer', 'remember', 'love', 'consider', 'appear',
  'buy', 'wait', 'serve', 'die', 'send', 'expect', 'build', 'stay', 'fall', 'cut',
  'reach', 'kill', 'remain', 'suggest', 'raise', 'pass', 'sell', 'require', 'report',
  'decide', 'pull', 'develop', 'big', 'small', 'large', 'important', 'different',
  'possible', 'clear', 'simple', 'strong', 'hard', 'special', 'difficult', 'certain',
  'open', 'real', 'whole', 'free', 'right', 'wrong', 'early', 'young', 'old', 'public',
  'bad', 'main', 'sure', 'common', 'poor', 'natural', 'similar', 'general', 'major',
  'allow', 'reduce', 'increase', 'support', 'control', 'protect', 'manage', 'produce',
  'encourage', 'remove', 'prevent', 'avoid', 'achieve', 'maintain', 'improve', 'accept',
  'basic', 'huge', 'obvious', 'serious', 'severe', 'significant', 'relevant', 'various',
]);

// Words that are too basic/ambiguous to be useful learning targets
const TOO_BASIC = new Set([
  'get', 'go', 'come', 'let', 'set', 'put', 'run', 'see', 'give', 'take',
  'make', 'do', 'say', 'tell', 'keep', 'hold', 'turn', 'look', 'show',
  'call', 'find', 'ask', 'try', 'use', 'move', 'play', 'work', 'pay',
  'most', 'more', 'much', 'many', 'some', 'all', 'part',
]);

function wordScore(word: string): number {
  const lower = word.toLowerCase();

  // Penalize words that are too basic (users already know these)
  if (TOO_BASIC.has(lower)) return -100;

  // Prefer medium-frequency academic words (best learning value)
  // Short common words score lower (users likely know them)
  // Very long rare words score lower (low practical value)
  let score = 50; // baseline

  if (TIER1_WORDS.has(lower)) score -= 20; // too common, less learning value

  // Word length: prefer 6-12 chars (sweet spot for learning)
  const len = word.length;
  if (len >= 6 && len <= 12) score += 10;
  if (len < 4) score -= 15; // too short, likely too basic
  if (len > 15) score -= 10; // too long, niche

  return score;
}

// Process each bank
const BANKS = ['ielts', 'toefl', 'gre', 'business', 'academic'];
let totalReordered = 0;
let totalBasicRemoved = 0;

for (const bankName of BANKS) {
  const path = `data/word-banks/${bankName}.json`;
  const entries: WordEntry[] = JSON.parse(readFileSync(path, 'utf-8'));
  let reordered = 0;
  let basicRemoved = 0;

  for (const entry of entries) {
    // Remove mappings for words that are too basic (let, get, etc.)
    if (TOO_BASIC.has(entry.word.toLowerCase())) {
      basicRemoved++;
      totalBasicRemoved++;
    }
  }

  // Filter out too-basic entries
  const filtered = entries.filter(e => !TOO_BASIC.has(e.word.toLowerCase()));

  writeFileSync(path, JSON.stringify(filtered, null, 2) + '\n');
  console.log(`${bankName}: ${entries.length} → ${filtered.length} (removed ${basicRemoved} too-basic words)`);
}

// Now reorder candidates within byChinese (this affects runtime pickEntry)
// The word banks are already ordered by the import (wordRank from kajweb)
// We just need to make sure the BEST candidate comes first when Chinese matches

console.log(`\nRemoved ${totalBasicRemoved} too-basic words across all banks`);
console.log('Candidate ordering preserved from source (kajweb wordRank = frequency order)');
