---
title: 英语词汇词根词缀拆解数据库 — 设计文档
date: 2026-04-17
status: draft
version: 1.0
owner: joejiang@nvidia.com
repo_target: https://github.com/host452b/root_and_affix.git
---

# 英语词汇词根词缀拆解数据库 — 设计文档

## 1. 背景与动机

项目现有 17 个英语词库（gre/ielts/toefl/...），总计 43,882 条词条（去重后 21,923 唯一词）。现有 `morphology`/`etymology` 字段覆盖率分别为 40% / 59%，且结构粗糙，缺少三个关键维度：**情感倾向、位置倾向、跨词关联映射**。

本项目的目标是**独立生产一套全新的结构化数据**，不依赖、不修改现有任何词库文件，产出独立数据包 `data/our_roots_affixes/`，作为词根词缀记忆训练的基础数据层。

## 2. 目标与非目标

### 目标
- 对全量 21,923 个去重唯一词做完整拆解
- 每个词拆解为 **词根 / 词缀 / 词中间体** 三类成分
- 每个成分标注 **核心意义 / 情感倾向 / 位置倾向** 三个属性
- 建立 10 类 **关联映射关系** 的全局图（词-词 8 类 + 形素-形素 4 类）
- 产出机器可校验的 schema、人类可读的 META 文档
- 工作完成后推送到 `https://github.com/host452b/root_and_affix.git`

### 非目标
- **不修改** `data/word-banks/` 下任何文件
- **不依赖** `data/roots-affixes/` 和 `data/etymology/` 的既有数据
- **不集成**进 Flipword extension 前端（本期只产数据）
- 不做音频、图像、例句生成

## 3. 数据模型

### 3.1 三类对象总览

```
          ┌─────────────────┐
          │   WordEntry     │  morphemes[].canonical
          │  (21,923 条)    │─────────────────┐
          │  words/*.json   │                 │
          └────────┬────────┘                 │
                   │                          ▼
                   │ relations.*    ┌─────────────────┐
                   │ (冗余快速查)    │  MorphemeEntry  │
                   │                │  (~1,800 条)    │
                   │                │  morphemes/*.json │
                   │                └────────┬────────┘
                   │                         │ memberWords[]
                   │                         │ (回指词)
                   ▼                         ▼
          ┌─────────────────────────────────────────┐
          │         RelationsGraph                  │
          │  (自动从 Word + Morpheme 推导)          │
          │  relations/graph.json                   │
          └─────────────────────────────────────────┘
```

### 3.2 WordEntry

```jsonc
{
  "word": "inflation",
  "phonetic": "/ɪnˈfleɪʃn/",
  "pos": ["n."],
  "coreMeaning": [
    { "cn": "通货膨胀", "domain": "economics", "coverage": 0.8 }
  ],

  "morphemes": [
    {
      "order": 1,
      "form": "in-",
      "role": "prefix",                 // prefix | root | suffix | linker | variant
      "canonical": "in-",               // 必须对齐到 MorphemeEntry.id
      "coreMeaning": { "cn": "进入；使…", "en": "into / to cause" },
      "sentiment": { "tags": ["中性"], "intensity": 0 },
      "positionTendency": "initial",    // initial | medial | final
      "etymology": "Latin in-"
    },
    {
      "order": 2,
      "form": "flat",
      "role": "root",
      "canonical": "flat",
      "variantOf": null,
      "coreMeaning": { "cn": "吹、膨胀", "en": "to blow" },
      "sentiment": { "tags": ["中性"], "intensity": 0 },
      "positionTendency": "medial",
      "etymology": "Latin flare 吹"
    },
    {
      "order": 3,
      "form": "-ion",
      "role": "suffix",
      "canonical": "-ion",
      "coreMeaning": { "cn": "名词化", "grammatical": true },
      "sentiment": { "tags": ["中性"], "intensity": 0 },
      "positionTendency": "final"
    }
    // 词中间体示例: { "form": "-e-", "role": "linker", "note": "连接元音，无独立词义" }
  ],

  "derivationChain": ["flat", "inflate", "inflation"],
  "morphVariantOf": null,               // 若是拼写变体则指向规范形，如 "analyse" → "analyze"

  "memorySemantics": {
    "literal": "吹气使膨胀",
    "imageChain": ["吹气使膨胀", "不断吹大", "通货膨胀"],
    "mnemonicExpr": "in (进入) + flat (吹膨) + ion → 不断吹大 → 通胀"
  },

  "wordLevel": {
    "sentiment": { "tags": ["贬义", "担忧", "偏负"], "intensity": 0.7 },
    "domain": ["economics", "finance", "news"],
    "registerFormality": "formal"
  },

  "relations": {
    "sameRoot":       ["inflate", "deflate", "flatulence"],
    "sameAffix":      [
      { "affix": "in-",  "members": ["input", "invest"] },
      { "affix": "-ion", "members": ["revision", "opinion"] }
    ],
    "synonyms":       ["price rise"],
    "antonyms":       ["deflation"],
    "domainCohort":   ["consumer", "economy", "estimate"],
    "derivationPair": ["inflate"],
    "morphVariants":  [],
    "sameImagery":    ["deflate", "balloon"]
  }
}
```

