import { CONTROLLED_VOCAB } from './config.js';
import type { CachedBlock } from './llm-client.js';
import type { MorphemeInventory, ManifestEntry } from './types.js';

const SYSTEM_L0 = `You are a precise morphological analyst and etymologist.
Your output MUST be a raw JSON array with no prose, no explanations, no Markdown fences.
Every field must conform strictly to the schema provided.
If uncertain about a field, use conservative defaults (sentiment.tags=["中性"], intensity=0).
Never invent morpheme canonical IDs outside the provided inventory.`;

const SCHEMA_L1 = `### WordEntry JSON Schema (compact)
{
  "word": string,
  "phonetic": string,
  "pos": string[],
  "coreMeaning": [{cn, en?, domain?, coverage?}],
  "morphemes": [{
    "order": number, "form": string,
    "role": "prefix"|"root"|"suffix"|"linker"|"variant",
    "canonical": string (MUST match an id in the inventory below),
    "variantOf": string|null,
    "coreMeaning": {cn, en?, grammatical?},
    "sentiment": {"tags": [<sentimentTag>], "intensity": 0..1},
    "positionTendency": "initial"|"medial"|"final",
    "etymology": string?
  }],
  "derivationChain": string[],
  "morphVariantOf": string|null,
  "memorySemantics": {"literal": string, "imageChain": string[], "mnemonicExpr": string},
  "wordLevel": {
    "sentiment": {"tags":[...], "intensity":0..1},
    "domain": [<domain>],
    "registerFormality": "formal"|"informal"|"neutral"
  },
  "relations": {
    "sameRoot": string[], "sameAffix": [{affix, members}],
    "synonyms": string[], "antonyms": string[],
    "domainCohort": string[], "derivationPair": string[],
    "morphVariants": string[], "sameImagery": string[]
  }
}

### Controlled Vocabularies
sentiment.tags ∈ {${CONTROLLED_VOCAB.sentimentTags.join(', ')}}
role ∈ {${CONTROLLED_VOCAB.roles.join(', ')}}
positionTendency ∈ {${CONTROLLED_VOCAB.positions.join(', ')}}
domain ∈ {${CONTROLLED_VOCAB.domains.join(', ')}}`;

