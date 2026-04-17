/**
 * Batch import from multiple sources:
 * - DomainWordsDict (Chinese domain terms → reverse ecdict lookup)
 * - KyleBing/english-vocabulary (CET4/6, 考研 with Chinese translations)
 * - SentimentDictionaries (financial sentiment terms)
 *
 * Usage: bun scripts/import-domains-batch.ts
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

// Load ecdict reverse index (already built by import-thuocl)
console.log('Building ecdict reverse index...');
const chineseToEnglish = new Map<string, Array<{ word: string; phonetic: string; translation: string }>>();
const ecdictContent = readFileSync('/tmp/it-english/dictionary/ecdict.csv', 'utf-8');
let lineNum = 0;
for (const line of ecdictContent.split('\n')) {
  lineNum++;
  if (lineNum === 1) continue;
  const parts = line.split(',');
  if (parts.length < 4) continue;
  const word = parts[0].toLowerCase().trim();
  if (!word || word.includes(' ') || word.length < 3 || word.length > 20) continue;
  const phonetic = parts[1] || '';
  const translation = parts[3] || '';
  if (!translation || !/[\u4e00-\u9fff]/.test(translation)) continue;

  const terms = translation.split(/[；;，,、\n()（）]/)
    .map(t => t.replace(/^[a-z]+\.\s*/, '').trim())
    .filter(t => t.length >= 2 && t.length <= 4 && /^[\u4e00-\u9fff]+$/.test(t));

  for (const term of terms) {
    if (!chineseToEnglish.has(term)) chineseToEnglish.set(term, []);
    chineseToEnglish.get(term)!.push({ word, phonetic, translation });
  }
}
console.log(`Reverse index: ${chineseToEnglish.size} terms`);

// Track all existing IDs
const existingIds = new Set<string>();
for (const f of ['ielts', 'toefl', 'gre', 'cet4', 'academic', 'sat', 'gmat', 'npee', 'cefr-b2', 'business', 'tech', 'news', 'finance', 'medical', 'legal', 'editorial']) {
  try { for (const e of JSON.parse(readFileSync(`data/word-banks/${f}.json`, 'utf-8'))) existingIds.add(e.id); } catch {}
}

function addFromChineseDomain(domainFile: string, bankId: string, tag: string, maxNew: number): number {
  if (!existsSync(domainFile)) { console.log(`  skip: ${domainFile} not found`); return 0; }
  const content = readFileSync(domainFile, 'utf-8');
  const terms = content.split('\n').map(l => l.trim()).filter(l => l.length >= 2 && l.length <= 4 && /^[\u4e00-\u9fff]+$/.test(l));

  const bankPath = `data/word-banks/${bankId}.json`;
  let entries: WordEntry[] = existsSync(bankPath) ? JSON.parse(readFileSync(bankPath, 'utf-8')) : [];
  const bankIds = new Set(entries.map(e => e.id));
  let added = 0;

  for (const cn of terms) {
    if (added >= maxNew) break;
    const ews = chineseToEnglish.get(cn);
    if (!ews) continue;
    for (const ew of ews.slice(0, 1)) {
      if (bankIds.has(ew.word) || existingIds.has(ew.word)) continue;
      if (ew.word.length < 4) continue;
      const lines = ew.translation.split('\n').filter(l => l.trim()).slice(0, 2);
      const meanings = lines.map(l => {
        const pm = l.match(/^([a-z]+\.)\s*/);
        return { partOfSpeech: pm ? pm[1].replace('.','') : '', definition: '', definitionCn: l.replace(/^[a-z]+\.\s*/, '').trim() };
      });
      entries.push({ id: ew.word, word: ew.word, phonetic: ew.phonetic ? `/${ew.phonetic}/` : '', meanings, difficulty: [tag], chineseMappings: [{ chinese: cn, partOfSpeech: meanings[0]?.partOfSpeech ?? '' }] });
      bankIds.add(ew.word); existingIds.add(ew.word); added++;
    }
  }
  writeFileSync(bankPath, JSON.stringify(entries, null, 2) + '\n');
  return added;
}

