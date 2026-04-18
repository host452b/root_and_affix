# our_roots_affixes — 数据变更日志

## [wip] 2026-04-18 — Stage 1b 进行中

### morphemes/ — 形素词典

由 Stage 1a 确定性合并器生成，覆盖所有 21,923 词的候选形素：

| 文件 | 条目数 | 说明 |
|------|--------|------|
| `morphemes/roots.json` | 1,628 | 词根（含变体列表、核心含义、情感、位置倾向） |
| `morphemes/affixes.json` | 307 | 词缀（196 前缀 + 111 后缀） |
| `morphemes/linkers.json` | 2 | 连接元音（`-i-`, `-o-`） |

字段结构（每条 MorphemeEntry）：
```
id, canonical, role, variants[], coreMeaning{cn,en},
sentiment{tags,intensity}, positionTendency, memberWords[],
synonymMorphemes[], antonymMorphemes[]
```

### words/ — 单词拆解桶

每桶 50 词（末桶按实际数量），每词含完整 WordEntry：

| 覆盖字母 | 桶数 | 文件范围 |
|----------|------|----------|
| a | 37/37 ✅ | `a-001.json` … `a-037.json` |
| b | 24/24 ✅ | `b-001.json` … `b-024.json` |
| c | 43/43 ✅ | `c-001.json` … `c-043.json` |
| d | 19/28 🟡 | `d-001.json` … `d-028.json`（部分桶尚未提交） |
| e–z | 0/322 ⏸️ | 处理中 |

**当前进度**：123 桶 / 454 桶，约 6,034 WordEntry

字段结构（每条 WordEntry）：
```
word, phonetic, pos, coreMeaning, morphemes[],
derivationChain{steps[]}, morphVariantOf?,
memorySemantics{mnemonicExpr, imageChain[]},
wordLevel{domain[], sentiment{tags,intensity}},
relations[{type, targets[]}]
```

关联边类型（12 种）：
`sameRoot` · `sameAffix` · `synonyms` · `antonyms` ·
`domainCohort` · `derivationPair` · `morphVariants` ·
`sameImagery` · `affixSynonyms` · `affixAntonyms` ·
`rootVariants` · `rootSynonyms`

---

## 待完成阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| Stage 1b（续） | 完成 e–z 共 331 桶 | 🟡 进行中 |
| Stage 2 | 回填 morphemes/\*.json 的 memberWords | ⏸️ 待 1b 完成 |
| Stage 3 | 生成 relations/ 关系图 + INV 校验 | ⏸️ 待 |
| Stage 4 | QA 抽样 | ⏸️ 待 |
| Stage 5 | 打包 META.md / README / schema | ⏸️ 待 |
| Stage 6 | 打 `v1.0.0` 标签并推送 | ⏸️ 待 |
