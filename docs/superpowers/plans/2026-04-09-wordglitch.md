# Flipword Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Flipword, a Chrome extension that turns web browsing into immersive English learning through "glitch aesthetic" word replacement, powered by the Pretext text measurement engine.

**Architecture:** Chrome Extension MV3 with 5-layer runtime (Core → Scanner → NLP → Renderer → FX). Content script orchestrates all layers. Preact + HTM for UI panels. Local Pretext library for pixel-accurate text measurement. Pure local storage via Chrome Storage API + IndexedDB behind a StorageAdapter abstraction.

**Tech Stack:** TypeScript, Preact + HTM, Pretext (local), Chrome Extension MV3, Bun (build + test), Intl.Segmenter (Chinese NLP)

**Spec:** `docs/superpowers/specs/2026-04-09-flipword-design.md`

---

## File Map

```
Flipword/
├── manifest.json                    # Chrome MV3 extension manifest
├── package.json                     # Bun workspace, scripts, deps
├── tsconfig.json                    # TypeScript config
├── build.ts                         # Bun build script for extension
├── src/
│   ├── core/
│   │   ├── types.ts                 # All shared interfaces (WordEntry, UserWordState, Theme, etc.)
│   │   ├── constants.ts             # Limits, defaults, config values
│   │   ├── themes.ts                # 4 theme definitions + CSS variable map
│   │   ├── storage.ts               # StorageAdapter: Chrome Storage + IndexedDB
│   │   └── messages.ts              # Background <-> content message protocol
│   ├── scanner/
│   │   └── index.ts                 # TreeWalker + MutationObserver + SPA detection
│   ├── nlp/
│   │   └── index.ts                 # Intl.Segmenter + Map lookup + priority sort
│   ├── renderer/
│   │   └── index.ts                 # Pretext measurement + 3 strategies + DOM swap
│   ├── fx/
│   │   └── index.ts                 # Canvas overlay + particle system (Phase 3 stub)
│   ├── crit/
│   │   └── index.ts                 # Crit detection + Combo tracking (Phase 3 stub)
│   ├── decode/
│   │   └── index.ts                 # Decode panel Preact component
│   ├── popup/
│   │   ├── index.html               # Popup HTML shell
│   │   └── index.tsx                # Popup Preact app (stats, levels, themes, settings)
│   ├── onboarding/
│   │   └── index.ts                 # Onboarding flow Preact component
│   ├── background.ts                # Service worker: messages, settings, stats
│   └── content.ts                   # Content script entry: orchestrates all layers
├── data/
│   └── word-banks/
│       └── ielts.json               # IELTS core word bank (~2000 entries)
├── tests/
│   ├── core/
│   │   ├── storage.test.ts          # StorageAdapter unit tests
│   │   └── themes.test.ts           # Theme generation tests
│   ├── nlp.test.ts                  # NLP matching tests
│   ├── scanner.test.ts              # DOM scanner tests
│   └── renderer.test.ts             # Render strategy tests
└── pretext/                         # Existing local dependency (unchanged)
```

---

## Phase 1 — 核心入侵 (Tasks 1–14)

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `manifest.json`
- Create: `build.ts`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "flipword",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "bun run build.ts",
    "dev": "bun run build.ts --watch",
    "test": "bun test",
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "htm": "^3.1.1",
    "preact": "^10.25.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/chrome": "^0.0.287",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["./src/*"],
      "@data/*": ["./data/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "build.ts"],
  "exclude": ["pretext"]
}
```

- [ ] **Step 3: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Flipword",
  "version": "0.1.0",
  "description": "Glitch your world into English.",
  "permissions": ["storage", "activeTab"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 4: Create build.ts**

```typescript
import { build, type BuildConfig } from 'bun';
import { cpSync, mkdirSync, rmSync } from 'fs';

const isWatch = process.argv.includes('--watch');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

const shared: Partial<BuildConfig> = {
  outdir: 'dist',
  target: 'browser',
  format: 'esm',
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : 'none',
};

await Promise.all([
  build({ ...shared, entrypoints: ['src/content.ts'], naming: 'content.js' }),
  build({ ...shared, entrypoints: ['src/background.ts'], naming: 'background.js' }),
  build({ ...shared, entrypoints: ['src/popup/index.tsx'], naming: 'popup.js' }),
]);

// Copy static assets
cpSync('manifest.json', 'dist/manifest.json');
cpSync('src/popup/index.html', 'dist/popup.html');
cpSync('data', 'dist/data', { recursive: true });
if (await Bun.file('src/content.css').exists()) {
  cpSync('src/content.css', 'dist/content.css');
}

console.log('Build complete → dist/');
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.superpowers/
*.tsbuildinfo
```

- [ ] **Step 6: Install dependencies and verify build**

Run: `cd /Users/joejiang/Flipword && bun install`
Expected: Dependencies installed successfully.

Run: `mkdir -p src && touch src/content.ts src/background.ts && mkdir -p src/popup && touch src/popup/index.tsx src/popup/index.html && mkdir -p data/word-banks`
Then: `bun run check`
Expected: No type errors (empty files).

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json manifest.json build.ts .gitignore
git commit -m "feat: scaffold Chrome extension project"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 1: Write all shared interfaces**

```typescript
// === Word Data ===

export interface MeaningEntry {
  partOfSpeech: string;
  definition: string;
  definitionCn: string;
}

export interface Morphology {
  prefix?: { part: string; meaning: string }[];
  root: { part: string; meaning: string };
  suffix?: { part: string; meaning: string }[];
  mnemonic: string;
}

export interface Etymology {
  origin: string;
  originalMeaning: string;
  story: string;
  entryPeriod?: string;
}

export interface NativeFeel {
  formality: 'casual' | 'neutral' | 'formal' | 'academic';
  sentiment: 'positive' | 'neutral' | 'negative';
  usageScenes: string[];
  synonyms: string[];
  confusables?: string[];
  notes?: string;
}

export interface ChineseMapping {
  chinese: string;
  partOfSpeech: string;
  contextHint?: string;
}

export interface WordEntry {
  id: string;
  word: string;
  phonetic: string;
  meanings: MeaningEntry[];
  difficulty: string[];
  morphology?: Morphology;
  etymology?: Etymology;
  nativeFeel?: NativeFeel;
  chineseMappings: ChineseMapping[];
}

// === User State ===

export type WordStatus = 'new' | 'seen' | 'learning' | 'reviewing' | 'mastered';

export interface UserWordState {
  wordId: string;
  status: WordStatus;
  exposureCount: number;
  contextDiversity: number;
  lastExposureAt: number;
  firstSeenAt: number;
  clickCount: number;
  hoverCount: number;
  decodedAt: number | null;
  correctRecognitions: number;
  masteredAt: number | null;
  nextReviewAt: number;
  easeFactor: number;
  interval: number;
  repetitions: number;
}

// === Context Matching ===

export type RenderStrategy = 'in-place' | 'shrink' | 'hover-expand';
export type MatchMethod = 'exact' | 'context' | 'llm';

export interface TextMetrics {
  width: number;
  fontSize: string;
  fontFamily: string;
}

export interface ContextMatch {
  originalText: string;
  sentenceContext: string;
  targetWord: string;
  wordEntry: WordEntry;
  confidenceScore: number;
  matchMethod: MatchMethod;
  originalMetrics: TextMetrics;
  replacementMetrics: TextMetrics & { adjustedFontSize?: string };
  renderStrategy: RenderStrategy;
  textNode: Text;
  startOffset: number;
  endOffset: number;
}

// === Settings ===

export type ThemeId = 'editorial' | 'brutalist' | 'soft' | 'minimal';
export type InvasionLevel = 1 | 2 | 3 | 4;

export interface UserSettings {
  theme: ThemeId;
  invasionLevel: InvasionLevel;
  wordBanks: string[];
  paused: boolean;
  onboarded: boolean;
}

export interface DailyStats {
  date: string;              // YYYY-MM-DD
  glitchCount: number;
  uniqueWords: Set<string>;  // serialized as array
  clearedCount: number;
  bestCombo: number;
}

// === Theme ===

export interface ThemeMarkStyle {
  fontFamily?: string;
  background?: string;
  color?: string;
  borderBottom?: string;
  borderRadius?: string;
  padding?: string;
  fontStyle?: string;
  fontWeight?: string;
  letterSpacing?: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  nameCn: string;
  mark: ThemeMarkStyle;
  decode: {
    border: string;
    borderRadius: string;
    background: string;
    headerFont: string;
    labelStyle: string;
  };
  popup: {
    background: string;
    foreground: string;
    accent: string;
    fontFamily: string;
  };
  cssVariables: Record<string, string>;
}

// === Invasion Level Config ===

export interface LevelConfig {
  level: InvasionLevel;
  name: string;
  nameCn: string;
  minWords: number;
  maxWords: number;
}
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: define all shared TypeScript interfaces"
```

---

### Task 3: Constants + Theme System

**Files:**
- Create: `src/core/constants.ts`
- Create: `src/core/themes.ts`
- Create: `tests/core/themes.test.ts`

- [ ] **Step 1: Write constants**

```typescript
import type { InvasionLevel, LevelConfig, UserSettings } from './types.js';

export const EXTENSION_PREFIX = 'wg';

export const BLACKLIST_TAGS = new Set([
  'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT',
  'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT', 'EMBED',
]);

