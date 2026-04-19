# CHANGELOG

## 2026-04-19
### Updated
- Stage 1b 全部完成：1,497 桶 100%，共 86,607 条 WordEntry
- 1,942 个 JSON 文件（含 _-xxx Stage 1a 桶）
- 修复 wordLevel / derivationChain / imageChain / morpheme.sentiment 字段格式（~11,000 条目）

## 2026-04-18
### Added
- 首批字母桶 JSON 文件（Stage 1a + 1b 初版），共 21,923 条 WordEntry
- `word-index.json` — 全量词汇索引（平铺列表）
- 数据由 our_roots_affixes Stage 1b 管道生成，经 Stage 5 打包
