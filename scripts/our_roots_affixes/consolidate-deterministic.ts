/**
 * Deterministic Stage 1a consolidator — Path B (subagent) variant.
 *
 * Merges all batch-*.json candidates into canonical MorphemeEntry objects
 * without calling an LLM. Handles:
 *   - Exact (role, candidate) dedup: union observedIn, union variants, pick most common meaning
 *   - Variant→canonical linking: if X appears both as a canonical and as another entry's variant, merge X under the one with more observedIn
 *   - Role defaults: positionTendency, sentiment
 *   - Writes morphemes/{roots,affixes,linkers}.json and _staging/variant-to-canonical.json
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { PATHS } from './config.js';
import { atomicWriteJson } from './atomic-write.js';
import { logger } from './logger.js';
import type { MorphemeEntry, Role, Position } from './types.js';

interface RawCandidate {
  candidate: string;
  role: Role;
  variants?: string[];
  meaning: { cn: string; en?: string };
  observedIn?: string[];
}

function normKey(role: string, candidate: string): string {
  return `${role}::${candidate.trim()}`;
}

function defaultPosition(role: Role): Position {
  if (role === 'prefix') return 'initial';
  if (role === 'suffix') return 'final';
  return 'medial';
}

function defaultLinker(role: Role): boolean {
  return role === 'linker';
}

function pickMeaning(cs: RawCandidate[]): { cn: string; en?: string; grammatical?: boolean } {
  const cnCounts = new Map<string, number>();
  for (const c of cs) {
    if (c.meaning?.cn) cnCounts.set(c.meaning.cn, (cnCounts.get(c.meaning.cn) ?? 0) + 1);
  }
  const topCn = [...cnCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  const enCounts = new Map<string, number>();
  for (const c of cs) {
    if (c.meaning?.en) enCounts.set(c.meaning.en, (enCounts.get(c.meaning.en) ?? 0) + 1);
  }
  const topEn = [...enCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const out: { cn: string; en?: string; grammatical?: boolean } = { cn: topCn };
  if (topEn) out.en = topEn;
  return out;
}

function mergeGroup(key: string, group: RawCandidate[]): MorphemeEntry {
  const [role, candidate] = key.split('::') as [Role, string];
  const variants = new Set<string>();
  const observed = new Set<string>();
  for (const c of group) {
    for (const v of c.variants ?? []) variants.add(v);
    for (const w of c.observedIn ?? []) observed.add(w);
  }
  variants.delete(candidate); // variants never include self

  const meaning = pickMeaning(group);
  if (defaultLinker(role)) meaning.grammatical = true;

  return {
    id: candidate,
    canonical: candidate,
    role,
    variants: [...variants].sort(),
    coreMeaning: meaning,
    sentiment: { tags: ['中性'], intensity: 0 },
    positionTendency: defaultPosition(role),
    memberWords: [...observed].sort(), // will be overwritten by Stage 2, but use observedIn as a starting point
    synonymMorphemes: [],
    antonymMorphemes: [],
    ...(defaultLinker(role) ? { note: '连接元音/插入形素，无独立词义' } : {}),
  };
}

function main(): void {
  const files = readdirSync(PATHS.candidates).filter(f => f.endsWith('.json')).sort();
  logger.info('consolidate', { phase: 'start', inputBatches: files.length });

  const allCandidates: RawCandidate[] = [];
  for (const f of files) {
    const arr: RawCandidate[] = JSON.parse(readFileSync(join(PATHS.candidates, f), 'utf-8'));
    for (const c of arr) allCandidates.push(c);
  }
  logger.info('consolidate', { rawCandidates: allCandidates.length });

  // Step 1: group by exact (role, candidate)
  const groups = new Map<string, RawCandidate[]>();
  for (const c of allCandidates) {
    const k = normKey(c.role, c.candidate);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(c);
  }

  // Step 2: merge each group into MorphemeEntry
  let entries: MorphemeEntry[] = [];
  for (const [key, g] of groups) entries.push(mergeGroup(key, g));

  // Step 3: variant resolution — if X is canonical but also listed as variant of Y with more observed,
  // merge X under Y (union memberWords, delete X).
  const byId = new Map<string, MorphemeEntry>();
  for (const e of entries) byId.set(`${e.role}::${e.id}`, e);

  // For each entry's variants, check if a canonical entry with same role exists; if so, absorb it.
  let absorbed = 0;
  for (const e of entries) {
    for (const v of [...e.variants]) {
      const vKey = `${e.role}::${v}`;
      const victim = byId.get(vKey);
      if (victim && victim.id !== e.id) {
        // Choose keeper = whichever has more memberWords; on tie, alphabetical
        const keeper = victim.memberWords.length > e.memberWords.length ? victim :
          (victim.memberWords.length === e.memberWords.length && victim.id < e.id) ? victim : e;
        const loser = keeper === e ? victim : e;
        // Absorb loser into keeper
        const mergedWords = new Set([...keeper.memberWords, ...loser.memberWords]);
        const mergedVariants = new Set([...keeper.variants, ...loser.variants, loser.id]);
        mergedVariants.delete(keeper.id);
        keeper.memberWords = [...mergedWords].sort();
        keeper.variants = [...mergedVariants].sort();
        byId.delete(`${loser.role}::${loser.id}`);
        absorbed++;
      }
    }
  }
  entries = [...byId.values()];
  logger.info('consolidate', { afterVariantAbsorption: entries.length, absorbed });

  // Step 4: split by role
  const roots = entries.filter(e => e.role === 'root').sort((a, b) => a.id.localeCompare(b.id));
  const affixes = entries.filter(e => e.role === 'prefix' || e.role === 'suffix').sort((a, b) => a.id.localeCompare(b.id));
  const linkers = entries.filter(e => e.role === 'linker').sort((a, b) => a.id.localeCompare(b.id));
  const variants = entries.filter(e => e.role === 'variant');

  // Step 5: variant→canonical map
  const variantToCanonical: Record<string, string> = {};
  for (const e of entries) {
    for (const v of e.variants) variantToCanonical[v] = e.id;
  }

  // Step 6: write outputs
  atomicWriteJson(join(PATHS.morphemes, 'roots.json'), roots);
  atomicWriteJson(join(PATHS.morphemes, 'affixes.json'), affixes);
  atomicWriteJson(join(PATHS.morphemes, 'linkers.json'), linkers);
  atomicWriteJson(join(PATHS.staging, 'variant-to-canonical.json'), variantToCanonical);

  logger.info('consolidate', {
    phase: 'done',
    roots: roots.length,
    affixes: affixes.length,
    prefixes: affixes.filter(a => a.role === 'prefix').length,
    suffixes: affixes.filter(a => a.role === 'suffix').length,
    linkers: linkers.length,
    variants: variants.length,
    variantMapSize: Object.keys(variantToCanonical).length,
  });
}

main();
