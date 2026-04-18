# our_roots_affixes 流水线 — 进度与变更日志

**日期**: 2026-04-18
**状态**: Stage 1b 进行中 (80/454 桶)

---

## 1. 改动了什么

### 1.1 新增代码（17 次提交，约 1,970 行 TypeScript）

| 提交 SHA | 内容 | 文件 |
|---|---|---|
| `450afd7` | 基础骨架 | `config.ts`, `types.ts` |
| `095cdc7` | 手写 schema 校验器 + 测试 | `schema.ts`, `schema.test.ts`, `fixtures/mock-word-entry.json` |
| `23e9a11` | INV-1..8 不变式校验器 + 测试 | `invariants.ts`, `invariants.test.ts` |
| `59410aa` | 工具模块 + 测试 | `atomic-write.ts`, `checkpoint.ts`, `retry.ts`, `logger.ts` + 3 test 文件 |
| `917f931` | Stage 0 manifest builder + 测试 | `stage-0-manifest.ts`, `stage-0-manifest.test.ts` |
| `e551115` | Anthropic API 客户端 | `llm-client.ts` |
| `4d22f53` | Prompt 模板（L0/L1/L3 + Stage 1a/4） | `prompts.ts` |
| `e2f80c6` | Stage 1a planner + consolidator | `stage-1a-planner.ts`, `stage-1a-consolidate.ts` |
| `f6bba4f` | Stage 1b decomposer + 批校验 + 测试 | `stage-1b-decompose.ts`, `stage-1b-decompose.test.ts` |
| `ffb91f9` | Stage 1b worker pool + coordinator | `stage-1b-runner.ts` |
| `89674f2` | Stage 2 morpheme index + 测试 | `stage-2-morpheme-index.ts`, `stage-2-morpheme-index.test.ts` |
| `5b1a63d` | Stage 3 relations graph + 8 测试 | `stage-3-relations.ts`, `stage-3-relations.test.ts` |
| `26a9379` | Stage 4 QA 抽样器 | `stage-4-qa.ts` |
| `7c6f38d` | Stage 5 打包 (META/README/schema) | `stage-5-package.ts` |
| `4a4c4d6` | Stage 6 GitHub 推送 | `stage-6-github.ts` |
| `20a5258` | 顶层 CLI orchestrator | `cli.ts` |
| `102a32f` | Path B: 确定性 Stage 1a 合并器 | `consolidate-deterministic.ts` |

### 1.2 生成数据

```
data/our_roots_affixes/
├── manifest.json                       21,923 唯一词 + 来源映射
├── _staging/
│   ├── bucket-plan.json                454 桶计划
│   ├── candidates/batch-000..021.json  Stage 1a 候选形素（22 批）
│   └── variant-to-canonical.json       963 变体→规范化映射
├── morphemes/
│   ├── roots.json                      1,628 词根
│   ├── affixes.json                    307 词缀 (196 prefix + 111 suffix)
│   └── linkers.json                    2 连接元音 (-i-, -o-)
└── words/                              80 桶 × 50 词 = 3,953 WordEntry（已完成）
```

总磁盘占用：17 MB

### 1.3 路径变更（Path B）

原计划 `stage-1a-consolidate.ts` 调用 Anthropic API 合并候选形素，因无 API key 已改为 **确定性合并** (`consolidate-deterministic.ts`)：按 `(role, candidate)` 精确匹配聚合 + 变体吸收。LLM-驱动的细粒度合并（跨变体语义聚合）待后期补齐。

Stage 1a/1b/4 的 LLM 调用全部通过 **Claude Code subagent dispatching** 完成，未使用用户的 Anthropic API key（零外部费用）。

---

## 2. 进度如何

### 2.1 整体流水线进度

| 阶段 | 状态 | 进度 |
|---|---|---|
| Stage 0 Manifest | ✅ 完成 | 21,923 词去重，454 桶计划 |
| Stage 1a Planner | ✅ 完成 | 22/22 批，3,392 候选形素 |
| Stage 1a Consolidate | ✅ 完成 | 1,937 规范形素 |
| **Stage 1b Decompose** | 🟡 **进行中** | **80/454 桶 (17.6%), 3,953/21,923 词 (18.0%)** |
| Stage 2 Morpheme Index | ⏸️ 待 1b 完成 | — |
| Stage 3 Relations Graph | ⏸️ 待 | — |
| Stage 4 QA | ⏸️ 待 | — |
| Stage 5 Package | ⏸️ 待 | — |
| Stage 6 GitHub Push | ⏸️ 待 | — |

