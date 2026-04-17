import type { InvasionLevel, LevelConfig, UserSettings } from './types.js';

export const EXTENSION_PREFIX = 'wg';

export const BLACKLIST_TAGS = new Set([
  'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT',
  'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT', 'EMBED',
]);

export const LEVEL_CONFIGS: Record<InvasionLevel, LevelConfig> = {
  1: { level: 1, name: 'Light',  nameCn: '轻度', rate: 10,  hint: '偶尔出现，不影响阅读',           hintEn: 'A few words per article' },
  2: { level: 2, name: 'Medium', nameCn: '中度', rate: 25,  hint: '每段有几个英文，开始有感觉',      hintEn: 'A few words per paragraph' },
  3: { level: 3, name: 'Strong', nameCn: '强',   rate: 50,  hint: '明显沉浸，英文密度较高',          hintEn: 'Noticeable immersion' },
  4: { level: 4, name: 'Full',   nameCn: '全',   rate: 120, hint: '大量替换，接近双语阅读',          hintEn: 'Heavy replacement, near-bilingual' },
};

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'brutalist',
  invasionLevel: 1,
  wordBanks: ['news', 'tech'],
  paused: false,
  onboarded: false,
  radarEnabled: false,
};

export const RENDER_RATIO_INPLACE = 1.2;
export const RENDER_RATIO_SHRINK = 1.6;
export const RENDER_MIN_SCALE = 0.75;

export const SCANNER_BATCH_LIMIT = 200;
export const SCANNER_DEBOUNCE_MS = 200;

export const CONFIDENCE_THRESHOLD = 0.8;

export const COMBO_WINDOW_MS = 30_000;
