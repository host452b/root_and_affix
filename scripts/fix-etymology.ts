/**
 * Fix etymology quality issues:
 * 1. Remove circular entries (origin = word itself, no value)
 * 2. Remove too-short/terse entries (< 30 chars, just "see X")
 * 3. Clean "Unknown" origin → extract actual language if present in story
 * 4. Truncate at first useful sentence (remove academic cross-references)
 *
 * Usage: bun scripts/fix-etymology.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';

const BANKS = readdirSync('data/word-banks')
  .filter(f => f.endsWith('.json') && f !== 'stats.json');

let totalFixed = 0;
let totalRemoved = 0;
let totalCleaned = 0;

for (const file of BANKS) {
  const path = `data/word-banks/${file}`;
  const entries = JSON.parse(readFileSync(path, 'utf-8'));
  let fixed = 0;
  let removed = 0;
  let cleaned = 0;

  for (const entry of entries) {
    if (!entry.etymology) continue;
    const et = entry.etymology;
    const word = entry.word.toLowerCase();
    const story = et.story ?? '';
    const origin = et.origin ?? '';

    // 1. Remove circular: origin is just the word itself, story adds nothing
    const isCircular = origin.toLowerCase() === word ||
      (story.toLowerCase().startsWith(word) && story.split(',').length <= 2 && story.length < 60);

    // 2. Remove too short / just a cross-reference
    const isTooShort = story.length < 25;
    const isJustRef = /^(see |cf\. |variant of |compare |chiefly )/i.test(story) && story.length < 80;

    if (isCircular || isTooShort || isJustRef) {
      delete entry.etymology;
      removed++;
      continue;
    }

    // 3. Fix "Unknown" origin — try to extract language from story
    if (origin === 'Unknown' || origin === '' || origin === 'unknown') {
      const langMatch = story.match(/from\s+(Latin|Greek|French|Old English|Old French|Middle English|Middle French|Anglo-French|Germanic|Norse|Sanskrit|Arabic|Spanish|Italian|Dutch|German|Proto-Germanic|Celtic|Hebrew|Persian|Turkish|Japanese|Chinese|Korean|Malay|Hindi|Russian|Portuguese|PIE)/i);
      if (langMatch) {
        et.origin = langMatch[1];
        fixed++;
      } else {
        et.origin = '';
      }
    }

    // 4. Clean up story: remove trailing cross-references like "Related: ..." or "Compare ..."
    let cleanStory = story
      .replace(/\s*Related:.*$/i, '')
      .replace(/\s*Compare\s+\w+\.?\s*$/i, '')
      .replace(/\s*See also\s+.*$/i, '')
      .replace(/\s*Cf\.\s+.*$/i, '')
      .trim();

    // 5. Remove "for spelling, see -or" type noise
    cleanStory = cleanStory
      .replace(/;\s*for spelling.*$/i, '')
      .replace(/;\s*see\s+-\w+\s*$/i, '')
      .trim();

    if (cleanStory !== story) {
      et.story = cleanStory;
      cleaned++;
    }
  }

  writeFileSync(path, JSON.stringify(entries, null, 2) + '\n');
  if (removed > 0 || fixed > 0 || cleaned > 0) {
    console.log(`${file}: removed ${removed} bad etymologies, fixed ${fixed} origins, cleaned ${cleaned} stories`);
  }
  totalRemoved += removed;
  totalFixed += fixed;
  totalCleaned += cleaned;
}

console.log(`\nTotal: removed ${totalRemoved}, fixed ${totalFixed} origins, cleaned ${totalCleaned} stories`);
