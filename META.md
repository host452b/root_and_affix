# data/our_roots_affixes — 数据包 META

版本: **v1.0.0**
Schema: **1.0**
生成时间: 2026-04-19T03:29:40.369Z

---

## 1. 版本与兼容性

- 当前 schema 版本：`1.0`
- 破坏性变更触发主版本号递增
- 添加非必填字段触发次版本号递增
- 变更日志见 `CHANGELOG.md`

## 2. 三类对象总览

```
          ┌─────────────────┐
          │   WordEntry     │ morphemes[].canonical
          │  ( 96434 条)│─────────────────┐
          │  words/*.json   │                 │
          └────────┬────────┘                 │
                   │                          ▼
                   │ relations.*    ┌─────────────────┐
                   │ (冗余快速查)    │  MorphemeEntry  │
                   │                │  (  8145 条)│
                   │                │  morphemes/*.json │
                   │                └────────┬────────┘
                   │                         │ memberWords[]
                   ▼                         ▼
          ┌─────────────────────────────────────────┐
          │         RelationsGraph                  │
          │  relations/graph.json  ( 74816 条边)│
          └─────────────────────────────────────────┘
```

## 3. WordEntry 字段

存放路径: `words/<bucket>.json` (50 词/桶)

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| word | string | ✓ | 英文小写 |
| phonetic | string | ✓ | IPA 音标 |
| pos | string[] | ✓ | 词性标签 |
| coreMeaning[] | object[] | ✓ | 核心义项（覆盖 80% 场景） |
| morphemes[] | Morpheme[] | ✓ | 按出现顺序的形素数组 |
| derivationChain | string[] | ✓ | 形态派生链 |
| morphVariantOf | string|null | ✓ | 若是拼写变体指向规范形 |
| memorySemantics | object | ✓ | literal / imageChain / mnemonicExpr |
| wordLevel | object | ✓ | 整词情感/语域/正式度 |
| relations | object | ✓ | 同根/同缀/同义等 8 类边（冗余快速查） |

### Morpheme 子对象

| 字段 | 类型 | 枚举 |
|---|---|---|
| role | string | prefix \| root \| suffix \| linker \| variant |
| positionTendency | string | initial \| medial \| final |
| canonical | string | MUST ∈ MorphemeEntry.id |
| sentiment.tags | string[] | 受控 (见 §7) |

## 4. MorphemeEntry 字段

存放路径: `morphemes/roots.json`, `morphemes/affixes.json`, `morphemes/linkers.json`

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

存放路径: `relations/graph.json`

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
- INV-3: WordEntry.relations.sameRoot ⊆ MorphemeEntry(root).memberWords \ {self}
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

`prefix | root | suffix | linker | variant`

### 7.3 positionTendency

`initial | medial | final`

### 7.4 domain

`general | academic | business | economics | finance | legal | medical | news | tech | cybersec | editorial`

## 8. 变更流程

1. 修改 schema 前先更新本 META 文件
2. 升级版本号（若破坏性变更）
3. 写 migration 脚本（若需要）
4. 在 `CHANGELOG.md` 记录变更
5. Stage 5 打包时再跑一次 INV-1..8 全量校验
