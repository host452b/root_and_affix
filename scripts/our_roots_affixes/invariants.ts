import { CONTROLLED_VOCAB } from './config.js';
import type { WordEntry, MorphemeEntry, RelationsGraph } from './types.js';

export interface InvariantInput {
  words: WordEntry[];
  morphemes: MorphemeEntry[];
  graph: RelationsGraph;
}

export interface InvariantResult {
  ok: boolean;
  violations: string[];
}

export function runInvariants(input: InvariantInput): InvariantResult {
  const violations: string[] = [];
  const wordSet = new Set(input.words.map(w => w.word));
  const morphemeIds = new Set(input.morphemes.map(m => m.id));
  const roleOk = new Set(CONTROLLED_VOCAB.roles as readonly string[]);
  const posOk = new Set(CONTROLLED_VOCAB.positions as readonly string[]);
  const sentimentOk = new Set(CONTROLLED_VOCAB.sentimentTags as readonly string[]);

  // INV-1: WordEntry.morphemes[].canonical exists in MorphemeEntry
  for (const w of input.words) {
    for (const m of w.morphemes) {
      if (!morphemeIds.has(m.canonical)) {
        violations.push(`INV-1: word "${w.word}" references missing morpheme id "${m.canonical}"`);
      }
    }
  }

  // INV-2: MorphemeEntry.memberWords[] exists in WordEntry
  for (const m of input.morphemes) {
    for (const mw of m.memberWords) {
      if (!wordSet.has(mw)) {
        violations.push(`INV-2: morpheme "${m.id}" references missing word "${mw}"`);
      }
    }
  }

  // INV-3: relations.sameRoot ⊆ MorphemeEntry(root).memberWords \ {self}
  const rootMembers = new Map<string, Set<string>>();
  for (const m of input.morphemes) {
    if (m.role === 'root') rootMembers.set(m.id, new Set(m.memberWords));
  }
  for (const w of input.words) {
    const roots = w.morphemes.filter(m => m.role === 'root').map(m => m.canonical);
    const allowedPool = new Set<string>();
    for (const r of roots) {
      const members = rootMembers.get(r);
      if (members) members.forEach(x => { if (x !== w.word) allowedPool.add(x); });
    }
    for (const peer of w.relations.sameRoot) {
      if (!allowedPool.has(peer)) {
        violations.push(`INV-3: word "${w.word}" sameRoot "${peer}" not in any of its roots' memberWords`);
      }
    }
  }

  // INV-4: all edge endpoints exist
  const edges = input.graph.edges;
  const endpointsIn = (names: string[], label: string) => {
    for (const n of names) {
      if (!wordSet.has(n)) violations.push(`INV-4: ${label} refers to missing word "${n}"`);
    }
  };
  edges.sameRoot.forEach(e => endpointsIn(e.members, `sameRoot[${e.root}]`));
  edges.sameAffix.forEach(e => endpointsIn(e.members, `sameAffix[${e.affix}]`));
  edges.synonyms.forEach(([a, b]) => endpointsIn([a, b], 'synonyms'));
  edges.antonyms.forEach(([a, b]) => endpointsIn([a, b], 'antonyms'));
  edges.domainCohort.forEach(e => endpointsIn(e.members, `domainCohort[${e.domain}]`));
  edges.derivationPair.forEach(([a, b]) => endpointsIn([a, b], 'derivationPair'));
  edges.morphVariants.forEach(([a, b]) => endpointsIn([a, b], 'morphVariants'));
  edges.sameImagery.forEach(e => endpointsIn(e.members, `sameImagery[${e.image}]`));

  // INV-5: variants ∩ id == ∅
  for (const m of input.morphemes) {
    for (const v of m.variants) {
      if (morphemeIds.has(v)) {
        violations.push(`INV-5: morpheme "${m.id}" has variant "${v}" which is another canonical id`);
      }
    }
  }

  // INV-6: sentiment.tags ⊆ vocab (already checked by schema, but re-check for safety)
  const checkTags = (tags: unknown, ctx: string) => {
    if (!Array.isArray(tags)) return;
    for (const t of tags) {
      if (typeof t === 'string' && !sentimentOk.has(t)) {
        violations.push(`INV-6: ${ctx} has out-of-vocab sentiment tag "${t}"`);
      }
    }
  };
  for (const w of input.words) {
    checkTags(w.wordLevel.sentiment.tags, `word[${w.word}].wordLevel.sentiment`);
    w.morphemes.forEach(m => checkTags(m.sentiment.tags, `word[${w.word}].morphemes[${m.order}].sentiment`));
  }
  for (const m of input.morphemes) {
    checkTags(m.sentiment.tags, `morpheme[${m.id}].sentiment`);
  }

  // INV-7: positionTendency ∈ vocab
  for (const w of input.words) {
    for (const mo of w.morphemes) {
      if (!posOk.has(mo.positionTendency)) {
        violations.push(`INV-7: word "${w.word}" morpheme "${mo.canonical}" invalid positionTendency "${mo.positionTendency}"`);
      }
    }
  }
  for (const m of input.morphemes) {
    if (!posOk.has(m.positionTendency)) {
      violations.push(`INV-7: morpheme "${m.id}" invalid positionTendency "${m.positionTendency}"`);
    }
  }

  // INV-8: role ∈ vocab
  for (const w of input.words) {
    for (const mo of w.morphemes) {
      if (!roleOk.has(mo.role)) {
        violations.push(`INV-8: word "${w.word}" morpheme "${mo.canonical}" invalid role "${mo.role}"`);
      }
    }
  }
  for (const m of input.morphemes) {
    if (!roleOk.has(m.role)) {
      violations.push(`INV-8: morpheme "${m.id}" invalid role "${m.role}"`);
    }
  }

  return { ok: violations.length === 0, violations };
}
