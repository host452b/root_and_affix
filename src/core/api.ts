import type { WordEntry } from './types.js';

export const WORD_BANK_SCHEMA_VERSION = 'flipword-bank-v1';

export interface WordBankPackage {
  format: string;
  version?: string;
  name: string;
  description?: string;
  author?: string;
  wordCount: number;
  words: WordEntry[];
}

/**
 * Validate a word bank package.
 * Returns { valid: true, words } or { valid: false, errors }.
 */
export function validateWordBank(data: unknown): { valid: true; words: WordEntry[] } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input must be a JSON object'] };
  }

  const pkg = data as Record<string, unknown>;

  if (pkg.format !== WORD_BANK_SCHEMA_VERSION) {
    errors.push(`Invalid format: expected "${WORD_BANK_SCHEMA_VERSION}", got "${pkg.format}"`);
  }

  if (!Array.isArray(pkg.words)) {
    errors.push('Missing or invalid "words" array');
    return { valid: false, errors };
  }

  const words: WordEntry[] = [];
  for (let i = 0; i < pkg.words.length; i++) {
    const w = pkg.words[i];
    const wordErrors: string[] = [];

    if (!w || typeof w !== 'object') { wordErrors.push(`words[${i}]: not an object`); continue; }
    if (typeof w.id !== 'string' || !w.id) wordErrors.push(`words[${i}]: missing "id"`);
    if (typeof w.word !== 'string' || !w.word) wordErrors.push(`words[${i}]: missing "word"`);
    if (!Array.isArray(w.chineseMappings) || w.chineseMappings.length === 0) {
      wordErrors.push(`words[${i}]: missing "chineseMappings"`);
    }

    if (wordErrors.length > 0) {
      errors.push(...wordErrors);
    } else {
      words.push({
        id: w.id,
        word: w.word,
        phonetic: w.phonetic ?? '',
        meanings: Array.isArray(w.meanings) ? w.meanings : [],
        difficulty: Array.isArray(w.difficulty) ? w.difficulty : [],
        morphology: w.morphology,
        etymology: w.etymology,
        nativeFeel: w.nativeFeel,
        chineseMappings: w.chineseMappings,
      });
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, words };
}

/**
 * Fetch and validate a word bank from a URL.
 */
export async function fetchWordBank(url: string): Promise<{ valid: true; words: WordEntry[] } | { valid: false; errors: string[] }> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return { valid: false, errors: [`HTTP ${resp.status}: ${resp.statusText}`] };
    const data = await resp.json();
    return validateWordBank(data);
  } catch (e) {
    return { valid: false, errors: [`Fetch failed: ${e instanceof Error ? e.message : String(e)}`] };
  }
}
