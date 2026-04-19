# CHANGELOG

## v1.0.0 — 2026-04-19

- manifest 词量 96,434
- 形素层：roots 5,403 / affixes 2,740 / linkers 5，合计 8,148
- 关系图：119,248 条边（12 类）
- 受控词表 + INV-1..8 不变式校验

## v1.0.0-beta.7 — 2026-04-19

- Stage 1b 最终：1497/1497 桶（100%），词条 92,274，JSON 全部合法（0 错误）
- Stage 2 重建：52,617 词 → 8,148 形素
- Stage 3 重建：119,795 条边（12 类）
- Stage 5 打包：v1.0.0，manifest 词量 96,434

## v1.0.0-beta.6 — 2026-04-19

- Stage 1b 最终确认：1497/1497 桶（100%），词条 91,751，JSON 全部合法（0 错误）
- Stage 2 重建：52,239 词 → 8,148 形素
- Stage 3 重建：119,248 条边（12 类）
- Stage 5 打包：v1.0.0，manifest 词量 96,434
- 修复 Stage 5 CHANGELOG 覆盖问题（现由人工维护）

## v1.0.0-beta.5 — 2026-04-19

- Stage 1b 完成：1497/1497 桶（100%），词条 86,607，所有 JSON 验证通过（0 错误）
- Stage 2 重建：形素 8,148 条（roots 5,403 / affixes 2,740 / linkers 5，新增 -e-/-a-/-u-）
- Stage 3 重建：关系图 118,718 条边（12 类），较 beta.4 +21,871
- Stage 5 打包：v1.0.0 发布，manifest 词量 96,434
- 数据规范化：修复 wordLevel / derivationChain / imageChain / morpheme.sentiment 字段格式（共 ~11,000 条目）

## v1.0.0-beta.4 — 2026-04-19

- Stage 1b 进度：1328/1497 桶完成（88.7%），已处理词条 50,136
- 20 并发 Agent 批量派发，修复 6 处 JSON 语法错误（unescaped quotes）
- 集成 MorphoLex 频率数据：141 个词缀 + 3,261 个词根补充 morpholexFamilySize / morpholexHalFreq
- 集成 EtymoLink 词源数据：43,940 词补充 etymOrigin（拉丁语 / 希腊语 / 古法语等）
- 关系图：96,847 条边（12 类）

## v1.0.0-beta.3 — 2026-04-19

- Stage 1b 进度：831/1497 桶完成（55.5%），已处理词量 74,557
- 形素层：roots 5,403 条 / affixes 2,740 条 / linkers 2 条，合计 8,145
- 集成 MorphoLex 频率数据：141 个词缀 + 3,261 个词根补充 morpholexFamilySize / morpholexHalFreq
- 集成 EtymoLink 词源数据：43,940 词补充 etymOrigin（拉丁语 / 希腊语 / 古法语等）
- 关系图：96,847 条边（12 类），较 beta.2 +4,113
- 累计新增词库：MorphoLex（68,538 词）、EtymoLink（43,940 词）、HN 技术词汇（5,000 词）、文学语料（12 部经典）

## v1.0.0-beta.2 — 2026-04-19

- Stage 1b 进度：779/1497 桶，37,246 词已处理
- 关系图：92,734 条边

## v1.0.0-beta.1 — 2026-04-19

- 初版发布，manifest 词量 96,434，源词库 17 个
- 形素层：roots.json / affixes.json / linkers.json
- 关系图 12 类边（sameRoot / sameAffix / synonyms / antonyms / domainCohort / derivationPair / morphVariants / sameImagery / affixSynonyms / affixAntonyms / rootVariants / rootSynonyms）
- 受控词表 + INV-1..8 不变式校验
