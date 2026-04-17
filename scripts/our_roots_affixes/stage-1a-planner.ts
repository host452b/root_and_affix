import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PATHS, PIPELINE } from './config.js';
import { atomicWriteJson } from './atomic-write.js';
import { callClaude, extractJson } from './llm-client.js';
import { buildStage1aSystem, buildStage1aUserMessage } from './prompts.js';
import { logger } from './logger.js';
import { withRetry } from './retry.js';
import type { Manifest, ManifestEntry } from './types.js';

interface Candidate {
  candidate: string;
  role: 'root' | 'prefix' | 'suffix' | 'linker';
  variants: string[];
  meaning: { cn: string; en?: string };
  observedIn: string[];
}

async function processBatch(batch: ManifestEntry[], batchIdx: number): Promise<Candidate[]> {
  return withRetry(async () => {
    const sys = buildStage1aSystem();
    const user = buildStage1aUserMessage(batch);
    const r = await callClaude({ system: sys, userText: user });
    const parsed = extractJson<Candidate[]>(r.text);
    logger.info('stage-1a', { batch: batchIdx, candidates: parsed.length, tokensOut: r.tokensOut, cacheRead: r.cacheRead });
    return parsed;
  }, { maxRetries: PIPELINE.maxRetries, baseDelayMs: 2000, onRetry: (a, e) => logger.warn('stage-1a', { batch: batchIdx, attempt: a, err: e.message }) });
}

export async function runStage1aPlanner(): Promise<void> {
  const manifest = JSON.parse(readFileSync(PATHS.manifest, 'utf-8')) as Manifest;
  mkdirSync(PATHS.candidates, { recursive: true });

  const batchSize = PIPELINE.planningBatchSize;
  const batches: ManifestEntry[][] = [];
  for (let i = 0; i < manifest.entries.length; i += batchSize) {
    batches.push(manifest.entries.slice(i, i + batchSize));
  }
  logger.info('stage-1a', { phase: 'start', totalBatches: batches.length });

  const concurrency = PIPELINE.concurrency;
  const queue = batches.map((b, i) => ({ batch: b, idx: i }));
  let nextIdx = 0;

  async function worker() {
    while (true) {
      const item = queue[nextIdx++];
      if (!item) return;
      const outPath = join(PATHS.candidates, `batch-${String(item.idx).padStart(3, '0')}.json`);
      const candidates = await processBatch(item.batch, item.idx);
      atomicWriteJson(outPath, candidates);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  logger.info('stage-1a', { phase: 'planner-done', batches: batches.length });
}

if (import.meta.main) {
  runStage1aPlanner().catch(e => {
    logger.error('stage-1a', { err: String(e) });
    process.exit(1);
  });
}
