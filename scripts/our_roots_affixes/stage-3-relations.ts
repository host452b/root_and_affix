import { readFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PATHS, PIPELINE } from './config.js';
import { atomicWriteJson } from './atomic-write.js';
import { runInvariants } from './invariants.js';
import { logger } from './logger.js';
import type { WordEntry, MorphemeEntry, RelationsGraph } from './types.js';

export function buildRelationsGraph(words: WordEntry[], morphemes: MorphemeEntry[]): RelationsGraph {
  const wordSet = new Set(words.map(w => w.word));
  const edges: RelationsGraph['edges'] = {
    sameRoot: [], sameAffix: [], synonyms: [], antonyms: [],
    domainCohort: [], derivationPair: [], morphVariants: [], sameImagery: [],
    affixSynonyms: [], affixAntonyms: [], rootVariants: [], rootSynonyms: [],
  };

  // sameRoot / sameAffix from morpheme memberWords
  for (const m of morphemes) {
    if (m.memberWords.length < 2) continue;
    const sorted = [...m.memberWords].sort();
    if (m.role === 'root') {
      edges.sameRoot.push({ root: m.id, members: sorted });
    } else if (m.role === 'prefix' || m.role === 'suffix') {
      edges.sameAffix.push({ affix: m.id, members: sorted });
    }
  }

  // synonyms / antonyms — bidirectional dedup
  const pairSet = (pairs: Array<[string, string]>): Array<[string, string]> => {
    const seen = new Set<string>();
    const out: Array<[string, string]> = [];
    for (const [a, b] of pairs) {
      if (!wordSet.has(a) || !wordSet.has(b)) continue;
      const [x, y] = [a, b].sort();
      const k = `${x}|${y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push([x, y]);
    }
    return out.sort((p, q) => p[0].localeCompare(q[0]) || p[1].localeCompare(q[1]));
  };

  const synPairs: Array<[string, string]> = [];
  const antPairs: Array<[string, string]> = [];
  for (const w of words) {
    for (const s of w.relations.synonyms) synPairs.push([w.word, s]);
    for (const a of w.relations.antonyms) antPairs.push([w.word, a]);
  }
  edges.synonyms = pairSet(synPairs);
  edges.antonyms = pairSet(antPairs);

  // domainCohort
  const byDomain = new Map<string, Set<string>>();
  for (const w of words) {
    for (const d of w.wordLevel.domain) {
      if (!byDomain.has(d)) byDomain.set(d, new Set());
      byDomain.get(d)!.add(w.word);
    }
  }
  for (const [domain, membersSet] of byDomain) {
    const members = [...membersSet].sort();
    if (members.length >= 2) edges.domainCohort.push({ domain, members });
  }
  edges.domainCohort.sort((a, b) => a.domain.localeCompare(b.domain));

  // derivationPair
  const dpSet = new Set<string>();
  for (const w of words) {
    const chain = w.derivationChain;
    for (let i = 0; i + 1 < chain.length; i++) {
      const [a, b] = [chain[i], chain[i + 1]];
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (!dpSet.has(k)) {
        dpSet.add(k);
        edges.derivationPair.push([a, b].sort() as [string, string]);
      }
    }
  }
  edges.derivationPair.sort((p, q) => p[0].localeCompare(q[0]));

  // morphVariants — from morphVariantOf field
  const mvSeen = new Set<string>();
  for (const w of words) {
    if (w.morphVariantOf && wordSet.has(w.morphVariantOf)) {
      const pair = [w.word, w.morphVariantOf].sort() as [string, string];
      const k = pair.join('|');
      if (!mvSeen.has(k)) {
        mvSeen.add(k);
        edges.morphVariants.push(pair);
      }
    }
  }
  edges.morphVariants.sort((p, q) => p[0].localeCompare(q[0]));

  // affixSynonyms / affixAntonyms / rootVariants / rootSynonyms from morphemes
  for (const m of morphemes) {
    if (m.role === 'prefix' || m.role === 'suffix') {
      if (m.synonymMorphemes.length > 0) edges.affixSynonyms.push({ affix: m.id, synonyms: [...m.synonymMorphemes].sort() });
      if (m.antonymMorphemes.length > 0) edges.affixAntonyms.push({ affix: m.id, antonyms: [...m.antonymMorphemes].sort() });
    } else if (m.role === 'root') {
      if (m.variants.length > 0) edges.rootVariants.push({ root: m.id, variants: [...m.variants].sort() });
      if (m.synonymMorphemes.length > 0) edges.rootSynonyms.push({ root: m.id, synonyms: [...m.synonymMorphemes].sort() });
    }
  }

  // sameImagery — simple keyword-match across imageChain
  const byImage = new Map<string, Set<string>>();
  for (const w of words) {
    for (const img of w.memorySemantics.imageChain) {
      if (img.length < 2) continue;
      if (!byImage.has(img)) byImage.set(img, new Set());
      byImage.get(img)!.add(w.word);
    }
  }
  for (const [img, membersSet] of byImage) {
    const members = [...membersSet].sort();
    if (members.length >= 3) edges.sameImagery.push({ image: img, members });
  }
  edges.sameImagery.sort((a, b) => a.image.localeCompare(b.image));

  const totalEdges =
    edges.sameRoot.length + edges.sameAffix.length + edges.synonyms.length + edges.antonyms.length +
    edges.domainCohort.length + edges.derivationPair.length + edges.morphVariants.length + edges.sameImagery.length +
    edges.affixSynonyms.length + edges.affixAntonyms.length + edges.rootVariants.length + edges.rootSynonyms.length;

  return {
    version: PIPELINE.schemaVersion,
    stats: { totalWords: words.length, totalMorphemes: morphemes.length, totalEdges },
    edges,
  };
}

export async function runStage3(): Promise<void> {
  logger.info('stage-3', { phase: 'start' });
  const wordFiles = readdirSync(PATHS.words).filter(f => f.match(/^[a-z_]-\d{3}\.json$/));
  const words: WordEntry[] = [];
  for (const f of wordFiles) {
    words.push(...JSON.parse(readFileSync(join(PATHS.words, f), 'utf-8')));
  }

  const roots: MorphemeEntry[] = JSON.parse(readFileSync(join(PATHS.morphemes, 'roots.json'), 'utf-8'));
  const affixes: MorphemeEntry[] = JSON.parse(readFileSync(join(PATHS.morphemes, 'affixes.json'), 'utf-8'));
  const linkers: MorphemeEntry[] = JSON.parse(readFileSync(join(PATHS.morphemes, 'linkers.json'), 'utf-8'));
  const allMorphemes = [...roots, ...affixes, ...linkers];

  const graph = buildRelationsGraph(words, allMorphemes);
  mkdirSync(PATHS.relations, { recursive: true });
  atomicWriteJson(join(PATHS.relations, 'graph.json'), graph);

  logger.info('stage-3', { phase: 'graph-built', stats: graph.stats });

  const inv = runInvariants({ words, morphemes: allMorphemes, graph });
  if (!inv.ok) {
    logger.error('stage-3', { phase: 'invariants-failed', count: inv.violations.length, sample: inv.violations.slice(0, 10) });
    atomicWriteJson(join(PATHS.staging, 'invariant-violations.json'), inv.violations);
    throw new Error(`Invariant check failed: ${inv.violations.length} violations`);
  }
  logger.info('stage-3', { phase: 'done' });
}

if (import.meta.main) {
  runStage3().catch(e => {
    logger.error('stage-3', { err: String(e) });
    process.exit(1);
  });
}