export const LEVEL_CONFIGS: Record<InvasionLevel, LevelConfig> = {
  1: { level: 1, name: 'Infiltrate', nameCn: '初始渗透', minWords: 3, maxWords: 5 },
  2: { level: 2, name: 'Spread',     nameCn: '扩散感染', minWords: 8, maxWords: 15 },
  3: { level: 3, name: 'Invade',     nameCn: '全面入侵', minWords: 20, maxWords: 30 },
  4: { level: 4, name: 'Override',   nameCn: '完全覆写', minWords: 50, maxWords: 999 },
};

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'brutalist',
  invasionLevel: 2,
  wordBanks: ['ielts'],
  paused: false,
  onboarded: false,
};

export const RENDER_RATIO_INPLACE = 1.2;
export const RENDER_RATIO_SHRINK = 1.6;
export const RENDER_MIN_SCALE = 0.75;

export const SCANNER_BATCH_LIMIT = 200;
export const SCANNER_DEBOUNCE_MS = 200;

export const CONFIDENCE_THRESHOLD = 0.8;

export const COMBO_WINDOW_MS = 30_000;
```

- [ ] **Step 2: Write theme definitions**

```typescript
import type { Theme } from './types.js';

export const THEMES: Record<string, Theme> = {
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    nameCn: '杂志编辑风',
    mark: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontStyle: 'italic',
      color: '#c44',
      borderBottom: '1.5px solid #c44',
      padding: '0 1px',
    },
    decode: {
      border: '1px solid #ddd',
      borderRadius: '4px',
      background: '#FAFAF8',
      headerFont: 'Georgia, serif',
      labelStyle: 'font-variant: small-caps; color: #999;',
    },
    popup: {
      background: '#FAFAF8',
      foreground: '#1a1a1a',
      accent: '#c44',
      fontFamily: 'Georgia, serif',
    },
    cssVariables: {
      '--wg-bg': '#FAFAF8',
      '--wg-fg': '#1a1a1a',
      '--wg-accent': '#c44',
      '--wg-mark-font': 'Georgia, "Times New Roman", serif',
      '--wg-mono': '"Courier New", monospace',
      '--wg-muted': '#999',
      '--wg-border': '#ddd',
    },
  },

  brutalist: {
    id: 'brutalist',
    name: 'Brutalist',
    nameCn: '粗野主义',
    mark: {
      fontFamily: '"SF Mono", Menlo, "Courier New", monospace',
      background: '#111',
      color: '#fff',
      padding: '1px 6px',
      letterSpacing: '0.5px',
    },
    decode: {
      border: '2px solid #111',
      borderRadius: '0',
      background: '#fff',
      headerFont: '"SF Mono", Menlo, monospace',
      labelStyle: 'text-transform: uppercase; letter-spacing: 2px; font-size: 10px; color: #999;',
    },
    popup: {
      background: '#fff',
      foreground: '#111',
      accent: '#111',
      fontFamily: '"SF Mono", Menlo, monospace',
    },
    cssVariables: {
      '--wg-bg': '#fff',
      '--wg-fg': '#111',
      '--wg-accent': '#111',
      '--wg-mark-font': '"SF Mono", Menlo, "Courier New", monospace',
      '--wg-mono': '"SF Mono", Menlo, "Courier New", monospace',
      '--wg-muted': '#999',
      '--wg-border': '#111',
    },
  },

  soft: {
    id: 'soft',
    name: 'Soft',
    nameCn: '柔和彩蛋风',
    mark: {
      background: 'linear-gradient(120deg, #e8d5f5, #fce4ec)',
      color: '#7b4fa2',
      borderRadius: '12px',
      padding: '2px 8px',
      fontWeight: '600',
    },
    decode: {
      border: '1px solid #e8d5f5',
      borderRadius: '16px',
      background: '#fdfbff',
      headerFont: '-apple-system, "Helvetica Neue", sans-serif',
      labelStyle: 'color: #b08dd4; font-weight: 600; font-size: 11px;',
    },
    popup: {
      background: 'linear-gradient(135deg, #f8f6ff, #fff5f5)',
      foreground: '#2d2d3a',
      accent: '#7b4fa2',
      fontFamily: '-apple-system, "Helvetica Neue", sans-serif',
    },
    cssVariables: {
      '--wg-bg': '#fdfbff',
      '--wg-fg': '#2d2d3a',
      '--wg-accent': '#7b4fa2',
      '--wg-mark-font': 'inherit',
      '--wg-mono': '"SF Mono", Menlo, monospace',
      '--wg-muted': '#b08dd4',
      '--wg-border': '#e8d5f5',
    },
  },

  minimal: {
    id: 'minimal',
    name: 'Minimal',
    nameCn: '精确克制风',
    mark: {
      color: '#0066CC',
      borderBottom: '1.5px solid #0066CC',
      padding: '0 0 0.5px 0',
    },
    decode: {
      border: 'none',
      borderRadius: '8px',
      background: '#fff',
      headerFont: '-apple-system, "SF Pro Text", sans-serif',
      labelStyle: 'font-size: 10px; color: #aaa; letter-spacing: 0.5px;',
    },
    popup: {
      background: '#fff',
      foreground: '#1d1d1f',
      accent: '#0066CC',
      fontFamily: '-apple-system, "SF Pro Text", sans-serif',
    },
    cssVariables: {
      '--wg-bg': '#fff',
      '--wg-fg': '#1d1d1f',
      '--wg-accent': '#0066CC',
      '--wg-mark-font': 'inherit',
      '--wg-mono': '"SF Mono", Menlo, monospace',
      '--wg-muted': '#aaa',
      '--wg-border': '#e5e5e5',
    },
  },
};

export function getTheme(id: string): Theme {
  return THEMES[id] ?? THEMES.brutalist;
}

export function generateThemeCSS(theme: Theme): string {
  return Object.entries(theme.cssVariables)
    .map(([key, val]) => `${key}: ${val};`)
    .join('\n  ');
}
```

- [ ] **Step 3: Write theme tests**

```typescript
import { describe, expect, test } from 'bun:test';
import { THEMES, getTheme, generateThemeCSS } from '../../src/core/themes.js';

describe('themes', () => {
  test('all 4 themes defined', () => {
    expect(Object.keys(THEMES)).toEqual(['editorial', 'brutalist', 'soft', 'minimal']);
  });

  test('each theme has required fields', () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(theme.mark).toBeTruthy();
      expect(theme.decode).toBeTruthy();
      expect(theme.popup).toBeTruthy();
      expect(theme.cssVariables).toBeTruthy();
      expect(theme.cssVariables['--wg-accent']).toBeTruthy();
    }
  });

  test('getTheme returns brutalist for unknown id', () => {
    expect(getTheme('nonexistent').id).toBe('brutalist');
  });

  test('generateThemeCSS produces valid CSS', () => {
    const css = generateThemeCSS(THEMES.brutalist);
    expect(css).toContain('--wg-fg: #111;');
    expect(css).toContain('--wg-accent: #111;');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `bun test tests/core/themes.test.ts`
Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/constants.ts src/core/themes.ts tests/core/themes.test.ts
git commit -m "feat: add constants, 4-theme system with CSS variable generation"
```

---

### Task 4: Storage Adapter

**Files:**
- Create: `src/core/storage.ts`
- Create: `src/core/messages.ts`
- Create: `tests/core/storage.test.ts`

- [ ] **Step 1: Write message protocol**

```typescript
import type { DailyStats, UserSettings, UserWordState } from './types.js';

// Background <-> Content/Popup message types
export type Message =
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Partial<UserSettings> }
  | { type: 'GET_STATS' }
  | { type: 'RECORD_EXPOSURE'; wordId: string; pageUrl: string }
  | { type: 'RECORD_CLICK'; wordId: string }
  | { type: 'RECORD_HOVER'; wordId: string }
  | { type: 'MARK_CLEARED'; wordId: string }
  | { type: 'MARK_REVIEW'; wordId: string }
  | { type: 'GET_WORD_STATE'; wordId: string }
  | { type: 'GET_WORD_STATES'; wordIds: string[] }
  | { type: 'GET_PAGE_COUNT' };

export type MessageResponse<T extends Message['type']> =
  T extends 'GET_SETTINGS' ? UserSettings :
  T extends 'GET_STATS' ? { today: number; total: number; cleared: number; bestCombo: number } :
  T extends 'GET_WORD_STATE' ? UserWordState | null :
  T extends 'GET_WORD_STATES' ? Record<string, UserWordState> :
  T extends 'GET_PAGE_COUNT' ? number :
  void;

export function sendMessage<T extends Message>(msg: T): Promise<MessageResponse<T['type']>> {
  return chrome.runtime.sendMessage(msg);
}
```

- [ ] **Step 2: Write StorageAdapter**

```typescript
import type { DailyStats, UserSettings, UserWordState } from './types.js';
import { DEFAULT_SETTINGS } from './constants.js';

const SETTINGS_KEY = 'wg_settings';
const STATS_KEY = 'wg_stats';
const DB_NAME = 'flipword';
const DB_VERSION = 1;
const WORD_STATE_STORE = 'wordStates';

// --- Chrome Storage (settings + daily stats) ---

export async function loadSettings(): Promise<UserSettings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
}

export async function saveSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await loadSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: updated });
  return updated;
}

export async function loadDailyStats(): Promise<DailyStats> {
  const today = new Date().toISOString().slice(0, 10);
  const result = await chrome.storage.local.get(STATS_KEY);
  const stored = result[STATS_KEY];
  if (stored && stored.date === today) {
    return { ...stored, uniqueWords: new Set(stored.uniqueWords) };
  }
  return { date: today, glitchCount: 0, uniqueWords: new Set(), clearedCount: 0, bestCombo: 0 };
}

