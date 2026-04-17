/**
 * Expand word banks using engra glossary lists + kajweb Chinese data.
 *
 * For words in engra that aren't in our banks yet, find their Chinese
 * data from kajweb and add them to the appropriate bank.
 *
 * Also creates new banks: CEFR levels, SAT, GMAT, KaoYan.
 *
 * Usage: bun scripts/expand-from-engra.ts
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';

interface KajwebEntry {
  headWord: string;
  content: {
    word: {
      content: {
        usphone?: string;
        ukphone?: string;
        trans?: Array<{ tranCn: string; pos: string }>;
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

function parseKajweb(line: string): KajwebEntry | null {
  try { return JSON.parse(line); } catch { return null; }
}

function convertKajweb(kw: KajwebEntry, tag: string): WordEntry | null {
  const content = kw.content?.word?.content;
  if (!content?.trans || content.trans.length === 0) return null;

  const word = kw.headWord.toLowerCase();
  const phonetic = content.usphone ? `/${content.usphone}/` : content.ukphone ? `/${content.ukphone}/` : '';

  const meanings = content.trans.map(t => ({
    partOfSpeech: t.pos?.replace(/[&]/g, '/') ?? '',
    definition: '',
    definitionCn: t.tranCn,
  }));

  const chineseMappings: Array<{ chinese: string; partOfSpeech: string }> = [];
  const seen = new Set<string>();
  for (const trans of content.trans) {
    const pos = trans.pos?.split(/[&/]/)[0] ?? '';
    const terms = trans.tranCn.split(/[；;，,、]/).map(t => t.trim())
      .filter(t => t.length >= 2 && t.length <= 6 && !/^[\x00-\x7F]+$/.test(t))
      .slice(0, 3);
    for (const term of terms) {
      if (!seen.has(term)) { seen.add(term); chineseMappings.push({ chinese: term, partOfSpeech: pos }); }
    }
  }

  if (chineseMappings.length === 0) return null;
  return { id: word, word, phonetic, meanings, difficulty: [tag], chineseMappings };
}

// Load all kajweb data into a lookup
console.log('Loading kajweb data...');
const kajwebMap = new Map<string, KajwebEntry>();
const SOURCE_DIR = '/tmp/kajweb-extract';
for (const cat of readdirSync(SOURCE_DIR)) {
  const catDir = `${SOURCE_DIR}/${cat}`;
  for (const file of readdirSync(catDir).filter(f => f.endsWith('.json'))) {
    for (const line of readFileSync(`${catDir}/${file}`, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      const kw = parseKajweb(line);
      if (kw) kajwebMap.set(kw.headWord.toLowerCase(), kw);
    }
  }
}
console.log(`Kajweb: ${kajwebMap.size} words loaded`);

// Load engra glossaries
const BANK_MAP: Record<string, { output: string; tag: string; max: number }> = {
  'IELTS': { output: 'ielts', tag: 'IELTS', max: 99999 },
  'TOEFL': { output: 'toefl', tag: 'TOEFL', max: 99999 },
  'GRE': { output: 'gre', tag: 'GRE', max: 99999 },
  'CET4': { output: 'cet4', tag: 'CET4', max: 99999 },
  'CET6': { output: 'academic', tag: 'ACADEMIC', max: 99999 },
  'GMAT': { output: 'gmat', tag: 'GMAT', max: 99999 },
  'SAT': { output: 'sat', tag: 'SAT', max: 99999 },
  'KaoYan': { output: 'kaoyan', tag: 'KAOYAN', max: 99999 },
  'CEFR-B2': { output: 'cefr-b2', tag: 'CEFR-B2', max: 99999 },
};

for (const [glossary, config] of Object.entries(BANK_MAP)) {
  const glossaryPath = `/tmp/engra/dict/glossaries/${glossary}.json`;
  if (!existsSync(glossaryPath)) {
    console.log(`⏭  ${glossary}: glossary not found`);
    continue;
  }

  const glossaryWords: string[] = JSON.parse(readFileSync(glossaryPath, 'utf-8'));
  const bankPath = `data/word-banks/${config.output}.json`;

  // Load existing bank or create new
  let existing: WordEntry[] = [];
  if (existsSync(bankPath)) {
    existing = JSON.parse(readFileSync(bankPath, 'utf-8'));
  }
  const existingIds = new Set(existing.map(e => e.id));

  let added = 0;
  for (const word of glossaryWords) {
    const id = word.toLowerCase();
    if (existingIds.has(id)) continue;
    if (existing.length >= config.max) break;

    const kw = kajwebMap.get(id);
    if (!kw) continue;

    const entry = convertKajweb(kw, config.tag);
    if (!entry) continue;

    existing.push(entry);
    existingIds.add(id);
    added++;
  }

  writeFileSync(bankPath, JSON.stringify(existing, null, 2) + '\n');
  console.log(`✓  ${config.output}: ${existing.length} total (+${added} new from ${glossary})`);
}

// Register new banks in popup
console.log('\nDone. New banks created: cet4, sat, gmat, kaoyan, cefr-b2');
console.log('Remember to register new banks in popup/index.tsx');