### 3.3 MorphemeEntry

```jsonc
{
  "id": "vis",                             // stable key
  "canonical": "vis",
  "role": "root",                          // root | prefix | suffix | linker
  "variants": ["vid", "vise", "view"],
  "coreMeaning": { "cn": "看", "en": "to see" },
  "sentiment": { "tags": ["中性"], "intensity": 0 },
  "positionTendency": "medial",
  "etymology": "Latin videre 看",
  "memberWords": ["vision", "revise", "previous", "provision", ...],
  "synonymMorphemes": ["spec", "spect"],
  "antonymMorphemes": []
}
```

**Linker 样例**（词中间体，字段最简）：

```jsonc
{
  "id": "-e-",
  "role": "linker",
  "note": "连接元音，无独立词义",
  "positionTendency": "medial",
  "memberWords": ["consumer", "producer", "writer", ...]
}
```

### 3.4 RelationsGraph

```jsonc
{
  "version": "1.0",
  "stats": {
    "totalWords": 21923,
    "totalMorphemes": 1800,
    "totalEdges": 87234
  },
  "edges": {
    // —— 词-词 8 类 ——
    "sameRoot":       [ { "root": "vis", "members": ["vision","revise",...] }, ... ],
    "sameAffix":      [ { "affix": "pre-", "members": ["prevent","preview",...] }, ... ],
    "synonyms":       [ ["inflation","price rise"], ... ],
    "antonyms":       [ ["inflation","deflation"], ... ],
    "domainCohort":   [ { "domain": "economics", "members": [...] }, ... ],
    "derivationPair": [ ["inflate","inflation"], ... ],
    "morphVariants":  [ ["analyse","analyze"], ... ],
    "sameImagery":    [ { "image": "吹气膨胀", "members": [...] }, ... ],

    // —— 形素-形素 4 类 ——
    "affixSynonyms":  [ { "affix": "in-", "synonyms": ["en-","im-"] }, ... ],
    "affixAntonyms":  [ { "affix": "in-(进入)", "antonyms": ["de-","ex-"] }, ... ],
    "rootVariants":   [ { "root": "flat", "variants": ["flate","flatu-"] }, ... ],
    "rootSynonyms":   [ { "root": "flat(吹)", "synonyms": ["spir(呼吸)",...] }, ... ]
  }
}
```

### 3.5 不变式（INV-1..8）

INV-1: `∀ WordEntry.morphemes[i].canonical ⇒ ∃ MorphemeEntry.id == canonical`
INV-2: `∀ MorphemeEntry.memberWords[j] ⇒ ∃ WordEntry.word == memberWords[j]`
INV-3: `WordEntry.relations.sameRoot ⊆ MorphemeEntry(root).memberWords \ {self}`
INV-4: `RelationsGraph.edges.* 任意一条边两端都在 WordEntry / MorphemeEntry 集合内`
INV-5: `MorphemeEntry.variants ∩ MorphemeEntry.id == ∅（变体不独立建 entry）`
INV-6: `sentiment.tags ⊆ 受控词表（见 §11）`
INV-7: `positionTendency ∈ {"initial","medial","final"}`
INV-8: `role ∈ {"prefix","root","suffix","linker","variant"}`

## 4. 文件布局