export async function saveDailyStats(stats: DailyStats): Promise<void> {
  await chrome.storage.local.set({
    [STATS_KEY]: { ...stats, uniqueWords: [...stats.uniqueWords] },
  });
}

// --- IndexedDB (word states) ---

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(WORD_STATE_STORE)) {
        db.createObjectStore(WORD_STATE_STORE, { keyPath: 'wordId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getWordState(wordId: string): Promise<UserWordState | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORD_STATE_STORE, 'readonly');
    const req = tx.objectStore(WORD_STATE_STORE).get(wordId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getWordStates(wordIds: string[]): Promise<Record<string, UserWordState>> {
  const db = await openDB();
  const results: Record<string, UserWordState> = {};
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORD_STATE_STORE, 'readonly');
    const store = tx.objectStore(WORD_STATE_STORE);
    let pending = wordIds.length;
    if (pending === 0) { resolve(results); return; }
    for (const id of wordIds) {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) results[id] = req.result;
        if (--pending === 0) resolve(results);
      };
      req.onerror = () => reject(req.error);
    }
  });
}

export async function putWordState(state: UserWordState): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORD_STATE_STORE, 'readwrite');
    const req = tx.objectStore(WORD_STATE_STORE).put(state);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function newWordState(wordId: string): UserWordState {
  const now = Date.now();
  return {
    wordId,
    status: 'new',
    exposureCount: 0,
    contextDiversity: 0,
    lastExposureAt: now,
    firstSeenAt: now,
    clickCount: 0,
    hoverCount: 0,
    decodedAt: null,
    correctRecognitions: 0,
    masteredAt: null,
    nextReviewAt: now,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
  };
}
```

- [ ] **Step 3: Write storage tests**

```typescript
import { describe, expect, test } from 'bun:test';
import { newWordState } from '../../src/core/storage.js';

describe('storage', () => {
  test('newWordState creates correct defaults', () => {
    const state = newWordState('aberrant');
    expect(state.wordId).toBe('aberrant');
    expect(state.status).toBe('new');
    expect(state.exposureCount).toBe(0);
    expect(state.easeFactor).toBe(2.5);
    expect(state.interval).toBe(0);
    expect(state.masteredAt).toBeNull();
  });

  test('newWordState sets timestamps to now', () => {
    const before = Date.now();
    const state = newWordState('test');
    const after = Date.now();
    expect(state.firstSeenAt).toBeGreaterThanOrEqual(before);
    expect(state.firstSeenAt).toBeLessThanOrEqual(after);
    expect(state.lastExposureAt).toBe(state.firstSeenAt);
    expect(state.nextReviewAt).toBe(state.firstSeenAt);
  });
});
```

Note: Chrome Storage API and IndexedDB require browser/extension context. Unit tests cover pure logic; integration tests in Task 14 cover actual storage.

- [ ] **Step 4: Run tests**

Run: `bun test tests/core/storage.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/storage.ts src/core/messages.ts tests/core/storage.test.ts
git commit -m "feat: add StorageAdapter (Chrome Storage + IndexedDB) and message protocol"
```

---

### Task 5: Word Bank Data + Loader

**Files:**
- Create: `data/word-banks/ielts.json` (structure + seed entries)
- Create: `src/nlp/word-bank.ts`

- [ ] **Step 1: Define word bank JSON structure with seed data**

Create `data/word-banks/ielts.json` with the first 20 entries as seed. Full 2000-entry dataset to be populated separately. Structure:

```json
[
  {
    "id": "environment",
    "word": "environment",
    "phonetic": "/ɪnˈvaɪrənmənt/",
    "meanings": [{ "partOfSpeech": "n", "definition": "the natural world", "definitionCn": "环境，自然环境" }],
    "difficulty": ["IELTS_5"],
    "chineseMappings": [{ "chinese": "环境", "partOfSpeech": "n" }]
  },
  {
    "id": "fundamental",
    "word": "fundamental",
    "phonetic": "/ˌfʌn.dəˈmen.tl/",
    "meanings": [{ "partOfSpeech": "adj", "definition": "forming the base or foundation", "definitionCn": "基本的，根本的" }],
    "difficulty": ["IELTS_6"],
    "morphology": {
      "root": { "part": "fund", "meaning": "基础" },
      "suffix": [{ "part": "ment", "meaning": "状态" }, { "part": "al", "meaning": "形容词" }],
      "mnemonic": "构成基础的状态 → 根本的"
    },
    "chineseMappings": [{ "chinese": "根本", "partOfSpeech": "adj" }, { "chinese": "基本", "partOfSpeech": "adj" }]
  },
  {
    "id": "innovation",
    "word": "innovation",
    "phonetic": "/ˌɪn.əˈveɪ.ʃən/",
    "meanings": [{ "partOfSpeech": "n", "definition": "a new method or idea", "definitionCn": "创新，革新" }],
    "difficulty": ["IELTS_6"],
    "chineseMappings": [{ "chinese": "创新", "partOfSpeech": "n" }, { "chinese": "革新", "partOfSpeech": "n" }]
  },
  {
    "id": "policy",
    "word": "policy",
    "phonetic": "/ˈpɒl.ə.si/",
    "meanings": [{ "partOfSpeech": "n", "definition": "a course of action adopted by government or organization", "definitionCn": "政策，方针" }],
    "difficulty": ["IELTS_5"],
    "chineseMappings": [{ "chinese": "政策", "partOfSpeech": "n" }, { "chinese": "方针", "partOfSpeech": "n" }]
  },
  {
    "id": "significant",
    "word": "significant",
    "phonetic": "/sɪɡˈnɪf.ɪ.kənt/",
    "meanings": [{ "partOfSpeech": "adj", "definition": "important or large enough to have an effect", "definitionCn": "重要的，显著的" }],
    "difficulty": ["IELTS_5"],
    "chineseMappings": [{ "chinese": "显著", "partOfSpeech": "adj" }, { "chinese": "重要", "partOfSpeech": "adj" }]
  }
]
```

(Continue with 15 more entries covering common IELTS topics: economy, technology, health, society, education.)

- [ ] **Step 2: Write word bank loader**

```typescript
import type { WordEntry } from '../core/types.js';

export type WordBank = {
  entries: WordEntry[];
  byId: Map<string, WordEntry>;
  byChinese: Map<string, WordEntry>;
};

export function buildWordBank(entries: WordEntry[]): WordBank {
  const byId = new Map<string, WordEntry>();
  const byChinese = new Map<string, WordEntry>();

  for (const entry of entries) {
    byId.set(entry.id, entry);
    for (const mapping of entry.chineseMappings) {
      // First mapping wins for duplicate Chinese words
      if (!byChinese.has(mapping.chinese)) {
        byChinese.set(mapping.chinese, entry);
      }
    }
  }

  return { entries, byId, byChinese };
}

export async function loadWordBank(bankId: string): Promise<WordBank> {
  const url = chrome.runtime.getURL(`data/word-banks/${bankId}.json`);
  const resp = await fetch(url);
  const entries: WordEntry[] = await resp.json();
  return buildWordBank(entries);
}
```

- [ ] **Step 3: Commit**

```bash
git add data/word-banks/ielts.json src/nlp/word-bank.ts
git commit -m "feat: add IELTS word bank seed data and loader"
```

---

### Task 6: NLP Matching Engine

**Files:**
- Create: `src/nlp/index.ts`
- Create: `tests/nlp.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, test } from 'bun:test';
import { buildWordBank } from '../src/nlp/word-bank.js';
import { findMatches, selectWords } from '../src/nlp/index.js';
import type { WordEntry } from '../src/core/types.js';

const MOCK_ENTRIES: WordEntry[] = [
  {
    id: 'environment', word: 'environment', phonetic: '', meanings: [],
    difficulty: [], chineseMappings: [{ chinese: '环境', partOfSpeech: 'n' }],
  },
  {
    id: 'policy', word: 'policy', phonetic: '', meanings: [],
    difficulty: [], chineseMappings: [{ chinese: '政策', partOfSpeech: 'n' }],
  },
  {
    id: 'innovation', word: 'innovation', phonetic: '', meanings: [],
    difficulty: [], chineseMappings: [{ chinese: '创新', partOfSpeech: 'n' }],
  },
];

const bank = buildWordBank(MOCK_ENTRIES);

describe('findMatches', () => {
  test('finds Chinese words that match word bank', () => {
    const matches = findMatches('保护环境是一项重要的政策', bank);
    expect(matches.length).toBe(2);
    expect(matches.map(m => m.targetWord).sort()).toEqual(['environment', 'policy']);
  });

  test('returns empty for text with no matches', () => {
    const matches = findMatches('今天天气很好', bank);
    expect(matches.length).toBe(0);
  });

  test('includes sentence context', () => {
    const matches = findMatches('保护环境很重要', bank);
    expect(matches[0].sentenceContext).toBe('保护环境很重要');
  });
});