function addFromKyleBing(file: string, bankId: string, tag: string, maxNew: number): number {
  if (!existsSync(file)) { console.log(`  skip: ${file} not found`); return 0; }
  const content = readFileSync(file, 'utf-8');
  const bankPath = `data/word-banks/${bankId}.json`;
  let entries: WordEntry[] = existsSync(bankPath) ? JSON.parse(readFileSync(bankPath, 'utf-8')) : [];
  const bankIds = new Set(entries.map(e => e.id));
  let added = 0;

  for (const line of content.split('\n')) {
    if (added >= maxNew) break;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const word = parts[0]?.trim().toLowerCase();
    const phonetic = parts[1]?.trim() ?? '';
    const defCn = parts[2]?.trim() ?? '';
    if (!word || word.length < 3 || !defCn || bankIds.has(word) || existingIds.has(word)) continue;

    // Extract Chinese mappings
    const chTerms = defCn.split(/[；;，,、]/)
      .map(t => t.replace(/^[a-z]+\.\s*/, '').trim())
      .filter(t => t.length >= 2 && t.length <= 6 && /[\u4e00-\u9fff]/.test(t))
      .slice(0, 3);
    if (chTerms.length === 0) continue;

    entries.push({
      id: word, word, phonetic: phonetic ? `/${phonetic}/` : '',
      meanings: [{ partOfSpeech: '', definition: '', definitionCn: defCn }],
      difficulty: [tag],
      chineseMappings: chTerms.map(ch => ({ chinese: ch, partOfSpeech: '' })),
    });
    bankIds.add(word); existingIds.add(word); added++;
  }
  writeFileSync(bankPath, JSON.stringify(entries, null, 2) + '\n');
  return added;
}

// === Task 3: DomainWordsDict ===
console.log('\n=== DomainWordsDict ===');
const domainResults: Array<[string, string, string, number]> = [
  ['/tmp/domain-words/data/医药医学.txt', 'medical', 'MEDICAL', 1000],
  ['/tmp/domain-words/data/金融财经.txt', 'finance', 'FINANCE', 500],
  ['/tmp/domain-words/data/军事情报.txt', 'military', 'MILITARY', 800],
  ['/tmp/domain-words/data/交通运输.txt', 'tech', 'TECH', 300],
];
for (const [file, bank, tag, max] of domainResults) {
  const n = addFromChineseDomain(file, bank, tag, max);
  const total = JSON.parse(readFileSync(`data/word-banks/${bank}.json`, 'utf-8')).length;
  console.log(`✓ ${bank}: +${n} → ${total} total`);
}

// === Task 7: KyleBing exam vocabularies ===
console.log('\n=== KyleBing ===');
const kyleFiles: Array<[string, string, string, number]> = [
  ['/tmp/kyle-vocab/3 四级-乱序.txt', 'cet4', 'CET4', 500],
  ['/tmp/kyle-vocab/4 六级-乱序.txt', 'academic', 'ACADEMIC', 500],
  ['/tmp/kyle-vocab/5 考研-乱序.txt', 'npee', 'NPEE', 500],
];
for (const [file, bank, tag, max] of kyleFiles) {
  const n = addFromKyleBing(file, bank, tag, max);
  const total = JSON.parse(readFileSync(`data/word-banks/${bank}.json`, 'utf-8')).length;
  console.log(`✓ ${bank}: +${n} → ${total} total`);
}

// === Task 6: Financial sentiment (LM dictionary words) ===
console.log('\n=== Sentiment Dictionaries ===');
if (existsSync('/tmp/sentiment-dict/Dictionary8K.csv')) {
  const content = readFileSync('/tmp/sentiment-dict/Dictionary8K.csv', 'utf-8');
  const bankPath = 'data/word-banks/finance.json';
  let entries: WordEntry[] = JSON.parse(readFileSync(bankPath, 'utf-8'));
  const bankIds = new Set(entries.map(e => e.id));
  let added = 0;

  for (const line of content.split('\n').slice(1)) {
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const word = parts[0]?.trim().toLowerCase();
    if (!word || word.length < 4 || bankIds.has(word) || existingIds.has(word)) continue;

    // Look up in ecdict for Chinese
    const ecdictLines = readFileSync('/tmp/it-english/dictionary/ecdict.csv', 'utf-8').split('\n');
    // Too slow to re-scan — use the reverse index instead
    const candidates = [...chineseToEnglish.entries()]
      .filter(([_, ews]) => ews.some(e => e.word === word))
      .map(([cn]) => cn);

    if (candidates.length === 0) continue;

    entries.push({
      id: word, word, phonetic: '',
      meanings: [{ partOfSpeech: '', definition: '', definitionCn: '' }],
      difficulty: ['FINANCE'],
      chineseMappings: candidates.slice(0, 2).map(ch => ({ chinese: ch, partOfSpeech: '' })),
    });
    bankIds.add(word); existingIds.add(word); added++;
    if (added >= 300) break;
  }
  writeFileSync(bankPath, JSON.stringify(entries, null, 2) + '\n');
  console.log(`✓ finance (sentiment): +${added} → ${entries.length} total`);
}

console.log('\nDone. Run enrichment + audit next.');
