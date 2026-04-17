# Flipword — Product Design Spec v1.0

> *"Glitch your world into English."*
> 你的网页"出故障"了——中文开始变成英语。这不是 bug，这是 feature。

---

## 1. 产品概述

### 1.1 一句话定义

Flipword 是一款基于 Pretext 文本引擎的 Chrome 浏览器插件，通过"故障美学"将用户日常浏览的网页变成沉浸式英语学习场。在中文网页中智能替换词汇，在英文网页中用游戏化标注提示重点词，点击即可深度解码词源、词根词缀与文化语义。

### 1.2 核心理念

- **不是"学英语"，是"英语入侵你的世界"**
- **不是打开 App 学习，是学习找上你**
- **不是背单词，是在真实语境中暴击词汇**

### 1.3 目标用户

想完全融入 native 英语社区的所有人——他们相信未来是英语的世界，所有第一手信息来自英语世界。不限于考试党，核心是"想用英语思考的人"。

### 1.4 品牌话术体系

| 传统说法 | Flipword 说法 |
|----------|-----------------|
| 学习了一个新词 | 触发了一次 Glitch |
| 词汇量 | Glitch Count |
| 复习 | Re-Glitch |
| 掌握一个词 | Glitch Cleared |
| 每日学习 | Daily Glitch |
| 词根词缀分析 | Decode Mode |

---

## 2. 技术架构

### 2.1 技术栈

| 选型 | 技术 | 理由 |
|------|------|------|
| 扩展规范 | Chrome Extension Manifest V3 | 目标平台 |
| 语言 | TypeScript | 类型安全，模块化 |
| UI 框架 | Preact + HTM | ~3KB，React 式开发体验，体积敏感 |
| 文本引擎 | @chenglou/pretext（本地依赖） | 精确文本测量，零 DOM reflow |
| NLP 分词 | Intl.Segmenter + 语境权重 | 浏览器原生，零依赖 |
| LLM 桥接 | 可选 Ollama / 远程 API | 高级语境消歧，非必需 |
| 存储 | Chrome Storage API + IndexedDB | 纯本地，StorageAdapter 抽象 |
| 构建 | Bun + tsc | 快速构建，TypeScript 原生支持 |

### 2.2 五层架构

```
┌─────────────────────────────────────────────────┐
│  Layer 4: FX Canvas (粒子/Glitch/暴击特效层)      │  ← Canvas overlay
│  Layer 3: Pretext Render (文本替换渲染层)          │  ← Pretext layout + DOM 替换
│  Layer 2: NLP Engine (语境分析 + 词库匹配层)       │  ← Intl.Segmenter + 词库
│  Layer 1: DOM Scanner (网页文本提取层)             │  ← MutationObserver + TreeWalker
│  Layer 0: Core Runtime (插件核心运行时)            │  ← Chrome Extension MV3
└─────────────────────────────────────────────────┘
```

**数据流：**
1. **DOM Scanner** 提取页面文本节点（TreeWalker + MutationObserver）
2. **NLP Engine** 分析语境，匹配目标词库，计算置信度
3. **Pretext Render** 精确测量原始/替换文本尺寸差异，选择渲染策略
4. **Pretext Render** 在不修改原始 DOM 结构的前提下替换目标词汇
5. **FX Canvas** 在 overlay 层绘制暴击/Combo 特效（仅高冲击时刻）

**侧面板：**
- **Decode Panel** — 词汇深度解码面板（Preact 组件，content script 内注入）
- **Popup Dashboard** — 插件弹窗统计面板（Preact 组件，popup.html）
- **Data Layer** — Chrome Storage API + IndexedDB，通过 StorageAdapter 抽象

### 2.3 为什么选 Pretext

Pretext 是纯 JavaScript 文本测量与布局引擎，核心能力：

- `prepare()` 一次性分析 + 测量文本，返回不透明句柄
- `layout()` 纯算术计算文本高度/行数，~0.0002ms/次，无 DOM reflow
- `measureNaturalWidth()` 返回文本自然宽度，用于尺寸比较
- 支持 CJK + 拉丁混排、Emoji、Bidi、软连字符等复杂场景
- Canvas 测量，与浏览器字体引擎一致

