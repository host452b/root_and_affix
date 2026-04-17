import type { DailyStats, UserSettings, UserWordState } from './types.js';
import { DEFAULT_SETTINGS } from './constants.js';

const SETTINGS_KEY = 'wg_settings';
const STATS_KEY = 'wg_stats';
const DB_NAME = 'flipword';
const DB_VERSION = 2;
const WORD_STATE_STORE = 'wordStates';
const CUSTOM_WORDS_STORE = 'customWords';

export interface CustomWordEntry {
  id: string;
  word: string;
  chinese: string;
  tags: string[];
  addedAt: number;
}

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

export function localDateStr(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function loadDailyStats(): Promise<DailyStats> {
  const today = localDateStr();
  const result = await chrome.storage.local.get(STATS_KEY);
  const stored = result[STATS_KEY];
  if (stored && stored.date === today) {
    return { ...stored, uniqueWords: new Set(stored.uniqueWords), domainHits: stored.domainHits ?? {} };
  }
  return { date: today, flipCount: 0, uniqueWords: new Set(), clearedCount: 0, bestCombo: 0, domainHits: {} };
}

export async function saveDailyStats(stats: DailyStats): Promise<void> {
  await chrome.storage.local.set({
    [STATS_KEY]: { ...stats, uniqueWords: [...stats.uniqueWords] },
  });

  // Also update wg_history for the weekly/streak stats
  const historyResult = await chrome.storage.local.get('wg_history');
  const history: Record<string, number> = historyResult['wg_history'] ?? {};
  history[stats.date] = stats.uniqueWords.size;

  // Prune to last 30 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  for (const key of Object.keys(history)) {
    if (key < cutoffStr) delete history[key];
  }

  await chrome.storage.local.set({ wg_history: history });
}

export async function getHistory(): Promise<Record<string, number>> {
  const result = await chrome.storage.local.get('wg_history');
  return result['wg_history'] ?? {};
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(WORD_STATE_STORE)) {
        db.createObjectStore(WORD_STATE_STORE, { keyPath: 'wordId' });
      }
      // v2: custom words store
      if (!db.objectStoreNames.contains(CUSTOM_WORDS_STORE)) {
        db.createObjectStore(CUSTOM_WORDS_STORE, { keyPath: 'id' });
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
    clearedCount: 0,
    masteredAt: null,
    nextReviewAt: now,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
  };
}

export async function getAllWordStates(): Promise<UserWordState[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORD_STATE_STORE, 'readonly');
    const req = tx.objectStore(WORD_STATE_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

// ── Achievements ──────────────────────────────────────────────────────────────

const ACHIEVEMENTS_KEY = 'wg_achievements';

export async function getUnlockedAchievements(): Promise<string[]> {
  const result = await chrome.storage.local.get(ACHIEVEMENTS_KEY);
  return result[ACHIEVEMENTS_KEY] ?? [];
}

export async function unlockAchievement(id: string): Promise<void> {
  const current = await getUnlockedAchievements();
  if (!current.includes(id)) {
    await chrome.storage.local.set({ [ACHIEVEMENTS_KEY]: [...current, id] });
  }
}

// ── Custom Words ──────────────────────────────────────────────────────────────

export async function getCustomWords(): Promise<CustomWordEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_WORDS_STORE, 'readonly');
    const req = tx.objectStore(CUSTOM_WORDS_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function addCustomWord(entry: CustomWordEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_WORDS_STORE, 'readwrite');
    const req = tx.objectStore(CUSTOM_WORDS_STORE).put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCustomWord(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_WORDS_STORE, 'readwrite');
    const req = tx.objectStore(CUSTOM_WORDS_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Audio Config ──────────────────────────────────────────────────────────────

const AUDIO_CONFIG_KEY = 'wg_audio_config';

export async function loadAudioConfig(): Promise<{ enabled: boolean; volume: number }> {
  const result = await chrome.storage.local.get(AUDIO_CONFIG_KEY);
  return { enabled: false, volume: 0.3, ...result[AUDIO_CONFIG_KEY] };
}

export async function saveAudioConfig(config: { enabled: boolean; volume: number }): Promise<void> {
  await chrome.storage.local.set({ [AUDIO_CONFIG_KEY]: config });
}

// ── LLM Config ────────────────────────────────────────────────────────────────

const LLM_CONFIG_KEY = 'wg_llm_config';

export async function loadLLMConfig() {
  const result = await chrome.storage.local.get(LLM_CONFIG_KEY);
  return { enabled: false, endpoint: 'http://localhost:11434', model: 'qwen2', ...result[LLM_CONFIG_KEY] };
}

export async function saveLLMConfig(config: { enabled: boolean; endpoint: string; model: string }) {
  await chrome.storage.local.set({ [LLM_CONFIG_KEY]: config });
}
