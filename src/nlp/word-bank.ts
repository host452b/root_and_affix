import type { WordEntry } from '../core/types.js';
import type { CustomWordEntry } from '../core/storage.js';

export type WordBank = {
  entries: WordEntry[];
  byId: Map<string, WordEntry>;
  byChinese: Map<string, WordEntry[]>;
  /** Bank IDs loaded — used for lazy-loading full entries */
  bankIds: string[];
};

/** Strip heavy fields for matching — keeps only what's needed for page replacement */
function toLightEntry(entry: WordEntry): WordEntry {
  return {
    id: entry.id,
    word: entry.word,
    phonetic: entry.phonetic,
    meanings: entry.meanings, // needed for definitionCn display in decode header
    difficulty: entry.difficulty,
    chineseMappings: entry.chineseMappings,
    // morphology, etymology, nativeFeel intentionally omitted — loaded on demand
  };
}

export function buildWordBank(entries: WordEntry[], bankIds: string[] = []): WordBank {
  const byId = new Map<string, WordEntry>();
  const byChinese = new Map<string, WordEntry[]>();

  for (const entry of entries) {
    byId.set(entry.id, entry);
    for (const mapping of entry.chineseMappings) {
      const existing = byChinese.get(mapping.chinese);
      if (existing) {
        if (!existing.some(e => e.id === entry.id)) {
          existing.push(entry);
        }
      } else {
        byChinese.set(mapping.chinese, [entry]);
      }
    }
  }

  return { entries, byId, byChinese, bankIds };
}

/**
 * Load word banks — lightweight mode.
 * Only loads matching data (id, word, chineseMappings, meanings).
 * Skips morphology/etymology/roots/affixes entirely.
 * Full entry data is loaded on demand via loadFullEntry().
 */
export async function loadWordBanks(bankIds: string[]): Promise<WordBank> {
  const allEntries: WordEntry[] = [];
  const seen = new Set<string>();

  for (const bankId of bankIds) {
    try {
      const url = chrome.runtime.getURL(`data/word-banks/${bankId}.json`);
      const resp = await fetch(url);
      const entries: WordEntry[] = await resp.json();
      for (const entry of entries) {
        if (!seen.has(entry.id)) {
          seen.add(entry.id);
          allEntries.push(toLightEntry(entry));
        }
      }
    } catch {
      console.warn(`[Flipword] Failed to load word bank: ${bankId}`);
    }
  }

  // No enrich step — data is pre-computed in JSON, loaded on demand
  return buildWordBank(allEntries, bankIds);
}

// Cache for full entries loaded on demand (lazy-loaded bank → full entries index)
const fullBankCache = new Map<string, Map<string, WordEntry>>();

/**
 * Load the full entry (with morphology, etymology, nativeFeel) for a single word.
 * Called when user clicks a word to open the decode panel.
 * First call for a bank fetches and indexes the entire bank; subsequent calls are instant.
 */
export async function loadFullEntry(wordId: string, bank: WordBank): Promise<WordEntry> {
  // Search cached banks first
  for (const [_, index] of fullBankCache) {
    const entry = index.get(wordId);
    if (entry) return entry;
  }

  // Lazy-load and cache each bank until we find the word
  for (const bankId of bank.bankIds) {
    if (fullBankCache.has(bankId)) continue; // already cached

    try {
      const url = chrome.runtime.getURL(`data/word-banks/${bankId}.json`);
      const resp = await fetch(url);
      const entries: WordEntry[] = await resp.json();
      const index = new Map<string, WordEntry>();
      for (const e of entries) index.set(e.id, e);
      fullBankCache.set(bankId, index);

      const found = index.get(wordId);
      if (found) return found;
    } catch {
      // Bank unavailable, try next
    }
  }

  // Fallback: return light entry
  return bank.byId.get(wordId) ?? { id: wordId, word: wordId, phonetic: '', meanings: [], difficulty: [], chineseMappings: [] };
}

export function mergeCustomWords(bank: WordBank, customWords: CustomWordEntry[]): WordBank {
  const entries = [...bank.entries];
  for (const cw of customWords) {
    if (!bank.byId.has(cw.word.toLowerCase())) {
      const entry: WordEntry = {
        id: cw.word.toLowerCase(),
        word: cw.word,
        phonetic: '',
        meanings: [{ partOfSpeech: '', definition: '', definitionCn: cw.chinese }],
        difficulty: cw.tags,
        chineseMappings: [{ chinese: cw.chinese, partOfSpeech: '' }],
      };
      entries.push(entry);
    }
  }
  return buildWordBank(entries, bank.bankIds);
}
