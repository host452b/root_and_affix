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