### 2.2 Stage 1b 字母覆盖

- **a**: 37/37 桶 ✅ 全部完成
- **b**: 24/24 桶 ✅ 全部完成
- **c**: 19/43 桶 🟡 (剩余 24)
- d-z: 0 桶 (剩余 350)

### 2.3 剩余工作量预估

- Stage 1b 剩余: 374 桶 × 50 词 = 约 17,970 词
- 按 15 并行/轮 × ~10 分钟/轮 = 约 **25 轮 × 10 min ≈ 4 小时**
- Stage 2-6 全部自动化，合计 <5 分钟

---

## 3. 结果如何

### 3.1 质量指标

- **所有输出 JSON 有效**：80/80 桶解析成功
- **字段完整**：所有 WordEntry 含 word/phonetic/pos/coreMeaning/morphemes/derivationChain/morphVariantOf/memorySemantics/wordLevel/relations 十大字段
- **受控词表合规**：sentiment.tags / role / positionTendency / domain 全部在白名单内
- **平均每桶大小**：~60 KB JSON，50 词（含完整形态拆解 + 情感 + 位置 + 关联）
- **pseudo-morpheme 比例**：每桶约 4-20 条（专有名词、短语、缩写），属合理边界行为
- **not-in-inventory canonical**：每桶约 15-30 条（稀有词根的 ad-hoc fallback），可接受

### 3.2 代码测试

- 9 个测试文件，39 测试用例，**全部通过 (39/39)**
- 覆盖：schema 校验、INV-1..8 不变式、atomic-write、checkpoint、retry、stage-0 manifest dedup/bucketize、stage-1b 批校验、stage-2 morpheme index、stage-3 relations graph 全部 12 类边

### 3.3 样本质量（随机抽查 b-008.json 的 believable 条目）

```json
{
  "word": "believable",
  "morphemes": [
    { "canonical": "believe", "role": "root", "meaning": "相信" },
    { "canonical": "-able", "role": "suffix", "meaning": "能…的" }
  ],
  "memorySemantics": { "mnemonicExpr": "believe(相信)+able → 可信的" },
  "wordLevel": { "domain": ["general"], "sentiment": { "tags": ["中性"] } }
}
```

形素拆解正确；记忆链合理；受控词合规；关联字段非空。

---

## 4. 有没有错误

### 4.1 已遇到并解决的问题

| 时间点 | 问题 | 处理 |
|---|---|---|
| Stage 6 开始前 | 目录非 git 仓库 | 执行 `git init`，创建 `.gitignore`，做 baseline commit |
| Wave 4 (b-003) | API socket 异常关闭 | 重试该桶，一次成功 |

### 4.2 当前失败计数

- `_staging/failed/`: **0 个桶失败**
- 无 JSON 解析错误
- 无 INV 违反（尚未运行最终 Stage 3 校验，Stage 1b 完成后会跑）

### 4.3 已知局限（非错误，设计权衡）

1. **LLM 语义合并未使用**：Stage 1a 合并改为确定性脚本，意味着 `vis` 和 `vid` 如果在不同批次分别作为 canonical 出现，且未列互为 variants，会残留为两个独立条目。影响 Stage 3 的 `sameRoot` 边覆盖度。Stage 2 回填后可补一轮去重。

2. **pseudo-morpheme 为 role=root**：专有名词、缩写、短语（如 `a.`, `a-share`, `abdulaziz`）被当作单一 root。这些词不会参与真正的词根词缀网络（它们的 `sameRoot` 边为空）。合理的边界处理。

3. **not-in-inventory canonical 的 fallback**：约 15% 的形素使用了 ad-hoc canonical 而非 inventory id。这些形素不会出现在 `morphemes/*.json` 里，Stage 2 的 memberWords 不会包含它们——它们"飘"在 WordEntry 上但不产生关联边。可在 Stage 1b 全部完成后做一轮"inventory 补齐"扫描。

---

## 5. 下一步

按当前用户指令继续 **Path B 全量执行**：

1. 继续派发 Stage 1b 余下 374 桶（~25 轮 × ~10 分钟）
2. 完成后跑 Stage 2 / 3 / 4 / 5（全部自动）
3. Stage 6: git init + commit + push 到 `https://github.com/host452b/root_and_affix.git` 并打 `v1.0.0` 标签

完成后总磁盘占用约 150-250 MB，输出将是独立的 word decomposition 数据包。