**在 Flipword 中的角色：**

```typescript
// 测量原始中文词宽度
const originalPrepared = prepareWithSegments(chineseWord, fontSpec);
const originalWidth = measureNaturalWidth(originalPrepared);

// 测量替换英文词宽度
const replacePrepared = prepareWithSegments(englishWord, fontSpec);
const replaceWidth = measureNaturalWidth(replacePrepared);

// 根据宽度比选择渲染策略
const ratio = replaceWidth / originalWidth;
```

### 2.4 项目结构

```
Flipword/
├── pretext/              # @chenglou/pretext 本地依赖
├── src/
│   ├── core/             # runtime · storage-adapter · types · constants · themes
│   ├── scanner/          # TreeWalker · MutationObserver · 文本节点过滤
│   ├── nlp/              # Segmenter 分词 · 词库匹配 · 语境权重 · LLM 桥接
│   ├── renderer/         # Pretext 集成 · DOM 替换 · 字号计算 · 回流控制
│   ├── fx/               # Canvas 特效层 · 粒子系统 · Glitch 滤镜
│   ├── crit/             # 暴击判定 · Combo 追踪 · 特效触发 · 成就系统
│   ├── decode/           # 解码面板 Preact 组件 · 词根词缀 · 词源渲染
│   ├── popup/            # 插件弹窗 Preact 组件 · 统计 · 设置 · 词库选择
│   └── content.ts        # content script 入口 · 编排所有层
├── data/
│   ├── word-banks/       # IELTS / TOEFL / GRE / 学术 / 商务 JSON
│   ├── etymology/        # 词源故事精简版 JSON
│   └── roots-affixes/    # 500 词根 + 300 词缀 JSON
├── manifest.json
├── docs/
├── package.json
└── tsconfig.json
```

每个 `src/` 子目录有自己的 `index.ts` 作为模块边界。

---

## 3. 视觉设计系统

### 3.1 设计原则

**精确侵入：** 日常视觉效果用 CSS 实现（微光、下划线、hover 效果），Canvas FX 层仅在暴击/Combo 等高冲击时刻启用。用排版力量而非特效噪音。

### 3.2 四主题系统

用户可选四种视觉主题，在 Onboarding 和 Settings 中切换。

#### Theme A: Editorial（杂志编辑风）

| 元素 | 样式 |
|------|------|
| 替换词标记 | 衬线斜体 + 红色下划线 (`#c44`) |
| 背景基调 | 奶白 `#FAFAF8` |
| 正文字体 | Georgia, serif |
| 标签系统 | 小型大写字母，灰色 |
| Decode 面板 | 细边框，衬线标题，编辑批注风 |
| Crit 特效 | 排版动画（字号脉冲、斜体切换） |
| 调性 | 安静、有品味、像翻高端杂志 |

#### Theme B: Brutalist（粗野主义）— 默认主题

| 元素 | 样式 |
|------|------|
| 替换词标记 | 等宽字体 + 黑底反白 (`#111` bg, `#fff` text) |
| 背景基调 | 纯白 `#fff` |
| 等宽字体 | SF Mono, Menlo, Courier New |
| 标签系统 | 大写字母 + letter-spacing 2px |
| Decode 面板 | 2px 黑边框，分区清晰，等宽标题 |
| Crit 特效 | 黑白闪烁、字重加粗、短暂放大 |
| 调性 | 系统故障感，不可忽视，黑白分明 |

#### Theme C: Soft（柔和彩蛋风）

| 元素 | 样式 |
|------|------|
| 替换词标记 | 圆角胶囊 + 淡紫粉渐变背景 |
| 背景基调 | 淡紫粉渐变 `#f8f6ff` → `#fff5f5` |
| 主色 | 紫色 `#7b4fa2`，绿色 `#3a8a5c` |
| 标签系统 | 彩色小标签，带 ✦ 装饰 |
| Decode 面板 | 圆角卡片，柔和阴影，渐变按钮 |
| Crit 特效 | 弹性缩放、彩色粒子、柔和弹跳 |
| 调性 | 温暖、友好、像发现彩蛋 |

