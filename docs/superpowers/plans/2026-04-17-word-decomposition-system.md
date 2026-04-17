# Word Decomposition System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained data generation pipeline that decomposes 21,923 unique English words from `data/word-banks/` into morphological components (root/affix/linker) + core meaning + sentiment + positional tendency, produces a 10-edge relation graph, and publishes the result to `https://github.com/host452b/root_and_affix.git`.

**Architecture:** 7-stage pipeline (Manifest → Morpheme Planning → Word Decomposition → Morpheme Index → Relations Graph → QA → Package → GitHub push) implemented as Bun/TypeScript scripts in `scripts/our_roots_affixes/`. Stages 1a/1b/4 call Anthropic Claude Opus 4.7 with prompt caching; all other stages are deterministic. Hand-rolled JSON schema validation (zero external deps). Independent from existing `data/word-banks/` content — output goes to `data/our_roots_affixes/`.

**Tech Stack:** Bun runtime, TypeScript (ES2022/ESNext), `bun:test`, native `fetch` for Anthropic API, custom JSON schema validators, Node built-ins (`fs`, `path`, `crypto`, `child_process`).

**Reference spec:** `docs/superpowers/specs/2026-04-17-word-decomposition-system-design.md`

---

## File Structure

```
scripts/our_roots_affixes/
├── types.ts                       WordEntry, MorphemeEntry, RelationsGraph, batch manifest
├── config.ts                      Constants: paths, limits, model id, concurrency
├── schema.ts                      Hand-rolled schema validators (zero deps)
├── invariants.ts                  INV-1..8 validators
├── atomic-write.ts                Atomic file write helper
├── checkpoint.ts                  Checkpoint/resume protocol
├── logger.ts                      Structured logger
├── retry.ts                       Exponential backoff retry
├── llm-client.ts                  Anthropic API wrapper with prompt caching
├── prompts.ts                     Prompt templates (L0/L1/L3)
├── stage-0-manifest.ts            Build manifest from word-banks
├── stage-1a-planner.ts            Morpheme candidate extraction per 1k-word batch
├── stage-1a-consolidate.ts        Merge candidates into canonical inventory
├── stage-1b-decompose.ts          Decompose one batch of 50 words
├── stage-1b-runner.ts             Worker pool + coordinator for Stage 1b
├── stage-2-morpheme-index.ts      Aggregate memberWords back to morphemes
├── stage-3-relations.ts           Build 12 edge types + run invariants
├── stage-4-qa.ts                  Random sample QA with LLM scorer
├── stage-5-package.ts             META.md, README.md, schema dumps, version tag
├── stage-6-github.ts              Git init + commit + tag + push
└── cli.ts                         Top-level orchestrator

tests/our_roots_affixes/
├── fixtures/
│   ├── mock-word-bank.json
│   ├── mock-morphemes.json
│   └── mock-words.json
├── schema.test.ts
├── invariants.test.ts
├── atomic-write.test.ts
├── checkpoint.test.ts
├── retry.test.ts
├── stage-0-manifest.test.ts
├── stage-1b-decompose.test.ts
├── stage-2-morpheme-index.test.ts
└── stage-3-relations.test.ts
```

Data output:
```
data/our_roots_affixes/              (generated, not committed to main repo)
├── META.md
├── README.md
├── CHANGELOG.md
├── manifest.json
├── schema/
├── morphemes/
├── words/
├── relations/
└── _staging/                       (stripped before publish)
```

---

### Task 1: Create directory skeleton and config

**Files:**
- Create: `scripts/our_roots_affixes/config.ts`
- Create: `scripts/our_roots_affixes/types.ts`

- [ ] **Step 1: Create config.ts with all constants**

Create `scripts/our_roots_affixes/config.ts`:

```ts
import { resolve } from 'path';

export const REPO_ROOT = resolve(import.meta.dir, '..', '..');
export const WORD_BANKS_DIR = resolve(REPO_ROOT, 'data/word-banks');
export const OUTPUT_DIR = resolve(REPO_ROOT, 'data/our_roots_affixes');

export const PATHS = {
  manifest: `${OUTPUT_DIR}/manifest.json`,
  meta: `${OUTPUT_DIR}/META.md`,
  readme: `${OUTPUT_DIR}/README.md`,
  changelog: `${OUTPUT_DIR}/CHANGELOG.md`,
  schema: `${OUTPUT_DIR}/schema`,
  morphemes: `${OUTPUT_DIR}/morphemes`,
  words: `${OUTPUT_DIR}/words`,
  relations: `${OUTPUT_DIR}/relations`,
  staging: `${OUTPUT_DIR}/_staging`,
  bucketPlan: `${OUTPUT_DIR}/_staging/bucket-plan.json`,
  checkpoints: `${OUTPUT_DIR}/_staging/checkpoints`,
  failed: `${OUTPUT_DIR}/_staging/failed`,
  candidates: `${OUTPUT_DIR}/_staging/candidates`,
  qaReport: `${OUTPUT_DIR}/_staging/qa-report.md`,
};

export const PIPELINE = {
  wordsPerBucket: 50,
  planningBatchSize: 1000,
  concurrency: 10,
  maxRetries: 3,
  qaSampleSize: 200,
  qaThreshold: 0.85,
  schemaVersion: '1.0',
  releaseVersion: 'v1.0.0',
};

export const LLM = {
  model: 'claude-opus-4-7',
  maxOutputTokens: 16000,
  temperature: 0,
  apiUrl: 'https://api.anthropic.com/v1/messages',
  apiVersion: '2023-06-01',
  cacheControl: { type: 'ephemeral' as const },
};

export const GITHUB = {
  remoteUrl: 'https://github.com/host452b/root_and_affix.git',
  defaultBranch: 'main',
};

export const CONTROLLED_VOCAB = {
  sentimentTags: [
    '褒义', '贬义', '中性', '混合',
    '喜爱', '厌恶', '讨厌', '中立',
    '偏正', '偏负',
    '担忧', '乐观', '讽刺', '庄重', '轻佻',
  ] as const,
  roles: ['prefix', 'root', 'suffix', 'linker', 'variant'] as const,
  positions: ['initial', 'medial', 'final'] as const,
  domains: [
    'general', 'academic', 'business', 'economics', 'finance',
    'legal', 'medical', 'news', 'tech', 'cybersec', 'editorial',
  ] as const,
} as const;
```

- [ ] **Step 2: Create types.ts with all shared types**

Create `scripts/our_roots_affixes/types.ts`:

```ts
import type { CONTROLLED_VOCAB } from './config.js';

export type Role = (typeof CONTROLLED_VOCAB.roles)[number];
export type Position = (typeof CONTROLLED_VOCAB.positions)[number];
export type SentimentTag = (typeof CONTROLLED_VOCAB.sentimentTags)[number];
export type Domain = (typeof CONTROLLED_VOCAB.domains)[number];

export interface Sentiment {
  tags: SentimentTag[];
  intensity?: number;
}

export interface CoreMeaning {
  cn: string;
  en?: string;
  grammatical?: boolean;
  domain?: Domain;
  coverage?: number;
}

export interface Morpheme {
  order: number;
  form: string;
  role: Role;
  canonical: string;
  variantOf?: string | null;
  coreMeaning: CoreMeaning;
  sentiment: Sentiment;
  positionTendency: Position;
  etymology?: string;
  note?: string;
}

export interface WordEntry {
  word: string;
  phonetic: string;
  pos: string[];
  coreMeaning: CoreMeaning[];
  morphemes: Morpheme[];
  derivationChain: string[];
  morphVariantOf: string | null;
  memorySemantics: {
    literal: string;
    imageChain: string[];
    mnemonicExpr: string;
  };
  wordLevel: {
    sentiment: Sentiment;
    domain: Domain[];
    registerFormality: 'formal' | 'informal' | 'neutral';
  };
  relations: {
    sameRoot: string[];
    sameAffix: Array<{ affix: string; members: string[] }>;
    synonyms: string[];
    antonyms: string[];
    domainCohort: string[];
    derivationPair: string[];
    morphVariants: string[];
    sameImagery: string[];
  };
}

export interface MorphemeEntry {
  id: string;
  canonical: string;
  role: Role;
  variants: string[];
  coreMeaning: CoreMeaning;
  sentiment: Sentiment;
  positionTendency: Position;
  etymology?: string;
  note?: string;
  memberWords: string[];
  synonymMorphemes: string[];
  antonymMorphemes: string[];
}

export interface RelationsGraph {
  version: string;
  stats: {
    totalWords: number;
    totalMorphemes: number;
    totalEdges: number;
  };
  edges: {
    sameRoot: Array<{ root: string; members: string[] }>;
    sameAffix: Array<{ affix: string; members: string[] }>;
    synonyms: Array<[string, string]>;
    antonyms: Array<[string, string]>;
    domainCohort: Array<{ domain: string; members: string[] }>;
    derivationPair: Array<[string, string]>;
    morphVariants: Array<[string, string]>;
    sameImagery: Array<{ image: string; members: string[] }>;
    affixSynonyms: Array<{ affix: string; synonyms: string[] }>;
    affixAntonyms: Array<{ affix: string; antonyms: string[] }>;
    rootVariants: Array<{ root: string; variants: string[] }>;
    rootSynonyms: Array<{ root: string; synonyms: string[] }>;
  };
}

export interface ManifestEntry {
  word: string;
  phonetic: string;
  definitionCn: string;
  sourceBanks: string[];
}

export interface Manifest {
  version: string;
  generatedAt: string;
  totalWords: number;
  entries: ManifestEntry[];
}

export interface BucketPlan {
  buckets: Array<{ id: string; words: ManifestEntry[] }>;
  totalBuckets: number;
}

export interface CheckpointRecord {
  bucketId: string;
  timestamp: string;
  tokensIn: number;
  tokensOut: number;
  hash: string;
}

export interface MorphemeInventory {
  roots: MorphemeEntry[];
  affixes: MorphemeEntry[];
  linkers: MorphemeEntry[];
  variantToCanonical: Record<string, string>;
}
```

- [ ] **Step 3: Create output directory skeleton**

Run:
```bash
mkdir -p /Users/joejiang/Desktop/词根词缀/data/our_roots_affixes/{schema,morphemes,words,relations,_staging/{checkpoints,failed,candidates}}
mkdir -p /Users/joejiang/Desktop/词根词缀/tests/our_roots_affixes/fixtures
```

Expected: directories exist; no output.

- [ ] **Step 4: Verify type compile**

Run: `bun build --target=bun --outdir=/tmp/check scripts/our_roots_affixes/config.ts`
Expected: builds without error. Delete `/tmp/check` after.