const FEW_SHOT_L3 = `### EXAMPLES (3 WordEntry objects covering: (1) prefix+root+suffix+linker, (2) derivation chain, (3) rich sentiment)

EX1 — consumer (含 linker -e-):
[{
  "word":"consumer","phonetic":"/kənˈsjuːmə/","pos":["n."],
  "coreMeaning":[{"cn":"消费者","domain":"economics","coverage":0.9}],
  "morphemes":[
    {"order":1,"form":"con-","role":"prefix","canonical":"con-","coreMeaning":{"cn":"加强语气","en":"intensifier"},"sentiment":{"tags":["中性"],"intensity":0},"positionTendency":"initial"},
    {"order":2,"form":"sum","role":"root","canonical":"sum","coreMeaning":{"cn":"拿、消耗","en":"take"},"sentiment":{"tags":["中性"],"intensity":0},"positionTendency":"medial"},
    {"order":3,"form":"e","role":"linker","canonical":"-e-","coreMeaning":{"cn":"连接元音","grammatical":true},"sentiment":{"tags":["中性"],"intensity":0},"positionTendency":"medial","note":"无独立词义"},
    {"order":4,"form":"-r","role":"suffix","canonical":"-er","coreMeaning":{"cn":"表人","grammatical":true},"sentiment":{"tags":["中性"],"intensity":0},"positionTendency":"final"}
  ],
  "derivationChain":["consume","consumer"],"morphVariantOf":null,
  "memorySemantics":{"literal":"消耗者","imageChain":["消耗者","买东西的人","消费者"],"mnemonicExpr":"con+sum(消耗)+e+r → 消耗商品的人 → 消费者"},
  "wordLevel":{"sentiment":{"tags":["中性"],"intensity":0},"domain":["economics","business"],"registerFormality":"neutral"},
  "relations":{"sameRoot":["consume","assume","presume"],"sameAffix":[{"affix":"-er","members":["teacher","worker"]}],"synonyms":["buyer"],"antonyms":["producer"],"domainCohort":["economy","market"],"derivationPair":["consume"],"morphVariants":[],"sameImagery":["consume","consumption"]}
}]

EX2 — revision (含派生链):
[{
  "word":"revision","phonetic":"/rɪˈvɪʒn/","pos":["n."],
  "coreMeaning":[{"cn":"修正，修订","domain":"academic","coverage":0.85}],
  "morphemes":[
    {"order":1,"form":"re-","role":"prefix","canonical":"re-","coreMeaning":{"cn":"再，重新","en":"again"},"sentiment":{"tags":["中性"],"intensity":0},"positionTendency":"initial"},
    {"order":2,"form":"vis","role":"root","canonical":"vis","coreMeaning":{"cn":"看","en":"see"},"sentiment":{"tags":["中性"],"intensity":0},"positionTendency":"medial"},
    {"order":3,"form":"-ion","role":"suffix","canonical":"-ion","coreMeaning":{"cn":"名词化","grammatical":true},"sentiment":{"tags":["中性"],"intensity":0},"positionTendency":"final"}
  ],
  "derivationChain":["vis","vise","revise","revision"],"morphVariantOf":null,
  "memorySemantics":{"literal":"再看一遍","imageChain":["再看一遍","改错","修订"],"mnemonicExpr":"re(再)+vis(看)+ion → 再看并改 → 修正"},
  "wordLevel":{"sentiment":{"tags":["中性"],"intensity":0},"domain":["academic","general"],"registerFormality":"neutral"},
  "relations":{"sameRoot":["vision","revise","provide","visible"],"sameAffix":[{"affix":"re-","members":["return","review"]},{"affix":"-ion","members":["opinion","education"]}],"synonyms":["edit","correction"],"antonyms":[],"domainCohort":["edit","review","draft"],"derivationPair":["revise"],"morphVariants":[],"sameImagery":[]}
}]

EX3 — corruption (含情感):
[{
  "word":"corruption","phonetic":"/kəˈrʌpʃn/","pos":["n."],
  "coreMeaning":[{"cn":"腐败","domain":"legal","coverage":0.85}],
  "morphemes":[
    {"order":1,"form":"cor-","role":"prefix","canonical":"cor-","coreMeaning":{"cn":"彻底","en":"completely"},"sentiment":{"tags":["偏负"],"intensity":0.4},"positionTendency":"initial"},
    {"order":2,"form":"rupt","role":"root","canonical":"rupt","coreMeaning":{"cn":"破坏、断裂","en":"break"},"sentiment":{"tags":["贬义"],"intensity":0.8},"positionTendency":"medial"},
    {"order":3,"form":"-ion","role":"suffix","canonical":"-ion","coreMeaning":{"cn":"名词化","grammatical":true},"sentiment":{"tags":["中性"],"intensity":0},"positionTendency":"final"}
  ],
  "derivationChain":["rupt","corrupt","corruption"],"morphVariantOf":null,
  "memorySemantics":{"literal":"彻底破碎","imageChain":["彻底破碎","制度败坏","腐败"],"mnemonicExpr":"cor(彻底)+rupt(破)+ion → 制度崩坏 → 腐败"},
  "wordLevel":{"sentiment":{"tags":["贬义","厌恶","偏负"],"intensity":0.9},"domain":["legal","news"],"registerFormality":"formal"},
  "relations":{"sameRoot":["rupture","disrupt","interrupt","erupt"],"sameAffix":[{"affix":"-ion","members":["revision","inflation"]}],"synonyms":["graft"],"antonyms":["integrity"],"domainCohort":["bribery","scandal"],"derivationPair":["corrupt"],"morphVariants":[],"sameImagery":["disrupt","rupture"]}
}]`;

export function buildStage1bSystem(inventory: MorphemeInventory): CachedBlock[] {
  const invText = formatInventory(inventory);
  return [
    { type: 'text', text: SYSTEM_L0, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: SCHEMA_L1, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `### CANONICAL MORPHEME INVENTORY (align to this; do NOT invent new IDs)\n${invText}`, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: FEW_SHOT_L3, cache_control: { type: 'ephemeral' } },
  ];
}

function formatInventory(inv: MorphemeInventory): string {
  const lines: string[] = [];
  lines.push('ROOTS:');
  for (const r of inv.roots) {
    lines.push(`  {id:"${r.id}", variants:${JSON.stringify(r.variants)}, meaning:"${r.coreMeaning.cn}"}`);
  }
  lines.push('PREFIXES:');
  for (const p of inv.affixes.filter(a => a.role === 'prefix')) {
    lines.push(`  {id:"${p.id}", meaning:"${p.coreMeaning.cn}"}`);
  }
  lines.push('SUFFIXES:');
  for (const s of inv.affixes.filter(a => a.role === 'suffix')) {
    lines.push(`  {id:"${s.id}", meaning:"${s.coreMeaning.cn}"}`);
  }
  lines.push('LINKERS:');
  for (const l of inv.linkers) {
    lines.push(`  {id:"${l.id}", note:"${l.note ?? l.coreMeaning.cn}"}`);
  }
  return lines.join('\n');
}

export function buildStage1bUserMessage(words: ManifestEntry[]): string {
  const payload = words.map(w => ({
    word: w.word, phonetic: w.phonetic, definitionCn: w.definitionCn, sources: w.sourceBanks,
  }));
  return `DECOMPOSE THESE ${words.length} WORDS. Return a JSON array of ${words.length} WordEntry objects in the same order.\n\n${JSON.stringify(payload, null, 2)}`;
}

