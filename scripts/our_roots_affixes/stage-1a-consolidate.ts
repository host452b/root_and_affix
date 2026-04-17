import { readFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PATHS, PIPELINE } from './config.js';
import { atomicWriteJson } from './atomic-write.js';
import { callClaude, extractJson } from './llm-client.js';
import { buildStage1aConsolidateSystem, buildStage1aConsolidateUserMessage } from './prompts.js';
import { logger } from './logger.js';
import { withRetry } from './retry.js';
import type { MorphemeInventory, MorphemeEntry } from './types.js';

export async function runStage1aConsolidate(): Promise<MorphemeInventory> {
  const files = readdirSync(PATHS.candidates).filter(f => f.endsWith('.json')).sort();
  const all: unknown[] = [];
  for (const f of files) {
    const arr = JSON.parse(readFileSync(join(PATHS.candidates, f), 'utf-8'));
    all.push(arr);
  }
  logger.info('stage-1a-consolidate', { phase: 'start', inputBatches: files.length });

  const result = await withRetry(async () => {
    const sys = buildStage1aConsolidateSystem();
    const user = buildStage1aConsolidateUserMessage(all);
    const r = await callClaude({ system: sys, userText: user, maxTokens: 16000 });
    logger.info('stage-1a-consolidate', { tokensOut: r.tokensOut });
    return extractJson<{ roots: MorphemeEntry[]; prefixes: MorphemeEntry[]; suffixes: MorphemeEntry[]; linkers: MorphemeEntry[] }>(r.text);
  }, { maxRetries: PIPELINE.maxRetries, baseDelayMs: 2000 });

  const variantToCanonical: Record<string, string> = {};
  const all2: MorphemeEntry[] = [...result.roots, ...result.prefixes, ...result.suffixes, ...result.linkers];
  for (const m of all2) {
    for (const v of m.variants) variantToCanonical[v] = m.id;
  }

  const inventory: MorphemeInventory = {
    roots: result.roots,
    affixes: [...result.prefixes, ...result.suffixes],
    linkers: result.linkers,
    variantToCanonical,
  };

  mkdirSync(PATHS.morphemes, { recursive: true });
  atomicWriteJson(join(PATHS.morphemes, 'roots.json'), inventory.roots);
  atomicWriteJson(join(PATHS.morphemes, 'affixes.json'), inventory.affixes);
  atomicWriteJson(join(PATHS.morphemes, 'linkers.json'), inventory.linkers);
  atomicWriteJson(join(PATHS.staging, 'variant-to-canonical.json'), variantToCanonical);

  logger.info('stage-1a-consolidate', {
    phase: 'done',
    roots: inventory.roots.length,
    affixes: inventory.affixes.length,
    linkers: inventory.linkers.length,
  });

  return inventory;
}

if (import.meta.main) {
  runStage1aConsolidate().catch(e => {
    logger.error('stage-1a-consolidate', { err: String(e) });
    process.exit(1);
  });
}
