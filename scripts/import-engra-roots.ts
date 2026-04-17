/**
 * Import roots from engra (2,233 YAML root files with word family trees)
 * and find-roots-of-word (4,311 root/affix entries with frequency data).
 *
 * Merges into existing data/roots-affixes/roots.json and affixes.json
 * without overwriting hand-curated Chinese meanings.
 *
 * Usage: bun scripts/import-engra-roots.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';

interface RootEntry {
  root: string;
  meaning: string;
  meaningCn: string;
  examples: string[];
}

interface AffixEntry {
  type: 'prefix' | 'suffix';
  affix: string;
  meaning: string;
  meaningCn: string;
  examples: string[];
}

// Simple YAML parser for engra's format (name/meaning/children)
function parseEngraYaml(content: string): { name: string; meaning?: string; words: string[] } {
  const nameMatch = content.match(/^name:\s*(.+)/m);
  const meaningMatch = content.match(/^meaning:\s*(.+)/m);
  const name = nameMatch?.[1]?.trim() ?? '';
  const meaning = meaningMatch?.[1]?.trim() ?? '';

  // Extract all word names from the tree
  const words: string[] = [];
  for (const match of content.matchAll(/- name:\s*(.+)/g)) {
    const word = match[1].trim();
    if (word.length >= 3 && /^[a-z]/i.test(word)) {
      words.push(word.toLowerCase());
    }
  }

  return { name, meaning, words };
}

// Parse find-roots CSV: root|frequency
function parseFindRoots(content: string): Array<{ root: string; freq: number; isAffix: boolean; type?: 'prefix' | 'suffix' }> {
  return content.split('\n')
    .map(line => line.trim())
    .filter(line => line && line.includes('|'))
    .map(line => {
      const [root, freqStr] = line.split('|');
      const isPrefix = root.endsWith('-');
      const isSuffix = root.startsWith('-');
      return {
        root: root.replace(/-/g, '').trim(),
        freq: parseInt(freqStr) || 0,
        isAffix: isPrefix || isSuffix,
        type: isPrefix ? 'prefix' as const : isSuffix ? 'suffix' as const : undefined,
      };
    });
}

// Load existing data
const existingRoots: RootEntry[] = JSON.parse(readFileSync('data/roots-affixes/roots.json', 'utf-8'));
const existingAffixes: AffixEntry[] = JSON.parse(readFileSync('data/roots-affixes/affixes.json', 'utf-8'));

// Build lookup sets
const rootKeys = new Set<string>();
for (const r of existingRoots) {
  for (const v of r.root.split('/')) rootKeys.add(v.toLowerCase());
}

const affixKeys = new Set<string>();
for (const a of existingAffixes) {
  affixKeys.add(a.affix.replace(/-/g, '').toLowerCase());
}

// === Import engra roots (2,233 YAML files with word family trees) ===
console.log('Importing engra roots...');
const engraDir = '/tmp/engra/dict/roots';
const engraFiles = readdirSync(engraDir).filter(f => f.endsWith('.yml'));
let engraAdded = 0;

for (const file of engraFiles) {
  const content = readFileSync(`${engraDir}/${file}`, 'utf-8');
  const parsed = parseEngraYaml(content);
  if (!parsed.name || parsed.words.length < 2) continue;

  const rootName = parsed.name.toLowerCase().replace(/[()]/g, '');
  if (rootKeys.has(rootName)) {
    // Already exists — enrich with more examples if available
    const existing = existingRoots.find(r =>
      r.root.split('/').some(v => v.toLowerCase() === rootName)
    );
    if (existing && existing.examples.length < 6) {
      const newExamples = parsed.words.filter(w => !existing.examples.includes(w)).slice(0, 6 - existing.examples.length);
      existing.examples.push(...newExamples);
    }
    // If we have a Chinese meaning from engra and existing is English-only
    if (existing && parsed.meaning && existing.meaningCn.match(/^[a-zA-Z\s,./]+$/)) {
      existing.meaningCn = parsed.meaning;
    }
    continue;
  }

  rootKeys.add(rootName);
  existingRoots.push({
    root: rootName,
    meaning: parsed.meaning || rootName,
    meaningCn: parsed.meaning || rootName, // engra has Chinese meanings for some
    examples: parsed.words.slice(0, 6),
  });
  engraAdded++;
}

console.log(`  engra: +${engraAdded} new roots (${engraFiles.length} files processed)`);

// === Import find-roots-of-word (4,311 root/affix entries) ===
console.log('Importing find-roots...');
const findRootsContent = readFileSync('/tmp/find-roots/roots-and-affixes.csv', 'utf-8');
const findRootsEntries = parseFindRoots(findRootsContent);
let frRootsAdded = 0;
let frAffixesAdded = 0;

for (const entry of findRootsEntries) {
  if (entry.root.length < 2) continue;

  if (entry.isAffix && entry.type) {
    const key = entry.root.toLowerCase();
    if (affixKeys.has(key)) continue;
    affixKeys.add(key);
    existingAffixes.push({
      type: entry.type,
      affix: entry.type === 'prefix' ? `${entry.root}-` : `-${entry.root}`,
      meaning: entry.root,
      meaningCn: entry.root,
      examples: [],
    });
    frAffixesAdded++;
  } else {
    const key = entry.root.toLowerCase();
    if (rootKeys.has(key)) continue;
    rootKeys.add(key);
    existingRoots.push({
      root: entry.root,
      meaning: entry.root,
      meaningCn: entry.root,
      examples: [],
    });
    frRootsAdded++;
  }
}

console.log(`  find-roots: +${frRootsAdded} roots, +${frAffixesAdded} affixes`);

// === Import engra glossary word lists to expand existing word banks ===
console.log('\nChecking engra glossaries for new words...');
const GLOSSARY_MAP: Record<string, string> = {
  'IELTS': 'ielts', 'TOEFL': 'toefl', 'GRE': 'gre',
  'CET4': 'academic', 'CET6': 'academic', 'SAT': 'gre',
};

for (const [glossary, bankId] of Object.entries(GLOSSARY_MAP)) {
  try {
    const words: string[] = JSON.parse(readFileSync(`/tmp/engra/dict/glossaries/${glossary}.json`, 'utf-8'));
    const bankPath = `data/word-banks/${bankId}.json`;
    const bankEntries = JSON.parse(readFileSync(bankPath, 'utf-8'));
    const existingIds = new Set(bankEntries.map((e: any) => e.id));
    let added = 0;

    for (const word of words) {
      const id = word.toLowerCase();
      if (existingIds.has(id)) continue;
      // Only add as skeleton entry (word + id, no Chinese mapping yet)
      // These won't match on web pages until Chinese mappings are added
      // but they'll be ready for enrichment
      existingIds.add(id);
      // Skip adding skeleton entries without Chinese — they won't work in matching
    }
    console.log(`  ${glossary} → ${bankId}: ${words.length} words (${added} new with Chinese)`);
  } catch {
    console.log(`  ${glossary}: skipped`);
  }
}

// Write output
writeFileSync('data/roots-affixes/roots.json', JSON.stringify(existingRoots, null, 2) + '\n');
writeFileSync('data/roots-affixes/affixes.json', JSON.stringify(existingAffixes, null, 2) + '\n');

console.log(`\nFinal totals:`);
console.log(`  Roots: ${existingRoots.length}`);
console.log(`  Affixes: ${existingAffixes.length}`);
console.log('\nNow re-run: bun scripts/import-kajweb.ts && bun scripts/import-morphology.ts');