// ── Stage 1a ──

const SYSTEM_L0_PLANNER = `You are a morphological analyst cataloging recurring morphemes in English vocabulary.
Your output MUST be a raw JSON array with no prose.
For each morpheme candidate you observe in the input, return one entry.
Merge variants conservatively — if "sume" and "sumpt" clearly share origin, list sume with variants=["sumpt"].`;

const SCHEMA_L1_PLANNER = `### Output Schema
[{
  "candidate": string (your proposed canonical id, e.g. "vis", "pre-", "-ion", "-e-"),
  "role": "root"|"prefix"|"suffix"|"linker",
  "variants": string[] (other spellings to merge into this canonical),
  "meaning": {"cn": string, "en": string?},
  "observedIn": string[] (words from input that use this morpheme, max 10)
}]
Only emit candidates actually supported by the provided words. Do not speculate.`;

export function buildStage1aSystem(): CachedBlock[] {
  return [
    { type: 'text', text: SYSTEM_L0_PLANNER, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: SCHEMA_L1_PLANNER, cache_control: { type: 'ephemeral' } },
  ];
}

export function buildStage1aUserMessage(words: ManifestEntry[]): string {
  const payload = words.map(w => ({ word: w.word, phonetic: w.phonetic, definitionCn: w.definitionCn }));
  return `SCAN THESE ${words.length} WORDS AND EXTRACT RECURRING MORPHEMES.\nReturn a JSON array of candidates with observedIn listing supporting words.\n\n${JSON.stringify(payload, null, 2)}`;
}

// ── Stage 1a Consolidation ──

const SYSTEM_L0_CONSOLIDATE = `You are merging overlapping morpheme candidates into a canonical inventory.
Input: several candidate lists from previous passes (same morpheme may appear with slight id variations).
Output: a single unified inventory with no duplicates.
Rules:
- When two candidates clearly refer to the same morpheme (same meaning, similar spelling), merge them: pick one canonical id and put the others in variants[].
- Preserve distinct meanings: if "in-" means "into" in some words and "not" in others, create TWO entries with disambiguated ids like "in-(into)" and "in-(not)".
- Output MUST be grouped into {roots, prefixes, suffixes, linkers} arrays.`;

const SCHEMA_L1_CONSOLIDATE = `### Output Schema (top-level object)
{
  "roots":   [{id, canonical, role:"root", variants, coreMeaning:{cn,en}, sentiment:{tags:["中性"],intensity:0}, positionTendency:"medial", memberWords:[], synonymMorphemes:[], antonymMorphemes:[]}],
  "prefixes":[{id, canonical, role:"prefix", variants, coreMeaning:{cn,en}, sentiment:{tags:["中性"],intensity:0}, positionTendency:"initial", memberWords:[], synonymMorphemes:[], antonymMorphemes:[]}],
  "suffixes":[{id, canonical, role:"suffix", variants, coreMeaning:{cn,en}, sentiment:{tags:["中性"],intensity:0}, positionTendency:"final", memberWords:[], synonymMorphemes:[], antonymMorphemes:[]}],
  "linkers": [{id, canonical, role:"linker", variants, coreMeaning:{cn,en,grammatical:true}, sentiment:{tags:["中性"],intensity:0}, positionTendency:"medial", memberWords:[], synonymMorphemes:[], antonymMorphemes:[], note}]
}
Include synonymMorphemes/antonymMorphemes when obvious (pre-/post-, in-/de-, vis/spec).`;

export function buildStage1aConsolidateSystem(): CachedBlock[] {
  return [
    { type: 'text', text: SYSTEM_L0_CONSOLIDATE, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: SCHEMA_L1_CONSOLIDATE, cache_control: { type: 'ephemeral' } },
  ];
}

export function buildStage1aConsolidateUserMessage(candidates: unknown[]): string {
  return `MERGE THE FOLLOWING ${candidates.length} CANDIDATE LISTS INTO A SINGLE INVENTORY.\n\n${JSON.stringify(candidates, null, 2)}`;
}

// ── Stage 4 QA ──

export const STAGE4_QA_SYSTEM: CachedBlock[] = [
  { type: 'text', text: `You are a strict QA reviewer of morphological decomposition data.
For each WordEntry you receive, return a score object:
{"word": string, "score": 0..1, "issues": string[]}

Score rubric:
- morphemes break up into sensible prefix/root/suffix/linker sequence (0.3)
- canonical forms align to standard etymology (0.2)
- memorySemantics chain is logical (0.2)
- sentiment tags match the word's actual connotation (0.15)
- domain is plausible (0.15)

Output ONLY a JSON array of score objects. No prose.`, cache_control: { type: 'ephemeral' } },
];

export function buildStage4UserMessage(entries: unknown[]): string {
  return `REVIEW THESE ${entries.length} WordEntry OBJECTS:\n\n${JSON.stringify(entries, null, 2)}`;
}