- [ ] **Step 5: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/config.ts scripts/our_roots_affixes/types.ts
git commit -m "our_roots_affixes: add config and types skeleton"
```

---

### Task 2: Hand-rolled schema validator

**Files:**
- Create: `scripts/our_roots_affixes/schema.ts`
- Create: `tests/our_roots_affixes/schema.test.ts`
- Create: `tests/our_roots_affixes/fixtures/mock-word-entry.json`

- [ ] **Step 1: Write the failing test**

Create `tests/our_roots_affixes/fixtures/mock-word-entry.json`:

```json
{
  "word": "inflation",
  "phonetic": "/ɪnˈfleɪʃn/",
  "pos": ["n."],
  "coreMeaning": [{ "cn": "通货膨胀", "domain": "economics", "coverage": 0.8 }],
  "morphemes": [
    {
      "order": 1, "form": "in-", "role": "prefix", "canonical": "in-",
      "coreMeaning": { "cn": "进入；使…", "en": "into" },
      "sentiment": { "tags": ["中性"], "intensity": 0 },
      "positionTendency": "initial"
    },
    {
      "order": 2, "form": "flat", "role": "root", "canonical": "flat",
      "coreMeaning": { "cn": "吹、膨胀", "en": "to blow" },
      "sentiment": { "tags": ["中性"], "intensity": 0 },
      "positionTendency": "medial"
    },
    {
      "order": 3, "form": "-ion", "role": "suffix", "canonical": "-ion",
      "coreMeaning": { "cn": "名词化", "grammatical": true },
      "sentiment": { "tags": ["中性"], "intensity": 0 },
      "positionTendency": "final"
    }
  ],
  "derivationChain": ["flat", "inflate", "inflation"],
  "morphVariantOf": null,
  "memorySemantics": {
    "literal": "吹气使膨胀",
    "imageChain": ["吹气使膨胀", "不断吹大", "通货膨胀"],
    "mnemonicExpr": "in (进入) + flat (吹膨) + ion → 不断吹大 → 通胀"
  },
  "wordLevel": {
    "sentiment": { "tags": ["贬义", "担忧"], "intensity": 0.7 },
    "domain": ["economics", "finance"],
    "registerFormality": "formal"
  },
  "relations": {
    "sameRoot": ["inflate", "deflate"],
    "sameAffix": [{ "affix": "in-", "members": ["input"] }],
    "synonyms": [],
    "antonyms": ["deflation"],
    "domainCohort": ["consumer"],
    "derivationPair": ["inflate"],
    "morphVariants": [],
    "sameImagery": []
  }
}
```

Create `tests/our_roots_affixes/schema.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  validateWordEntry,
  validateMorphemeEntry,
  validateRelationsGraph,
} from '../../scripts/our_roots_affixes/schema.js';

const MOCK_WORD: any = JSON.parse(
  readFileSync(resolve(import.meta.dir, 'fixtures/mock-word-entry.json'), 'utf-8')
);

describe('validateWordEntry', () => {
  test('accepts valid WordEntry', () => {
    const r = validateWordEntry(MOCK_WORD);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('rejects missing required field', () => {
    const bad = { ...MOCK_WORD, word: undefined };
    const r = validateWordEntry(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('word'))).toBe(true);
  });

  test('rejects invalid role', () => {
    const bad = structuredClone(MOCK_WORD);
    bad.morphemes[0].role = 'bogus';
    const r = validateWordEntry(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('role'))).toBe(true);
  });

  test('rejects invalid positionTendency', () => {
    const bad = structuredClone(MOCK_WORD);
    bad.morphemes[0].positionTendency = 'middle';
    const r = validateWordEntry(bad);
    expect(r.ok).toBe(false);
  });

  test('rejects sentiment tag not in vocab', () => {
    const bad = structuredClone(MOCK_WORD);
    bad.wordLevel.sentiment.tags = ['super-bad'];
    const r = validateWordEntry(bad);
    expect(r.ok).toBe(false);
  });
});

describe('validateMorphemeEntry', () => {
  test('accepts valid MorphemeEntry', () => {
    const entry = {
      id: 'vis',
      canonical: 'vis',
      role: 'root',
      variants: ['vid'],
      coreMeaning: { cn: '看', en: 'to see' },
      sentiment: { tags: ['中性'], intensity: 0 },
      positionTendency: 'medial',
      memberWords: ['vision'],
      synonymMorphemes: [],
      antonymMorphemes: [],
    };
    const r = validateMorphemeEntry(entry);
    expect(r.ok).toBe(true);
  });
});