#### Theme D: Minimal（精确克制风）

| 元素 | 样式 |
|------|------|
| 替换词标记 | 蓝色下划线 (`#0066CC`) |
| 背景基调 | 纯白 `#fff` |
| 正文字体 | -apple-system, SF Pro Text |
| 标签系统 | 小号灰色文字，几乎不可见 |
| Decode 面板 | 无边框，轻投影，Apple 式极简 |
| Crit 特效 | 淡入淡出、透明度变化、极简过渡 |
| 调性 | 安静渗透，不打扰阅读节奏 |

### 3.3 主题实现

```typescript
// src/core/themes.ts
interface Theme {
  id: 'editorial' | 'brutalist' | 'soft' | 'minimal';
  name: string;
  mark: {                        // 替换词标记样式
    fontFamily?: string;
    background?: string;
    color?: string;
    borderBottom?: string;
    borderRadius?: string;
    padding?: string;
    fontStyle?: string;
  };
  decode: {                      // Decode 面板样式
    border: string;
    borderRadius: string;
    headerFont: string;
    labelStyle: string;
  };
  crit: {                        // 暴击特效配置
    type: 'typographic' | 'flash' | 'bounce' | 'fade';
    useCanvas: boolean;          // 是否启用 Canvas 粒子
    colors: string[];
  };
  cssVariables: Record<string, string>;
}
```

主题通过 CSS 变量注入 content script，所有组件读取变量而非硬编码颜色。

---

## 4. 核心功能

### 4.1 Invasion Mode — 中文网页词汇入侵

**机制：** 在中文网页中，根据用户词库和入侵等级，将目标中文词替换为英文。

**入侵等级：**

| 等级 | 名称 | 替换密度 | 目标用户 |
|------|------|----------|----------|
| Level 1 | 初始渗透 | 每页 3-5 词 | 新用户，建立信心 |
| Level 2 | 扩散感染 | 每页 8-15 词 | 适应期，提升挑战 |
| Level 3 | 全面入侵 | 每页 20-30 词 | 进阶用户，强化沉浸 |
| Level 4 | 完全覆写 | 50%+ 内容替换 | 硬核模式（解锁制） |

**替换策略（Pretext 驱动）：**

```typescript
function selectRenderStrategy(ratio: number): RenderStrategy {
  if (ratio <= 1.2) return 'in-place';      // 原位替换，同字号
  if (ratio <= 1.6) return 'shrink';         // 缩小字号，最低 75%
  return 'hover-expand';                     // hover 展开，默认截断
}
```

- `in-place`：英文词宽度 ≤ 原中文词 120% → 原位替换，同字号
- `shrink`：120%-160% → 按比例缩小字号，下限 75%
- `hover-expand`：>160% → 默认截断 + 省略号，hover 时展开完整英文词

**Hover 行为（所有策略通用）：** hover 任何被替换的词，显示中文原词 tooltip。`hover-expand` 策略额外展开被截断的英文全文。两者共存。

**选词优先级：**
1. 用户词库中 `status: 'new'` 的词优先
2. 高语境适配度（`confidenceScore > 0.8`）优先
3. 已曝光但未掌握（`status: 'learning'`）的词周期性复现
4. 已掌握词低概率出现，作为巩固
5. SM-2 到期复习词优先进入当页替换队列

### 4.2 Radar Mode — 英文网页词汇雷达

**机制：** 在英文网页中，自动识别目标词汇并用视觉标注高亮，不替换文本。

**标注分级：**

| 标注 | 含义 | 视觉效果（随主题适配） |
|------|------|------------------------|
| 🔴 Red Pulse | 未知词，需要学 | 红色/强调下划线 + 微弱脉冲 |
| 🟡 Amber Ring | 见过但不熟 | 琥珀色/次级下划线 |
| 🟢 Green Dot | 已掌握，巩固中 | 绿色小圆点/淡标记 |
| ⚡ Lightning | 高价值词（考试重点） | 强调边框/加粗 |

