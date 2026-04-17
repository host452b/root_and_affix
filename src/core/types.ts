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
  clearedCount: number;
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
  radarEnabled: boolean;
}

export interface DailyStats {
  date: string;
  flipCount: number;
  uniqueWords: Set<string>;
  clearedCount: number;
  bestCombo: number;
  /** Exposure count per bank — tracks which domains user actually read in */
  domainHits: Record<string, number>;
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
  /** 3-letter abbreviation for compact theme selector */
  abbr: string;
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
    /** 2px outer border color for popup container */
    outerBorder: string;
    /** Border radius for swatch preview in theme selector */
    swatchRadius: string;
  };
  cssVariables: Record<string, string>;
}

// === Invasion Level Config ===

export interface LevelConfig {
  level: InvasionLevel;
  name: string;
  nameCn: string;
  /** Words to replace per 1000 characters of page content */
  rate: number;
  /** Human-readable hint shown below level selector */
  hint: string;
  hintEn: string;
}