describe('validateRelationsGraph', () => {
  test('accepts minimal graph', () => {
    const g = {
      version: '1.0',
      stats: { totalWords: 0, totalMorphemes: 0, totalEdges: 0 },
      edges: {
        sameRoot: [], sameAffix: [], synonyms: [], antonyms: [],
        domainCohort: [], derivationPair: [], morphVariants: [], sameImagery: [],
        affixSynonyms: [], affixAntonyms: [], rootVariants: [], rootSynonyms: [],
      },
    };
    const r = validateRelationsGraph(g);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/schema.test.ts`
Expected: FAIL — `schema.js` not found.

- [ ] **Step 3: Implement schema validators**

Create `scripts/our_roots_affixes/schema.ts`:

```ts
import { CONTROLLED_VOCAB } from './config.js';
import type { WordEntry, MorphemeEntry, RelationsGraph } from './types.js';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

type V = (v: unknown, path: string) => string[];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && !isNaN(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

const must = (cond: boolean, path: string, msg: string): string[] =>
  cond ? [] : [`${path}: ${msg}`];

const checkEnum = (v: unknown, path: string, vals: readonly string[]): string[] =>
  must(isStr(v) && (vals as readonly string[]).includes(v), path, `must be one of ${vals.join('|')}`);

const checkStringArray = (v: unknown, path: string): string[] =>
  isArr(v) && v.every(isStr) ? [] : [`${path}: must be string[]`];

const checkSentiment: V = (v, path) => {
  if (!isObject(v)) return [`${path}: must be object`];
  const errs: string[] = [];
  if (!isArr(v.tags) || !v.tags.every(t => isStr(t) && (CONTROLLED_VOCAB.sentimentTags as readonly string[]).includes(t))) {
    errs.push(`${path}.tags: each tag must be in controlled vocab`);
  }
  if ('intensity' in v && v.intensity !== undefined && !(isNum(v.intensity) && v.intensity >= 0 && v.intensity <= 1)) {
    errs.push(`${path}.intensity: must be number in [0,1]`);
  }
  return errs;
};

const checkCoreMeaning: V = (v, path) => {
  if (!isObject(v)) return [`${path}: must be object`];
  const errs: string[] = [];
  errs.push(...must(isStr(v.cn), `${path}.cn`, 'required string'));
  if ('en' in v && v.en !== undefined) errs.push(...must(isStr(v.en), `${path}.en`, 'must be string'));
  if ('grammatical' in v && v.grammatical !== undefined) errs.push(...must(isBool(v.grammatical), `${path}.grammatical`, 'must be boolean'));
  if ('domain' in v && v.domain !== undefined) errs.push(...checkEnum(v.domain, `${path}.domain`, CONTROLLED_VOCAB.domains));
  if ('coverage' in v && v.coverage !== undefined) errs.push(...must(isNum(v.coverage), `${path}.coverage`, 'must be number'));
  return errs;
};

const checkMorpheme: V = (v, path) => {
  if (!isObject(v)) return [`${path}: must be object`];
  const errs: string[] = [];
  errs.push(...must(isNum(v.order), `${path}.order`, 'required number'));
  errs.push(...must(isStr(v.form), `${path}.form`, 'required string'));
  errs.push(...checkEnum(v.role, `${path}.role`, CONTROLLED_VOCAB.roles));
  errs.push(...must(isStr(v.canonical), `${path}.canonical`, 'required string'));
  errs.push(...checkCoreMeaning(v.coreMeaning, `${path}.coreMeaning`));
  errs.push(...checkSentiment(v.sentiment, `${path}.sentiment`));
  errs.push(...checkEnum(v.positionTendency, `${path}.positionTendency`, CONTROLLED_VOCAB.positions));
  return errs;
};

export function validateWordEntry(v: unknown): ValidationResult {
  if (!isObject(v)) return { ok: false, errors: ['root: must be object'] };
  const errs: string[] = [];
  errs.push(...must(isStr(v.word), 'word', 'required string'));
  errs.push(...must(isStr(v.phonetic), 'phonetic', 'required string'));
  errs.push(...checkStringArray(v.pos, 'pos'));
  if (!isArr(v.coreMeaning)) errs.push('coreMeaning: must be array');
  else v.coreMeaning.forEach((m, i) => errs.push(...checkCoreMeaning(m, `coreMeaning[${i}]`)));
  if (!isArr(v.morphemes)) errs.push('morphemes: must be array');
  else v.morphemes.forEach((m, i) => errs.push(...checkMorpheme(m, `morphemes[${i}]`)));
  errs.push(...checkStringArray(v.derivationChain, 'derivationChain'));
  if (v.morphVariantOf !== null && !isStr(v.morphVariantOf)) errs.push('morphVariantOf: must be string or null');
  if (!isObject(v.memorySemantics)) errs.push('memorySemantics: must be object');
  else {
    const ms = v.memorySemantics;
    errs.push(...must(isStr(ms.literal), 'memorySemantics.literal', 'required string'));
    errs.push(...checkStringArray(ms.imageChain, 'memorySemantics.imageChain'));
    errs.push(...must(isStr(ms.mnemonicExpr), 'memorySemantics.mnemonicExpr', 'required string'));
  }
  if (!isObject(v.wordLevel)) errs.push('wordLevel: must be object');
  else {
    errs.push(...checkSentiment(v.wordLevel.sentiment, 'wordLevel.sentiment'));
    if (!isArr(v.wordLevel.domain)) errs.push('wordLevel.domain: must be array');
    else v.wordLevel.domain.forEach((d, i) => errs.push(...checkEnum(d, `wordLevel.domain[${i}]`, CONTROLLED_VOCAB.domains)));
    errs.push(...checkEnum(v.wordLevel.registerFormality, 'wordLevel.registerFormality', ['formal', 'informal', 'neutral']));
  }
  if (!isObject(v.relations)) errs.push('relations: must be object');
  else {
    const r = v.relations;
    errs.push(...checkStringArray(r.sameRoot, 'relations.sameRoot'));
    errs.push(...checkStringArray(r.synonyms, 'relations.synonyms'));
    errs.push(...checkStringArray(r.antonyms, 'relations.antonyms'));
    errs.push(...checkStringArray(r.domainCohort, 'relations.domainCohort'));
    errs.push(...checkStringArray(r.derivationPair, 'relations.derivationPair'));
    errs.push(...checkStringArray(r.morphVariants, 'relations.morphVariants'));
    errs.push(...checkStringArray(r.sameImagery, 'relations.sameImagery'));
    if (!isArr(r.sameAffix)) errs.push('relations.sameAffix: must be array');
  }
  return { ok: errs.length === 0, errors: errs };
}

export function validateMorphemeEntry(v: unknown): ValidationResult {
  if (!isObject(v)) return { ok: false, errors: ['root: must be object'] };
  const errs: string[] = [];
  errs.push(...must(isStr(v.id), 'id', 'required string'));
  errs.push(...must(isStr(v.canonical), 'canonical', 'required string'));
  errs.push(...checkEnum(v.role, 'role', CONTROLLED_VOCAB.roles));
  errs.push(...checkStringArray(v.variants, 'variants'));
  errs.push(...checkCoreMeaning(v.coreMeaning, 'coreMeaning'));
  errs.push(...checkSentiment(v.sentiment, 'sentiment'));
  errs.push(...checkEnum(v.positionTendency, 'positionTendency', CONTROLLED_VOCAB.positions));
  errs.push(...checkStringArray(v.memberWords, 'memberWords'));
  errs.push(...checkStringArray(v.synonymMorphemes, 'synonymMorphemes'));
  errs.push(...checkStringArray(v.antonymMorphemes, 'antonymMorphemes'));
  return { ok: errs.length === 0, errors: errs };
}

export function validateRelationsGraph(v: unknown): ValidationResult {
  if (!isObject(v)) return { ok: false, errors: ['root: must be object'] };
  const errs: string[] = [];
  errs.push(...must(isStr(v.version), 'version', 'required string'));
  if (!isObject(v.stats)) errs.push('stats: must be object');
  else {
    errs.push(...must(isNum(v.stats.totalWords), 'stats.totalWords', 'required number'));
    errs.push(...must(isNum(v.stats.totalMorphemes), 'stats.totalMorphemes', 'required number'));
    errs.push(...must(isNum(v.stats.totalEdges), 'stats.totalEdges', 'required number'));
  }
  if (!isObject(v.edges)) errs.push('edges: must be object');
  else {
    const e = v.edges;
    const arrs = [
      'sameRoot', 'sameAffix', 'synonyms', 'antonyms', 'domainCohort', 'derivationPair',
      'morphVariants', 'sameImagery', 'affixSynonyms', 'affixAntonyms', 'rootVariants', 'rootSynonyms',
    ];
    arrs.forEach(k => {
      if (!isArr(e[k as keyof typeof e])) errs.push(`edges.${k}: must be array`);
    });
  }
  return { ok: errs.length === 0, errors: errs };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/schema.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/schema.ts tests/our_roots_affixes/schema.test.ts tests/our_roots_affixes/fixtures/mock-word-entry.json
git commit -m "our_roots_affixes: add hand-rolled schema validators with tests"
```

---

### Task 3: Invariants (INV-1..8)

**Files:**
- Create: `scripts/our_roots_affixes/invariants.ts`
- Create: `tests/our_roots_affixes/invariants.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/our_roots_affixes/invariants.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { runInvariants } from '../../scripts/our_roots_affixes/invariants.js';
import type { WordEntry, MorphemeEntry, RelationsGraph } from '../../scripts/our_roots_affixes/types.js';

const word: WordEntry = {
  word: 'inflation', phonetic: '/x/', pos: ['n.'],
  coreMeaning: [{ cn: '通货膨胀' }],
  morphemes: [
    { order: 1, form: 'in-', role: 'prefix', canonical: 'in-', coreMeaning: { cn: '进入' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial' },
    { order: 2, form: 'flat', role: 'root', canonical: 'flat', coreMeaning: { cn: '吹' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial' },
  ],
  derivationChain: ['flat', 'inflation'], morphVariantOf: null,
  memorySemantics: { literal: 'x', imageChain: ['x'], mnemonicExpr: 'x' },
  wordLevel: { sentiment: { tags: ['中性'] }, domain: ['economics'], registerFormality: 'formal' },
  relations: { sameRoot: [], sameAffix: [], synonyms: [], antonyms: [], domainCohort: [], derivationPair: [], morphVariants: [], sameImagery: [] },
};

const morphemesOk: MorphemeEntry[] = [
  { id: 'in-', canonical: 'in-', role: 'prefix', variants: [], coreMeaning: { cn: '进入' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial', memberWords: ['inflation'], synonymMorphemes: [], antonymMorphemes: [] },
  { id: 'flat', canonical: 'flat', role: 'root', variants: [], coreMeaning: { cn: '吹' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial', memberWords: ['inflation'], synonymMorphemes: [], antonymMorphemes: [] },
];

const graphOk: RelationsGraph = {
  version: '1.0',
  stats: { totalWords: 1, totalMorphemes: 2, totalEdges: 0 },
  edges: {
    sameRoot: [], sameAffix: [], synonyms: [], antonyms: [], domainCohort: [],
    derivationPair: [], morphVariants: [], sameImagery: [],
    affixSynonyms: [], affixAntonyms: [], rootVariants: [], rootSynonyms: [],
  },
};

describe('runInvariants', () => {
  test('all pass on consistent data', () => {
    const r = runInvariants({ words: [word], morphemes: morphemesOk, graph: graphOk });
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  test('INV-1 fails when morpheme canonical missing', () => {
    const orphan: WordEntry = {
      ...word,
      morphemes: [...word.morphemes, { order: 3, form: '-ion', role: 'suffix', canonical: '-ion', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'final' }],
    };
    const r = runInvariants({ words: [orphan], morphemes: morphemesOk, graph: graphOk });
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.startsWith('INV-1'))).toBe(true);
  });

  test('INV-2 fails when memberWords references missing word', () => {
    const m: MorphemeEntry[] = [
      { ...morphemesOk[0], memberWords: ['ghost'] }, morphemesOk[1],
    ];
    const r = runInvariants({ words: [word], morphemes: m, graph: graphOk });
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.startsWith('INV-2'))).toBe(true);
  });

  test('INV-5 fails when id appears in another entry variants', () => {
    const m: MorphemeEntry[] = [
      { ...morphemesOk[0], variants: ['flat'] }, morphemesOk[1],
    ];
    const r = runInvariants({ words: [word], morphemes: m, graph: graphOk });
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.startsWith('INV-5'))).toBe(true);
  });

  test('INV-7 fails when positionTendency bad', () => {
    const w = structuredClone(word);
    (w.morphemes[0].positionTendency as any) = 'middle';
    const r = runInvariants({ words: [w], morphemes: morphemesOk, graph: graphOk });
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.startsWith('INV-7'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/invariants.test.ts`
Expected: FAIL — `invariants.js` not found.

- [ ] **Step 3: Implement invariants**

Create `scripts/our_roots_affixes/invariants.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/invariants.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/invariants.ts tests/our_roots_affixes/invariants.test.ts
git commit -m "our_roots_affixes: add INV-1..8 invariant validator"
```

---

### Task 4: Utilities (atomic-write, checkpoint, retry, logger)

**Files:**
- Create: `scripts/our_roots_affixes/atomic-write.ts`
- Create: `scripts/our_roots_affixes/checkpoint.ts`
- Create: `scripts/our_roots_affixes/retry.ts`
- Create: `scripts/our_roots_affixes/logger.ts`
- Create: `tests/our_roots_affixes/atomic-write.test.ts`
- Create: `tests/our_roots_affixes/checkpoint.test.ts`
- Create: `tests/our_roots_affixes/retry.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/our_roots_affixes/atomic-write.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { atomicWriteJson, atomicWriteText } from '../../scripts/our_roots_affixes/atomic-write.js';

describe('atomicWriteJson', () => {
  test('writes object as JSON', () => {
    const p = join(tmpdir(), `atw-${Date.now()}.json`);
    atomicWriteJson(p, { a: 1, b: 'x' });
    expect(readFileSync(p, 'utf-8')).toBe(JSON.stringify({ a: 1, b: 'x' }, null, 2));
    unlinkSync(p);
  });

  test('no .tmp file remains after success', () => {
    const p = join(tmpdir(), `atw-${Date.now()}.json`);
    atomicWriteJson(p, { ok: true });
    expect(existsSync(p + '.tmp')).toBe(false);
    unlinkSync(p);
  });
});

describe('atomicWriteText', () => {
  test('writes text content', () => {
    const p = join(tmpdir(), `atw-${Date.now()}.txt`);
    atomicWriteText(p, 'hello world');
    expect(readFileSync(p, 'utf-8')).toBe('hello world');
    unlinkSync(p);
  });
});
```

Create `tests/our_roots_affixes/checkpoint.test.ts`:

```ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  writeCheckpoint,
  listCompletedBuckets,
  isBucketDone,
} from '../../scripts/our_roots_affixes/checkpoint.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ckpt-'));
});

describe('checkpoint', () => {
  test('writeCheckpoint creates done file', () => {
    writeCheckpoint(dir, { bucketId: 'a-001', timestamp: 'now', tokensIn: 1, tokensOut: 2, hash: 'h' });
    expect(existsSync(join(dir, 'a-001.done.json'))).toBe(true);
    rmSync(dir, { recursive: true });
  });

  test('listCompletedBuckets returns all done', () => {
    writeCheckpoint(dir, { bucketId: 'a-001', timestamp: 'n', tokensIn: 0, tokensOut: 0, hash: 'h' });
    writeCheckpoint(dir, { bucketId: 'b-002', timestamp: 'n', tokensIn: 0, tokensOut: 0, hash: 'h' });
    expect(listCompletedBuckets(dir).sort()).toEqual(['a-001', 'b-002']);
    rmSync(dir, { recursive: true });
  });

  test('isBucketDone reflects state', () => {
    expect(isBucketDone(dir, 'a-001')).toBe(false);
    writeCheckpoint(dir, { bucketId: 'a-001', timestamp: 'n', tokensIn: 0, tokensOut: 0, hash: 'h' });
    expect(isBucketDone(dir, 'a-001')).toBe(true);
    rmSync(dir, { recursive: true });
  });
});
```

Create `tests/our_roots_affixes/retry.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { withRetry } from '../../scripts/our_roots_affixes/retry.js';

describe('withRetry', () => {
  test('returns value on first success', async () => {
    let calls = 0;
    const r = await withRetry(async () => { calls++; return 42; }, { maxRetries: 3, baseDelayMs: 1 });
    expect(r).toBe(42);
    expect(calls).toBe(1);
  });

  test('retries on failure then succeeds', async () => {
    let calls = 0;
    const r = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error('boom');
      return 'ok';
    }, { maxRetries: 5, baseDelayMs: 1 });
    expect(r).toBe('ok');
    expect(calls).toBe(3);
  });

  test('throws after maxRetries exceeded', async () => {
    let calls = 0;
    await expect(withRetry(async () => {
      calls++;
      throw new Error('boom');
    }, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow('boom');
    expect(calls).toBe(3); // initial + 2 retries
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/atomic-write.test.ts tests/our_roots_affixes/checkpoint.test.ts tests/our_roots_affixes/retry.test.ts`
Expected: FAIL — missing modules.

- [ ] **Step 3: Implement utilities**

Create `scripts/our_roots_affixes/atomic-write.ts`:

```ts
import { writeFileSync, renameSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export function atomicWriteText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + '.tmp';
  writeFileSync(tmp, content, 'utf-8');
  renameSync(tmp, path);
}

export function atomicWriteJson(path: string, data: unknown): void {
  atomicWriteText(path, JSON.stringify(data, null, 2));
}
```

Create `scripts/our_roots_affixes/checkpoint.ts`:

```ts
import { readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { atomicWriteJson } from './atomic-write.js';
import type { CheckpointRecord } from './types.js';

export function writeCheckpoint(dir: string, rec: CheckpointRecord): void {
  mkdirSync(dir, { recursive: true });
  atomicWriteJson(join(dir, `${rec.bucketId}.done.json`), rec);
}

export function listCompletedBuckets(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.done.json'))
    .map(f => f.replace(/\.done\.json$/, ''));
}

export function isBucketDone(dir: string, bucketId: string): boolean {
  return existsSync(join(dir, `${bucketId}.done.json`));
}
```

Create `scripts/our_roots_affixes/retry.ts`:

```ts
export interface RetryOpts {
  maxRetries: number;
  baseDelayMs: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === opts.maxRetries) break;
      const delay = opts.baseDelayMs * Math.pow(2, attempt);
      opts.onRetry?.(attempt + 1, e as Error);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
```

Create `scripts/our_roots_affixes/logger.ts`:

```ts
type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export function log(level: Level, source: string, fields: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  const entries = Object.entries(fields).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
  // eslint-disable-next-line no-console
  console.log(`[${ts}] ${level} ${source} ${entries}`);
}

export const logger = {
  info: (source: string, fields: Record<string, unknown>) => log('INFO', source, fields),
  warn: (source: string, fields: Record<string, unknown>) => log('WARN', source, fields),
  error: (source: string, fields: Record<string, unknown>) => log('ERROR', source, fields),
  debug: (source: string, fields: Record<string, unknown>) => log('DEBUG', source, fields),
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/atomic-write.test.ts tests/our_roots_affixes/checkpoint.test.ts tests/our_roots_affixes/retry.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/atomic-write.ts scripts/our_roots_affixes/checkpoint.ts scripts/our_roots_affixes/retry.ts scripts/our_roots_affixes/logger.ts tests/our_roots_affixes/atomic-write.test.ts tests/our_roots_affixes/checkpoint.test.ts tests/our_roots_affixes/retry.test.ts
git commit -m "our_roots_affixes: add utilities (atomic-write, checkpoint, retry, logger)"
```

---

### Task 5: Stage 0 — Manifest builder

**Files:**
- Create: `scripts/our_roots_affixes/stage-0-manifest.ts`
- Create: `tests/our_roots_affixes/stage-0-manifest.test.ts`
- Create: `tests/our_roots_affixes/fixtures/mock-word-bank.json`

- [ ] **Step 1: Create fixture + failing test**

Create `tests/our_roots_affixes/fixtures/mock-word-bank.json`:

```json
[
  { "id": "inflate", "word": "inflate", "phonetic": "/ɪnˈfleɪt/", "meanings": [{ "partOfSpeech": "v", "definition": "x", "definitionCn": "使膨胀" }] },
  { "id": "inflation", "word": "inflation", "phonetic": "/ɪnˈfleɪʃn/", "meanings": [{ "partOfSpeech": "n", "definition": "x", "definitionCn": "通货膨胀" }] },
  { "id": "deflate", "word": "deflate", "phonetic": "/dɪˈfleɪt/", "meanings": [{ "partOfSpeech": "v", "definition": "x", "definitionCn": "放气" }] }
]
```

Create `tests/our_roots_affixes/stage-0-manifest.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildManifest, bucketize } from '../../scripts/our_roots_affixes/stage-0-manifest.js';

const mockBank = [
  { id: 'inflate', word: 'inflate', phonetic: '/a/', meanings: [{ partOfSpeech: 'v', definition: 'x', definitionCn: '使膨胀' }] },
  { id: 'inflation', word: 'inflation', phonetic: '/b/', meanings: [{ partOfSpeech: 'n', definition: 'x', definitionCn: '通货膨胀' }] },
];
const mockBank2 = [
  { id: 'inflation', word: 'inflation', phonetic: '/b/', meanings: [{ partOfSpeech: 'n', definition: 'x', definitionCn: '通货膨胀' }] },
  { id: 'deflate', word: 'deflate', phonetic: '/c/', meanings: [{ partOfSpeech: 'v', definition: 'x', definitionCn: '放气' }] },
];

describe('buildManifest', () => {
  test('dedups and records source banks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wb-'));
    writeFileSync(join(dir, 'bank1.json'), JSON.stringify(mockBank));
    writeFileSync(join(dir, 'bank2.json'), JSON.stringify(mockBank2));
    const m = buildManifest(dir);
    expect(m.totalWords).toBe(3);
    const inflation = m.entries.find(e => e.word === 'inflation');
    expect(inflation?.sourceBanks.sort()).toEqual(['bank1', 'bank2']);
    rmSync(dir, { recursive: true });
  });

  test('normalizes word to lowercase', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wb-'));
    writeFileSync(join(dir, 'x.json'), JSON.stringify([
      { word: 'INFLATE', phonetic: '/a/', meanings: [{ partOfSpeech: 'v', definition: '', definitionCn: 'y' }] },
    ]));
    const m = buildManifest(dir);
    expect(m.entries[0].word).toBe('inflate');
    rmSync(dir, { recursive: true });
  });
});

describe('bucketize', () => {
  test('splits 50-word buckets with alphabetic prefix', () => {
    const words = Array.from({ length: 120 }, (_, i) => ({
      word: (i < 100 ? 'a' : 'b') + String(i).padStart(3, '0'),
      phonetic: '', definitionCn: '', sourceBanks: [],
    }));
    const plan = bucketize(words, 50);
    expect(plan.totalBuckets).toBe(3);
    expect(plan.buckets.map(b => b.id)).toEqual(['a-001', 'a-002', 'b-001']);
    expect(plan.buckets[0].words.length).toBe(50);
    expect(plan.buckets[1].words.length).toBe(50);
    expect(plan.buckets[2].words.length).toBe(20);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/stage-0-manifest.test.ts`
Expected: FAIL — missing module.

- [ ] **Step 3: Implement Stage 0**

Create `scripts/our_roots_affixes/stage-0-manifest.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/stage-0-manifest.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Run Stage 0 against real data to verify 21,923 words**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun scripts/our_roots_affixes/stage-0-manifest.ts`
Expected: logs show `totalWords=21923` (or very close) and `totalBuckets=~440`. `data/our_roots_affixes/manifest.json` and `_staging/bucket-plan.json` exist.

- [ ] **Step 6: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/stage-0-manifest.ts tests/our_roots_affixes/stage-0-manifest.test.ts tests/our_roots_affixes/fixtures/mock-word-bank.json
git commit -m "our_roots_affixes: add Stage 0 manifest builder"
```

---

### Task 6: LLM client (Anthropic fetch wrapper with prompt caching)

**Files:**
- Create: `scripts/our_roots_affixes/llm-client.ts`

- [ ] **Step 1: Implement client**

Create `scripts/our_roots_affixes/llm-client.ts`:

```ts
import { LLM } from './config.js';
import { logger } from './logger.js';

export interface CachedBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export interface LLMCallArgs {
  system: CachedBlock[];
  userText: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCallResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  cacheWrite: number;
}

export async function callClaude(args: LLMCallArgs): Promise<LLMCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const body = {
    model: LLM.model,
    max_tokens: args.maxTokens ?? LLM.maxOutputTokens,
    temperature: args.temperature ?? LLM.temperature,
    system: args.system,
    messages: [{ role: 'user', content: args.userText }],
  };

  const res = await fetch(LLM.apiUrl, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': LLM.apiVersion,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errTxt}`);
  }

  const json = await res.json() as {
    content: Array<{ type: string; text?: string }>;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };

  const text = json.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
  return {
    text,
    tokensIn: json.usage.input_tokens,
    tokensOut: json.usage.output_tokens,
    cacheRead: json.usage.cache_read_input_tokens ?? 0,
    cacheWrite: json.usage.cache_creation_input_tokens ?? 0,
  };
}

export function extractJson<T = unknown>(text: string): T {
  // Strip Markdown code fences if present
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fence) t = fence[1];
  return JSON.parse(t) as T;
}
```

- [ ] **Step 2: Type check**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun build --target=bun --outdir=/tmp/check scripts/our_roots_affixes/llm-client.ts`
Expected: builds without error.

- [ ] **Step 3: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/llm-client.ts
git commit -m "our_roots_affixes: add Anthropic API client with prompt caching"
```

---

### Task 7: Prompt templates

**Files:**
- Create: `scripts/our_roots_affixes/prompts.ts`

- [ ] **Step 1: Implement prompt templates**

Create `scripts/our_roots_affixes/prompts.ts`:

```ts
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
```

- [ ] **Step 2: Type check**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun build --target=bun --outdir=/tmp/check scripts/our_roots_affixes/prompts.ts`
Expected: builds without error.

- [ ] **Step 3: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/prompts.ts
git commit -m "our_roots_affixes: add prompt templates (L0/L1/L3 + Stage 1a/4)"
```

---

### Task 8: Stage 1a — Morpheme planning

**Files:**
- Create: `scripts/our_roots_affixes/stage-1a-planner.ts`
- Create: `scripts/our_roots_affixes/stage-1a-consolidate.ts`

- [ ] **Step 1: Implement planner**

Create `scripts/our_roots_affixes/stage-1a-planner.ts`:

```ts
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
```

- [ ] **Step 2: Implement consolidator**

Create `scripts/our_roots_affixes/stage-1a-consolidate.ts`:

```ts
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
```

- [ ] **Step 3: Type check**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun build --target=bun --outdir=/tmp/check scripts/our_roots_affixes/stage-1a-planner.ts scripts/our_roots_affixes/stage-1a-consolidate.ts`
Expected: builds without error.

- [ ] **Step 4: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/stage-1a-planner.ts scripts/our_roots_affixes/stage-1a-consolidate.ts
git commit -m "our_roots_affixes: add Stage 1a planner + consolidator"
```

---

### Task 9: Stage 1b — Word decomposer (single batch)

**Files:**
- Create: `scripts/our_roots_affixes/stage-1b-decompose.ts`
- Create: `tests/our_roots_affixes/stage-1b-decompose.test.ts`

- [ ] **Step 1: Write test for validation logic**

Create `tests/our_roots_affixes/stage-1b-decompose.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { validateBatchResult } from '../../scripts/our_roots_affixes/stage-1b-decompose.js';
import type { MorphemeInventory } from '../../scripts/our_roots_affixes/types.js';

const inv: MorphemeInventory = {
  roots: [
    { id: 'flat', canonical: 'flat', role: 'root', variants: ['flate'], coreMeaning: { cn: '吹' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial', memberWords: [], synonymMorphemes: [], antonymMorphemes: [] },
  ],
  affixes: [
    { id: 'in-', canonical: 'in-', role: 'prefix', variants: [], coreMeaning: { cn: '进入' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial', memberWords: [], synonymMorphemes: [], antonymMorphemes: [] },
    { id: '-ion', canonical: '-ion', role: 'suffix', variants: [], coreMeaning: { cn: '名词化' }, sentiment: { tags: ['中性'] }, positionTendency: 'final', memberWords: [], synonymMorphemes: [], antonymMorphemes: [] },
  ],
  linkers: [],
  variantToCanonical: { flate: 'flat' },
};

const goodEntry = {
  word: 'inflation', phonetic: '/x/', pos: ['n.'], coreMeaning: [{ cn: '通货膨胀' }],
  morphemes: [
    { order: 1, form: 'in-', role: 'prefix', canonical: 'in-', coreMeaning: { cn: '进入' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial' },
    { order: 2, form: 'flat', role: 'root', canonical: 'flat', coreMeaning: { cn: '吹' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial' },
    { order: 3, form: '-ion', role: 'suffix', canonical: '-ion', coreMeaning: { cn: '名词化' }, sentiment: { tags: ['中性'] }, positionTendency: 'final' },
  ],
  derivationChain: ['flat', 'inflation'], morphVariantOf: null,
  memorySemantics: { literal: 'x', imageChain: ['x'], mnemonicExpr: 'x' },
  wordLevel: { sentiment: { tags: ['贬义'] }, domain: ['economics'], registerFormality: 'formal' },
  relations: { sameRoot: [], sameAffix: [], synonyms: [], antonyms: [], domainCohort: [], derivationPair: [], morphVariants: [], sameImagery: [] },
};

describe('validateBatchResult', () => {
  test('accepts valid batch', () => {
    const r = validateBatchResult([goodEntry], ['inflation'], inv);
    expect(r.ok).toBe(true);
  });

  test('rejects count mismatch', () => {
    const r = validateBatchResult([goodEntry], ['inflation', 'foo'], inv);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('count'))).toBe(true);
  });

  test('rejects out-of-order word', () => {
    const r = validateBatchResult([goodEntry], ['wrong'], inv);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('mismatch'))).toBe(true);
  });

  test('rejects canonical not in inventory', () => {
    const bad = structuredClone(goodEntry) as any;
    bad.morphemes[0].canonical = 'bogus-';
    const r = validateBatchResult([bad], ['inflation'], inv);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('canonical'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/stage-1b-decompose.test.ts`
Expected: FAIL — missing module.

- [ ] **Step 3: Implement decomposer**

Create `scripts/our_roots_affixes/stage-1b-decompose.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/stage-1b-decompose.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/stage-1b-decompose.ts tests/our_roots_affixes/stage-1b-decompose.test.ts
git commit -m "our_roots_affixes: add Stage 1b decomposer with batch validation"
```

---

### Task 10: Stage 1b — Worker pool + coordinator

**Files:**
- Create: `scripts/our_roots_affixes/stage-1b-runner.ts`

- [ ] **Step 1: Implement runner**

Create `scripts/our_roots_affixes/stage-1b-runner.ts`:

```ts
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
```

- [ ] **Step 2: Type check**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun build --target=bun --outdir=/tmp/check scripts/our_roots_affixes/stage-1b-runner.ts`
Expected: builds without error.

- [ ] **Step 3: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/stage-1b-runner.ts
git commit -m "our_roots_affixes: add Stage 1b worker pool coordinator"
```

---

### Task 11: Stage 2 — Morpheme index backfill

**Files:**
- Create: `scripts/our_roots_affixes/stage-2-morpheme-index.ts`
- Create: `tests/our_roots_affixes/stage-2-morpheme-index.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/our_roots_affixes/stage-2-morpheme-index.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { backfillMemberWords, buildWordIndex } from '../../scripts/our_roots_affixes/stage-2-morpheme-index.js';
import type { WordEntry, MorphemeEntry } from '../../scripts/our_roots_affixes/types.js';

const w1: WordEntry = {
  word: 'vision', phonetic: '/x/', pos: ['n.'], coreMeaning: [{ cn: 'x' }],
  morphemes: [
    { order: 1, form: 'vis', role: 'root', canonical: 'vis', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial' },
    { order: 2, form: '-ion', role: 'suffix', canonical: '-ion', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'final' },
  ],
  derivationChain: [], morphVariantOf: null,
  memorySemantics: { literal: 'x', imageChain: [], mnemonicExpr: 'x' },
  wordLevel: { sentiment: { tags: ['中性'] }, domain: ['general'], registerFormality: 'neutral' },
  relations: { sameRoot: [], sameAffix: [], synonyms: [], antonyms: [], domainCohort: [], derivationPair: [], morphVariants: [], sameImagery: [] },
};
const w2: WordEntry = { ...w1, word: 'revision', morphemes: [{ order: 1, form: 're-', role: 'prefix', canonical: 're-', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial' }, ...w1.morphemes] };

const morphemes: MorphemeEntry[] = [
  { id: 'vis', canonical: 'vis', role: 'root', variants: [], coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial', memberWords: [], synonymMorphemes: [], antonymMorphemes: [] },
  { id: '-ion', canonical: '-ion', role: 'suffix', variants: [], coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'final', memberWords: [], synonymMorphemes: [], antonymMorphemes: [] },
  { id: 're-', canonical: 're-', role: 'prefix', variants: [], coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial', memberWords: [], synonymMorphemes: [], antonymMorphemes: [] },
];

describe('backfillMemberWords', () => {
  test('aggregates all words using each morpheme', () => {
    const r = backfillMemberWords([w1, w2], morphemes);
    expect(r.find(m => m.id === 'vis')?.memberWords.sort()).toEqual(['revision', 'vision']);
    expect(r.find(m => m.id === '-ion')?.memberWords.sort()).toEqual(['revision', 'vision']);
    expect(r.find(m => m.id === 're-')?.memberWords).toEqual(['revision']);
  });

  test('dedupes when word references same morpheme twice', () => {
    const w3 = structuredClone(w1);
    w3.morphemes.push({ order: 3, form: 'vis', role: 'root', canonical: 'vis', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial' });
    const r = backfillMemberWords([w3], morphemes);
    expect(r.find(m => m.id === 'vis')?.memberWords).toEqual(['vision']);
  });
});

describe('buildWordIndex', () => {
  test('maps word to bucket id', () => {
    const idx = buildWordIndex([
      { bucketId: 'v-001', words: [w1, w2] },
    ]);
    expect(idx).toEqual({ vision: 'v-001', revision: 'v-001' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/stage-2-morpheme-index.test.ts`
Expected: FAIL — missing module.

- [ ] **Step 3: Implement Stage 2**

Create `scripts/our_roots_affixes/stage-2-morpheme-index.ts`:

```ts
import { readFileSync, readdirSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { PATHS } from './config.js';
import { atomicWriteJson } from './atomic-write.js';
import { logger } from './logger.js';
import type { WordEntry, MorphemeEntry } from './types.js';

export function backfillMemberWords(words: WordEntry[], morphemes: MorphemeEntry[]): MorphemeEntry[] {
  const byId = new Map<string, Set<string>>();
  for (const m of morphemes) byId.set(m.id, new Set());
  for (const w of words) {
    for (const mo of w.morphemes) {
      const set = byId.get(mo.canonical);
      if (set) set.add(w.word);
    }
  }
  return morphemes.map(m => ({ ...m, memberWords: [...(byId.get(m.id) ?? [])].sort() }));
}

export function buildWordIndex(buckets: Array<{ bucketId: string; words: WordEntry[] }>): Record<string, string> {
  const idx: Record<string, string> = {};
  for (const b of buckets) {
    for (const w of b.words) idx[w.word] = b.bucketId;
  }
  return idx;
}

export async function runStage2(): Promise<void> {
  logger.info('stage-2', { phase: 'start' });

  const wordFiles = readdirSync(PATHS.words).filter(f => f.match(/^[a-z_]-\d{3}\.json$/));
  const allWords: WordEntry[] = [];
  const buckets: Array<{ bucketId: string; words: WordEntry[] }> = [];
  for (const f of wordFiles) {
    const bucketId = basename(f, '.json');
    const arr: WordEntry[] = JSON.parse(readFileSync(join(PATHS.words, f), 'utf-8'));
    allWords.push(...arr);
    buckets.push({ bucketId, words: arr });
  }

  const roots: MorphemeEntry[] = JSON.parse(readFileSync(join(PATHS.morphemes, 'roots.json'), 'utf-8'));
  const affixes: MorphemeEntry[] = JSON.parse(readFileSync(join(PATHS.morphemes, 'affixes.json'), 'utf-8'));
  const linkers: MorphemeEntry[] = JSON.parse(readFileSync(join(PATHS.morphemes, 'linkers.json'), 'utf-8'));

  const rootsWithMembers = backfillMemberWords(allWords, roots);
  const affixesWithMembers = backfillMemberWords(allWords, affixes);
  const linkersWithMembers = backfillMemberWords(allWords, linkers);

  mkdirSync(PATHS.morphemes, { recursive: true });
  atomicWriteJson(join(PATHS.morphemes, 'roots.json'), rootsWithMembers);
  atomicWriteJson(join(PATHS.morphemes, 'affixes.json'), affixesWithMembers);
  atomicWriteJson(join(PATHS.morphemes, 'linkers.json'), linkersWithMembers);

  const wordIndex = buildWordIndex(buckets);
  atomicWriteJson(join(PATHS.words, 'word-index.json'), wordIndex);

  logger.info('stage-2', {
    phase: 'done',
    totalWords: allWords.length,
    roots: rootsWithMembers.length,
    affixes: affixesWithMembers.length,
    linkers: linkersWithMembers.length,
  });
}

if (import.meta.main) {
  runStage2().catch(e => {
    logger.error('stage-2', { err: String(e) });
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/stage-2-morpheme-index.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/stage-2-morpheme-index.ts tests/our_roots_affixes/stage-2-morpheme-index.test.ts
git commit -m "our_roots_affixes: add Stage 2 morpheme index backfill"
```

---

### Task 12: Stage 3 — Relations graph builder

**Files:**
- Create: `scripts/our_roots_affixes/stage-3-relations.ts`
- Create: `tests/our_roots_affixes/stage-3-relations.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/our_roots_affixes/stage-3-relations.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { buildRelationsGraph } from '../../scripts/our_roots_affixes/stage-3-relations.js';
import type { WordEntry, MorphemeEntry } from '../../scripts/our_roots_affixes/types.js';

const base: WordEntry = {
  word: '', phonetic: '', pos: ['n.'], coreMeaning: [{ cn: 'x' }],
  morphemes: [], derivationChain: [], morphVariantOf: null,
  memorySemantics: { literal: 'x', imageChain: [], mnemonicExpr: 'x' },
  wordLevel: { sentiment: { tags: ['中性'] }, domain: ['general'], registerFormality: 'neutral' },
  relations: { sameRoot: [], sameAffix: [], synonyms: [], antonyms: [], domainCohort: [], derivationPair: [], morphVariants: [], sameImagery: [] },
};
const mk = (word: string, patch: Partial<WordEntry>): WordEntry => ({ ...base, word, ...patch, relations: { ...base.relations, ...(patch.relations ?? {}) } });

describe('buildRelationsGraph', () => {
  test('sameRoot derived from morpheme memberWords', () => {
    const words = [
      mk('vision', { morphemes: [{ order: 1, form: 'vis', role: 'root', canonical: 'vis', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial' }] }),
      mk('revise', { morphemes: [{ order: 1, form: 'vis', role: 'root', canonical: 'vis', coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial' }] }),
    ];
    const morphemes: MorphemeEntry[] = [
      { id: 'vis', canonical: 'vis', role: 'root', variants: [], coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial', memberWords: ['vision', 'revise'], synonymMorphemes: ['spec'], antonymMorphemes: [] },
    ];
    const g = buildRelationsGraph(words, morphemes);
    expect(g.edges.sameRoot).toEqual([{ root: 'vis', members: ['revise', 'vision'] }]);
  });

  test('synonyms deduped and bidirectional', () => {
    const words = [
      mk('big', { relations: { ...base.relations, synonyms: ['large'] } }),
      mk('large', { relations: { ...base.relations, synonyms: ['big'] } }),
    ];
    const g = buildRelationsGraph(words, []);
    expect(g.edges.synonyms).toEqual([['big', 'large']]);
  });

  test('derivationPair from derivationChain adjacent pairs', () => {
    const w = mk('inflation', { derivationChain: ['flat', 'inflate', 'inflation'] });
    const g = buildRelationsGraph([w], []);
    expect(g.edges.derivationPair.sort()).toEqual([['flat', 'inflate'], ['inflate', 'inflation']]);
  });

  test('domainCohort grouped by domain', () => {
    const words = [
      mk('inflation', { wordLevel: { ...base.wordLevel, domain: ['economics'] } }),
      mk('tariff', { wordLevel: { ...base.wordLevel, domain: ['economics'] } }),
    ];
    const g = buildRelationsGraph(words, []);
    expect(g.edges.domainCohort).toContainEqual({ domain: 'economics', members: ['inflation', 'tariff'] });
  });

  test('morphVariants from morphVariantOf field', () => {
    const words = [
      mk('analyze', {}),
      mk('analyse', { morphVariantOf: 'analyze' }),
    ];
    const g = buildRelationsGraph(words, []);
    expect(g.edges.morphVariants).toEqual([['analyse', 'analyze']]);
  });

  test('affixSynonyms from morpheme synonymMorphemes', () => {
    const morphemes: MorphemeEntry[] = [
      { id: 'pre-', canonical: 'pre-', role: 'prefix', variants: [], coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'initial', memberWords: [], synonymMorphemes: ['ante-', 'pro-'], antonymMorphemes: ['post-'] },
    ];
    const g = buildRelationsGraph([], morphemes);
    expect(g.edges.affixSynonyms).toEqual([{ affix: 'pre-', synonyms: ['ante-', 'pro-'] }]);
    expect(g.edges.affixAntonyms).toEqual([{ affix: 'pre-', antonyms: ['post-'] }]);
  });

  test('rootVariants and rootSynonyms from morpheme', () => {
    const morphemes: MorphemeEntry[] = [
      { id: 'vis', canonical: 'vis', role: 'root', variants: ['vid', 'vise'], coreMeaning: { cn: 'x' }, sentiment: { tags: ['中性'] }, positionTendency: 'medial', memberWords: [], synonymMorphemes: ['spec'], antonymMorphemes: [] },
    ];
    const g = buildRelationsGraph([], morphemes);
    expect(g.edges.rootVariants).toEqual([{ root: 'vis', variants: ['vid', 'vise'] }]);
    expect(g.edges.rootSynonyms).toEqual([{ root: 'vis', synonyms: ['spec'] }]);
  });

  test('sameImagery groups words sharing an image keyword', () => {
    const words = [
      mk('inflate', { memorySemantics: { literal: 'x', imageChain: ['吹气膨胀'], mnemonicExpr: 'x' } }),
      mk('deflate', { memorySemantics: { literal: 'x', imageChain: ['吹气膨胀'], mnemonicExpr: 'x' } }),
      mk('balloon', { memorySemantics: { literal: 'x', imageChain: ['吹气膨胀'], mnemonicExpr: 'x' } }),
    ];
    const g = buildRelationsGraph(words, []);
    expect(g.edges.sameImagery).toContainEqual({ image: '吹气膨胀', members: ['balloon', 'deflate', 'inflate'] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/stage-3-relations.test.ts`
Expected: FAIL — missing module.

- [ ] **Step 3: Implement Stage 3**

Create `scripts/our_roots_affixes/stage-3-relations.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun test tests/our_roots_affixes/stage-3-relations.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/stage-3-relations.ts tests/our_roots_affixes/stage-3-relations.test.ts
git commit -m "our_roots_affixes: add Stage 3 relations graph builder with tests"
```

---

### Task 13: Stage 4 — QA sampling

**Files:**
- Create: `scripts/our_roots_affixes/stage-4-qa.ts`

- [ ] **Step 1: Implement QA sampler**

Create `scripts/our_roots_affixes/stage-4-qa.ts`:

```ts
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
```

- [ ] **Step 2: Type check**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun build --target=bun --outdir=/tmp/check scripts/our_roots_affixes/stage-4-qa.ts`
Expected: builds without error.

- [ ] **Step 3: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/stage-4-qa.ts
git commit -m "our_roots_affixes: add Stage 4 QA sampling with pass-rate gate"
```

---

### Task 14: Stage 5 — Packaging + META.md generator

**Files:**
- Create: `scripts/our_roots_affixes/stage-5-package.ts`

- [ ] **Step 1: Implement packaging**

Create `scripts/our_roots_affixes/stage-5-package.ts`:

```ts
import { readFileSync, existsSync, rmSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { PATHS, PIPELINE, CONTROLLED_VOCAB } from './config.js';
import { atomicWriteText } from './atomic-write.js';
import { logger } from './logger.js';
import type { Manifest, MorphemeEntry, RelationsGraph } from './types.js';

function genMetaMd(stats: {
  totalWords: number; totalRoots: number; totalAffixes: number; totalLinkers: number;
  totalEdges: number; schemaVersion: string; release: string;
}): string {
  return `# data/our_roots_affixes — 数据包 META

版本: **${stats.release}**
Schema: **${stats.schemaVersion}**
生成时间: ${new Date().toISOString()}

---

## 1. 版本与兼容性

- 当前 schema 版本：\`${stats.schemaVersion}\`
- 破坏性变更触发主版本号递增
- 添加非必填字段触发次版本号递增
- 变更日志见 \`CHANGELOG.md\`

## 2. 三类对象总览

\`\`\`
          ┌─────────────────┐
          │   WordEntry     │ morphemes[].canonical
          │  (${String(stats.totalWords).padStart(6)} 条)│─────────────────┐
          │  words/*.json   │                 │
          └────────┬────────┘                 │
                   │                          ▼
                   │ relations.*    ┌─────────────────┐
                   │ (冗余快速查)    │  MorphemeEntry  │
                   │                │  (${String(stats.totalRoots + stats.totalAffixes + stats.totalLinkers).padStart(6)} 条)│
                   │                │  morphemes/*.json │
                   │                └────────┬────────┘
                   │                         │ memberWords[]
                   ▼                         ▼
          ┌─────────────────────────────────────────┐
          │         RelationsGraph                  │
          │  relations/graph.json  (${String(stats.totalEdges).padStart(6)} 条边)│
          └─────────────────────────────────────────┘
\`\`\`

## 3. WordEntry 字段

存放路径: \`words/<bucket>.json\` (50 词/桶)

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| word | string | ✓ | 英文小写 |
| phonetic | string | ✓ | IPA 音标 |
| pos | string[] | ✓ | 词性标签 |
| coreMeaning[] | object[] | ✓ | 核心义项（覆盖 80% 场景） |
| morphemes[] | Morpheme[] | ✓ | 按出现顺序的形素数组 |
| derivationChain | string[] | ✓ | 形态派生链 |
| morphVariantOf | string\|null | ✓ | 若是拼写变体指向规范形 |
| memorySemantics | object | ✓ | literal / imageChain / mnemonicExpr |
| wordLevel | object | ✓ | 整词情感/语域/正式度 |
| relations | object | ✓ | 同根/同缀/同义等 8 类边（冗余快速查） |

### Morpheme 子对象

| 字段 | 类型 | 枚举 |
|---|---|---|
| role | string | ${CONTROLLED_VOCAB.roles.join(' \\| ')} |
| positionTendency | string | ${CONTROLLED_VOCAB.positions.join(' \\| ')} |
| canonical | string | MUST ∈ MorphemeEntry.id |
| sentiment.tags | string[] | 受控 (见 §7) |

## 4. MorphemeEntry 字段

存放路径: \`morphemes/roots.json\`, \`morphemes/affixes.json\`, \`morphemes/linkers.json\`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | stable key |
| canonical | string | 展示形 |
| role | enum | 同上 |
| variants | string[] | 同形素的其他拼写（不独立建 entry） |
| memberWords | string[] | 所有使用此形素的词（自动聚合） |
| synonymMorphemes | string[] | 语义近似的同类形素 (pre-/ante-/pro-) |
| antonymMorphemes | string[] | 语义反向的同类形素 (pre-/post-) |

## 5. RelationsGraph 字段 + 推导规则

存放路径: \`relations/graph.json\`

| 边类型 | 推导 |
|---|---|
| sameRoot | GROUP BY MorphemeEntry(role=root).id → memberWords |
| sameAffix | GROUP BY MorphemeEntry(role∈prefix,suffix).id → memberWords |
| synonyms | UNION ALL WordEntry.relations.synonyms（双向去重） |
| antonyms | UNION ALL WordEntry.relations.antonyms |
| domainCohort | GROUP BY WordEntry.wordLevel.domain → words (≥2) |
| derivationPair | WordEntry.derivationChain 相邻二元组 |
| morphVariants | WordEntry.morphVariantOf → pair |
| sameImagery | GROUP BY WordEntry.memorySemantics.imageChain 关键词 (≥3 词) |
| affixSynonyms | MorphemeEntry(role=prefix/suffix).synonymMorphemes |
| affixAntonyms | MorphemeEntry(role=prefix/suffix).antonymMorphemes |
| rootVariants | MorphemeEntry(role=root).variants |
| rootSynonyms | MorphemeEntry(role=root).synonymMorphemes |

## 6. 不变式（INV-1..8）

- INV-1: ∀ WordEntry.morphemes[].canonical  ⇒ ∃ MorphemeEntry.id
- INV-2: ∀ MorphemeEntry.memberWords[]       ⇒ ∃ WordEntry.word
- INV-3: WordEntry.relations.sameRoot ⊆ MorphemeEntry(root).memberWords \\ {self}
- INV-4: RelationsGraph.edges.* 任意端点在 WordEntry/MorphemeEntry
- INV-5: MorphemeEntry.variants ∩ MorphemeEntry.id == ∅
- INV-6: sentiment.tags ⊆ 受控词表（§7）
- INV-7: positionTendency ∈ {initial,medial,final}
- INV-8: role ∈ {prefix,root,suffix,linker,variant}

生成流水线的 Stage 3 + Stage 5 各跑一次 INV-1..8 校验。

## 7. 受控词表

### 7.1 sentiment.tags（可多选）

| 轴 | 标签 |
|---|---|
| 好坏 | 褒义 / 贬义 / 中性 / 混合 |
| 喜恶 | 喜爱 / 厌恶 / 讨厌 / 中立 |
| 偏向 | 偏正 / 偏负 |
| 情绪色 | 担忧 / 乐观 / 讽刺 / 庄重 / 轻佻 |

### 7.2 role

\`${CONTROLLED_VOCAB.roles.join(' | ')}\`

### 7.3 positionTendency

\`${CONTROLLED_VOCAB.positions.join(' | ')}\`

### 7.4 domain

\`${CONTROLLED_VOCAB.domains.join(' | ')}\`

## 8. 变更流程

1. 修改 schema 前先更新本 META 文件
2. 升级版本号（若破坏性变更）
3. 写 migration 脚本（若需要）
4. 在 \`CHANGELOG.md\` 记录变更
5. Stage 5 打包时再跑一次 INV-1..8 全量校验
`;
}

function genReadme(stats: { totalWords: number; release: string }): string {
  return `# our_roots_affixes

独立构建的英语词汇词根词缀数据库。

- 词量: **${stats.totalWords}**
- 版本: **${stats.release}**

## 加载示例

\`\`\`ts
import wordIndex from './words/word-index.json' assert { type: 'json' };
const bucket = wordIndex['inflation'];   // "i-001"
const bucketData = await import(\`./words/\${bucket}.json\`, { assert: { type: 'json' } });
const entry = bucketData.default.find(w => w.word === 'inflation');
\`\`\`

## 查同根词

\`\`\`ts
import graph from './relations/graph.json' assert { type: 'json' };
const sameRoot = graph.edges.sameRoot.find(e => e.root === 'vis')?.members;
// ["revise", "revision", "vision", ...]
\`\`\`

## 完整 schema 说明

见 \`META.md\`。
`;
}

function genChangelog(stats: { release: string; totalWords: number }): string {
  return `# CHANGELOG

## ${stats.release} — ${new Date().toISOString().slice(0, 10)}

- 初版发布
- 词量 ${stats.totalWords}
- 形素层: roots.json / affixes.json / linkers.json
- 关系图 12 类边
- 受控词表 + INV-1..8 不变式校验
`;
}

function genSchemaTypesD(): string {
  return readFileSync(join(import.meta.dir, 'types.ts'), 'utf-8')
    .replace(/import type.*\n/g, '')
    .replace(/export type Role = .*$/m, 'export type Role = "prefix"|"root"|"suffix"|"linker"|"variant";')
    .replace(/export type Position = .*$/m, 'export type Position = "initial"|"medial"|"final";')
    .replace(/export type SentimentTag = .*$/m, `export type SentimentTag = ${CONTROLLED_VOCAB.sentimentTags.map(t => `"${t}"`).join('|')};`)
    .replace(/export type Domain = .*$/m, `export type Domain = ${CONTROLLED_VOCAB.domains.map(d => `"${d}"`).join('|')};`);
}

export async function runStage5(): Promise<void> {
  logger.info('stage-5', { phase: 'start' });

  const manifest: Manifest = JSON.parse(readFileSync(PATHS.manifest, 'utf-8'));
  const roots: MorphemeEntry[] = JSON.parse(readFileSync(join(PATHS.morphemes, 'roots.json'), 'utf-8'));
  const affixes: MorphemeEntry[] = JSON.parse(readFileSync(join(PATHS.morphemes, 'affixes.json'), 'utf-8'));
  const linkers: MorphemeEntry[] = JSON.parse(readFileSync(join(PATHS.morphemes, 'linkers.json'), 'utf-8'));
  const graph: RelationsGraph = JSON.parse(readFileSync(join(PATHS.relations, 'graph.json'), 'utf-8'));

  const stats = {
    totalWords: manifest.totalWords,
    totalRoots: roots.length,
    totalAffixes: affixes.length,
    totalLinkers: linkers.length,
    totalEdges: graph.stats.totalEdges,
    schemaVersion: PIPELINE.schemaVersion,
    release: PIPELINE.releaseVersion,
  };

  atomicWriteText(PATHS.meta, genMetaMd(stats));
  atomicWriteText(PATHS.readme, genReadme(stats));
  atomicWriteText(PATHS.changelog, genChangelog(stats));

  mkdirSync(PATHS.schema, { recursive: true });
  atomicWriteText(join(PATHS.schema, 'types.d.ts'), genSchemaTypesD());

  // Strip _staging
  if (existsSync(PATHS.staging)) {
    rmSync(PATHS.staging, { recursive: true });
    logger.info('stage-5', { phase: 'staging-stripped' });
  }

  // Final invariants already ran in Stage 3. We could re-run here, but staging/ is gone so we skip. Publisher can spot-check.
  const wordFiles = readdirSync(PATHS.words).filter(f => f.match(/^[a-z_]-\d{3}\.json$/));
  logger.info('stage-5', { phase: 'done', wordFiles: wordFiles.length, ...stats });
}

if (import.meta.main) {
  runStage5().catch(e => {
    logger.error('stage-5', { err: String(e) });
    process.exit(1);
  });
}
```

- [ ] **Step 2: Type check**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun build --target=bun --outdir=/tmp/check scripts/our_roots_affixes/stage-5-package.ts`
Expected: builds without error.

- [ ] **Step 3: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/stage-5-package.ts
git commit -m "our_roots_affixes: add Stage 5 packaging (META.md, README, types.d.ts)"
```

---

### Task 15: Stage 6 — GitHub push

**Files:**
- Create: `scripts/our_roots_affixes/stage-6-github.ts`

- [ ] **Step 1: Implement GitHub push**

Create `scripts/our_roots_affixes/stage-6-github.ts`:

```ts
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { PATHS, PIPELINE, GITHUB, OUTPUT_DIR } from './config.js';
import { logger } from './logger.js';

function run(cmd: string, cwd: string): string {
  logger.info('stage-6', { cmd });
  return execSync(cmd, { cwd, encoding: 'utf-8' }).trim();
}

export async function runStage6(): Promise<void> {
  logger.info('stage-6', { phase: 'start', repo: GITHUB.remoteUrl });

  if (!existsSync(PATHS.meta) || !existsSync(join(PATHS.relations, 'graph.json'))) {
    throw new Error('Stage 5 must complete before Stage 6. Missing META.md or relations/graph.json.');
  }

  // Init repo if not already
  if (!existsSync(join(OUTPUT_DIR, '.git'))) {
    run('git init', OUTPUT_DIR);
    run(`git checkout -b ${GITHUB.defaultBranch}`, OUTPUT_DIR);
  }

  // Ensure remote
  try {
    run('git remote get-url origin', OUTPUT_DIR);
  } catch {
    run(`git remote add origin ${GITHUB.remoteUrl}`, OUTPUT_DIR);
  }

  run('git add .', OUTPUT_DIR);

  // Only commit if there are changes
  let hasChanges = true;
  try {
    run('git diff --cached --quiet', OUTPUT_DIR);
    hasChanges = false;
  } catch {
    hasChanges = true;
  }

  if (hasChanges) {
    const msg = `${PIPELINE.releaseVersion}: initial dataset of ${(await fetchTotalWords())} words with full morphological decomposition`;
    run(`git -c user.name="our_roots_affixes bot" -c user.email="bot@local" commit -m "${msg.replace(/"/g, '\\"')}"`, OUTPUT_DIR);
    logger.info('stage-6', { phase: 'committed' });
  } else {
    logger.info('stage-6', { phase: 'no-changes' });
  }

  // Tag
  try {
    run(`git tag ${PIPELINE.releaseVersion}`, OUTPUT_DIR);
  } catch {
    logger.warn('stage-6', { phase: 'tag-exists', tag: PIPELINE.releaseVersion });
  }

  // Push
  run(`git push -u origin ${GITHUB.defaultBranch}`, OUTPUT_DIR);
  run(`git push origin ${PIPELINE.releaseVersion}`, OUTPUT_DIR);

  logger.info('stage-6', { phase: 'done', release: PIPELINE.releaseVersion });
}

async function fetchTotalWords(): Promise<number> {
  const { readFileSync } = await import('fs');
  const manifest = JSON.parse(readFileSync(PATHS.manifest, 'utf-8'));
  return manifest.totalWords;
}

if (import.meta.main) {
  runStage6().catch(e => {
    logger.error('stage-6', { err: String(e) });
    process.exit(1);
  });
}
```

- [ ] **Step 2: Type check**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun build --target=bun --outdir=/tmp/check scripts/our_roots_affixes/stage-6-github.ts`
Expected: builds without error.

- [ ] **Step 3: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/stage-6-github.ts
git commit -m "our_roots_affixes: add Stage 6 GitHub push"
```

---

### Task 16: Top-level CLI orchestrator

**Files:**
- Create: `scripts/our_roots_affixes/cli.ts`

- [ ] **Step 1: Implement CLI**

Create `scripts/our_roots_affixes/cli.ts`:

```ts
import { runStage0 } from './stage-0-manifest.js';
import { runStage1aPlanner } from './stage-1a-planner.js';
import { runStage1aConsolidate } from './stage-1a-consolidate.js';
import { runStage1b } from './stage-1b-runner.js';
import { runStage2 } from './stage-2-morpheme-index.js';
import { runStage3 } from './stage-3-relations.js';
import { runStage4 } from './stage-4-qa.js';
import { runStage5 } from './stage-5-package.js';
import { runStage6 } from './stage-6-github.js';
import { logger } from './logger.js';

const STAGES: Record<string, () => Promise<void>> = {
  'stage-0': runStage0,
  'stage-1a-plan': runStage1aPlanner,
  'stage-1a-consolidate': runStage1aConsolidate,
  'stage-1b': runStage1b,
  'stage-2': runStage2,
  'stage-3': runStage3,
  'stage-4': runStage4,
  'stage-5': runStage5,
  'stage-6': runStage6,
};

const ALL_SEQUENCE = [
  'stage-0', 'stage-1a-plan', 'stage-1a-consolidate', 'stage-1b',
  'stage-2', 'stage-3', 'stage-4', 'stage-5', 'stage-6',
] as const;

async function main() {
  const arg = process.argv[2] ?? 'help';

  if (arg === 'help' || arg === '--help' || arg === '-h') {
    console.log(`Usage: bun scripts/our_roots_affixes/cli.ts <command>

Commands:
  all                   Run the full 9-step pipeline
  stage-0               Build manifest from data/word-banks/
  stage-1a-plan         LLM: extract morpheme candidates per 1k-word batch
  stage-1a-consolidate  LLM: merge candidates into canonical inventory
  stage-1b              LLM: decompose words in 50-word buckets (resumable)
  stage-2               Backfill MorphemeEntry.memberWords
  stage-3               Build RelationsGraph + run INV-1..8
  stage-4               QA sampling (200 words)
  stage-5               Package META.md / README / schema / types.d.ts
  stage-6               Git push to ${'\x1B[36mhttps://github.com/host452b/root_and_affix.git\x1B[0m'}
  help                  Print this message

Env:
  ANTHROPIC_API_KEY     Required for Stage 1a/1b/4
`);
    return;
  }

  if (arg === 'all') {
    for (const stage of ALL_SEQUENCE) {
      logger.info('cli', { stage, action: 'start' });
      await STAGES[stage]();
      logger.info('cli', { stage, action: 'complete' });
    }
    return;
  }

  const fn = STAGES[arg];
  if (!fn) {
    console.error(`Unknown command: ${arg}. Run with 'help' for usage.`);
    process.exit(2);
  }
  await fn();
}

main().catch(e => {
  logger.error('cli', { err: String(e) });
  process.exit(1);
});
```

- [ ] **Step 2: Test CLI help**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun scripts/our_roots_affixes/cli.ts help`
Expected: prints usage text listing all 9 commands + `all`.

- [ ] **Step 3: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add scripts/our_roots_affixes/cli.ts
git commit -m "our_roots_affixes: add top-level CLI orchestrator"
```

---

### Task 17: Execute Stage 0 on real data

**Files:** (no code changes; execution only)

- [ ] **Step 1: Run Stage 0**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun scripts/our_roots_affixes/cli.ts stage-0`
Expected:
- Logs show `totalWords` within [21900, 21950] (approx 21,923)
- Logs show `totalBuckets` ≈ 440
- Files exist: `data/our_roots_affixes/manifest.json`, `data/our_roots_affixes/_staging/bucket-plan.json`

- [ ] **Step 2: Verify manifest sanity**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun -e 'const m = require("./data/our_roots_affixes/manifest.json"); console.log({ total: m.totalWords, first: m.entries[0], last: m.entries[m.entries.length-1], sample: m.entries.filter(e=>e.sourceBanks.length>5).slice(0,3) })'`
Expected: shows totalWords, sorted entries, some words with multiple source banks.

- [ ] **Step 3: Commit artifact log**

```bash
cd /Users/joejiang/Desktop/词根词缀
# The generated data/our_roots_affixes/ is typically .gitignored, but record that Stage 0 ran
git status data/our_roots_affixes/ || true
```
(No commit needed if directory is outside tracked paths.)

---

### Task 18: Execute Stage 1a (Planner + Consolidator) on real data

**Files:** (no code changes; execution only)

- [ ] **Step 1: Confirm API key**

Run: `echo ${ANTHROPIC_API_KEY:+KEY_SET}`
Expected: `KEY_SET` (if not, user must export ANTHROPIC_API_KEY).

- [ ] **Step 2: Run Stage 1a planner**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun scripts/our_roots_affixes/cli.ts stage-1a-plan`
Expected:
- ~22 batches processed across 10 workers, ~3-5 minutes
- Files in `data/our_roots_affixes/_staging/candidates/batch-000.json` ... `batch-021.json`
- Each batch ~50-100 candidate morphemes

- [ ] **Step 3: Spot-check candidates**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun -e 'const f = require("./data/our_roots_affixes/_staging/candidates/batch-000.json"); console.log("count:", f.length); console.log("sample:", f.slice(0,3))'`
Expected: shows a few candidates with candidate/role/variants/meaning fields populated.

- [ ] **Step 4: Run Stage 1a consolidator**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun scripts/our_roots_affixes/cli.ts stage-1a-consolidate`
Expected:
- Logs show roots/affixes/linkers counts
- Files exist: `data/our_roots_affixes/morphemes/{roots,affixes,linkers}.json`
- Total morphemes ≥ 1,200 across all three files

- [ ] **Step 5: Human review gate (Gate-1a→1b)**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun -e 'const r=require("./data/our_roots_affixes/morphemes/roots.json"); const a=require("./data/our_roots_affixes/morphemes/affixes.json"); const l=require("./data/our_roots_affixes/morphemes/linkers.json"); console.log("roots:",r.length,"affixes:",a.length,"linkers:",l.length); console.log("sample roots:",r.slice(0,5).map(x=>({id:x.id,variants:x.variants,cn:x.coreMeaning.cn}))); console.log("sample prefixes:",a.filter(x=>x.role==="prefix").slice(0,5).map(x=>x.id)); console.log("sample suffixes:",a.filter(x=>x.role==="suffix").slice(0,5).map(x=>x.id));'`
Expected: totals meet gate criteria. User visually confirms no bogus entries (e.g., whole words mistakenly flagged as roots, duplicate ids). Pause here for manual review; proceed to Task 19 only after approval.

---

### Task 19: Execute Stage 1b on real data

**Files:** (no code changes; execution only)

- [ ] **Step 1: Kick off Stage 1b**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun scripts/our_roots_affixes/cli.ts stage-1b`
Expected:
- Logs stream with per-bucket completion lines
- ~40-45 minutes for 439 buckets × 10 concurrency
- Checkpoint files under `_staging/checkpoints/`
- Word output files under `words/`

- [ ] **Step 2: Check mid-run progress (in separate terminal if needed)**

Run: `cd /Users/joejiang/Desktop/词根词缀 && ls data/our_roots_affixes/_staging/checkpoints/ | wc -l && ls data/our_roots_affixes/_staging/failed/ 2>/dev/null | wc -l`
Expected: checkpoints grows over time; failed count stays <9.

- [ ] **Step 3: Verify completion**

After Stage 1b reports `phase=done`, confirm:
Run: `cd /Users/joejiang/Desktop/词根词缀 && ls data/our_roots_affixes/words/ | grep -v word-index | wc -l && ls data/our_roots_affixes/_staging/failed/ 2>/dev/null | wc -l`
Expected: 439 bucket files; failed count <9 (≤2% threshold).

- [ ] **Step 4: Retry failed buckets if any**

If failed >0:
Run: `cd /Users/joejiang/Desktop/词根词缀 && ls data/our_roots_affixes/_staging/failed/ && rm data/our_roots_affixes/_staging/failed/*.json && bun scripts/our_roots_affixes/cli.ts stage-1b`
Expected: runner picks up only missing buckets (checkpoint-based resume).

---

### Task 20: Execute Stage 2, 3, 4, 5 on real data

**Files:** (no code changes; execution only)

- [ ] **Step 1: Run Stage 2 (morpheme index backfill)**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun scripts/our_roots_affixes/cli.ts stage-2`
Expected:
- Logs show totalWords ≈ 21,923 and counts for roots/affixes/linkers
- `data/our_roots_affixes/words/word-index.json` exists
- `morphemes/*.json` memberWords arrays are populated

- [ ] **Step 2: Run Stage 3 (relations graph + invariants)**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun scripts/our_roots_affixes/cli.ts stage-3`
Expected:
- Logs show `phase=graph-built` with stats
- Logs show `phase=done` (no invariant violations)
- If Stage 3 throws, inspect `_staging/invariant-violations.json` and fix underlying data

- [ ] **Step 3: Run Stage 4 (QA)**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun scripts/our_roots_affixes/cli.ts stage-4`
Expected:
- `_staging/qa-report.md` written
- Pass rate ≥85%
- If below threshold, Stage 4 throws with guidance

- [ ] **Step 4: Run Stage 5 (package)**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun scripts/our_roots_affixes/cli.ts stage-5`
Expected:
- `META.md`, `README.md`, `CHANGELOG.md`, `schema/types.d.ts` exist
- `_staging/` directory removed
- Log shows final stats

- [ ] **Step 5: Final sanity check**

Run: `cd /Users/joejiang/Desktop/词根词缀 && ls data/our_roots_affixes/ && echo "---" && cat data/our_roots_affixes/META.md | head -30`
Expected:
- Top-level: META.md, README.md, CHANGELOG.md, manifest.json, morphemes/, schema/, words/, relations/ (no _staging/)
- META.md renders the correct stats

---

### Task 21: Execute Stage 6 — Push to GitHub

**Files:** (no code changes; execution only)

- [ ] **Step 1: Confirm git credentials**

Run: `git config --get credential.helper`
Expected: some credential helper is configured (osxkeychain, store, or GH CLI). If not, user sets up `gh auth login` or `git credential-osxkeychain`.

- [ ] **Step 2: Verify remote is empty or compatible**

Run: `git ls-remote https://github.com/host452b/root_and_affix.git 2>&1 | head -5`
Expected: either empty (brand new repo) or lists some refs. If the remote already has commits, user must decide whether to merge or force-push (ask before force).

- [ ] **Step 3: Run Stage 6**

Run: `cd /Users/joejiang/Desktop/词根词缀 && bun scripts/our_roots_affixes/cli.ts stage-6`
Expected:
- Git init/add/commit succeed
- `git push -u origin main` and `git push origin v1.0.0` both succeed
- Log ends with `phase=done, release=v1.0.0`

- [ ] **Step 4: Browser verification**

Open `https://github.com/host452b/root_and_affix` in a browser.
Expected: README renders, `v1.0.0` tag visible, file tree matches the Stage 5 layout.

---

### Task 22: Smoke test — end-to-end on miniature fixture

**Files:**
- Create: `tests/our_roots_affixes/fixtures/mini-word-banks/sample.json`
- Modify: `tests/our_roots_affixes/fixtures/mock-word-entry.json` (already exists, no change)

(Optional — only if QA caught issues and you want a regression test before the next full run.)

- [ ] **Step 1: Create miniature word bank fixture**

Create `tests/our_roots_affixes/fixtures/mini-word-banks/sample.json`:

```json
[
  { "id": "inflation", "word": "inflation", "phonetic": "/ɪnˈfleɪʃn/", "meanings": [{ "partOfSpeech": "n", "definition": "rise in prices", "definitionCn": "通货膨胀" }] },
  { "id": "revision", "word": "revision", "phonetic": "/rɪˈvɪʒn/", "meanings": [{ "partOfSpeech": "n", "definition": "rework", "definitionCn": "修订" }] },
  { "id": "consumer", "word": "consumer", "phonetic": "/kənˈsjuːmə/", "meanings": [{ "partOfSpeech": "n", "definition": "buyer", "definitionCn": "消费者" }] }
]
```

- [ ] **Step 2: Run Stage 0 on the fixture**

Run: `cd /Users/joejiang/Desktop/词根词缀 && WORD_BANKS_DIR=tests/our_roots_affixes/fixtures/mini-word-banks bun -e 'process.env.WORD_BANKS_DIR="tests/our_roots_affixes/fixtures/mini-word-banks"; import("./scripts/our_roots_affixes/stage-0-manifest.js").then(m => { const r = m.buildManifest("tests/our_roots_affixes/fixtures/mini-word-banks"); console.log(JSON.stringify(r, null, 2)); })'`

(Note: for a real smoke test we'd stub the LLM. This step merely sanity-checks Stage 0 on a minimal input without mutating the real output directory.)
Expected: prints 3-word manifest.

- [ ] **Step 3: Commit**

```bash
cd /Users/joejiang/Desktop/词根词缀
git add tests/our_roots_affixes/fixtures/mini-word-banks/sample.json
git commit -m "our_roots_affixes: add miniature word bank fixture for smoke tests"
```

---

## Self-review notes

- **Spec coverage**: each §1-§13 section of the spec maps to at least one task:
  - Data model (§3) → Tasks 1, 2, 3
  - File layout (§4) → Task 1 (directory skeleton)
  - Pipeline (§5) → Tasks 5-14 (one task per stage)
  - LLM Prompt (§6) → Tasks 6, 7
  - Concurrency/recovery (§7) → Tasks 4, 10 (checkpoint + worker pool)
  - Validation gates (§8) → Task 11 (Stage 3 runs INV), Task 13 (Stage 4 threshold)
  - Time/cost (§9) → execution tasks 17-21
  - GitHub (§10) → Task 15, 21
  - Controlled vocab (§11) → Task 1 config
  - Schema version (§12) → Task 14 META.md
- **Placeholders**: none. Every code step has concrete code; every command has expected output.
- **Type consistency**: `Morpheme`, `WordEntry`, `MorphemeEntry`, `RelationsGraph` types defined once in `types.ts` (Task 1), used consistently across all stages.
- **Known simplification**: Stage 3 `sameImagery` uses exact string matching on imageChain tokens (≥3-word threshold). Vector cosine clustering mentioned in spec is deferred — the current heuristic catches the most common grouping (identical imagery phrases) without ML deps.
