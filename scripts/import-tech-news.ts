/**
 * Import IT/Tech and News vocabulary as new word banks.
 *
 * Sources:
 * - Simple-IT-English: HN + StackOverflow word frequency (16K words)
 * - news-vocabulary-dataset: news site word frequency
 * - ecdict.csv: 770K word English-Chinese dictionary (provides Chinese translations)
 *
 * Creates: tech.json, news.json
 *
 * Usage: bun scripts/import-tech-news.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

interface WordEntry {
  id: string;
  word: string;
  phonetic: string;
  meanings: Array<{ partOfSpeech: string; definition: string; definitionCn: string }>;
  difficulty: string[];
  chineseMappings: Array<{ chinese: string; partOfSpeech: string }>;
}

// Load ecdict as Chinese translation source
console.log('Loading ecdict (770K entries)...');
const ecdictMap = new Map<string, { phonetic: string; translation: string; pos: string }>();
const ecdictContent = readFileSync('/tmp/it-english/dictionary/ecdict.csv', 'utf-8');
let lineNum = 0;
for (const line of ecdictContent.split('\n')) {
  lineNum++;
  if (lineNum === 1) continue; // header
  // CSV: word,phonetic,definition,translation,pos,...
  const parts = line.split(',');
  if (parts.length < 5) continue;
  const word = parts[0].toLowerCase().trim();
  if (!word || word.includes(' ') || word.length < 3) continue;
  const phonetic = parts[1] || '';
  const translation = parts[3] || '';
  const pos = parts[4] || '';
  if (translation && /[\u4e00-\u9fff]/.test(translation)) {
    ecdictMap.set(word, { phonetic, translation, pos });
  }
}
console.log(`ecdict: ${ecdictMap.size} words with Chinese translations`);

function makeEntry(word: string, tag: string): WordEntry | null {
  const dict = ecdictMap.get(word.toLowerCase());
  if (!dict) return null;

  const phonetic = dict.phonetic ? `/${dict.phonetic}/` : '';
  // Parse Chinese translation: "n. 代码\nv. 编码" → extract short terms
  const lines = dict.translation.split('\n').filter(l => l.trim());
  const meanings: WordEntry['meanings'] = [];
  const chineseMappings: Array<{ chinese: string; partOfSpeech: string }> = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const posMatch = line.match(/^([a-z]+\.)\s*/);
    const pos = posMatch ? posMatch[1].replace('.', '') : '';
    const cnText = line.replace(/^[a-z]+\.\s*/, '').trim();

    if (cnText) {
      meanings.push({ partOfSpeech: pos, definition: '', definitionCn: cnText });
    }

    // Extract short Chinese terms for mapping
    const terms = cnText.split(/[；;，,、（）()【】]/)
      .map(t => t.trim())
      .filter(t => t.length >= 2 && t.length <= 6 && /[\u4e00-\u9fff]/.test(t) && !/^[a-zA-Z]/.test(t));

    for (const term of terms.slice(0, 3)) {
      if (!seen.has(term)) {
        seen.add(term);
        chineseMappings.push({ chinese: term, partOfSpeech: pos });
      }
    }
  }

  if (chineseMappings.length === 0) return null;

  return {
    id: word.toLowerCase(),
    word: word.toLowerCase(),
    phonetic,
    meanings,
    difficulty: [tag],
    chineseMappings,
  };
}

// === Build TECH bank from IT English word frequency ===
console.log('\nBuilding tech bank...');
const itFreq = readFileSync('/tmp/it-english/source/results-20191210-170511.csv', 'utf-8');
const itWords: string[] = [];
for (const line of itFreq.split('\n').slice(1)) {
  const [word] = line.split(',');
  if (word && word.length >= 3 && /^[a-z]/i.test(word) && !word.includes("'")) {
    itWords.push(word.toLowerCase());
  }
}

// Filter: only keep words that have Chinese translations AND are not super basic
const BASIC_SKIP = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'are', 'was', 'were', 'been', 'being', 'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'not', 'but', 'all', 'its', 'his', 'her', 'our', 'your', 'their', 'which', 'when', 'where', 'what', 'who', 'how', 'than', 'then', 'them', 'these', 'those', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'also', 'back', 'after', 'just', 'over', 'new', 'about', 'into', 'time', 'very', 'your', 'just']);

const techEntries: WordEntry[] = [];
const techSeen = new Set<string>();

// Load existing banks to avoid duplicates
const existingWords = new Set<string>();
for (const f of ['ielts', 'toefl', 'gre', 'business', 'academic', 'editorial', 'cet4', 'sat', 'gmat', 'npee', 'cefr-b2']) {
  try {
    const data = JSON.parse(readFileSync(`data/word-banks/${f}.json`, 'utf-8'));
    for (const e of data) existingWords.add(e.id);
  } catch {}
}

for (const word of itWords) {
  if (BASIC_SKIP.has(word) || techSeen.has(word) || existingWords.has(word)) continue;
  if (word.length < 4) continue;
  const entry = makeEntry(word, 'TECH');
  if (!entry) continue;
  techEntries.push(entry);
  techSeen.add(word);
  if (techEntries.length >= 3000) break;
}

writeFileSync('data/word-banks/tech.json', JSON.stringify(techEntries, null, 2) + '\n');
console.log(`✓ tech: ${techEntries.length} words`);

// === Build NEWS bank from news vocabulary ===
console.log('\nBuilding news bank...');
const newsSQL = readFileSync('/tmp/news-vocab/storage/wordlist.sql', 'utf-8');
const newsWords: Array<{ word: string; count: number }> = [];
for (const match of newsSQL.matchAll(/\(\d+,\s*'([^']+)',\s*(\d+)\)/g)) {
  newsWords.push({ word: match[1].toLowerCase(), count: parseInt(match[2]) });
}
newsWords.sort((a, b) => b.count - a.count);

const newsEntries: WordEntry[] = [];
const newsSeen = new Set<string>();

for (const { word } of newsWords) {
  if (BASIC_SKIP.has(word) || newsSeen.has(word) || existingWords.has(word) || techSeen.has(word)) continue;
  if (word.length < 4) continue;
  const entry = makeEntry(word, 'NEWS');
  if (!entry) continue;
  newsEntries.push(entry);
  newsSeen.add(word);
  if (newsEntries.length >= 3000) break;
}

writeFileSync('data/word-banks/news.json', JSON.stringify(newsEntries, null, 2) + '\n');
console.log(`✓ news: ${newsEntries.length} words`);

console.log(`\nTotal new: ${techEntries.length + newsEntries.length} words`);
console.log('Register in popup: tech, news');
