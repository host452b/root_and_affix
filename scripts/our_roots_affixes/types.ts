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
