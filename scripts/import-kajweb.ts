/**
 * Import word banks from kajweb/dict format → Flipword WordEntry format.
 *
 * Usage: bun scripts/import-kajweb.ts
 *
 * Reads JSONL files from /tmp/kajweb-extract/{CATEGORY}/*.json
 * Outputs to data/word-banks/{category}.json
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';

interface KajwebEntry {
  wordRank: number;
  headWord: string;
  content: {
    word: {
      wordHead: string;
      content: {
        usphone?: string;
        ukphone?: string;
        trans?: Array<{ tranCn: string; pos: string }>;
        remMethod?: { val: string };
        sentence?: { sentences: Array<{ sContent: string; sCn: string }> };
        syno?: { synos: Array<{ pos: string; tran: string }> };
      };
    };
  };
}

interface WordEntry {
  id: string;
  word: string;
  phonetic: string;
  meanings: Array<{ partOfSpeech: string; definition: string; definitionCn: string }>;
  difficulty: string[];
  chineseMappings: Array<{ chinese: string; partOfSpeech: string }>;
}

function parseKajwebLine(line: string): KajwebEntry | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function convertEntry(kw: KajwebEntry, tag: string): WordEntry | null {
  const content = kw.content?.word?.content;
  if (!content?.trans || content.trans.length === 0) return null;

  const word = kw.headWord.toLowerCase();
  const phonetic = content.usphone ? `/${content.usphone}/` : content.ukphone ? `/${content.ukphone}/` : '';

  // Build meanings
  const meanings = content.trans.map(t => ({
    partOfSpeech: t.pos?.replace(/[&]/g, '/') ?? '',
    definition: '', // kajweb doesn't always have English definitions
    definitionCn: t.tranCn,
  }));

  // Build Chinese mappings — split by ；or；then by ，
  const chineseMappings: Array<{ chinese: string; partOfSpeech: string }> = [];
  const seenChinese = new Set<string>();

  for (const trans of content.trans) {
    const pos = trans.pos?.split(/[&/]/)[0] ?? '';
    // Split Chinese translation into individual terms
    const terms = trans.tranCn
      .split(/[；;，,、]/)
      .map(t => t.trim())
      .filter(t => t.length > 0 && t.length <= 6) // Keep short terms (good for matching on web pages)
      .slice(0, 3); // Max 3 per POS

    for (const term of terms) {
      if (!seenChinese.has(term)) {
        seenChinese.add(term);
        chineseMappings.push({ chinese: term, partOfSpeech: pos });
      }
    }
  }

  if (chineseMappings.length === 0) return null;

  return {
    id: word,
    word,
    phonetic,
    meanings,
    difficulty: [tag],
    chineseMappings,
  };
}

// Mapping: source category → output bank + tag + max words
const BANK_CONFIG: Record<string, { output: string; tag: string; max: number }> = {
  IELTS: { output: 'ielts', tag: 'IELTS', max: 3500 },
  TOEFL: { output: 'toefl', tag: 'TOEFL', max: 3500 },
  GRE: { output: 'gre', tag: 'GRE', max: 3500 },
  BEC: { output: 'business', tag: 'BUSINESS', max: 1500 },
  CET6: { output: 'academic', tag: 'ACADEMIC', max: 1500 },
};

const SOURCE_DIR = '/tmp/kajweb-extract';

for (const [category, config] of Object.entries(BANK_CONFIG)) {
  const catDir = `${SOURCE_DIR}/${category}`;
  if (!existsSync(catDir)) {
    console.log(`⏭  ${category}: source directory not found`);
    continue;
  }

  const files = readdirSync(catDir).filter(f => f.endsWith('.json'));
  const allEntries: WordEntry[] = [];
  const seenIds = new Set<string>();

  // Read all JSONL files for this category
  for (const file of files) {
    const content = readFileSync(`${catDir}/${file}`, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const kw = parseKajwebLine(line);
      if (!kw) continue;

      const entry = convertEntry(kw, config.tag);
      if (!entry || seenIds.has(entry.id)) continue;

      seenIds.add(entry.id);
      allEntries.push(entry);
    }
  }

  // Sort by wordRank (original order = frequency order) and limit
  const limited = allEntries.slice(0, config.max);

  const outPath = `data/word-banks/${config.output}.json`;
  writeFileSync(outPath, JSON.stringify(limited, null, 2) + '\n');
  console.log(`✓  ${config.output}: ${limited.length} words (from ${allEntries.length} total ${category})`);
}

// Keep editorial.json as-is (hand-curated)
console.log(`\n✓  editorial: kept as-is (hand-curated)`);
console.log('\nDone. Run `bun run build` to include updated banks in dist/');