**检测逻辑：**
- 页面加载 → Scanner 提取所有文本节点
- 与用户词库 + 目标词库交叉匹配
- 根据 `UserWordState.status` 分配标注等级
- MutationObserver 监听 SPA 路由变化，动态更新

### 4.3 Decode Mode — 词汇深度解码

**触发：** 点击任何被 Invasion 替换或 Radar 标注的单词。

**面板内容结构：**

```
┌─────────────────────────────────────────────────┐
│  fundamental  /ˌfʌn.dəˈmen.tl/      [IELTS 6+] │
│─────────────────────────────────────────────────│
│                                                 │
│  DECODE                                         │
│  fund- (基础) + -ment (状态) + -al (形容词)      │
│  → "构成基础的状态" → 根本的、基本的              │
│                                                 │
│  ORIGIN                                         │
│  拉丁语 fundamentum "地基"                       │
│  15世纪进入英语，最初用于建筑术语                 │
│                                                 │
│  NATIVE FEEL                                    │
│  正式/书面 · 中性 · 常见于学术/政策语境           │
│  近义词: essential, crucial                      │
│  易混: fundamentalism (原教旨主义，贬义)          │
│                                                 │
│  CONTEXT                                        │
│  "这种 fundamental 的转变需要全社会共同参与"      │
│  → 此处含义：根本性的                            │
│                                                 │
│  [ Cleared ✓ ]              [ Re-Glitch ↻ ]     │
└─────────────────────────────────────────────────┘
```

**数据来源：**

| 数据 | 来源 | 规模 |
|------|------|------|
| 词根词缀库 | 本地 JSON | 500 常用词根 + 300 常用词缀 |
| 词源数据 | 本地精简版 | 核心 5000 词 |
| 词源扩展 | 可选 Wiktionary API | 按需在线查询 |
| 母语者语感 | 预标注数据集 | 正式度、情感、场景、易混词 |
| 语境分析 | 页面上下文推断 | 实时 |
| 高级消歧 | 可选 LLM | 低置信度词触发 |

### 4.4 Crit System — 暴击反馈系统

**核心：** 将所有学习行为转化为游戏化的即时反馈。

**暴击触发与特效：**

| 触发事件 | 暴击类型 | 特效 |
|----------|----------|------|
| 首次语境中认出词 | **First Blood** | 短暂加粗 + 主题色闪烁 (0.3s) |
| 连续正确识别 5 词 | **Combo x5** | Combo 数字飞出 + 标记强调 |
| 连续正确识别 10 词 | **Rampage** | 全屏短暂反色/闪烁 (0.8s) |
| 连续正确识别 20 词 | **Godlike** | Canvas 粒子爆发 + 屏幕震动 (1.2s) |
| 连续正确识别 30+ 词 | **Beyond Godlike** | 全页面接管特效 + 解锁成就 |
| 掌握一个词 | **Glitch Cleared** | 词汇淡出 + 删除线过渡 |
| 完成每日目标 | **Daily Complete** | 统计弹窗 + 庆祝动画 |

**设计原则：** 日常特效（First Blood、Combo、Cleared）用纯 CSS/排版动画实现。Canvas 粒子系统仅在 Godlike 及以上启用。具体动画形式跟随用户所选主题。

**"正确识别"判定：**
- Invasion Mode：用户看到英文替换词后**没有点击**查看 Decode 面板，继续阅读 → 视为"认出"
- Radar Mode：用户 hover 标注词后 3 秒内移开且**没有点击** → 视为"认出"
- 主动标记：用户在 Decode 面板点击 "Cleared" → 显式掌握

**Combo 机制：**
- 连击窗口：30 秒内连续识别不中断
- 中断条件：30 秒无新识别 / 点击 Decode / 切换标签页
- Combo 计数显示在页面右上角浮动 badge（等宽大号数字）

---

## 5. 数据模型

### 5.1 词汇数据

