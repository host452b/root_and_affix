# our_roots_affixes

独立构建的英语词汇词根词缀数据库，覆盖 GRE / IELTS / TOEFL / SAT / GMAT / CET4 / Academic / Medical / Legal / Finance / Tech 等主流词库。

| 指标 | 数值 |
|------|------|
| manifest 词量 | **96,434** |
| 已分析词条（WordEntry） | **52,030** |
| 形素（词根+词缀+连接词） | **8,148** |
| 关系图边数（12 类） | **118,718** |
| 词桶数 | **1,497** |
| 版本 | **v1.0.0** |
| Schema | **1.0** |

---

## 目录结构

```
our_roots_affixes/
├── manifest.json          # 全量词汇清单（96,434 词，去重排序）
├── META.md                # Schema 说明、不变式、受控词表
├── CHANGELOG.md           # 版本历史
│
├── words/                 # WordEntry 数据（按字母桶分片，每桶约 50 词）
│   ├── word-index.json    # 词 → 桶ID 索引（快速定位）
│   ├── a-001.json         # bucket 示例
│   └── ...                # _-xxx (Stage 1a) + a-xxx ~ z-xxx (Stage 1b)
│
├── morphemes/             # 形素层
│   ├── roots.json         # 5,403 条词根
│   ├── affixes.json       # 2,740 条词缀（前缀+后缀）
│   └── linkers.json       # 5 条连接元音（-i- / -o- / -e- / -a- / -u-）
│
├── relations/
│   └── graph.json         # 关系图（118,718 条边，12 类）
│
└── schema/
    └── types.d.ts         # TypeScript 类型定义
```

---

## 数据模型

### WordEntry（`words/*.json`）

每个词条包含：

| 字段 | 说明 |
|------|------|
| `word` | 英文小写 |
| `phonetic` | IPA 音标 |
| `pos[]` | 词性标签 |
| `coreMeaning[]` | 核心义项（覆盖 80% 场景） |
| `morphemes[]` | 形素分解（role / canonical / gloss / sentiment） |
| `derivationChain[]` | 形态派生链 |
| `memorySemantics` | 记忆语义（literal / imageChain / mnemonicExpr） |
| `wordLevel` | 情感 / 语域 / 正式度 / domain |
| `relations` | 8 类关系（同根 / 同缀 / 同义 / 反义等） |

### MorphemeEntry（`morphemes/*.json`）

每个形素包含 id、canonical、role、variants、memberWords、synonymMorphemes、antonymMorphemes。

### RelationsGraph（`relations/graph.json`）

12 类边：

| 类型 | 说明 |
|------|------|
| `sameRoot` | 共享同一词根的词 |
| `sameAffix` | 共享同一词缀的词 |
| `synonyms` | 同义词对 |
| `antonyms` | 反义词对 |
| `domainCohort` | 同领域词群 |
| `derivationPair` | 派生链相邻对 |
| `morphVariants` | 拼写变体对 |
| `sameImagery` | 共享记忆意象 |
| `affixSynonyms` | 语义近似词缀 |
| `affixAntonyms` | 语义反向词缀 |
| `rootVariants` | 同词根拼写变体 |
| `rootSynonyms` | 语义近似词根 |

---

## 使用示例

### 查词条

```ts
import wordIndex from './words/word-index.json' assert { type: 'json' };
const bucket = wordIndex['inflation'];   // "i-001"
const bucketData = await import(`./words/${bucket}.json`, { assert: { type: 'json' } });
const entry = bucketData.default.find(w => w.word === 'inflation');
```

### 查同根词

```ts
import graph from './relations/graph.json' assert { type: 'json' };
const sameRoot = graph.edges.sameRoot.find(e => e.root === 'vis')?.members;
// ["revise", "revision", "vision", ...]
```

### 查词缀成员

```ts
import affixes from './morphemes/affixes.json' assert { type: 'json' };
const pre = affixes.find(a => a.id === 'pre-');
console.log(pre.memberWords); // ["predict", "prefix", "prepare", ...]
```

### 查同义词对

```ts
const synPairs = graph.edges.synonyms.filter(([a]) => a === 'concise');
// [["concise", "terse"], ["concise", "succinct"], ...]
```

---

## 完整 Schema 说明

见 [`META.md`](./META.md)。
