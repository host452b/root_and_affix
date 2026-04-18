# 词根词缀库 — Claude Code 工作指南

## 项目使命

**打造最全的英语词根词缀收录库。**

覆盖 GRE / IELTS / TOEFL / SAT / GMAT / CET4 / NPEE / Academic / Medical / Legal / Finance / Tech 等主流词库，对每个词条进行形态分析（词根 + 词缀 + 派生链），最终输出结构化 JSON 数据集供应用层消费。

---

## 目录结构

```
词根词缀/
├── CLAUDE.md                        # 本文件
├── data/
│   ├── word-banks/                  # 17 个源词库（43,882 词，去重前）
│   ├── our_roots_affixes/           # 管道主输出
│   │   ├── manifest.json            # 21,923 唯一词清单
│   │   ├── morphemes/               # roots.json / affixes.json / linkers.json
│   │   ├── words/                   # 454 桶 × ~50 词（WordEntry JSON）
│   │   ├── relations/               # 关系图 graph.json
│   │   └── _staging/               # 中间产物（bucket-plan.json 等）
│   ├── etymology/                   # 词源参考数据
│   └── roots-affixes/               # 原始词根词缀参考库
├── scripts/our_roots_affixes/       # Stage 0–6 管道脚本（TypeScript，bun 运行）
│   ├── prep-stage1b-inputs.py       # 会话重启后重建 /tmp 输入
│   └── tsconfig.json                # 脚本专用 tsconfig
├── docs/
│   └── our_roots_affixes-workflow.md  # 迭代工作流（必读）
├── src/                             # 应用层源码
└── tests/                           # 测试
```

---

## 核心命令

### 检查缺失桶
```python
python3 -c "
import json, os
plan = json.load(open('data/our_roots_affixes/_staging/bucket-plan.json'))
done = set(f.replace('.json','') for f in os.listdir('data/our_roots_affixes/words/') if f.endswith('.json'))
missing = [b['id'] for b in plan['buckets'] if b['id'] not in done]
print(f'Missing {len(missing)}:', missing)
"
```

### 会话重启后重建 /tmp 输入
```bash
python3 scripts/our_roots_affixes/prep-stage1b-inputs.py
```

### 运行 Stage 2–6
```bash
bun run scripts/our_roots_affixes/stage-2-morpheme-index.ts
bun run scripts/our_roots_affixes/stage-3-relations.ts
bun run scripts/our_roots_affixes/stage-4-qa.ts      # 需要 ANTHROPIC_API_KEY
bun run scripts/our_roots_affixes/stage-5-package.ts
bun run scripts/our_roots_affixes/stage-6-github.ts
# 或一键运行：
bun run scripts/our_roots_affixes/cli.ts --from-stage 2
```

### 添加新词库
```bash
# 1. 将新词库 JSON 放入 data/word-banks/
# 2. 重跑 Stage 0 生成新 manifest 和 bucket-plan
bun run scripts/our_roots_affixes/stage-0-manifest.ts
# 3. 重建 /tmp 输入，查缺补漏
python3 scripts/our_roots_affixes/prep-stage1b-inputs.py
```

---

## Stage 1b 派发规则

**标准桶（50 词）：**
```
Decompose 50 English words from `/tmp/s1b-{bucket}.json` into WordEntry JSON objects.
IMPORTANT: Write DIRECTLY to `.../words/{bucket}.json` using the Write tool.
Reference `/tmp/s1b-fewshot.json` and `/tmp/s1b-inventory.json`.
Report ONLY: "Done. {bucket}.json written, N entries."
```

**超出 32K token 的桶（un-/under- 等前缀密集桶）→ 拆分为 25+25：**
- Part A：取 index 0-24，写入 `{bucket}a-tmp.json`
- Part B：取 index 25-49，写入 `{bucket}b-tmp.json`
- 合并：`python3 -c "import json,os; base='...words/'; a=json.load(open(f'{base}{b}a-tmp.json')); b_=json.load(open(f'{base}{b}b-tmp.json')); json.dump(a+b_,open(f'{base}{b}.json','w'),ensure_ascii=False,indent=2); os.remove(f'{base}{b}a-tmp.json'); os.remove(f'{base}{b}b-tmp.json')"`

---

## JSON 修复

Stage 1b 产出的 JSON 可能存在：
- **未转义的 ASCII 双引号**（中文引号用法）→ 用 `fix_unescaped_quotes()` 修复
- **relations 字段格式**：应为对象 `{synonyms:[],antonyms:[],...}`，不能是数组
- **morpheme.sentiment 缺失**：补填 `{"tags":["中性"],"intensity":0}`

运行 Stage 2 前务必先验证：
```python
python3 -c "
import json, os
bad = []
for f in os.listdir('data/our_roots_affixes/words/'):
    if not f.endswith('.json'): continue
    try: json.load(open(f'data/our_roots_affixes/words/{f}'))
    except Exception as e: bad.append((f, str(e)))
print(f'Bad: {len(bad)}'); [print(x) for x in bad]
"
```

---

## 数据规范

- **WordEntry** 必填字段：`word`、`phonetic`、`pos`、`coreMeaning`、`morphemes`、`derivationChain`、`memorySemantics`、`wordLevel`、`relations`
- **relations** 键：`sameRoot`、`sameAffix`、`synonyms`、`antonyms`、`domainCohort`、`derivationPair`、`morphVariants`、`sameImagery`
- **morpheme.canonical** 优先使用 `/tmp/s1b-inventory.json` 中的 ID；词组/缩写/专有名词用 `role=root canonical=词本身`
- **sentiment.tags** 控制词汇：`["积极"]` / `["消极"]` / `["中性"]` / `["贬义"]` / `["褒义"]`

---

## 注意事项

| 事项 | 说明 |
|------|------|
| `/tmp/` 每次 Claude Code 重启被清空 | 先运行 `prep-stage1b-inputs.py` |
| INV-1 警告（70K+）| 预期行为：stage-1b 使用了库外 canonical，已降级为 warn-only |
| Stage 4 QA | 需要 `ANTHROPIC_API_KEY` 环境变量 |
| 数据仓库 | `https://github.com/host452b/root_and_affix`，通过 Stage 6 推送 |
| bun vs npx ts-node | 脚本必须用 `bun run` 执行，不要用 `npx ts-node` |