```typescript
interface WordEntry {
  id: string;                     // 唯一标识 (e.g., "aberrant")
  word: string;                   // 英文单词
  phonetic: string;               // 音标 /æˈber.ənt/
  meanings: MeaningEntry[];       // 释义列表（含词性）
  difficulty: DifficultyTag[];    // ['IELTS_7', 'GRE'] 等标签

  morphology?: {
    prefix?: { part: string; meaning: string }[];
    root: { part: string; meaning: string };
    suffix?: { part: string; meaning: string }[];
    mnemonic: string;             // 助记解读
  };

  etymology?: {
    origin: string;               // "拉丁语 aberrare"
    originalMeaning: string;      // "走偏"
    story: string;                // 词源故事
    entryPeriod?: string;         // "16世纪"
  };

  nativeFeel?: {
    formality: 'casual' | 'neutral' | 'formal' | 'academic';
    sentiment: 'positive' | 'neutral' | 'negative';
    usageScenes: string[];        // ["学术论文", "法律文书"]
    synonyms: string[];
    confusables?: string[];
    notes?: string;
  };

  chineseMappings: {
    chinese: string;              // "异常"
    partOfSpeech: string;         // "adj"
    contextHint?: string;
  }[];
}
```

### 5.2 用户学习状态

```typescript
interface UserWordState {
  wordId: string;
  status: 'new' | 'seen' | 'learning' | 'reviewing' | 'mastered';

  // 曝光
  exposureCount: number;
  contextDiversity: number;
  lastExposureAt: number;
  firstSeenAt: number;

  // 互动
  clickCount: number;
  hoverCount: number;
  decodedAt: number | null;

  // 掌握
  correctRecognitions: number;
  masteredAt: number | null;

  // SM-2 间隔重复
  nextReviewAt: number;
  easeFactor: number;             // 初始 2.5
  interval: number;               // 当前间隔天数
  repetitions: number;            // 连续正确次数
}
```

### 5.3 语境匹配

```typescript
interface ContextMatch {
  originalText: string;
  sentenceContext: string;
  pageUrl: string;
  pageTitle: string;

  targetWord: string;
  confidenceScore: number;        // 0-1
  matchMethod: 'exact' | 'context' | 'llm';

  originalMetrics: {
    width: number;
    height: number;
    fontSize: string;
    fontFamily: string;
  };
  replacementMetrics: {
    width: number;
    height: number;
    adjustedFontSize?: string;
  };
  renderStrategy: 'in-place' | 'shrink' | 'hover-expand';
}
```

### 5.4 存储分层

| 数据 | 存储 | 理由 |
|------|------|------|
| 用户设置（等级、词库、主题） | Chrome Storage Sync | 轻量，跨设备同步 |
| UserWordState | IndexedDB | 数据量大，需索引 |
| WordEntry 词库 | IndexedDB | 只读大数据集 |
| 每日统计缓存 | Chrome Storage Local | popup 快速访问 |
| 临时匹配缓存 | 内存 Map | 当前页面生命周期 |

StorageAdapter 接口抽象存储层，未来可接入云同步而不改业务逻辑。

---

## 6. 用户旅程

### 6.1 首次安装 (Onboarding Glitch)

```
1. 安装插件
   → 当前页面触发 1.5s 全屏 Glitch 效果（主题预览）
   → 3-5 个中文词带动画变成英语

2. 右下角浮动欢迎卡片（非弹窗，不遮挡阅读）
   "你的网页被 Glitch 了。"
   "从现在起，英语会不断渗入你的世界。"

3. 选择视觉主题（四选一，实时预览当前页面效果）
   [ Editorial ] [ Brutalist ] [ Soft ] [ Minimal ]

4. 选择词库（可多选，卡片式选择器）
   [ 雅思 ] [ 托福 ] [ GRE ] [ 学术 ] [ 商务 ] [ 我全都要 ]

5. 选择入侵等级（滑块 + 实时预览）
   轻度渗透 ←——●——→ 全面入侵

6. 完成确认
   页面重载效果，更多词汇被 Glitch 替换
   "Glitch 已激活。Happy hunting."
```

### 6.2 日常使用 — 中文网页

