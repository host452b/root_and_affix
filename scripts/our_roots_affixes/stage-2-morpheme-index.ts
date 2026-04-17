import { readFileSync, readdirSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { PATHS } from './config.js';
import { atomicWriteJson } from './atomic-write.js';
import { logger } from './logger.js';
import type { WordEntry, MorphemeEntry } from './types.js';

export function backfillMemberWords(words: WordEntry[], morphemes: MorphemeEntry[]): MorphemeEntry[] {
  const byId = new Map<string, Set<string>>();
  for (const m of morphemes) byId.set(m.id, new Set());
  for (const w of words) {
    for (const mo of w.morphemes) {
      const set = byId.get(mo.canonical);
      if (set) set.add(w.word);
    }
  }
  return morphemes.map(m => ({ ...m, memberWords: [...(byId.get(m.id) ?? [])].sort() }));
}

export function buildWordIndex(buckets: Array<{ bucketId: string; words: WordEntry[] }>): Record<string, string> {
  const idx: Record<string, string> = {};
  for (const b of buckets) {
    for (const w of b.words) idx[w.word] = b.bucketId;
  }
  return idx;
}

export async function runStage2(): Promise<void> {
  logger.info('stage-2', { phase: 'start' });

  const wordFiles = readdirSync(PATHS.words).filter(f => f.match(/^[a-z_]-\d{3}\.json$/));
  const allWords: WordEntry[] = [];
  const buckets: Array<{ bucketId: string; words: WordEntry[] }> = [];
  for (const f of wordFiles) {
    const bucketId = basename(f, '.json');
    const arr: WordEntry[] = JSON.parse(readFileSync(join(PATHS.words, f), 'utf-8'));
    allWords.push(...arr);
    buckets.push({ bucketId, words: arr });
  }

  const roots: MorphemeEntry[] = JSON.parse(readFileSync(join(PATHS.morphemes, 'roots.json'), 'utf-8'));
  const affixes: MorphemeEntry[] = JSON.parse(readFileSync(join(PATHS.morphemes, 'affixes.json'), 'utf-8'));
  const linkers: MorphemeEntry[] = JSON.parse(readFileSync(join(PATHS.morphemes, 'linkers.json'), 'utf-8'));

  const rootsWithMembers = backfillMemberWords(allWords, roots);
  const affixesWithMembers = backfillMemberWords(allWords, affixes);
  const linkersWithMembers = backfillMemberWords(allWords, linkers);

  mkdirSync(PATHS.morphemes, { recursive: true });
  atomicWriteJson(join(PATHS.morphemes, 'roots.json'), rootsWithMembers);
  atomicWriteJson(join(PATHS.morphemes, 'affixes.json'), affixesWithMembers);
  atomicWriteJson(join(PATHS.morphemes, 'linkers.json'), linkersWithMembers);

  const wordIndex = buildWordIndex(buckets);
  atomicWriteJson(join(PATHS.words, 'word-index.json'), wordIndex);

  logger.info('stage-2', {
    phase: 'done',
    totalWords: allWords.length,
    roots: rootsWithMembers.length,
    affixes: affixesWithMembers.length,
    linkers: linkersWithMembers.length,
  });
}

if (import.meta.main) {
  runStage2().catch(e => {
    logger.error('stage-2', { err: String(e) });
    process.exit(1);
  });
}
