import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { PATHS, PIPELINE } from './config.js';
import { atomicWriteText, atomicWriteJson } from './atomic-write.js';
import { callClaude, extractJson } from './llm-client.js';
import { STAGE4_QA_SYSTEM, buildStage4UserMessage } from './prompts.js';
import { withRetry } from './retry.js';
import { logger } from './logger.js';
import type { WordEntry } from './types.js';

interface QaScore { word: string; score: number; issues: string[]; bucket?: string }

function sampleN<T>(arr: T[], n: number, seed: number): T[] {
  // Mulberry32 PRNG for deterministic sampling
  let s = seed;
  const rng = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export async function runStage4(): Promise<void> {
  logger.info('stage-4', { phase: 'start' });
  const wordFiles = readdirSync(PATHS.words).filter(f => f.match(/^[a-z_]-\d{3}\.json$/));
  const all: Array<WordEntry & { bucket: string }> = [];
  for (const f of wordFiles) {
    const bucket = f.replace(/\.json$/, '');
    for (const w of JSON.parse(readFileSync(join(PATHS.words, f), 'utf-8')) as WordEntry[]) {
      all.push({ ...w, bucket });
    }
  }

  const sample = sampleN(all, PIPELINE.qaSampleSize, 42);
  const scores: QaScore[] = [];

  // Process in chunks of 20 to keep each QA call small
  for (let i = 0; i < sample.length; i += 20) {
    const chunk = sample.slice(i, i + 20);
    const result = await withRetry(async () => {
      const r = await callClaude({
        system: STAGE4_QA_SYSTEM,
        userText: buildStage4UserMessage(chunk.map(c => { const { bucket, ...rest } = c; return rest; })),
      });
      return extractJson<QaScore[]>(r.text);
    }, { maxRetries: PIPELINE.maxRetries, baseDelayMs: 2000 });
    chunk.forEach((c, idx) => {
      if (result[idx]) scores.push({ ...result[idx], bucket: c.bucket });
    });
    logger.info('stage-4', { chunk: i / 20, processed: scores.length });
  }

  const passCount = scores.filter(s => s.score >= 0.7).length;
  const passRate = passCount / scores.length;
  const low = scores.filter(s => s.score < 0.7);
  const lowBuckets = new Set(low.map(s => s.bucket).filter(Boolean));

  atomicWriteJson(join(PATHS.staging, 'qa-scores.json'), scores);
  const report = [
    `# Stage 4 QA Report`,
    ``,
    `- Sample size: ${scores.length}`,
    `- Pass count (score ≥ 0.7): ${passCount}`,
    `- **Pass rate: ${(passRate * 100).toFixed(1)}%** (threshold: ${(PIPELINE.qaThreshold * 100).toFixed(0)}%)`,
    `- Low-score entries: ${low.length}`,
    `- Buckets containing low-score entries: ${[...lowBuckets].sort().join(', ') || '(none)'}`,
    ``,
    `## Low-score details`,
    ``,
    ...low.map(s => `- **${s.word}** (${s.bucket}, score=${s.score}): ${s.issues.join('; ')}`),
  ].join('\n');
  atomicWriteText(PATHS.qaReport, report);

  logger.info('stage-4', { phase: 'done', passRate, lowCount: low.length });

  if (passRate < PIPELINE.qaThreshold) {
    throw new Error(`QA pass rate ${(passRate * 100).toFixed(1)}% < threshold ${(PIPELINE.qaThreshold * 100).toFixed(0)}%. See ${PATHS.qaReport}. Re-run flagged buckets.`);
  }
}

if (import.meta.main) {
  runStage4().catch(e => {
    logger.error('stage-4', { err: String(e) });
    process.exit(1);
  });
}