describe('selectWords', () => {
  test('respects maxWords limit', () => {
    const matches = findMatches('环境政策和创新', bank);
    const selected = selectWords(matches, 2);
    expect(selected.length).toBe(2);
  });

  test('returns all matches if under limit', () => {
    const matches = findMatches('环境政策和创新', bank);
    const selected = selectWords(matches, 10);
    expect(selected.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/nlp.test.ts`
Expected: FAIL — `findMatches` and `selectWords` not defined.

- [ ] **Step 3: Implement NLP engine**

```typescript
import type { WordEntry, MatchMethod } from '../core/types.js';
import type { WordBank } from './word-bank.js';
import { CONFIDENCE_THRESHOLD } from '../core/constants.js';

export interface RawMatch {
  originalText: string;
  sentenceContext: string;
  targetWord: string;
  wordEntry: WordEntry;
  confidenceScore: number;
  matchMethod: MatchMethod;
  startOffset: number;
  endOffset: number;
}

export function findMatches(text: string, bank: WordBank): RawMatch[] {
  const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
  const segments = segmenter.segment(text);
  const matches: RawMatch[] = [];

  let offset = 0;
  for (const { segment, isWordLike } of segments) {
    if (isWordLike) {
      const entry = bank.byChinese.get(segment);
      if (entry) {
        matches.push({
          originalText: segment,
          sentenceContext: text,
          targetWord: entry.word,
          wordEntry: entry,
          confidenceScore: 1.0,   // Phase 1: exact match = full confidence
          matchMethod: 'exact',
          startOffset: offset,
          endOffset: offset + segment.length,
        });
      }
    }
    offset += segment.length;
  }

  return matches;
}

export function selectWords(matches: RawMatch[], maxWords: number): RawMatch[] {
  // Phase 1: shuffle + slice. Phase 2+ adds priority scoring.
  const shuffled = [...matches];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, maxWords);
}
```

- [ ] **Step 4: Run tests**

Run: `bun test tests/nlp.test.ts`
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/nlp/index.ts tests/nlp.test.ts
git commit -m "feat: add NLP matching engine with Intl.Segmenter + word bank lookup"
```

---

### Task 7: DOM Scanner

**Files:**
- Create: `src/scanner/index.ts`
- Create: `tests/scanner.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, test } from 'bun:test';
import { hasChinese, shouldSkipNode } from '../src/scanner/index.js';

describe('hasChinese', () => {
  test('detects Chinese characters', () => {
    expect(hasChinese('今天天气很好')).toBe(true);
    expect(hasChinese('这是一个test')).toBe(true);
  });

  test('rejects non-Chinese text', () => {
    expect(hasChinese('Hello world')).toBe(false);
    expect(hasChinese('12345')).toBe(false);
    expect(hasChinese('')).toBe(false);
  });
});

describe('shouldSkipNode', () => {
  test('skips blacklisted tags', () => {
    const script = document.createElement('script');
    script.textContent = '中文';
    expect(shouldSkipNode(script.firstChild as Text)).toBe(true);
  });

  test('skips already-glitched nodes', () => {
    const div = document.createElement('div');
    div.setAttribute('data-wg', 'test');
    div.textContent = '中文';
    expect(shouldSkipNode(div.firstChild as Text)).toBe(true);
  });

  test('accepts normal Chinese text node', () => {
    const p = document.createElement('p');
    p.textContent = '今天天气很好';
    document.body.appendChild(p);
    expect(shouldSkipNode(p.firstChild as Text)).toBe(false);
    p.remove();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/scanner.test.ts`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement scanner**

```typescript
import { BLACKLIST_TAGS, EXTENSION_PREFIX, SCANNER_BATCH_LIMIT, SCANNER_DEBOUNCE_MS } from '../core/constants.js';

const CHINESE_RE = /[\u4e00-\u9fff]/;

export function hasChinese(text: string): boolean {
  return CHINESE_RE.test(text);
}

export function shouldSkipNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (BLACKLIST_TAGS.has(parent.tagName)) return true;
  if (!node.textContent?.trim()) return true;
  if (parent.closest(`[data-${EXTENSION_PREFIX}]`)) return true;
  return false;
}

export function collectTextNodes(root: Element): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Text) {
      if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
      if (!hasChinese(node.textContent ?? '')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
    if (nodes.length >= SCANNER_BATCH_LIMIT) break;
  }
  return nodes;
}

export type ScanCallback = (nodes: Text[]) => void;

export function observeMutations(root: Element, onNew: ScanCallback): MutationObserver {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver((mutations) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const newNodes: Text[] = [];
      for (const mutation of mutations) {
        for (const added of mutation.addedNodes) {
          if (added.nodeType === Node.TEXT_NODE) {
            const text = added as Text;
            if (!shouldSkipNode(text) && hasChinese(text.textContent ?? '')) {
              newNodes.push(text);
            }
          } else if (added.nodeType === Node.ELEMENT_NODE) {
            newNodes.push(...collectTextNodes(added as Element));
          }
        }
      }
      if (newNodes.length > 0) onNew(newNodes);
    }, SCANNER_DEBOUNCE_MS);
  });

  observer.observe(root, { childList: true, subtree: true, characterData: true });
  return observer;
}

export function observeSPANavigation(callback: () => void): void {
  // Intercept pushState/replaceState
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);

  history.pushState = (...args) => { origPush(...args); callback(); };
  history.replaceState = (...args) => { origReplace(...args); callback(); };
  window.addEventListener('popstate', callback);
}
```

- [ ] **Step 4: Run tests**

Run: `bun test tests/scanner.test.ts`
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/scanner/index.ts tests/scanner.test.ts
git commit -m "feat: add DOM scanner with TreeWalker, MutationObserver, SPA detection"
```

---

### Task 8: Pretext Renderer

**Files:**
- Create: `src/renderer/index.ts`
- Create: `tests/renderer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, test } from 'bun:test';
import { selectRenderStrategy } from '../src/renderer/index.js';

describe('selectRenderStrategy', () => {
  test('in-place for ratio <= 1.2', () => {
    expect(selectRenderStrategy(1.0)).toBe('in-place');
    expect(selectRenderStrategy(1.2)).toBe('in-place');
  });

  test('shrink for ratio 1.2-1.6', () => {
    expect(selectRenderStrategy(1.3)).toBe('shrink');
    expect(selectRenderStrategy(1.6)).toBe('shrink');
  });

  test('hover-expand for ratio > 1.6', () => {
    expect(selectRenderStrategy(1.7)).toBe('hover-expand');
    expect(selectRenderStrategy(3.0)).toBe('hover-expand');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/renderer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement renderer**

```typescript
import type { RenderStrategy, Theme, ThemeMarkStyle } from '../core/types.js';
import { EXTENSION_PREFIX, RENDER_RATIO_INPLACE, RENDER_RATIO_SHRINK, RENDER_MIN_SCALE } from '../core/constants.js';
import type { RawMatch } from '../nlp/index.js';

export function selectRenderStrategy(ratio: number): RenderStrategy {
  if (ratio <= RENDER_RATIO_INPLACE) return 'in-place';
  if (ratio <= RENDER_RATIO_SHRINK) return 'shrink';
  return 'hover-expand';
}

function applyMarkStyle(el: HTMLElement, style: ThemeMarkStyle): void {
  if (style.fontFamily) el.style.fontFamily = style.fontFamily;
  if (style.background) el.style.background = style.background;
  if (style.color) el.style.color = style.color;
  if (style.borderBottom) el.style.borderBottom = style.borderBottom;
  if (style.borderRadius) el.style.borderRadius = style.borderRadius;
  if (style.padding) el.style.padding = style.padding;
  if (style.fontStyle) el.style.fontStyle = style.fontStyle;
  if (style.fontWeight) el.style.fontWeight = style.fontWeight;
  if (style.letterSpacing) el.style.letterSpacing = style.letterSpacing;
}

export interface GlitchResult {
  span: HTMLSpanElement;
  strategy: RenderStrategy;
}

export function createGlitchSpan(
  match: RawMatch,
  strategy: RenderStrategy,
  theme: Theme,
  originalFontSize: number,
  originalWidth: number,
  replaceWidth: number,
): GlitchResult {
  const span = document.createElement('span');
  span.dataset[EXTENSION_PREFIX] = match.targetWord;
  span.dataset[`${EXTENSION_PREFIX}Original`] = match.originalText;
  span.textContent = match.targetWord;
  span.style.cursor = 'pointer';

  applyMarkStyle(span, theme.mark);

  if (strategy === 'shrink') {
    const scale = Math.max(RENDER_MIN_SCALE, originalWidth / replaceWidth);
    span.style.fontSize = `${originalFontSize * scale}px`;
  } else if (strategy === 'hover-expand') {
    span.style.maxWidth = `${originalWidth * RENDER_RATIO_INPLACE}px`;
    span.style.overflow = 'hidden';
    span.style.textOverflow = 'ellipsis';
    span.style.whiteSpace = 'nowrap';
    span.style.display = 'inline-block';
    span.style.verticalAlign = 'bottom';

    span.addEventListener('mouseenter', () => {
      span.style.maxWidth = 'none';
      span.style.overflow = 'visible';
    });
    span.addEventListener('mouseleave', () => {
      span.style.maxWidth = `${originalWidth * RENDER_RATIO_INPLACE}px`;
      span.style.overflow = 'hidden';
    });
  }

  // Tooltip: show original Chinese on hover (all strategies)
  span.title = match.originalText;

  return { span, strategy };
}

export function replaceInTextNode(
  textNode: Text,
  match: RawMatch,
  span: HTMLSpanElement,
): void {
  const text = textNode.textContent ?? '';
  const before = text.slice(0, match.startOffset);
  const after = text.slice(match.endOffset);

  const parent = textNode.parentNode!;
  const frag = document.createDocumentFragment();

  if (before) frag.appendChild(document.createTextNode(before));
  frag.appendChild(span);
  if (after) frag.appendChild(document.createTextNode(after));

  parent.replaceChild(frag, textNode);
}
```

- [ ] **Step 4: Run tests**

Run: `bun test tests/renderer.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/index.ts tests/renderer.test.ts
git commit -m "feat: add Pretext-driven renderer with 3 strategies and theme-aware marks"
```

---

### Task 9: Background Service Worker

**Files:**
- Create: `src/background.ts`

- [ ] **Step 1: Implement service worker**

```typescript
import type { Message } from './core/messages.js';
import { loadSettings, saveSettings, loadDailyStats, saveDailyStats, getWordState, getWordStates, putWordState, newWordState } from './core/storage.js';

let pageCount = 0;

chrome.runtime.onInstalled.addListener(async () => {
  // Ensure defaults exist
  await loadSettings();
});

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse);
  return true; // keep channel open for async response
});

async function handleMessage(msg: Message): Promise<unknown> {
  switch (msg.type) {
    case 'GET_SETTINGS':
      return loadSettings();

    case 'SAVE_SETTINGS':
      return saveSettings(msg.settings);

    case 'GET_STATS': {
      const stats = await loadDailyStats();
      return {
        today: stats.glitchCount,
        total: stats.uniqueWords.size,
        cleared: stats.clearedCount,
        bestCombo: stats.bestCombo,
      };
    }

    case 'RECORD_EXPOSURE': {
      const stats = await loadDailyStats();
      stats.glitchCount++;
      stats.uniqueWords.add(msg.wordId);
      await saveDailyStats(stats);

      let state = await getWordState(msg.wordId);
      if (!state) state = newWordState(msg.wordId);
      state.exposureCount++;
      state.lastExposureAt = Date.now();
      if (state.status === 'new') state.status = 'seen';
      await putWordState(state);
      return;
    }

    case 'RECORD_CLICK': {
      let state = await getWordState(msg.wordId);
      if (!state) state = newWordState(msg.wordId);
      state.clickCount++;
      if (state.decodedAt === null) state.decodedAt = Date.now();
      if (state.status === 'seen') state.status = 'learning';
      await putWordState(state);
      return;
    }

    case 'RECORD_HOVER': {
      let state = await getWordState(msg.wordId);
      if (!state) state = newWordState(msg.wordId);
      state.hoverCount++;
      await putWordState(state);
      return;
    }

    case 'MARK_CLEARED': {
      let state = await getWordState(msg.wordId);
      if (!state) state = newWordState(msg.wordId);
      state.status = 'mastered';
      state.masteredAt = Date.now();
      await putWordState(state);

      const stats = await loadDailyStats();
      stats.clearedCount++;
      await saveDailyStats(stats);
      return;
    }

    case 'MARK_REVIEW': {
      let state = await getWordState(msg.wordId);
      if (!state) state = newWordState(msg.wordId);
      state.status = 'reviewing';
      await putWordState(state);
      return;
    }

    case 'GET_WORD_STATE':
      return getWordState(msg.wordId);

    case 'GET_WORD_STATES':
      return getWordStates(msg.wordIds);

    case 'GET_PAGE_COUNT':
      return pageCount;
  }
}

// Track page glitch events
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'RECORD_EXPOSURE') pageCount++;
});
```

- [ ] **Step 2: Commit**

```bash
git add src/background.ts
git commit -m "feat: add background service worker with message handling and stats tracking"
```

---

### Task 10: Decode Panel

**Files:**
- Create: `src/decode/index.ts`

- [ ] **Step 1: Implement Decode panel**

```typescript
import { html } from 'htm/preact';
import { render } from 'preact';
import type { WordEntry, Theme } from '../core/types.js';
import { EXTENSION_PREFIX } from '../core/constants.js';
import { sendMessage } from '../core/messages.js';

let panelRoot: HTMLDivElement | null = null;

export function showDecodePanel(entry: WordEntry, context: string, theme: Theme): void {
  hideDecodePanel();

  panelRoot = document.createElement('div');
  panelRoot.id = `${EXTENSION_PREFIX}-decode`;
  panelRoot.style.cssText = `
    position: fixed; z-index: 2147483647;
    top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 380px; max-height: 80vh; overflow-y: auto;
    border: ${theme.decode.border};
    border-radius: ${theme.decode.borderRadius};
    background: ${theme.decode.background};
    font-family: -apple-system, "Helvetica Neue", sans-serif;
    font-size: 14px; color: #333;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  `;

  // Overlay to close on outside click
  const overlay = document.createElement('div');
  overlay.id = `${EXTENSION_PREFIX}-overlay`;
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483646;
    background: rgba(0,0,0,0.15);
  `;
  overlay.addEventListener('click', hideDecodePanel);

  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(panelRoot);

  render(html`<${DecodeContent}
    entry=${entry}
    context=${context}
    theme=${theme}
    onClear=${() => handleClear(entry.id)}
    onReview=${() => handleReview(entry.id)}
    onClose=${hideDecodePanel}
  />`, panelRoot);

  // Record click
  sendMessage({ type: 'RECORD_CLICK', wordId: entry.id }).catch(() => {});
}

export function hideDecodePanel(): void {
  document.getElementById(`${EXTENSION_PREFIX}-overlay`)?.remove();
  document.getElementById(`${EXTENSION_PREFIX}-decode`)?.remove();
  panelRoot = null;
}

function DecodeContent({ entry, context, theme, onClear, onReview, onClose }: {
  entry: WordEntry;
  context: string;
  theme: Theme;
  onClear: () => void;
  onReview: () => void;
  onClose: () => void;
}) {
  const labelStyle = theme.decode.labelStyle;

  return html`
    <div style="position: relative;">
      <!-- Close button -->
      <button onClick=${onClose} style="
        position: absolute; top: 12px; right: 12px;
        background: none; border: none; cursor: pointer;
        font-size: 18px; color: #999; line-height: 1;
      ">×</button>

      <!-- Header: word + phonetic -->
      <div style="padding: 20px 24px; border-bottom: 1px solid var(--wg-border, #eee);">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-family: ${theme.decode.headerFont}; font-size: 24px; font-weight: 700;">
            ${entry.word}
          </span>
          ${entry.difficulty.length > 0 && html`
            <span style="font-size: 11px; color: var(--wg-muted, #999);">
              ${entry.difficulty[0]}
            </span>
          `}
        </div>
        <div style="font-size: 13px; color: var(--wg-muted, #888); margin-top: 4px;">
          ${entry.phonetic}
        </div>
        <!-- Meanings -->
        <div style="margin-top: 8px;">
          ${entry.meanings.map(m => html`
            <div style="font-size: 13px; color: #555;">
              <span style="color: var(--wg-muted, #999); margin-right: 4px;">${m.partOfSpeech}</span>
              ${m.definitionCn}
            </div>
          `)}
        </div>
      </div>

      <!-- Morphology (if available) -->
      ${entry.morphology && html`
        <div style="padding: 14px 24px; border-bottom: 1px solid var(--wg-border, #eee);">
          <div style="${labelStyle}">Decode</div>
          <div style="font-family: var(--wg-mono); font-size: 13px; color: #333; margin-top: 6px; line-height: 1.7;">
            ${entry.morphology.prefix?.map(p => html`
              <span style="background: var(--wg-accent); color: #fff; padding: 0 4px;">${p.part}-</span>
              <span> ${p.meaning} </span>
            `)}
            <span style="background: var(--wg-accent); color: #fff; padding: 0 4px;">${entry.morphology.root.part}</span>
            <span> ${entry.morphology.root.meaning} </span>
            ${entry.morphology.suffix?.map(s => html`
              <span style="background: var(--wg-accent); color: #fff; padding: 0 4px;">-${s.part}</span>
              <span> ${s.meaning} </span>
            `)}
          </div>
          <div style="font-size: 13px; color: #666; margin-top: 6px;">→ ${entry.morphology.mnemonic}</div>
        </div>
      `}

      <!-- Context -->
      <div style="padding: 14px 24px; border-bottom: 1px solid var(--wg-border, #eee);">
        <div style="${labelStyle}">Context</div>
        <div style="font-size: 13px; color: #444; margin-top: 6px; line-height: 1.6;">
          "${context}"
        </div>
      </div>

      <!-- Actions -->
      <div style="padding: 14px 24px; display: flex; gap: 8px;">
        <button onClick=${onClear} style="
          flex: 1; padding: 10px; text-align: center; cursor: pointer;
          background: var(--wg-accent, #111); color: #fff; border: none;
          font-size: 13px; font-weight: 600; letter-spacing: 0.5px;
        ">Cleared ✓</button>
        <button onClick=${onReview} style="
          flex: 1; padding: 10px; text-align: center; cursor: pointer;
          background: none; border: 1.5px solid var(--wg-accent, #111);
          color: var(--wg-fg, #111);
          font-size: 13px; font-weight: 600; letter-spacing: 0.5px;
        ">Re-Glitch ↻</button>
      </div>
    </div>
  `;
}

async function handleClear(wordId: string): Promise<void> {
  await sendMessage({ type: 'MARK_CLEARED', wordId }).catch(() => {});
  hideDecodePanel();
}

async function handleReview(wordId: string): Promise<void> {
  await sendMessage({ type: 'MARK_REVIEW', wordId }).catch(() => {});
  hideDecodePanel();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/decode/index.ts
git commit -m "feat: add Decode panel with Preact + HTM, theme-aware styling"
```

---

### Task 11: Popup Dashboard

**Files:**
- Create: `src/popup/index.html`
- Create: `src/popup/index.tsx`

- [ ] **Step 1: Write popup HTML shell**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 320px; min-height: 400px; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write popup Preact app**

```tsx
import { html } from 'htm/preact';
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { sendMessage } from '../core/messages.js';
import { THEMES } from '../core/themes.js';
import { LEVEL_CONFIGS } from '../core/constants.js';
import type { UserSettings, ThemeId, InvasionLevel } from '../core/types.js';

function Popup() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [stats, setStats] = useState({ today: 0, total: 0, cleared: 0, bestCombo: 0 });

  useEffect(() => {
    sendMessage({ type: 'GET_SETTINGS' }).then(setSettings).catch(() => {});
    sendMessage({ type: 'GET_STATS' }).then(setStats).catch(() => {});
  }, []);

  if (!settings) return html`<div style="padding: 40px; text-align: center; color: #999;">Loading...</div>`;

  const theme = THEMES[settings.theme];
  const fontFamily = theme.popup.fontFamily;

  async function updateSetting(partial: Partial<UserSettings>) {
    const updated = await sendMessage({ type: 'SAVE_SETTINGS', settings: partial });
    setSettings(updated);
  }

  return html`
    <div style="
      background: ${theme.popup.background};
      color: ${theme.popup.foreground};
      font-family: ${fontFamily};
      min-height: 400px;
    ">
      <!-- Header -->
      <div style="padding: 20px 20px 16px; border-bottom: 2px solid ${theme.popup.accent};">
        <div style="font-family: var(--wg-mono, monospace); font-size: 18px; font-weight: 700;">Flipword</div>
        <div style="font-size: 10px; color: ${theme.popup.accent}; letter-spacing: 1px; margin-top: 2px;">
          ${settings.paused ? 'PAUSED' : 'SYSTEM ACTIVE'} · LEVEL ${settings.invasionLevel}
        </div>
      </div>

      <!-- Stats Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--wg-border, #eee);">
        <${StatCard} label="Today" value=${stats.today} border="right" accent=${theme.popup.accent} />
        <${StatCard} label="Total" value=${stats.total} accent=${theme.popup.accent} />
        <${StatCard} label="Cleared" value=${stats.cleared} border="right top" accent=${theme.popup.accent} />
        <${StatCard} label="Best Combo" value=${'×' + stats.bestCombo} border="top" accent=${theme.popup.accent} />
      </div>

      <!-- Level Selector -->
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--wg-border, #eee);">
        <div style="font-size: 10px; letter-spacing: 1.5px; color: var(--wg-muted, #999); text-transform: uppercase; margin-bottom: 10px;">
          Invasion Level
        </div>
        <div style="display: flex; gap: 6px;">
          ${([1,2,3,4] as InvasionLevel[]).map(level => html`
            <button
              onClick=${() => updateSetting({ invasionLevel: level })}
              style="
                flex: 1; padding: 8px; text-align: center; cursor: pointer;
                font-family: var(--wg-mono, monospace); font-size: 11px; border: none;
                ${settings.invasionLevel === level
                  ? `background: ${theme.popup.accent}; color: #fff; font-weight: 600;`
                  : `background: none; border: 1.5px solid var(--wg-border, #ddd); color: var(--wg-muted, #999);`
                }
              "
            >L${level}</button>
          `)}
        </div>
      </div>

      <!-- Theme Selector -->
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--wg-border, #eee);">
        <div style="font-size: 10px; letter-spacing: 1.5px; color: var(--wg-muted, #999); text-transform: uppercase; margin-bottom: 10px;">
          Theme
        </div>
        <div style="display: flex; gap: 6px;">
          ${Object.values(THEMES).map(t => html`
            <button
              onClick=${() => updateSetting({ theme: t.id })}
              style="
                flex: 1; padding: 8px 4px; text-align: center; cursor: pointer;
                font-size: 10px; border: none;
                ${settings.theme === t.id
                  ? `background: ${theme.popup.accent}; color: #fff; font-weight: 600;`
                  : `background: none; border: 1.5px solid var(--wg-border, #ddd); color: var(--wg-muted, #999);`
                }
              "
            >${t.name}</button>
          `)}
        </div>
      </div>

      <!-- Actions -->
      <div style="padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
        <button
          onClick=${() => updateSetting({ paused: !settings.paused })}
          style="
            background: none; border: none; cursor: pointer;
            font-family: var(--wg-mono, monospace); font-size: 11px;
            color: ${theme.popup.foreground}; font-weight: 600; letter-spacing: 0.5px;
          "
        >${settings.paused ? '▶ RESUME' : '⏸ PAUSE'}</button>
      </div>
    </div>
  `;
}

function StatCard({ label, value, border, accent }: {
  label: string; value: string | number; border?: string; accent: string;
}) {
  const borderStyle = [
    border?.includes('right') && 'border-right: 1px solid var(--wg-border, #eee)',
    border?.includes('top') && 'border-top: 1px solid var(--wg-border, #eee)',
  ].filter(Boolean).join('; ');

  return html`
    <div style="padding: 16px 20px; ${borderStyle}">
      <div style="font-family: var(--wg-mono, monospace); font-size: 28px; font-weight: 700;">${value}</div>
      <div style="font-size: 10px; letter-spacing: 1.5px; color: var(--wg-muted, #999); text-transform: uppercase; margin-top: 2px;">
        ${label}
      </div>
    </div>
  `;
}

render(html`<${Popup} />`, document.getElementById('app')!);
```

- [ ] **Step 3: Commit**

```bash
git add src/popup/index.html src/popup/index.tsx
git commit -m "feat: add Popup dashboard with stats, level/theme selectors"
```

---

### Task 12: Onboarding Flow

**Files:**
- Create: `src/onboarding/index.ts`

- [ ] **Step 1: Implement onboarding**

```typescript
import { html } from 'htm/preact';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { THEMES } from '../core/themes.js';
import { LEVEL_CONFIGS } from '../core/constants.js';
import { sendMessage } from '../core/messages.js';
import type { ThemeId, InvasionLevel } from '../core/types.js';
import { EXTENSION_PREFIX } from '../core/constants.js';

export function showOnboarding(onComplete: () => void): void {
  const root = document.createElement('div');
  root.id = `${EXTENSION_PREFIX}-onboarding`;
  root.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
    width: 360px; background: #fff; border: 2px solid #111;
    font-family: -apple-system, "Helvetica Neue", sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  `;
  document.documentElement.appendChild(root);

  function handleComplete(theme: ThemeId, level: InvasionLevel, banks: string[]) {
    sendMessage({
      type: 'SAVE_SETTINGS',
      settings: { theme, invasionLevel: level, wordBanks: banks, onboarded: true },
    }).catch(() => {});
    root.remove();
    onComplete();
  }

  render(html`<${OnboardingFlow} onComplete=${handleComplete} />`, root);
}

function OnboardingFlow({ onComplete }: {
  onComplete: (theme: ThemeId, level: InvasionLevel, banks: string[]) => void;
}) {
  const [step, setStep] = useState(0);
  const [theme, setTheme] = useState<ThemeId>('brutalist');
  const [level, setLevel] = useState<InvasionLevel>(2);
  const [banks, setBanks] = useState<string[]>(['ielts']);

  const steps = [
    // Step 0: Welcome
    html`
      <div style="padding: 28px 24px; text-align: center;">
        <div style="font-family: 'SF Mono', monospace; font-size: 20px; font-weight: 700; margin-bottom: 8px;">
          Flipword
        </div>
        <div style="font-size: 15px; color: #333; margin-bottom: 6px;">你的网页被 Glitch 了。</div>
        <div style="font-size: 13px; color: #888; margin-bottom: 24px;">从现在起，英语会不断渗入你的世界。</div>
        <button onClick=${() => setStep(1)} style="
          width: 100%; padding: 12px; background: #111; color: #fff; border: none;
          font-size: 14px; font-weight: 600; cursor: pointer; letter-spacing: 0.5px;
        ">开始设置</button>
      </div>
    `,

    // Step 1: Theme
    html`
      <div style="padding: 24px;">
        <div style="font-size: 10px; letter-spacing: 2px; color: #999; text-transform: uppercase; margin-bottom: 12px;">
          选择视觉风格
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px;">
          ${Object.values(THEMES).map(t => html`
            <button
              onClick=${() => setTheme(t.id)}
              style="
                padding: 12px 8px; text-align: center; cursor: pointer; border: none;
                ${theme === t.id
                  ? 'background: #111; color: #fff; font-weight: 600;'
                  : 'background: #f5f5f5; color: #333;'
                }
                font-size: 12px;
              "
            >
              <div style="font-weight: 600;">${t.name}</div>
              <div style="font-size: 10px; color: ${theme === t.id ? '#ccc' : '#999'}; margin-top: 2px;">${t.nameCn}</div>
            </button>
          `)}
        </div>
        <button onClick=${() => setStep(2)} style="
          width: 100%; padding: 12px; background: #111; color: #fff; border: none;
          font-size: 14px; font-weight: 600; cursor: pointer;
        ">下一步</button>
      </div>
    `,

    // Step 2: Word banks
    html`
      <div style="padding: 24px;">
        <div style="font-size: 10px; letter-spacing: 2px; color: #999; text-transform: uppercase; margin-bottom: 12px;">
          选择词库
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
          ${['ielts', 'toefl', 'gre', 'academic', 'business'].map(id => {
            const names: Record<string, string> = { ielts: '雅思', toefl: '托福', gre: 'GRE', academic: '学术', business: '商务' };
            const active = banks.includes(id);
            return html`
              <button
                onClick=${() => setBanks(active ? banks.filter(b => b !== id) : [...banks, id])}
                style="
                  padding: 8px 16px; cursor: pointer; border: none; font-size: 13px;
                  ${active ? 'background: #111; color: #fff; font-weight: 600;' : 'background: #f5f5f5; color: #333;'}
                  ${id !== 'ielts' ? 'opacity: 0.5;' : ''}
                "
                disabled=${id !== 'ielts'}
              >${names[id]}</button>
            `;
          })}
        </div>
        <div style="font-size: 11px; color: #999; margin-bottom: 16px;">更多词库即将开放</div>
        <button onClick=${() => setStep(3)} style="
          width: 100%; padding: 12px; background: #111; color: #fff; border: none;
          font-size: 14px; font-weight: 600; cursor: pointer;
        ">下一步</button>
      </div>
    `,

    // Step 3: Level
    html`
      <div style="padding: 24px;">
        <div style="font-size: 10px; letter-spacing: 2px; color: #999; text-transform: uppercase; margin-bottom: 12px;">
          入侵等级
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
          ${([1,2,3] as InvasionLevel[]).map(l => {
            const cfg = LEVEL_CONFIGS[l];
            return html`
              <button
                onClick=${() => setLevel(l)}
                style="
                  padding: 12px 16px; text-align: left; cursor: pointer; border: none;
                  ${level === l ? 'background: #111; color: #fff;' : 'background: #f5f5f5; color: #333;'}
                "
              >
                <div style="font-weight: 600; font-size: 13px;">L${l} · ${cfg.nameCn}</div>
                <div style="font-size: 11px; color: ${level === l ? '#ccc' : '#999'}; margin-top: 2px;">
                  每页 ${cfg.minWords}-${cfg.maxWords} 词
                </div>
              </button>
            `;
          })}
        </div>
        <button onClick=${() => onComplete(theme, level, banks)} style="
          width: 100%; padding: 12px; background: #111; color: #fff; border: none;
          font-size: 14px; font-weight: 600; cursor: pointer; letter-spacing: 0.5px;
        ">Glitch 已激活。Happy hunting.</button>
      </div>
    `,
  ];

  return steps[step];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/index.ts
git commit -m "feat: add onboarding flow with theme/wordbank/level selection"
```

---

### Task 13: Content Script Entry Point

**Files:**
- Create: `src/content.ts`
- Create: `src/content.css`

- [ ] **Step 1: Write content.css (base styles)**

```css
/* Flipword content script styles — minimal, theme-injected via JS */

[data-wg] {
  cursor: pointer;
  transition: opacity 0.3s ease;
}

[data-wg]:hover {
  opacity: 0.85;
}

/* Cleared state */
[data-wg-cleared] {
  opacity: 0.5;
  text-decoration: line-through;
  pointer-events: none;
}
```

- [ ] **Step 2: Write content script orchestration**

```typescript
import { collectTextNodes, observeMutations, observeSPANavigation } from './scanner/index.js';
import { findMatches, selectWords } from './nlp/index.js';
import { loadWordBank, type WordBank } from './nlp/word-bank.js';
import { selectRenderStrategy, createGlitchSpan, replaceInTextNode } from './renderer/index.js';
import { showDecodePanel, hideDecodePanel } from './decode/index.js';
import { showOnboarding } from './onboarding/index.js';
import { getTheme, generateThemeCSS } from './core/themes.js';
import { LEVEL_CONFIGS, DEFAULT_SETTINGS, EXTENSION_PREFIX } from './core/constants.js';
import { sendMessage } from './core/messages.js';
import type { UserSettings, Theme } from './core/types.js';

let settings: UserSettings = DEFAULT_SETTINGS;
let wordBank: WordBank | null = null;
let theme: Theme = getTheme('brutalist');

async function init(): Promise<void> {
  // Load settings (fallback to defaults if background unavailable)
  try {
    settings = await sendMessage({ type: 'GET_SETTINGS' });
  } catch {
    settings = DEFAULT_SETTINGS;
  }

  theme = getTheme(settings.theme);
  injectThemeCSS(theme);

  // Check onboarding
  if (!settings.onboarded) {
    showOnboarding(() => {
      // Reload settings after onboarding
      sendMessage({ type: 'GET_SETTINGS' }).then(s => {
        settings = s;
        theme = getTheme(settings.theme);
        injectThemeCSS(theme);
        startGlitching();
      }).catch(() => startGlitching());
    });
    return;
  }

  if (settings.paused) return;

  await startGlitching();
}

async function startGlitching(): Promise<void> {
  // Load word bank
  if (!wordBank) {
    try {
      wordBank = await loadWordBank(settings.wordBanks[0] ?? 'ielts');
    } catch (e) {
      console.warn('[Flipword] Failed to load word bank:', e);
      return;
    }
  }

  glitchPage();

  // Watch for dynamic content
  observeMutations(document.body, (newNodes) => {
    if (settings.paused || !wordBank) return;
    glitchNodes(newNodes);
  });

  // Watch for SPA navigation
  observeSPANavigation(() => {
    if (settings.paused) return;
    // Re-scan after a short delay for new content to render
    setTimeout(glitchPage, 300);
  });
}

function glitchPage(): void {
  if (!wordBank) return;
  const nodes = collectTextNodes(document.body);
  glitchNodes(nodes);
}

function glitchNodes(nodes: Text[]): void {
  if (!wordBank) return;
  const levelConfig = LEVEL_CONFIGS[settings.invasionLevel];
  const allMatches = [];

  for (const node of nodes) {
    const text = node.textContent ?? '';
    const matches = findMatches(text, wordBank);
    allMatches.push(...matches.map(m => ({ ...m, textNode: node })));
  }

  const selected = selectWords(allMatches, levelConfig.maxWords);

  // Sort by offset descending so replacements don't shift earlier offsets
  selected.sort((a, b) => b.startOffset - a.startOffset);

  // Canvas for Pretext measurement
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;

  for (const match of selected) {
    const parent = match.textNode.parentElement;
    if (!parent) continue;

    const style = getComputedStyle(parent);
    const fontSpec = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const fontSize = parseFloat(style.fontSize);

    // Measure widths (using canvas directly for Phase 1; Pretext integration in refinement)
    measureCtx.font = fontSpec;
    const originalWidth = measureCtx.measureText(match.originalText).width;
    const replaceWidth = measureCtx.measureText(match.targetWord).width;

    const ratio = replaceWidth / originalWidth;
    const strategy = selectRenderStrategy(ratio);

    const { span } = createGlitchSpan(match, strategy, theme, fontSize, originalWidth, replaceWidth);

    // Click handler → Decode panel
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const context = match.sentenceContext.slice(
        Math.max(0, match.startOffset - 30),
        Math.min(match.sentenceContext.length, match.endOffset + 30),
      );
      showDecodePanel(match.wordEntry, context, theme);
    });

    // Record exposure
    sendMessage({ type: 'RECORD_EXPOSURE', wordId: match.wordEntry.id, pageUrl: location.href }).catch(() => {});

    try {
      replaceInTextNode(match.textNode, match, span);
    } catch {
      // Node may have been removed by page scripts
    }
  }
}

function injectThemeCSS(t: Theme): void {
  const existingStyle = document.getElementById(`${EXTENSION_PREFIX}-theme`);
  if (existingStyle) existingStyle.remove();

  const style = document.createElement('style');
  style.id = `${EXTENSION_PREFIX}-theme`;
  style.textContent = `:root { ${generateThemeCSS(t)} }`;
  document.head.appendChild(style);
}

// Listen for settings changes from popup
chrome.storage.onChanged.addListener((changes) => {
  if (changes.wg_settings) {
    const newSettings = { ...DEFAULT_SETTINGS, ...changes.wg_settings.newValue };
    const themeChanged = newSettings.theme !== settings.theme;
    settings = newSettings;

    if (themeChanged) {
      theme = getTheme(settings.theme);
      injectThemeCSS(theme);
    }
  }
});

// Start
init();
```

- [ ] **Step 3: Commit**

```bash
git add src/content.ts src/content.css
git commit -m "feat: add content script orchestration — wires scanner, NLP, renderer, decode, onboarding"
```

---

### Task 14: Build, Package, and Manual Test

**Files:**
- Modify: `build.ts` (if adjustments needed)
- Create: `icons/icon48.png`, `icons/icon128.png` (placeholder)

- [ ] **Step 1: Create placeholder icons**

Run: `mkdir -p /Users/joejiang/Flipword/icons`

Create simple placeholder PNGs (48x48 and 128x128). For now, use any square image or generate one:

```bash
# Quick placeholder — a 48x48 and 128x128 solid square
convert -size 48x48 xc:'#111' icons/icon48.png 2>/dev/null || printf '\x89PNG\r\n\x1a\n' > icons/icon48.png
convert -size 128x128 xc:'#111' icons/icon128.png 2>/dev/null || printf '\x89PNG\r\n\x1a\n' > icons/icon128.png
```

Update `build.ts` to copy icons:

Add after the existing `cpSync` calls:
```typescript
cpSync('icons', 'dist/icons', { recursive: true });
```

- [ ] **Step 2: Build the extension**

Run: `cd /Users/joejiang/Flipword && bun run build`
Expected: `Build complete → dist/` with files: `content.js`, `content.css`, `background.js`, `popup.js`, `popup.html`, `manifest.json`, `data/`, `icons/`

- [ ] **Step 3: Verify dist/ contents**

Run: `ls -la dist/`
Expected: All required files present.

- [ ] **Step 4: Manual test checklist**

Load the extension in Chrome:
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `dist/` directory
4. Verify: Extension appears with name "Flipword"

Test on a Chinese web page (e.g., zhihu.com):
- [ ] Onboarding card appears on first visit
- [ ] Can select theme, word bank, level
- [ ] After onboarding, Chinese words are replaced with English
- [ ] Replaced words have correct theme styling
- [ ] Clicking a word opens Decode panel
- [ ] Decode panel shows word info and context
- [ ] "Cleared" and "Re-Glitch" buttons work
- [ ] Popup dashboard shows stats
- [ ] Level selector in popup changes replacement density
- [ ] Theme selector in popup changes visual style
- [ ] Pause button stops new replacements

- [ ] **Step 5: Commit**

```bash
git add icons/ build.ts
git commit -m "feat: Phase 1 complete — build, package, and manual test pass"
```

---

## Phase 2 — 雷达上线 (Tasks 15–22)

> Phase 2 builds on Phase 1. Task outlines below; full code will be planned when Phase 1 ships.

### Task 15: Page Language Detection

**Files:**
- Create: `src/scanner/language.ts`
- Create: `tests/scanner/language.test.ts`

Detect whether a page is predominantly Chinese or English using `document.documentElement.lang`, `<meta>` charset hints, and a character frequency sample of the first 1000 characters. Returns `'zh' | 'en' | 'other'`. Determines whether to run Invasion Mode or Radar Mode.

### Task 16: Radar Mode — English Word Scanner

**Files:**
- Create: `src/radar/index.ts`
- Create: `tests/radar.test.ts`

On English pages, scan text nodes for words matching the user's word banks. Tokenize with `Intl.Segmenter('en', { granularity: 'word' })`. Match against `WordBank.byId`. No replacement — only annotation.

### Task 17: Radar Mode — Visual Annotations

**Files:**
- Create: `src/radar/annotate.ts`

Apply visual annotations to matched English words based on `UserWordState.status`:
- `new` → red pulse (strong underline + subtle CSS animation)
- `seen`/`learning` → amber underline
- `mastered` → green dot
- High difficulty tags → lightning-style emphasis

Each annotation is a `<mark>` wrapper with `data-wg-radar` attribute, themed via CSS variables.

### Task 18: Context Weighting Engine

**Files:**
- Modify: `src/nlp/index.ts`
- Create: `src/nlp/context.ts`
- Create: `tests/nlp/context.test.ts`

Add contextual disambiguation for one-to-many Chinese→English mappings. Score matches by:
- Co-occurrence: Do nearby words suggest this domain? (e.g., "经济" near "政策" → economic policy context)
- Part-of-speech hint: Does the sentence position suggest noun/verb/adj?
- `confidenceScore` computed as weighted sum. Only replace if above `CONFIDENCE_THRESHOLD`.

### Task 19: Full Decode Panel — Etymology + Morphology + Native Feel

**Files:**
- Modify: `src/decode/index.ts`

Extend Decode panel with:
- Etymology section (origin, original meaning, story, entry period)
- Native feel section (formality, sentiment, usage scenes, synonyms, confusables)
- Richer morphology display (prefix chain + root + suffix chain with individual meanings)

Gate display: sections only render if data exists on the `WordEntry`.

### Task 20: Etymology + Root/Affix Data

**Files:**
- Create: `data/etymology/core-5000.json`
- Create: `data/roots-affixes/roots.json`
- Create: `data/roots-affixes/affixes.json`

Build the data sets:
- 500 common roots with meaning and example words
- 300 common affixes (prefixes + suffixes)
- 5000-word etymology dataset (origin, original meaning, short story)
- Merge into `WordEntry` at load time via a `enrichWordBank()` function

### Task 21: TOEFL / GRE / Academic / Business Word Banks

**Files:**
- Create: `data/word-banks/toefl.json`
- Create: `data/word-banks/gre.json`
- Create: `data/word-banks/academic.json`
- Create: `data/word-banks/business.json`

Each follows the same `WordEntry[]` JSON schema. Multi-bank loading in `loadWordBank()` merges all selected banks, deduplicating by `id`.

### Task 22: Custom Word Bank — Manual Add + CSV Import

**Files:**
- Create: `src/popup/custom-bank.tsx`
- Modify: `src/popup/index.tsx`
- Modify: `src/core/storage.ts`

Add a "Custom Words" tab in popup:
- Manual add form: English word + Chinese meaning + optional tags
- CSV import: parse `english,chinese,tags` format
- Store custom entries in IndexedDB `customWords` store
- Merge into active word bank at scan time

---

## Phase 3 — 暴击觉醒 (Tasks 23–30)

### Task 23: Crit Detection Engine

**Files:**
- Create: `src/crit/index.ts`
- Create: `tests/crit.test.ts`

Implement recognition detection:
- Invasion: word visible for 5s+ without click → "recognized"
- Radar: hover < 3s without click → "recognized"
- Track Combo counter (30s window, reset on click/tab switch)
- Emit `CritEvent` with type (FirstBlood, Combo5, Rampage, etc.)

### Task 24: CSS Crit Effects (Daily Tier)

**Files:**
- Create: `src/crit/css-effects.ts`

CSS-only animations for daily-tier crits:
- First Blood: `@keyframes` bold pulse on the word (0.3s)
- Combo badge: absolute-positioned counter that floats up and fades
- Cleared: opacity transition + line-through

Each effect is theme-aware (different animations per theme).

### Task 25: FX Canvas Engine

**Files:**
- Create: `src/fx/index.ts`
- Create: `src/fx/particles.ts`

Canvas overlay for high-tier crits:
- `createFXCanvas()` — fixed full-viewport canvas, `pointer-events: none`
- Particle system: `Particle` interface, pool with 500 max, `requestAnimationFrame` loop
- Auto-pause on `visibilitychange`
- Theme-aware: particle colors from theme palette

### Task 26: High-Tier Crit Effects

**Files:**
- Modify: `src/fx/index.ts`
- Create: `src/fx/presets.ts`

Presets for Godlike (×20), Beyond Godlike (×30+), Daily Complete:
- Godlike: burst of 200 particles from word position + screen shake CSS
- Beyond Godlike: cascading particle rain + brief color inversion
- Daily Complete: centered celebration burst

### Task 27: SM-2 Spaced Repetition

**Files:**
- Create: `src/core/sm2.ts`
- Create: `tests/core/sm2.test.ts`

Implement SM-2 algorithm:
- Input: `UserWordState` + quality (0-5 scale)
- Output: updated `easeFactor`, `interval`, `repetitions`, `nextReviewAt`
- Integration: background worker runs SM-2 on RECORD_EXPOSURE/MARK_CLEARED events
- Word selection: `nextReviewAt <= now` words get priority in `selectWords()`

### Task 28: Enhanced Stats Dashboard

**Files:**
- Create: `src/popup/stats.tsx`
- Modify: `src/popup/index.tsx`

Add a "Stats" tab to popup:
- Daily/weekly/monthly bar chart (CSS-only, no chart library)
- Mastery progress: words per status bucket
- Streak counter (consecutive active days)
- Word list view with filters (status, bank, date)

### Task 29: Achievement System

**Files:**
- Create: `src/crit/achievements.ts`
- Modify: `src/core/storage.ts`

Define milestone achievements:
- First Glitch, Combo ×10, 100 words cleared, 7-day streak, etc.
- Store unlocked achievements in IndexedDB
- Toast notification on unlock (CSS animation, theme-aware)

### Task 30: Level 4 Unlock + Performance Optimization

**Files:**
- Modify: `src/core/constants.ts`
- Modify: `src/content.ts`

- Level 4 ("Override") unlockable after clearing 500 words
- IntersectionObserver: only scan visible + 1-screen buffer
- `requestIdleCallback` for non-urgent replacements
- Battery API check: disable canvas FX on low battery

---

## Phase 4 — 全面入侵 (Tasks 31–38)

### Task 31: LLM Bridge

**Files:**
- Create: `src/nlp/llm.ts`
- Create: `src/popup/llm-settings.tsx`

Optional LLM integration for context disambiguation:
- Ollama local API (`localhost:11434`) or configurable remote endpoint
- Only triggered for matches with `confidenceScore < CONFIDENCE_THRESHOLD`
- Settings UI: enable/disable, endpoint URL, model selection
- Graceful fallback: if LLM unavailable, use best non-LLM match

### Task 32: Community Word Banks

**Files:**
- Create: `src/popup/community.tsx`

Word bank sharing:
- Export: serialize word bank to JSON with metadata
- Import: validate and merge community banks
- Future: optional cloud directory (out of scope for v1)

### Task 33: Firefox Adapter

**Files:**
- Create: `src/core/browser.ts`

Abstract browser-specific APIs behind a compatibility layer:
- `chrome.storage` → `browser.storage` (Firefox WebExtension)
- `chrome.runtime` → `browser.runtime`
- Manifest v3 differences (Firefox supports both v2 and v3)
- Separate `manifest.firefox.json`

### Task 34: Edge Adapter

Minimal task — Edge is Chromium-based. Verify the Chrome build works, add Edge-specific store metadata if needed.

### Task 35: Sound Effects System

**Files:**
- Create: `src/fx/audio.ts`
- Create: `assets/sfx/`

Optional audio feedback:
- Short sound clips for crit events (< 100KB total)
- `AudioContext` for playback, respects system volume
- Settings: enable/disable, volume slider
- Default: muted

### Task 36: Data Export

**Files:**
- Create: `src/popup/export.tsx`

Export learning data:
- JSON: full `UserWordState[]` dump
- CSV: `word, status, exposures, cleared_date`
- Trigger from popup settings panel

### Task 37: Open API Protocol

**Files:**
- Create: `src/core/api.ts`

Define a protocol for third-party word bank integration:
- JSON schema for word bank format
- Validation function
- URL-based import (fetch + validate + merge)

### Task 38: Rift Reader (Exploration)

Explore extending Flipword to PDF reading:
- Research `pdf.js` integration for text extraction
- Prototype: inject content script into local PDF viewer
- Scope: exploratory, no ship commitment
