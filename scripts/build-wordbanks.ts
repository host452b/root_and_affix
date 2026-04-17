/**
 * Build Flipword word banks from source data.
 *
 * Usage:
 *   bun scripts/build-wordbanks.ts
 *
 * Input:  scripts/translations/*.csv  (word,chinese,pos format)
 * Source: /tmp/flipword-data/*.js      (wordsta format, optional enrichment)
 * Output: data/word-banks/*.json       (Flipword WordEntry format)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';

interface SourceWord {
  word: string;
  definition: string;
  difficulty?: number;
  frequency?: number;
}

interface Translation {
  word: string;
  chinese: string;
  pos: string;
}

interface WordEntry {
  id: string;
  word: string;
  phonetic: string;
  meanings: Array<{ partOfSpeech: string; definition: string; definitionCn: string }>;
  difficulty: string[];
  chineseMappings: Array<{ chinese: string; partOfSpeech: string }>;
}

// Parse wordsta JS format: export const words = [...]
function parseWordstaJS(content: string): SourceWord[] {
  const jsonStr = content
    .replace(/^export\s+const\s+\w+\s*=\s*/, '')
    .replace(/;\s*$/, '')
    .trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    console.warn('Failed to parse wordsta file');
    return [];
  }
}

// Parse CSV: word,chinese,pos
function parseTranslationCSV(content: string): Translation[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [word, chinese, pos] = line.split(',').map(s => s.trim());
      return { word: word.toLowerCase(), chinese, pos: pos || 'n' };
    });
}

// Build WordEntry from source + translation
function buildEntry(src: SourceWord, trans: Translation, bankTag: string): WordEntry {
  return {
    id: src.word.toLowerCase(),
    word: src.word.toLowerCase(),
    phonetic: '',
    meanings: [{
      partOfSpeech: trans.pos,
      definition: src.definition,
      definitionCn: trans.chinese,
    }],
    difficulty: [bankTag],
    chineseMappings: trans.chinese.split('/').map(ch => ({
      chinese: ch.trim(),
      partOfSpeech: trans.pos,
    })),
  };
}

// Main
const BANKS: Record<string, { tag: string; wordstaFile?: string; translationFile: string }> = {
  gre: {
    tag: 'GRE',
    wordstaFile: '/tmp/flipword-data/high-frequency-gre.js',
    translationFile: 'scripts/translations/gre.csv',
  },
  ielts: {
    tag: 'IELTS',
    wordstaFile: '/tmp/flipword-data/intermediate.js',
    translationFile: 'scripts/translations/ielts.csv',
  },
  toefl: {
    tag: 'TOEFL',
    translationFile: 'scripts/translations/toefl.csv',
  },
  business: {
    tag: 'BUSINESS',
    translationFile: 'scripts/translations/business.csv',
  },
  academic: {
    tag: 'ACADEMIC',
    translationFile: 'scripts/translations/academic.csv',
  },
};

let totalGenerated = 0;

for (const [bankId, config] of Object.entries(BANKS)) {
  if (!existsSync(config.translationFile)) {
    console.log(`⏭  ${bankId}: no translation file (${config.translationFile}), skipping`);
    continue;
  }

  // Load translations
  const translations = parseTranslationCSV(readFileSync(config.translationFile, 'utf-8'));
  const transMap = new Map(translations.map(t => [t.word, t]));

  // Load source data if available
  let sourceWords: SourceWord[] = [];
  if (config.wordstaFile && existsSync(config.wordstaFile)) {
    sourceWords = parseWordstaJS(readFileSync(config.wordstaFile, 'utf-8'));
  }
  const sourceMap = new Map(sourceWords.map(s => [s.word.toLowerCase(), s]));

  // Merge: translations drive the output, source enriches definitions
  const entries: WordEntry[] = [];
  const seen = new Set<string>();

  // Load existing bank to preserve hand-crafted entries
  const existingPath = `data/word-banks/${bankId}.json`;
  let existing: WordEntry[] = [];
  if (existsSync(existingPath)) {
    existing = JSON.parse(readFileSync(existingPath, 'utf-8'));
    for (const e of existing) seen.add(e.id);
    entries.push(...existing);
  }

  // Add new entries from translations
  for (const trans of translations) {
    if (seen.has(trans.word)) continue;
    seen.add(trans.word);

    const src = sourceMap.get(trans.word) ?? {
      word: trans.word,
      definition: '',
    };

    entries.push(buildEntry(src, trans, config.tag));
  }

  writeFileSync(existingPath, JSON.stringify(entries, null, 2) + '\n');
  const newCount = entries.length - existing.length;
  console.log(`✓  ${bankId}: ${entries.length} total (${existing.length} existing + ${newCount} new)`);
  totalGenerated += newCount;
}

console.log(`\nDone: ${totalGenerated} new words generated across all banks`);
