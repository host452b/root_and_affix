/**
 * Import THUOCL domain word lists + reverse-map Chinese → English via ecdict.
 *
 * THUOCL provides Chinese domain words with frequency.
 * ecdict provides English → Chinese mappings.
 * We reverse it: find English words whose Chinese translation contains THUOCL terms.
 *
 * Creates/merges: medical, legal, finance banks.
 *
 * Usage: bun scripts/import-thuocl.ts
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

// Load ecdict — build reverse index: Chinese term → English word entries
console.log('Building reverse Chinese→English index from ecdict...');
const chineseToEnglish = new Map<string, Array<{ word: string; phonetic: string; translation: string; pos: string }>>();

const ecdictContent = readFileSync('/tmp/it-english/dictionary/ecdict.csv', 'utf-8');
let lineNum = 0;
for (const line of ecdictContent.split('\n')) {
  lineNum++;
  if (lineNum === 1) continue;
  const parts = line.split(',');
  if (parts.length < 5) continue;
  const word = parts[0].toLowerCase().trim();
  if (!word || word.includes(' ') || word.length < 3 || word.length > 20) continue;
  const phonetic = parts[1] || '';
  const translation = parts[3] || '';
  const pos = parts[4] || '';
  if (!translation || !/[\u4e00-\u9fff]/.test(translation)) continue;

  // Extract 2-4 char Chinese terms from translation
  const terms = translation.split(/[；;，,、\n()（）]/)
    .map(t => t.replace(/^[a-z]+\.\s*/, '').trim())
    .filter(t => t.length >= 2 && t.length <= 4 && /^[\u4e00-\u9fff]+$/.test(t));

  for (const term of terms) {
    if (!chineseToEnglish.has(term)) chineseToEnglish.set(term, []);
    chineseToEnglish.get(term)!.push({ word, phonetic, translation, pos });
  }
}
console.log(`Reverse index: ${chineseToEnglish.size} Chinese terms → English words`);

// Load existing word IDs to avoid duplicates
const existingIds = new Set<string>();
for (const f of ['ielts', 'toefl', 'gre', 'cet4', 'academic', 'sat', 'gmat', 'npee', 'cefr-b2', 'business', 'tech', 'news', 'finance', 'editorial']) {
  try {
    const data = JSON.parse(readFileSync(`data/word-banks/${f}.json`, 'utf-8'));
    for (const e of data) existingIds.add(e.id);
  } catch {}
}
console.log(`Existing words: ${existingIds.size}`);

function makeBankFromTHUOCL(
  thuoclFile: string,
  bankId: string,
  tag: string,
  maxWords: number,
): number {
  const content = readFileSync(thuoclFile, 'utf-8');
  const chineseTerms = content.split('\n')
    .map(line => line.split('\t')[0]?.trim())
    .filter(t => t && t.length >= 2 && t.length <= 4 && /^[\u4e00-\u9fff]+$/.test(t));

  // Load existing bank
  const bankPath = `data/word-banks/${bankId}.json`;
  let existing: WordEntry[] = [];
  if (existsSync(bankPath)) {
    existing = JSON.parse(readFileSync(bankPath, 'utf-8'));
  }
  const bankIds = new Set(existing.map(e => e.id));

  let added = 0;
  for (const cn of chineseTerms) {
    const englishWords = chineseToEnglish.get(cn);
    if (!englishWords) continue;

    // Pick the best English word (shortest common word with this Chinese meaning)
    for (const ew of englishWords.slice(0, 2)) {
      if (bankIds.has(ew.word) || existingIds.has(ew.word)) continue;
      if (ew.word.length < 4) continue;

      // Parse Chinese translation for meanings
      const lines = ew.translation.split('\n').filter(l => l.trim());
      const meanings = lines.slice(0, 2).map(l => {
        const posMatch = l.match(/^([a-z]+\.)\s*/);
        const p = posMatch ? posMatch[1].replace('.', '') : '';
        const defCn = l.replace(/^[a-z]+\.\s*/, '').trim();
        return { partOfSpeech: p, definition: '', definitionCn: defCn };
      });

      const chineseMappings = [{ chinese: cn, partOfSpeech: meanings[0]?.partOfSpeech ?? '' }];

      existing.push({
        id: ew.word,
        word: ew.word,
        phonetic: ew.phonetic ? `/${ew.phonetic}/` : '',
        meanings,
        difficulty: [tag],
        chineseMappings,
      });
      bankIds.add(ew.word);
      existingIds.add(ew.word);
      added++;

      if (existing.length >= maxWords) break;
    }
    if (existing.length >= maxWords) break;
  }

  writeFileSync(bankPath, JSON.stringify(existing, null, 2) + '\n');
  return added;
}

// Process each THUOCL domain
const DOMAINS: Array<{ file: string; bank: string; tag: string; max: number }> = [
  { file: '/tmp/thuocl/data/THUOCL_medical.txt', bank: 'medical', tag: 'MEDICAL', max: 2000 },
  { file: '/tmp/thuocl/data/THUOCL_law.txt', bank: 'legal', tag: 'LEGAL', max: 1500 },
  { file: '/tmp/thuocl/data/THUOCL_caijing.txt', bank: 'finance', tag: 'FINANCE', max: 1500 },
  { file: '/tmp/thuocl/data/THUOCL_IT.txt', bank: 'tech', tag: 'TECH', max: 5000 },
];

for (const domain of DOMAINS) {
  const added = makeBankFromTHUOCL(domain.file, domain.bank, domain.tag, domain.max);
  const total = JSON.parse(readFileSync(`data/word-banks/${domain.bank}.json`, 'utf-8')).length;
  console.log(`✓ ${domain.bank}: +${added} new → ${total} total`);
}

console.log('\nRun: bun scripts/import-morphology.ts && bun scripts/audit-fix-wordbanks.ts');
