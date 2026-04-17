# data/ — Flipword 数据目录

此目录存放 Flipword 扩展运行所需的全部静态数据。构建时由 `build.ts` 复制到 `dist/data/`，运行时由 content script 和 background service worker 通过 `chrome.runtime.getURL()` 加载。

**重要：此目录不是词库可用性的唯一真相源。** 产品中实际可用的词库由 `src/core/banks.ts` 的 `BANKS` 数组定义。popup 和 onboarding 都从该注册表读取。往此目录新增/删除 JSON 文件后，必须同步更新 `src/core/banks.ts`，否则产品 UI 不会反映变化。

## 目录结构

```
data/
├── README.md              ← 本文件
├── CHANGELOG.md           ← 数据变更记录
├── stats.json             ← 词库统计总表（自动生成）
├── word-banks/            ← 词库（核心数据）
│   ├── ielts.json         ← 雅思词汇 (5,072)
│   ├── toefl.json         ← 托福词汇 (4,195)
│   ├── gre.json           ← GRE 词汇 (7,888)
│   ├── sat.json           ← SAT 词汇 (4,272)
│   ├── gmat.json          ← GMAT 词汇 (2,616)
│   ├── cet4.json          ← 大学英语四级 (2,539)
│   ├── npee.json          ← 考研 NPEE (3,610)
│   ├── academic.json      ← 学术英语 (2,891)
│   ├── cefr-b2.json       ← 欧标 B2 (1,479)
│   ├── business.json      ← 商务英语 (1,475)
│   ├── tech.json          ← 科技/IT HN+SO (2,425)
│   ├── news.json          ← 新闻英语 (2,388)
│   ├── medical.json       ← 医学词汇 (1,999)
│   ├── finance.json       ← 金融词汇 (830)
│   ├── legal.json         ← 法律词汇 (164)
│   ├── cybersec.json      ← 网络安全 (9)
│   ├── editorial.json     ← 长文阅读 (30, 手工策划)
│   └── stats.json         ← 词库统计（冗余副本）
├── etymology/
│   └── core-5000.json     ← 词源数据（30 条手工 + Etymonline 增补）
└── roots-affixes/
    ├── roots.json          ← 词根数据库 (4,844 条)
    └── affixes.json        ← 词缀数据库 (1,499 条: 935 前缀 + 564 后缀)
```

## 各目录职责

### word-banks/ — 词库（替换引擎的燃料）

每个 JSON 文件是一个词库，包含 `WordEntry[]` 数组。每条 entry 的关键字段：

| 字段 | 作用 | 在哪里用 |
|------|------|---------|
| `id` | 唯一标识（小写英文） | SM-2 状态追踪、去重 |
| `word` | 英文单词 | 页面上显示的替换词 |
| `phonetic` | 音标 | Decode 面板头部 |
| `meanings[].definitionCn` | 中文释义 | Decode 面板释义区 |
| `chineseMappings[].chinese` | 中文触发词 | **核心：决定网页上哪些中文会被替换** |
| `morphology` | 词根词缀拆解 | Decode 面板 DECODE 区 |
| `etymology` | 词源故事 | Decode 面板 ORIGIN 区 |

**数据流：**
```
用户浏览中文网页
  → content.ts 扫描文本节点
  → Intl.Segmenter 分词
  → 每个中文片段查 byChinese Map（从 chineseMappings 构建）
  → 命中 → 用 word 替换显示
  → 用户点击 → 读取 meanings + morphology + etymology 渲染 Decode 面板
```

**质量规则（CLAUDE.md 明确要求）：**
- `chineseMappings` 是页面替换触发器，不是词典释义堆砌
- 中文映射长度 2-6 字符，必须是真实网页上会出现的自然表达
- 单字中文（"多""光""肉"）已清除（会过度匹配）
- 详见 `CLAUDE.md` → "Translation Quality Policy"

### etymology/ — 词源数据

`core-5000.json` 存放词源信息，在词库加载时由 `src/nlp/enrich.ts` 合并到 word entry。

来源：Etymonline (43K 词的首句词源 + 首次出现年份)

### roots-affixes/ — 词根词缀数据库

运行时 `src/nlp/enrich.ts` 的 `analyzeMorphology()` 函数用这两个文件自动拆解单词结构。

**roots.json** — 4,844 个词根
```json
{ "root": "soph", "meaning": "wise", "meaningCn": "智慧", "examples": ["sophisticated", "philosophy"] }
```
来源：MorphoLex 学术语料 + engra 词族树 + find-roots-of-word + 手工补充

**affixes.json** — 1,499 个词缀（935 前缀 + 564 后缀）
```json
{ "type": "prefix", "affix": "un-", "meaning": "not", "meaningCn": "不/否定", "examples": ["unusual", "undo"] }
```

**拆解流程：**
```
词库加载时
  → enrichWordBank() 被调用
  → 对每个没有 morphology 的词：
    1. 查复合词表（welfare → well + fare）
    2. 在 roots.json 的 examples 中查找匹配
    3. 匹配前后缀
    4. 生成 { prefix, root, suffix, mnemonic }
  → 结果写入 entry.morphology
  → Decode 面板渲染
```

### stats.json — 词库统计总表

由 `scripts/full-audit.ts` 或手动 Python 脚本生成。包含每个词库的词量、形态覆盖率、词源覆盖率。

```json
{
  "generated": "2026-04-14 22:31",
  "banks": { "ielts": { "words": 5072, "morphology": 2282, ... } },
  "total": { "words": 43882, "banks": 17 }
}
```

## 数据来源

| 来源 | 贡献 | 许可 |
|------|------|------|
| kajweb/dict | 词库主体（有道词典数据） | 开源 |
| engra | 词库扩展 + 2,233 词根族 | MIT |
| MorphoLex | 37K 词的形态分解 | 学术开放 |
| Etymonline | 43K 词源数据 | 开源 |
| find-roots-of-word | 4,311 词根词缀 | MIT |
| THUOCL (清华) | 医学/法律/金融/IT 领域词 | MIT |
| ecdict | 338K 英汉翻译 | MIT |
| Simple-IT-English | HN/SO 科技词频 | MIT |
| news-vocabulary-dataset | 新闻词频 | MIT |

## 导入/维护脚本

所有脚本在 `scripts/` 目录：

| 脚本 | 作用 |
|------|------|
| `import-kajweb.ts` | 从 kajweb/dict 导入词库主体 |
| `expand-from-engra.ts` | 用 engra 词表扩展现有词库 |
| `import-morphology.ts` | 用 MorphoLex + Etymonline 增补形态/词源 |
| `import-engra-roots.ts` | 从 engra 导入词根族 |
| `import-morpholex-full.ts` | 导入 MorphoLex 全量词素 |
| `import-thuocl.ts` | 从清华 THUOCL 导入领域词 |
| `import-tech-news.ts` | 导入科技/新闻词库 |
| `audit-fix-wordbanks.ts` | Phase A 质量清理 |
| `full-audit.ts` | 全量 8 维度审校 |
| `fix-candidate-order.ts` | 多义词候选排序 |
| `add-context-hints.ts` | 添加语境提示 |
