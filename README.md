# our_roots_affixes

独立构建的英语词汇词根词缀数据库。

- 词量: **21923**
- 版本: **v1.0.0**

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
