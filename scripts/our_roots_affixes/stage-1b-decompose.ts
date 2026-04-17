import { callClaude, extractJson } from './llm-client.js';
import { buildStage1bSystem, buildStage1bUserMessage } from './prompts.js';
import { validateWordEntry } from './schema.js';
import { logger } from './logger.js';
import { withRetry } from './retry.js';
import { PIPELINE } from './config.js';
import type { WordEntry, ManifestEntry, MorphemeInventory } from './types.js';

export interface BatchValidation {
  ok: boolean;
  errors: string[];
}

export function validateBatchResult(
  entries: unknown[],
  expectedWords: string[],
  inv: MorphemeInventory,
): BatchValidation {
  const errors: string[] = [];
  if (!Array.isArray(entries)) return { ok: false, errors: ['result is not an array'] };
  if (entries.length !== expectedWords.length) {
    errors.push(`count mismatch: got ${entries.length}, expected ${expectedWords.length}`);
  }

  const ids = new Set<string>([
    ...inv.roots.map(r => r.id),
    ...inv.affixes.map(a => a.id),
    ...inv.linkers.map(l => l.id),
  ]);

  const n = Math.min(entries.length, expectedWords.length);
  for (let i = 0; i < n; i++) {
    const e = entries[i] as WordEntry;
    const exp = expectedWords[i];
    const schemaRes = validateWordEntry(e);
    if (!schemaRes.ok) {
      for (const err of schemaRes.errors) errors.push(`[${i}:${exp}] ${err}`);
      continue;
    }
    if (e.word !== exp) {
      errors.push(`[${i}] word mismatch: got "${e.word}", expected "${exp}"`);
    }
    for (const m of e.morphemes) {
      if (!ids.has(m.canonical)) {
        errors.push(`[${i}:${e.word}] morpheme canonical "${m.canonical}" not in inventory`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export async function decomposeBatch(
  batch: ManifestEntry[],
  inv: MorphemeInventory,
  bucketId: string,
): Promise<{ entries: WordEntry[]; tokensIn: number; tokensOut: number; cacheRead: number }> {
  return withRetry(async () => {
    const sys = buildStage1bSystem(inv);
    const user = buildStage1bUserMessage(batch);
    const r = await callClaude({ system: sys, userText: user });
    const parsed = extractJson<unknown[]>(r.text);
    const validation = validateBatchResult(parsed, batch.map(b => b.word), inv);
    if (!validation.ok) {
      throw new Error(`validation failed for ${bucketId}: ${validation.errors.slice(0, 5).join('; ')}`);
    }
    return {
      entries: parsed as WordEntry[],
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      cacheRead: r.cacheRead,
    };
  }, {
    maxRetries: PIPELINE.maxRetries,
    baseDelayMs: 2000,
    onRetry: (a, e) => logger.warn('stage-1b', { bucket: bucketId, attempt: a, err: e.message.slice(0, 200) }),
  });
}