```
用户正常浏览中文网页（微博/知乎/B站...）
  ↓
页面中部分中文词被替换为英文（带主题标记样式）
  ↓
用户阅读时自然遇到英文词
  ├→ 认出 → 继续阅读（后台记录正确识别 → Combo +1）
  ├→ 不确定 → hover 查看中文 tooltip（记录为 hover）
  └→ 不认识 → 点击打开 Decode 面板（记录为 click → Combo 中断）
       ├→ 浏览词根词缀、词源、语感
       ├→ 点击 "Cleared" 标记掌握
       └→ 点击 "Re-Glitch" 加入复习队列
  ↓
触发暴击条件 → Crit 特效播放（主题适配）
  ↓
关闭浏览器 → 数据自动保存到 IndexedDB
```

### 6.3 日常使用 — 英文网页 (Radar Mode)

```
用户浏览英文网页（Reddit/HN/Medium...）
  ↓
Radar 自动扫描，标注页面中的目标词汇
  ├→ 🔴 未知词 → 强调标记
  ├→ 🟡 半熟词 → 次级标记
  └→ ⚡ 高价值词 → 重点标记
  ↓
点击任意标注词 → 打开 Decode 面板（同 Invasion Mode）
```

### 6.4 复习循环 (Re-Glitch)

```
SM-2 算法计算每个词的下次复习时间
  ↓
用户浏览任意网页时
  ↓
到期复习词优先进入当页替换/标注队列
  ↓
识别正确 → interval 递增，easeFactor 上调
识别失败 → interval 重置，easeFactor 下调
```

---

## 7. 技术实现

### 7.1 DOM Scanner

```typescript
// TreeWalker 过滤策略
const BLACKLIST_TAGS = new Set([
  'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT', 'SVG'
]);

function collectTextNodes(root: Element): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Text) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (BLACKLIST_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      if (parent.closest('[data-wg]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}
```

**MutationObserver 策略：**
- 监听 `childList` + `characterData`，`subtree: true`
- 防抖 200ms，批量处理新增节点
- SPA 路由变化：额外监听 `popstate` + `pushState` / `replaceState` hook
- 性能保护：单次处理上限 200 节点，超出排入 `requestIdleCallback`

### 7.2 NLP 匹配引擎

**分层策略：**

1. **精确匹配层**（Phase 1）：`Intl.Segmenter` 中文分词 → `Map<string, WordEntry>` 查表 → O(1)
2. **语境权重层**（Phase 2）：上下文共现分析 → 一词多义消歧 → `confidenceScore` 计算
3. **LLM 辅助层**（Phase 4）：低置信度词 → 可选 Ollama/远程 API → 精确消歧

```typescript
// Phase 1: 精确匹配
function matchWords(text: string, wordBank: Map<string, WordEntry>): Match[] {
  const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
  const segments = segmenter.segment(text);
  const matches: Match[] = [];

  for (const { segment, isWordLike } of segments) {
    if (!isWordLike) continue;
    const entry = wordBank.get(segment);
    if (entry) {
      matches.push({ original: segment, entry, confidence: 1.0, method: 'exact' });
    }
  }
  return matches;
}
```

### 7.3 Pretext 渲染集成

```typescript
function glitchWord(textNode: Text, match: ContextMatch, theme: Theme) {
  const parent = textNode.parentElement!;
  const style = getComputedStyle(parent);
  const fontSpec = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

  // Pretext 精确测量
  const origPrep = prepareWithSegments(match.originalText, fontSpec);
  const origWidth = measureNaturalWidth(origPrep);
  const replPrep = prepareWithSegments(match.targetWord, fontSpec);
  const replWidth = measureNaturalWidth(replPrep);

  const ratio = replWidth / origWidth;
  const strategy = selectRenderStrategy(ratio);

  // 创建替换 span
  const span = document.createElement('span');
  span.dataset.wg = match.targetWord;
  span.dataset.wgOriginal = match.originalText;
  span.textContent = match.targetWord;

  // 应用主题样式
  Object.assign(span.style, theme.mark);

  if (strategy === 'shrink') {
    const scale = Math.max(0.75, origWidth / replWidth);
    span.style.fontSize = `${parseFloat(style.fontSize) * scale}px`;
  } else if (strategy === 'hover-expand') {
    span.style.maxWidth = `${origWidth * 1.2}px`;
    span.style.overflow = 'hidden';
    span.style.textOverflow = 'ellipsis';
    span.style.whiteSpace = 'nowrap';
    span.style.display = 'inline-block';
    span.style.verticalAlign = 'bottom';
  }

  // 替换文本节点中的匹配部分
  replaceTextRange(textNode, match, span);
}
```

