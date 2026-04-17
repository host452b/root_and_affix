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