```
data/our_roots_affixes/
├── META.md                          ← schema 定义 + 引用关系 + 不变式 + 版本
├── README.md
├── CHANGELOG.md
├── manifest.json                    ← 21,923 词清单 + 来源映射 + 版本号
│
├── schema/                          ← 机器校验器
│   ├── word-entry.schema.json
│   ├── morpheme-entry.schema.json
│   ├── relations-graph.schema.json
│   └── types.d.ts
│
├── morphemes/                       ← 形素层（Phase A 产物）
│   ├── roots.json                   ← ~1,200 条
│   ├── affixes.json                 ← ~400 条（前后缀分字段）
│   └── linkers.json                 ← ~50 条
│
├── words/                           ← 词层（Phase B 产物）
│   ├── a-001.json … z-015.json      ← 50 词/桶 × 439 桶
│   └── word-index.json              ← word → bucket 反查表
│
├── relations/
│   └── graph.json                   ← 10 类关联边聚合图
│
└── _staging/                        ← 生成期中间产物（发布时剥离）
    ├── candidates/
    ├── checkpoints/
    └── failed/
```

## 5. 生成流水线

### 5.1 总览

7 个 stage，共 468 个任务（不含人工 review 环节）：

| 阶段 | 任务数 | 类型 | 耗时（10 并发） |
|---|---|---|---|
| Stage 0: Manifest 构建 | 1 | 自动 | <1 分钟 |
| Stage 1a: 形素规划（Phase A） | 23 | LLM | ~5 分钟 |
| — Gate-1a→1b: 人工 review | — | 人工 | 3-5 分钟 |
| **Stage 1b: 词拆解（Phase B）** | **439** | **LLM** | **~40 分钟** |
| Stage 2: 形素索引回填 | 1 | 自动 | <1 分钟 |
| Stage 3: 关联映射构建 + INV 校验 | 1 | 自动 | <1 分钟 |
| Stage 4: 抽样 QA | 1 | LLM | ~3 分钟 |
| Stage 5: 打包（META / README / schema / version）| 1 | 自动 | <1 分钟 |
| Stage 6: GitHub 推送 | 1 | 自动 | ~1 分钟 |
| **合计** | **468** | | **~56 分钟** |

### 5.2 Stage 细节

**Stage 0 — Manifest 构建**：
扫 `data/word-banks/*.json` → 提取 word + phonetic + definitionCn → 跨库 dedup → 产出 `manifest.json`（含 sourceBanks 字段）→ 按字母分桶，每桶 50 词，共 439 桶，写 `_staging/bucket-plan.json`。

**Stage 1a — 形素规划**：
输入：全量 21,923 词，分 22 批（1000 词/批）。
对每批调 LLM，抽候选形素（role 粗标）。
所有批完成后跑 1 次合并批：合并变体、定 canonical、按 role 分到 roots/affixes/linkers。
产出：`morphemes/{roots,affixes,linkers}.json` 骨架（memberWords 为空）+ 变体映射表。
**Gate-1a→1b**：人工 review 形素清单，需要 ≥1,200 条 + 四类非空 + 无 id 冲突。

**Stage 1b — 词拆解**：
输入：439 批 × 50 词，每批 prompt 包含：
- L0 System prompt（~2k tok，缓存）
- L1 Schema + 受控词表（~3k tok，缓存）
- L2 形素清单（~5k tok，缓存）
- L3 3 个 few-shot 示例（~5k tok，缓存）
- L4 本批 50 词输入（~2k tok，不缓存）

输出：50 个 WordEntry → `words/<bucket>.json`。
并发 10 条 Opus 4.7。

**Stage 2 — 形素索引回填**：
扫所有 `words/*.json` → 按 `morphemes[].canonical` 聚合 → 填 `MorphemeEntry.memberWords[]`。

**Stage 3 — 关联映射构建**：
10 类边自动从 WordEntry + MorphemeEntry 推导（推导规则见 §5.3）。完成后跑 INV-1..8。

**Stage 4 — 抽样 QA**：
随机抽 200 词，独立 LLM 审查员打分（morpheme 拆解正确性、sentiment 合理性、记忆链通顺度）。产出 QA 报告。阈值 85%。

**Stage 5 — 打包发布**：
剥离 `_staging/` → 写 META.md / README / CHANGELOG / schema/ → 打 v1.0.0 版本号。

