# CHANGELOG

## v1.0.0 — 2026-04-19

### 数据完成
- Stage 1b 全部 1,497 桶处理完毕（100%），词条 86,607 条
- 20 并发 Agent 并行派发；修复 wordLevel / derivationChain / imageChain / morpheme.sentiment 字段格式

### 形素与关系图
- 形素层：roots 5,403 条 / affixes 2,740 条 / linkers 2 条，合计 8,145
- 关系图：118,459 条边（12 类）

### 数据集成
- MorphoLex 频率数据：141 个词缀 + 3,261 个词根补充 morpholexFamilySize / morpholexHalFreq
- EtymoLink 词源数据：43,940 词补充 etymOrigin（拉丁语 / 希腊语 / 古法语等）
- 源词库 17 个：GRE / IELTS / TOEFL / SAT / GMAT / CET4 / NPEE / Academic / Medical / Legal / Finance / Tech 等
- 受控词表 + INV-1..8 不变式校验
