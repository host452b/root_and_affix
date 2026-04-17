/**
 * Phase A: Fix critical quality issues in word banks.
 *
 * 1. Remove single-char Chinese mappings (too ambiguous, over-matches on pages)
 * 2. Remove ASCII-only mappings (import artifacts like "n.", quotes)
 * 3. Remove mappings with punctuation artifacts
 * 4. Skip entries that end up with zero valid mappings
 *
 * Usage: bun scripts/audit-fix-wordbanks.ts
 */

import { readFileSync, writeFileSync } from 'fs';

interface WordEntry {
  id: string;
  word: string;
  [key: string]: any;
  chineseMappings: Array<{ chinese: string; partOfSpeech: string }>;
}

const BANKS = ['ielts', 'toefl', 'gre', 'business', 'academic', 'editorial'];

let totalRemoved = 0;
let totalEntriesDropped = 0;
let totalSingleChar = 0;
let totalAscii = 0;

for (const bankName of BANKS) {
  const path = `data/word-banks/${bankName}.json`;
  const entries: WordEntry[] = JSON.parse(readFileSync(path, 'utf-8'));
  const cleaned: WordEntry[] = [];
  let bankRemoved = 0;
  let bankDropped = 0;

  for (const entry of entries) {
    const originalCount = entry.chineseMappings.length;

    // Filter out bad mappings
    entry.chineseMappings = entry.chineseMappings.filter(m => {
      const ch = m.chinese;

      // Remove ASCII-only (import artifacts: "n.", quotes, etc.)
      if (/^[\x00-\x7F]+$/.test(ch)) {
        totalAscii++;
        return false;
      }

      // Remove single-char Chinese (too ambiguous: 多,唱,肉,光,网...)
      // These match everywhere on Chinese pages, creating noise
      if (ch.length === 1) {
        totalSingleChar++;
        return false;
      }

      // Remove if starts/ends with punctuation artifacts
      if (/^[""''（）()【】\[\]、，。；：！？…]/.test(ch)) return false;
      if (/[""''（）()【】\[\]、，。；：！？…]$/.test(ch)) return false;

      // Remove pure numbers
      if (/^\d+$/.test(ch)) return false;

      return true;
    });

    const removed = originalCount - entry.chineseMappings.length;
    bankRemoved += removed;
    totalRemoved += removed;

    // Keep entry only if it still has valid mappings
    if (entry.chineseMappings.length > 0) {
      cleaned.push(entry);
    } else {
      bankDropped++;
      totalEntriesDropped++;
    }
  }

  writeFileSync(path, JSON.stringify(cleaned, null, 2) + '\n');
  console.log(`${bankName}: removed ${bankRemoved} bad mappings, dropped ${bankDropped} entries → ${cleaned.length} words`);
}

console.log(`\nTotal: removed ${totalRemoved} mappings (${totalSingleChar} single-char, ${totalAscii} ASCII)`);
console.log(`Dropped ${totalEntriesDropped} entries with zero valid mappings`);
console.log('\nRun `bun run build` to update dist/');