### 5.3 10 类关联边的推导规则

| 边类型 | 推导逻辑 |
|---|---|
| `sameRoot` | GROUP BY `MorphemeEntry.id WHERE role='root'` → `memberWords[]` |
| `sameAffix` | GROUP BY `MorphemeEntry.id WHERE role∈{prefix,suffix}` → `memberWords[]` |
| `synonyms` | UNION ALL `WordEntry.relations.synonyms`（双向化、去重） |
| `antonyms` | UNION ALL `WordEntry.relations.antonyms`（双向化、去重） |
| `domainCohort` | GROUP BY `WordEntry.wordLevel.domain[*]` → words |
| `derivationPair` | 对每个 `WordEntry.derivationChain`，取相邻二元组 |
| `morphVariants` | 从 `WordEntry.morphVariantOf` 字段聚合（拼写变体如 analyse/analyze） |
| `sameImagery` | `imageChain` 向量化 + 余弦聚类（阈值 0.85），每簇 ≥3 词入图 |
| `affixSynonyms` | 直接取自 `MorphemeEntry.synonymMorphemes WHERE role∈{prefix,suffix}` |
| `affixAntonyms` | 直接取自 `MorphemeEntry.antonymMorphemes WHERE role∈{prefix,suffix}` |
| `rootVariants` | 直接取自 `MorphemeEntry.variants WHERE role='root'` |
| `rootSynonyms` | 直接取自 `MorphemeEntry.synonymMorphemes WHERE role='root'` |

## 6. LLM Prompt 策略

### 6.1 Prompt 分层缓存

每个 Stage 1b 调用的 Prompt 分 5 层：

| 层 | 内容 | tokens | 缓存 |
|---|---|---|---|
| L0 System | 角色设定 + 输出纪律 + 仅 JSON | ~2k | ✓ |
| L1 Schema & 受控词表 | WordEntry JSON Schema + 情感/role/position/domain 词表 | ~3k | ✓ |
| L2 形素清单 | Stage 1a 产物：canonical + 变体 + 义项 | ~5k | ✓ |
| L3 Few-shot | 3 个 WordEntry 完整示例 | ~5k | ✓ |
| L4 本批输入 | 50 词 { word, phonetic, definitionCn, sources } | ~2k | ✗ |

L0-L3 共 ~15k tok 全部 `cache_control: ephemeral`，439 次调用共享。

### 6.2 输出校验与重试

```
LLM → JSON.parse → AJV schema 校验 → 业务规则校验 → 形素拼接一致性（warn）→ 写入
         ↓ fail            ↓ fail              ↓ fail
       retry ≤3           retry ≤3            retry ≤3
         ↓ 持续失败                             ↓
       _staging/failed/<bucket>.json ← 人工 review
```

业务规则校验：
- 50 个 entry 一一对应输入
- `morphemes[].canonical` 都在 Stage 1a 清单里
- `sentiment.tags`、`positionTendency`、`role` 都在受控词表

## 7. 并发与失败恢复

### 7.1 Worker 池

10 条并发（Opus 4.7 Tier 50 RPM，留 40% 余量）。
Coordinator 从 `_staging/bucket-plan.json` 派发任务，Worker 独立请求 Anthropic API，共享 cache prefix。

### 7.2 Checkpoint / Resume

每批完成后原子写：
- `words/<bucket>.json`（最终产物）
- `_staging/checkpoints/<bucket>.done.json`（`{bucketId, timestamp, tokens, hash}`）

Resume：扫 checkpoints → 未完成的桶重新入队。**幂等，可中断无限次**。

### 7.3 错误隔离

每桶独立，互不阻塞。3 次 retry 仍失败 → `_staging/failed/`，全部跑完后人工 review。

### 7.4 监控日志格式

```
[12:30:45.267] INFO  worker-3  bucket=a-004 status=start
[12:30:50.891] INFO  worker-3  bucket=a-004 status=done duration=5.6s tok_in=1920 tok_out=38750 cache_hit=true
[12:30:51.120] WARN  worker-7  bucket=b-002 status=retry attempt=2 reason=schema_validation:morphemes[3].canonical not in inventory
```

## 8. 验证门与发布流程

