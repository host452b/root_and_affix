import { readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { atomicWriteJson } from './atomic-write.js';
import { logger } from './logger.js';
import { PATHS, PIPELINE, WORD_BANKS_DIR } from './config.js';
import type { Manifest, ManifestEntry, BucketPlan } from './types.js';

interface RawEntry {
  id?: string;
  word: string;
  phonetic?: string;
  meanings?: Array<{ partOfSpeech?: string; definition?: string; definitionCn?: string }>;
}

export function buildManifest(wordBanksDir: string): Manifest {
  const files = readdirSync(wordBanksDir).filter(f => f.endsWith('.json') && f !== 'stats.json');
  const acc = new Map<string, ManifestEntry>();

  for (const f of files) {
    const bankName = basename(f, '.json');
    const raw = JSON.parse(readFileSync(join(wordBanksDir, f), 'utf-8')) as RawEntry[] | { words: RawEntry[] };
    const arr: RawEntry[] = Array.isArray(raw) ? raw : (raw.words ?? []);
    for (const r of arr) {
      if (!r.word) continue;
      const key = r.word.trim().toLowerCase();
      if (!key) continue;
      const existing = acc.get(key);
      const cn = r.meanings?.[0]?.definitionCn ?? '';
      const phon = r.phonetic ?? '';
      if (existing) {
        if (!existing.sourceBanks.includes(bankName)) existing.sourceBanks.push(bankName);
        if (!existing.phonetic && phon) existing.phonetic = phon;
        if (!existing.definitionCn && cn) existing.definitionCn = cn;
      } else {
        acc.set(key, {
          word: key,
          phonetic: phon,
          definitionCn: cn,
          sourceBanks: [bankName],
        });
      }
    }
  }

  const entries = Array.from(acc.values()).sort((a, b) => a.word.localeCompare(b.word));
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    totalWords: entries.length,
    entries,
  };
}

export function bucketize(entries: ManifestEntry[], bucketSize: number): BucketPlan {
  const byLetter = new Map<string, ManifestEntry[]>();
  for (const e of entries) {
    const letter = (e.word[0] ?? 'x').toLowerCase();
    const k = /[a-z]/.test(letter) ? letter : '_';
    if (!byLetter.has(k)) byLetter.set(k, []);
    byLetter.get(k)!.push(e);
  }

  const buckets: BucketPlan['buckets'] = [];
  for (const letter of [...byLetter.keys()].sort()) {
    const arr = byLetter.get(letter)!;
    for (let i = 0; i < arr.length; i += bucketSize) {
      const idx = Math.floor(i / bucketSize) + 1;
      buckets.push({
        id: `${letter}-${String(idx).padStart(3, '0')}`,
        words: arr.slice(i, i + bucketSize),
      });
    }
  }
  return { buckets, totalBuckets: buckets.length };
}

export async function runStage0(): Promise<void> {
  logger.info('stage-0', { phase: 'start' });
  const m = buildManifest(WORD_BANKS_DIR);
  atomicWriteJson(PATHS.manifest, m);
  logger.info('stage-0', { phase: 'manifest-written', totalWords: m.totalWords });
  const plan = bucketize(m.entries, PIPELINE.wordsPerBucket);
  atomicWriteJson(PATHS.bucketPlan, plan);
  logger.info('stage-0', { phase: 'done', totalBuckets: plan.totalBuckets });
}

if (import.meta.main) {
  runStage0().catch(err => {
    logger.error('stage-0', { err: String(err) });
    process.exit(1);
  });
}