**批量优化：**
- `prepare()` 结果按 `word+fontSpec` 缓存（Map），同一页面同词同字体只测量一次
- `layout()` 调用 ~0.0002ms，可同步批量执行
- 替换操作排入 `requestIdleCallback`，不阻塞主线程

### 7.4 Canvas 特效层

```typescript
function createFXCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.id = 'wg-fx';
  canvas.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: 2147483647;
  `;
  document.documentElement.appendChild(canvas);
  return canvas;
}
```

**仅在以下场景启用 Canvas：**
- Godlike (×20) 及以上暴击
- Beyond Godlike (×30+)
- Daily Complete 庆祝
- Onboarding 首次 Glitch 效果

**日常特效（CSS 实现）：**
- 替换词标记样式 → 主题 CSS 变量
- First Blood → `@keyframes` 短暂加粗
- Combo 数字 → absolute 定位 + `animation` 飞出
- Cleared → `transition` 淡出 + 删除线

**粒子系统配置：**
- 同时在屏上限 500 粒子
- `requestAnimationFrame` 驱动，无粒子时停止循环
- Tab 不可见时暂停（`visibilitychange`）

---

## 8. 性能预算

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 插件安装体积 | < 2MB | 含词库，不含可选扩展包 |
| Content script 注入 | < 50ms | DOMContentLoaded → 首次扫描完成 |
| 单词替换延迟 | < 5ms | 匹配命中 → DOM 更新可见 |
| 首次全页扫描 | < 200ms | 中等页面 ~5000 文本节点 |
| FX Canvas FPS | ≥ 55fps | 特效激活期间 |
| 内存占用增量 | < 50MB | 含词库 + 页面缓存 |
| CPU（空闲） | < 1% | 无特效、无扫描 |
| CPU（活跃） | < 5% | 扫描 + 替换 + 轻量特效 |
| Decode 面板弹出 | < 100ms | 点击 → 面板渲染完成 |
| IndexedDB 查询 | < 10ms | 单词状态读写 |

**性能保护机制：**
- 节点扫描上限：200 节点/次，超出排入 `requestIdleCallback`
- 粒子池上限：500 同屏粒子，超出回收最旧
- 分段扫描：IntersectionObserver，仅处理可视区 ± 1 屏缓冲
- 低电量降级：`navigator.getBattery()`，关闭 Canvas 特效
- Tab 隐藏暂停：`visibilitychange`，停止所有 FX 和扫描

---

## 9. 测试策略

| 层级 | 覆盖范围 | 工具 |
|------|----------|------|
| 单元测试 | NLP 匹配、SM-2 算法、StorageAdapter、词库解析 | bun:test |
| 组件测试 | Decode 面板、Popup 页面、设置表单 | Preact Testing Library |
| 集成测试 | Scanner → NLP → Renderer 全链路 | bun:test + mock DOM |
| E2E | 安装 → Onboarding → 替换 → Decode → 统计 | Puppeteer |
| 性能 | 扫描耗时、替换延迟、FPS、内存 | Chrome DevTools Protocol |

**关键测试场景：**
- 动态页面（React/Vue SPA）MutationObserver 正确性
- 中文分词边界 case（成语、专有名词、中英混合）
- Pretext 尺寸计算在不同字体/字号下的准确性
- 高密度替换（Level 4）下性能不降级
- 长时间运行（8h+）内存不泄漏
- 四主题切换后样式一致性

---

## 10. 风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| 替换破坏页面布局 | 中 | 高 | Pretext 精确测量 + 三级渲染策略 + 页面黑名单 |
| SPA 框架重渲染冲掉替换 | 高 | 中 | MutationObserver 重检测 + `data-wg` 标记防重复 |
| 中文分词歧义导致错误替换 | 中 | 中 | 高置信度阈值 (>0.8) + 用户一键撤销 |
| Canvas 特效影响性能 | 低 | 中 | 粒子上限 + 可见性检测 + 低电量降级 |
| 词库数据版权 | 低 | 高 | 使用开源词频数据 + 自建词根库 |
| MV3 Service Worker 生命周期 | 中 | 中 | 关键数据即时写 IndexedDB |
| 某些网站 CSP 阻止注入 | 低 | 低 | 检测 CSP，降级为纯 DOM 模式 |
| 用户隐私顾虑 | 中 | 高 | 全本地处理，零网络请求，开源核心 |

---

## 11. 成功指标

| 指标 | 基线（传统背单词） | 目标 |
|------|---------------------|------|
| 日活跃使用时长 | 10 min | 60 min+ |
| 7 日留存 | 25% | 45% |
| 28 日留存 | 10% | 30% |
| 词汇掌握速度 | 5 词/天 | 15 词/天 |
| new → mastered 平均天数 | 14 天 | 7 天 |
| 每日 Decode 打开次数 | N/A | 20+ |
| Combo 平均最高连击 | N/A | 8 |

---

## 12. 路线图

### Phase 1 — 核心入侵 (4-6 周)

| 交付物 | 说明 |
|--------|------|
| Chrome Extension 骨架 | MV3 manifest, service worker, content script |
| DOM Scanner | TreeWalker + MutationObserver + SPA 检测 |
| 基础 NLP 匹配 | Intl.Segmenter + 精确词库匹配 |
| Pretext Renderer | prepare/layout 集成 + 三级渲染策略 |
| IELTS 核心词库 | ~2000 词 + 中文映射 + 基础释义 |
| Invasion Mode 基础版 | Level 1-3 + 主题标记样式 |
| 简版 Decode 面板 | 音标 + 释义 + 当前语境 |
| Popup Dashboard | 今日统计 / 总量 / 等级调节 |
| Onboarding 流程 | 引导 + 主题选择 + 词库选择 + 等级选择 |
| 主题系统 | 4 主题 CSS 变量 + 切换逻辑 |
| StorageAdapter | Chrome Storage + IndexedDB 抽象 |

**不做：** Radar Mode、完整 Decode、Crit System、SM-2、LLM

### Phase 2 — 雷达上线 (3-4 周)

| 交付物 | 说明 |
|--------|------|
| Radar Mode | 英文网页标注 + 四级视觉分级 |
| 完整 Decode | 词根词缀 + 词源 + 母语者语感 |
| 词根词缀库 | 500 词根 + 300 词缀 |
| 词源数据 | 核心 5000 词精简版 |
| TOEFL / GRE 词库 | 扩展词库 + 学术/商务 |
| 自定义词库 | 手动添加 + CSV 导入 |
| 语境权重引擎 | 上下文共现分析 + 置信度 |
| 页面语言检测 | 自动切换 Invasion / Radar |

### Phase 3 — 暴击觉醒 (3-4 周)

| 交付物 | 说明 |
|--------|------|
| FX Canvas 引擎 | 粒子系统 + 主题适配特效 |
| Crit System | 7 暴击类型 + 视觉特效 |
| Combo 系统 | 30s 窗口 + 浮动 badge |
| SM-2 间隔重复 | Re-Glitch 队列 + 到期优先 |
| 统计面板增强 | 图表 + 进度曲线 |
| 成就系统 | 里程碑成就 |
| Level 4 | 完全覆写模式（解锁制） |
| 性能优化 | IntersectionObserver + 粒子池 |

### Phase 4 — 全面入侵 (持续迭代)

| 交付物 | 说明 |
|--------|------|
| LLM 桥接 | Ollama / 远程 API |
| 社区词库 | 分享/下载市场 |
| Firefox 适配 | WebExtension 兼容 |
| Edge 适配 | Chromium 低改动 |
| 音效系统 | Crit 音效 + 静音控制 |
| 数据导出 | JSON/CSV |
| 开放 API | 第三方词库协议 |
| Rift Reader | PDF 阅读器扩展（探索） |
