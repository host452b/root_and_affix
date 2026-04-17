import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PATHS, PIPELINE } from './config.js';
import { atomicWriteJson } from './atomic-write.js';
import { writeCheckpoint, isBucketDone } from './checkpoint.js';
import { decomposeBatch } from './stage-1b-decompose.js';
import { logger } from './logger.js';
import { createHash } from 'crypto';
import type { BucketPlan, MorphemeInventory, WordEntry } from './types.js';

function loadInventory(): MorphemeInventory {
  const roots = JSON.parse(readFileSync(join(PATHS.morphemes, 'roots.json'), 'utf-8'));
  const affixes = JSON.parse(readFileSync(join(PATHS.morphemes, 'affixes.json'), 'utf-8'));
  const linkers = JSON.parse(readFileSync(join(PATHS.morphemes, 'linkers.json'), 'utf-8'));
  const variantToCanonical = JSON.parse(readFileSync(join(PATHS.staging, 'variant-to-canonical.json'), 'utf-8'));
  return { roots, affixes, linkers, variantToCanonical };
}

export async function runStage1b(): Promise<void> {
  const plan = JSON.parse(readFileSync(PATHS.bucketPlan, 'utf-8')) as BucketPlan;
  const inv = loadInventory();

  mkdirSync(PATHS.words, { recursive: true });
  mkdirSync(PATHS.checkpoints, { recursive: true });
  mkdirSync(PATHS.failed, { recursive: true });

  const todo = plan.buckets.filter(b => !isBucketDone(PATHS.checkpoints, b.id));
  logger.info('stage-1b', { phase: 'start', total: plan.totalBuckets, done: plan.totalBuckets - todo.length, todo: todo.length });

  let cursor = 0;
  let completed = plan.totalBuckets - todo.length;
  let failed = 0;
  const startTs = Date.now();

  async function worker(workerId: number) {
    while (true) {
      const item = todo[cursor++];
      if (!item) return;
      const startBucket = Date.now();
      try {
        const result = await decomposeBatch(item.words, inv, item.id);
        const outPath = join(PATHS.words, `${item.id}.json`);
        atomicWriteJson(outPath, result.entries);
        const hash = createHash('sha256').update(JSON.stringify(result.entries)).digest('hex').slice(0, 16);
        writeCheckpoint(PATHS.checkpoints, {
          bucketId: item.id,
          timestamp: new Date().toISOString(),
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          hash,
        });
        completed++;
        const elapsed = Date.now() - startTs;
        const rate = completed / elapsed;
        const remaining = todo.length - (cursor - 1);
        const etaMs = remaining / rate;
        logger.info('stage-1b', {
          worker: workerId,
          bucket: item.id,
          status: 'done',
          durationMs: Date.now() - startBucket,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          cacheRead: result.cacheRead,
          progress: `${completed}/${plan.totalBuckets}`,
          etaMs: Math.round(etaMs),
        });
      } catch (err) {
        failed++;
        logger.error('stage-1b', { worker: workerId, bucket: item.id, status: 'failed', err: String(err).slice(0, 300) });
        atomicWriteJson(join(PATHS.failed, `${item.id}.json`), {
          bucketId: item.id,
          words: item.words.map(w => w.word),
          error: String(err),
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: PIPELINE.concurrency }, (_, i) => worker(i + 1)));
  logger.info('stage-1b', { phase: 'done', completed, failed, total: plan.totalBuckets });
  if (failed / plan.totalBuckets > 0.02) {
    throw new Error(`Stage 1b failure rate exceeded 2%: ${failed}/${plan.totalBuckets}`);
  }
}

if (import.meta.main) {
  runStage1b().catch(e => {
    logger.error('stage-1b', { err: String(e) });
    process.exit(1);
  });
}
