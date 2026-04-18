# our_roots_affixes — 运营工作流程

本文档说明如何**继续执行、补缺、补充新词库**，面向未来任何新会话。

---

## 0. 前置：重建 /tmp 输入文件

每次 Claude Code 重启后 `/tmp/` 会被清空。在派发 Stage 1b subagent 前必须先运行：

```bash
cd /Users/joejiang/Desktop/词根词缀
python3 scripts/our_roots_affixes/prep-stage1b-inputs.py
```

该脚本会生成：
- `/tmp/s1b-{bucket}.json`：每个桶的词列表
- `/tmp/s1b-inventory.json`：形素清单（89KB 紧凑格式）
- `/tmp/s1b-fewshot.json`：2条示例 WordEntry

---

## 1. 查缺补漏（找出未完成的桶）

```python
import json, os
plan = json.load(open('data/our_roots_affixes/_staging/bucket-plan.json'))
done = set(f.replace('.json','') for f in os.listdir('data/our_roots_affixes/words/') if f.endswith('.json'))
missing = [b['id'] for b in plan['buckets'] if b['id'] not in done]
print(f'Missing {len(missing)}:', missing)
```

---

## 2. 派发单个桶（标准模板）

```
Decompose 50 English words from `/tmp/s1b-{bucket}.json` into WordEntry JSON objects.
IMPORTANT: Write the output DIRECTLY to `/Users/joejiang/Desktop/词根词缀/data/our_roots_affixes/words/{bucket}.json`
using the Write tool — do NOT print the JSON to your response.
Reference `/tmp/s1b-fewshot.json` (COPY structure exactly) and `/tmp/s1b-inventory.json`.
Rules: (1) canonical prefers inventory ids; (2) phrases/abbrevs/proper-nouns→pseudo-morpheme role=root canonical=word;
(3) same count and order as input; (4) controlled vocabs; (5) relations 2-5 items.
Report ONLY: "Done. {bucket}.json written, N entries." in ≤20 words.
```

---

## 3. 处理 32K token 超限

当 subagent 返回 `API Error: Claude's response exceeded the 32000 output token maximum`：

**Step 1** — 派发 Part A（前 25 词）：
```
Read `/tmp/s1b-{bucket}.json`. Take only the FIRST 25 items (index 0-24).
Write output to `/Users/joejiang/Desktop/词根词缀/data/our_roots_affixes/words/{bucket}a-tmp.json`.
Report ONLY: "Done. {bucket}a-tmp.json written, 25 entries."
```

**Step 2** — 派发 Part B（后 25 词）：
```
Read `/tmp/s1b-{bucket}.json`. Take only the LAST 25 items (index 25-49).
Write output to `/Users/joejiang/Desktop/词根词缀/data/our_roots_affixes/words/{bucket}b-tmp.json`.
Report ONLY: "Done. {bucket}b-tmp.json written, 25 entries."
```

**Step 3** — 合并（等两部分都完成后）：
```python
import json, os
base = '/Users/joejiang/Desktop/词根词缀/data/our_roots_affixes/words/'
for b in ['{bucket}']:
    a = json.load(open(f'{base}{b}a-tmp.json'))
    b_ = json.load(open(f'{base}{b}b-tmp.json'))
    json.dump(a + b_, open(f'{base}{b}.json','w'), ensure_ascii=False, indent=2)
    os.remove(f'{base}{b}a-tmp.json')
    os.remove(f'{base}{b}b-tmp.json')
    print(f'{b}: {len(a)+len(b_)} entries')
```

---

## 4. 添加新词库

### 4a. 将新词加入 manifest

```bash
# 新词库文件放到 data/sources/ 后运行：
cd /Users/joejiang/Desktop/词根词缀
npx ts-node scripts/our_roots_affixes/stage-0-manifest.ts
```

Stage 0 会：
- 读取所有 `data/sources/` 下的词库
- 去重合并到 `data/our_roots_affixes/manifest.json`
- 重新生成 `data/our_roots_affixes/_staging/bucket-plan.json`（454→N 桶）

### 4b. 重建 /tmp 输入文件

```bash
python3 scripts/our_roots_affixes/prep-stage1b-inputs.py
```

### 4c. 仅派发新增桶

先查缺（步骤 1），然后对每个新桶执行步骤 2。

---

## 5. 全量管道（Stage 1b 完成后）

```bash
# Stage 2: 回填 morphemes/*.json 的 memberWords
npx ts-node scripts/our_roots_affixes/stage-2-morpheme-index.ts

# Stage 3: 生成 relations/ 关系图 + INV-1..8 校验
npx ts-node scripts/our_roots_affixes/stage-3-relations.ts

# Stage 4: QA 抽样（可选，检查质量）
npx ts-node scripts/our_roots_affixes/stage-4-qa.ts

# Stage 5: 打包（META.md / README / types.d.ts）
npx ts-node scripts/our_roots_affixes/stage-5-package.ts

# Stage 6: git tag v1.0.0 并推送到数据仓库
npx ts-node scripts/our_roots_affixes/stage-6-github.ts
```

或者用顶层 CLI 一键运行 Stage 2-6：
```bash
npx ts-node scripts/our_roots_affixes/cli.ts --from-stage 2
```

---

## 6. 已知局限与注意事项

| 问题 | 说明 |
|------|------|
| `/tmp/` 每次重启被清空 | 必须先运行 `prep-stage1b-inputs.py` |
| 32K token 超限 | 对高频字母桶（i/p/r/s 等）直接用拆分模板 |
| 网络超时 (ECONNRESET / idle timeout) | 直接重试即可，无需拆分 |
| `_-001` 桶（以 `-` 开头的词）| 11 条，正常派发即可 |
| 末尾桶词数少于 50 | 正常，最后一桶按实际词数 |

---

## 7. 目录结构参考

```
词根词缀/
├── data/our_roots_affixes/        # 输出（.gitignore 忽略）
│   ├── manifest.json              # 21,923 词清单
│   ├── _staging/
│   │   ├── bucket-plan.json       # 454 桶计划
│   │   ├── candidates/            # Stage 1a 候选形素
│   │   └── variant-to-canonical.json
│   ├── morphemes/
│   │   ├── roots.json             # 1,628 词根
│   │   ├── affixes.json           # 307 词缀
│   │   └── linkers.json           # 2 连接元音
│   └── words/                     # 454 桶 × ~50 词
├── scripts/our_roots_affixes/     # 管道脚本（TypeScript）
│   ├── prep-stage1b-inputs.py     # 重建 /tmp 输入文件
│   ├── stage-0-manifest.ts
│   ├── consolidate-deterministic.ts
│   ├── stage-1b-decompose.ts
│   ├── stage-2-morpheme-index.ts
│   ├── stage-3-relations.ts
│   ├── stage-4-qa.ts
│   ├── stage-5-package.ts
│   ├── stage-6-github.ts
│   └── cli.ts
└── docs/
    └── our_roots_affixes-workflow.md  # 本文档
```
