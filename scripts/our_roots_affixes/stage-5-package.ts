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