| 门 | 条件 | 失败处理 |
|---|---|---|
| Gate-0→1a | manifest.json 存在、21,923 行、无重复 | 重跑 Stage 0 |
| **Gate-1a→1b** | 形素清单 ≥1,200 条、四类非空、无 id 冲突 | 人工抽查 + 必要时手工编辑清单 |
| Gate-1b→2 | 439/439 桶完成，失败率 <2% | ≥9 桶失败：针对性重跑 |
| Gate-2→3 | roots+affixes+linkers 无 id 冲突、memberWords 去重 | 重跑 Stage 2 |
| Gate-3→4 | **INV-1..8 全通过** | 修复违反的不变式 |
| **Gate-4→5** | QA 通过率 **≥85%** | <85%：定位异常桶、重跑 Stage 1b |
| Gate-5→发布 | INV-1..8 再跑一次 + schema/ 下 JSON Schema 通过 | 重跑 Stage 5 |

## 9. 时间与成本

### 9.1 时间表（理想情况，无 retry）

```
00:00  Stage 0 start
00:01  Stage 0 done → Stage 1a start
00:06  Stage 1a done → ── Gate-1a→1b 人工 review 3-5 分钟 ──
00:10  Stage 1b start
00:50  Stage 1b done → Stage 2/3 ≈ 1 分钟
00:52  Stage 4 QA start
00:55  Stage 4 done → Stage 5 打包
00:56  Stage 5 done → Stage 6 GitHub push
00:57  v1.0.0 上线到 github.com/host452b/root_and_affix
───────────────────────────────────
总计约 57 分钟（含人工 review 3-5 分钟）
```

### 9.2 成本估算（Claude Opus 4.7，$15 input / $75 output / M）

| 项目 | 成本 |
|---|---|
| Stage 1a（22 规划 + 1 合并） | ~$75 |
| Stage 1b（439 批 × 50 词） | ~$1,373 |
| Stage 4 QA | ~$10 |
| **合计** | **~$1,460** |

## 10. GitHub 发布

Stage 5 打包完成后，执行 Stage 6（独立步骤，非数据生成）：

```bash
# Stage 6: GitHub 发布
cd data/our_roots_affixes/
git init
git remote add origin https://github.com/host452b/root_and_affix.git
git add .
git commit -m "v1.0.0: initial dataset of 21,923 words with full morphological decomposition"
git tag v1.0.0
git push -u origin main --tags
```

**Release 内容**：
- 完整 `data/our_roots_affixes/` 目录（已剥离 `_staging/`）
- GitHub Release 页附 `CHANGELOG.md` + 数据统计摘要
- README 含使用示例（如何加载 word-index.json 查一个词、如何通过 graph.json 查同根词）

**不推送** `_staging/`、失败日志、token 凭据。

## 11. 受控词表

### 11.1 情感标签 `sentiment.tags`（可多选）

| 轴 | 标签 |
|---|---|
| 好坏 | 褒义 / 贬义 / 中性 / 混合 |
| 喜恶 | 喜爱 / 厌恶 / 讨厌 / 中立 |
| 偏向 | 偏正 / 偏负 / 中立 |
| 情绪色 | 担忧 / 乐观 / 讽刺 / 庄重 / 轻佻 |

### 11.2 形素 role

`prefix | root | suffix | linker | variant`

### 11.3 物理位置 `positionTendency`

`initial | medial | final`

### 11.4 domain（WordEntry.wordLevel.domain 与 coreMeaning.domain）

`general | academic | business | economics | finance | legal | medical | news | tech | cybersec | editorial`

## 12. Schema 版本与兼容性

- 当前版本：**v1.0**
- 破坏性变更 → 主版本号 +1（如 v2.0）
- 加字段不破坏 → 次版本号 +1（如 v1.1）
- META.md 第 1 节维护完整变更日志

## 13. 未解决问题 / Future work

- Flipword extension 前端集成（本期不做）
- 更细粒度的 domain 分类（当前 11 类偏粗）
- 增量更新机制（新词加入时只跑该词，不重跑全量）
- 多语言扩展（当前仅中英双语解释）

## 14. 相关文档

- `data/our_roots_affixes/META.md` — 数据包 schema 说明（本 spec 落地后产出）
- 实施计划：`docs/superpowers/plans/`（本 spec 批准后通过 writing-plans 生成）
