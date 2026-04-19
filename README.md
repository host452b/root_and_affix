# our_roots_affixes

独立构建的英语词汇词根词缀数据库，覆盖 GRE / IELTS / TOEFL / SAT / GMAT / CET4 / Academic / Medical / Legal / Finance / Tech 等主流词库。

| 指标 | 数值 |
|------|------|
| manifest 词量 | **96,434** |
| 已分析词条 | **86,607** |
| 形素（词根+词缀+连接词） | **8,145** |
| 关系图边数（12 类） | **118,459** |
| 词桶数 | **1,497** |
| 版本 | **v1.0.0** |
| Schema | **1.0** |

## 加载示例

```ts
import wordIndex from './words/word-index.json' assert { type: 'json' };
const bucket = wordIndex['inflation'];   // "i-001"
const bucketData = await import(`./words/${bucket}.json`, { assert: { type: 'json' } });
const entry = bucketData.default.find(w => w.word === 'inflation');
```

## 查同根词

```ts
import graph from './relations/graph.json' assert { type: 'json' };
const sameRoot = graph.edges.sameRoot.find(e => e.root === 'vis')?.members;
// ["revise", "revision", "vision", ...]
```

## 完整 schema 说明

见 `META.md`。
