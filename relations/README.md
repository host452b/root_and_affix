# relations/graph.json

## 主要作用

`graph.json` 是整个数据集的**关系索引层**。

`words/*.json` 存的是单个词条的完整信息，但如果你想问"所有含词根 `vis` 的词有哪些"、"和 `vivid` 同义的词是什么"，就需要跨词条聚合。`graph.json` 把这类关系预先算好，存成可直接查询的边列表，避免每次都扫全量词文件。

`words/*.json` 中的 `relations` 字段是同一信息的**词级冗余副本**（按词查），`graph.json` 是**形素/关系类型级视图**（按关系类型查）。

---

## 顶层结构

```json
{
  "version": "1.0",
  "stats": {
    "totalWords":     53505,   // Stage 2 聚合的 WordEntry 数
    "totalMorphemes": 8148,    // 形素总数（roots + affixes + linkers）
    "totalEdges":     120881   // 所有类型边的总条数
  },
  "edges": { ... }             // 12 类边，见下方
}
```

---

## 12 类边详解

### 1. `sameRoot` — 同词根词族

> 来源：按 `MorphemeEntry(role=root).id` 分组 → memberWords

```json
{ "root": "vis", "members": ["vision", "revise", "visible", "visor"] }
```

同一个词根下的所有词，用于"词根家族"展示和同根词推荐。

---

### 2. `sameAffix` — 同词缀词族

> 来源：按 `MorphemeEntry(role∈prefix,suffix).id` 分组 → memberWords

```json
{ "affix": "re-", "members": ["rebuild", "recall", "reform", "renew"] }
```

共享同一前缀或后缀的所有词，用于词缀教学和批量记忆。

---

### 3. `synonyms` — 近义词对

> 来源：UNION ALL WordEntry.relations.synonyms，双向去重

```json
["abhor", "abominate"]
["vivid", "vibrant"]
```

每条是一个无向词对。一个词可出现在多条记录中。

---

### 4. `antonyms` — 反义词对

> 来源：UNION ALL WordEntry.relations.antonyms，双向去重

```json
["-ful", "-less"]
["optimistic", "pessimistic"]
```

结构同 synonyms，表示语义反向关系。

---

### 5. `domainCohort` — 同领域词群

> 来源：按 WordEntry.wordLevel.domain 分组，≥2 词才收录

```json
{ "domain": "medical", "members": ["diagnosis", "prognosis", "symptom", "etiology"] }
{ "domain": "legal",   "members": ["tort", "plaintiff", "indictment", "subpoena"] }
```

同一专业领域的词聚合，用于专项词汇分类学习。

---

### 6. `derivationPair` — 派生对

> 来源：WordEntry.derivationChain 相邻二元组

```json
["sign", "signal"]
["nation", "national"]
```

派生链上相邻的两个形式，表示"A 派生自 B"或"A → B"的直接演变关系。

---

### 7. `morphVariants` — 拼写变体对

> 来源：WordEntry.morphVariantOf → 规范形

```json
["colour", "color"]
["centre", "center"]
```

同一词的不同拼写，或同一形素的异体写法。

---

### 8. `sameImagery` — 共享意象词群

> 来源：按 WordEntry.memorySemantics.imageChain 关键词分组，≥3 词才收录

```json
{ "image": "光", "members": ["lucid", "illuminate", "luminous", "elucidate"] }
{ "image": "水流", "members": ["fluent", "flux", "fluctuate", "influx"] }
```

共享同一联想意象的词，用于意象记忆法（将词串联成画面）。

---

### 9. `affixSynonyms` — 同义词缀对

> 来源：MorphemeEntry(role=prefix/suffix).synonymMorphemes

```json
["pre-", "ante-"]
["sub-", "hypo-"]
```

语义相近的词缀对，用于词缀辨析。（当前数据集暂无填充）

---

### 10. `affixAntonyms` — 反义词缀对

> 来源：MorphemeEntry(role=prefix/suffix).antonymMorphemes

```json
["pre-", "post-"]
["hyper-", "hypo-"]
```

语义反向的词缀对。（当前数据集暂无填充）

---

### 11. `rootVariants` — 词根变体

> 来源：MorphemeEntry(role=root).variants

```json
{ "root": "-phob", "variants": ["phobe", "phobia", "phobic"] }
{ "root": "scrib",  "variants": ["script", "scrip"] }
```

同一词根在不同词中的拼写变形，用于识别词根的"伪装"形式。

---

### 12. `rootSynonyms` — 同义词根

> 来源：MorphemeEntry(role=root).synonymMorphemes

```json
{ "root": "vid", "synonyms": ["vis", "spec", "opt"] }  // 都含"看"的意思
```

语义相近的不同词根，帮助建立跨词根的语义网络。（当前数据集暂无填充）

---

## 生成规则

`graph.json` 由 `stage-3-relations.ts` 从以下来源聚合生成：

| 边类型 | 数据来源 |
|---|---|
| sameRoot / sameAffix | `morphemes/roots.json` + `morphemes/affixes.json` 的 `memberWords` |
| synonyms / antonyms | 每条 `WordEntry.relations.synonyms/antonyms` 双向合并去重 |
| domainCohort | `WordEntry.wordLevel.domain` 分组 |
| derivationPair | `WordEntry.derivationChain[]` 相邻二元组 |
| morphVariants | `WordEntry.morphVariantOf` 指针 |
| sameImagery | `WordEntry.memorySemantics.imageChain` 关键词分组 |
| affixSynonyms/Antonyms | `MorphemeEntry.synonymMorphemes/antonymMorphemes` |
| rootVariants | `MorphemeEntry.variants` |
| rootSynonyms | `MorphemeEntry.synonymMorphemes` |

每次重跑 Stage 3 会完整重建此文件，**不做增量更新**。

---

## 查询示例（TypeScript）

```ts
import graph from './graph.json' assert { type: 'json' };

// 查某个词根的所有词族成员
const family = graph.edges.sameRoot.find(e => e.root === 'vis')?.members;
// → ["vision", "revise", "visible", "visor", ...]

// 查含 re- 前缀的所有词
const reWords = graph.edges.sameAffix.find(e => e.affix === 're-')?.members;

// 查某词的近义词（需要先找到包含该词的词对）
const synPairs = graph.edges.synonyms.filter(([a, b]) => a === 'vivid' || b === 'vivid');

// 查某领域所有词
const medWords = graph.edges.domainCohort.find(e => e.domain === 'medical')?.members;
```
