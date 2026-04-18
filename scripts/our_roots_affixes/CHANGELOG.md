# CHANGELOG

## 2026-04-18
### Changed
- `stage-3-relations.ts` — INV-1 校验由强制失败改为警告（warn-only），允许形素 canonical 不在预建库中
- 新增 `tsconfig.json` — 支持 bun/ts-node 直接运行脚本

## 2026-04-17
### Added
- `stage-0-manifest.ts` — 词库去重合并，生成 manifest.json
- `consolidate-deterministic.ts` — Stage 1a 确定性形素合并器
- `stage-1b-decompose.ts` — 单批次词条分解（WordEntry 生成）
- `stage-2-morpheme-index.ts` — 形素 memberWords 回填
- `stage-3-relations.ts` — 关系图构建 + INV-1..8 校验
- `stage-4-qa.ts` — QA 抽样（需要 ANTHROPIC_API_KEY）
- `stage-5-package.ts` — 打包（META.md / README / types.d.ts）
- `stage-6-github.ts` — git tag + push 到数据仓库
- `cli.ts` — 顶层 CLI 一键运行 Stage 2–6
- `prep-stage1b-inputs.py` — 会话重启后重建 /tmp 输入文件
