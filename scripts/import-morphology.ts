/**
 * Import morphology data from MorphoLex + etymology from Etymonline.
 * Pre-computes morphology for all word bank entries and writes back to JSON.
 *
 * Usage: bun scripts/import-morphology.ts
 *
 * Input:
 *   /tmp/morpholex_words.json   — MorphoLex segmentation data (37K words)
 *   /tmp/etymonline/index.json  — Etymonline etymology data (46K words)
 *   data/roots-affixes/roots.json — our Chinese meaning mappings
 *   data/roots-affixes/affixes.json — our Chinese meaning mappings
 *   data/word-banks/*.json — word banks to enrich
 *
 * Output:
 *   data/word-banks/*.json — enriched with morphology + etymology
 *   data/etymology/core-5000.json — expanded etymology database
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';

// Types
interface MorphSegment {
  type: 'prefix' | 'root' | 'suffix';
  part: string;
}

interface RootData {
  root: string;
  meaning: string;
  meaningCn: string;
  examples: string[];
}

interface AffixData {
  type: 'prefix' | 'suffix';
  affix: string;
  meaning: string;
  meaningCn: string;
  examples: string[];
}

interface WordEntry {
  id: string;
  word: string;
  phonetic: string;
  meanings: Array<{ partOfSpeech: string; definition: string; definitionCn: string }>;
  difficulty: string[];
  chineseMappings: Array<{ chinese: string; partOfSpeech: string }>;
  morphology?: {
    prefix?: Array<{ part: string; meaning: string }>;
    root: { part: string; meaning: string };
    suffix?: Array<{ part: string; meaning: string }>;
    mnemonic: string;
  };
  etymology?: {
    origin: string;
    originalMeaning: string;
    story: string;
    entryPeriod?: string;
  };
}

// Parse MorphoLex segmentation: {<prefix<(root)>suffix>}
function parseMorphoLex(segm: string): MorphSegment[] {
  const parts: MorphSegment[] = [];
  const prefixRe = /<([^<>]+)</g;
  const rootRe = /\(([^()]+)\)/g;
  const suffixRe = />([^<>]+)>/g;

  let m: RegExpExecArray | null;
  while ((m = prefixRe.exec(segm)) !== null) {
    parts.push({ type: 'prefix', part: m[1] });
  }
  while ((m = rootRe.exec(segm)) !== null) {
    parts.push({ type: 'root', part: m[1] });
  }
  while ((m = suffixRe.exec(segm)) !== null) {
    parts.push({ type: 'suffix', part: m[1] });
  }
  return parts;
}

// Find Chinese meaning for a morpheme from our roots/affixes database
function findMeaning(
  part: string,
  type: 'prefix' | 'root' | 'suffix',
  rootsMap: Map<string, string>,
  prefixMap: Map<string, string>,
  suffixMap: Map<string, string>,
): string {
  if (type === 'prefix') {
    // Try exact, then with dash
    return prefixMap.get(part) ?? prefixMap.get(part + '-') ?? '';
  }
  if (type === 'suffix') {
    return suffixMap.get(part) ?? suffixMap.get('-' + part) ?? '';
  }
  // Root: try exact, then all roots that contain this substring
  if (rootsMap.has(part)) return rootsMap.get(part)!;
  for (const [root, meaning] of rootsMap) {
    const variants = root.split('/');
    for (const v of variants) {
      if (v === part || part.startsWith(v) || v.startsWith(part)) {
        return meaning;
      }
    }
  }
  return '';
}

// Main
console.log('Loading data sources...');

const morpholex: Record<string, string> = JSON.parse(readFileSync('/tmp/morpholex_words.json', 'utf-8'));
const etymonline: Array<{ word: string; etymology: string; years?: number[] }> =
  JSON.parse(readFileSync('/tmp/etymonline/index.json', 'utf-8'));
const roots: RootData[] = JSON.parse(readFileSync('data/roots-affixes/roots.json', 'utf-8'));
const affixes: AffixData[] = JSON.parse(readFileSync('data/roots-affixes/affixes.json', 'utf-8'));

// Build lookup maps
const rootsMap = new Map<string, string>();
for (const r of roots) {
  for (const variant of r.root.split('/')) {
    rootsMap.set(variant.toLowerCase(), r.meaningCn);
  }
}

const prefixMap = new Map<string, string>();
const suffixMap = new Map<string, string>();
for (const a of affixes) {
  const clean = a.affix.replace(/-/g, '').toLowerCase();
  const variants = clean.split('/');
  for (const v of variants) {
    if (a.type === 'prefix') prefixMap.set(v, a.meaningCn);
    else suffixMap.set(v, a.meaningCn);
  }
}

const etymMap = new Map<string, { origin: string; etymology: string; years?: number[] }>();
for (const e of etymonline) {
  etymMap.set(e.word.toLowerCase(), { origin: e.word, etymology: e.etymology, years: e.years });
}

console.log(`MorphoLex: ${Object.keys(morpholex).length} words`);
console.log(`Etymonline: ${etymMap.size} words`);
console.log(`Roots map: ${rootsMap.size} entries`);
console.log(`Prefix map: ${prefixMap.size}, Suffix map: ${suffixMap.size}`);

// Process each word bank
const bankFiles = readdirSync('data/word-banks').filter(f => f.endsWith('.json') && f !== 'stats.json');
let totalMorphAdded = 0;
let totalEtymAdded = 0;

for (const file of bankFiles) {
  const path = `data/word-banks/${file}`;
  const entries: WordEntry[] = JSON.parse(readFileSync(path, 'utf-8'));
  let morphAdded = 0;
  let etymAdded = 0;

  for (const entry of entries) {
    const word = entry.word.toLowerCase();

    // Add morphology from MorphoLex if not already present
    if (!entry.morphology) {
      const segm = morpholex[word];
      if (segm) {
        const parts = parseMorphoLex(segm);
        const prefixes = parts.filter(p => p.type === 'prefix');
        const rootParts = parts.filter(p => p.type === 'root');
        const suffixes = parts.filter(p => p.type === 'suffix');

        if (rootParts.length > 0 && (prefixes.length > 0 || suffixes.length > 0)) {
          const rootMeaning = findMeaning(rootParts[0].part, 'root', rootsMap, prefixMap, suffixMap) || rootParts[0].part;
          const prefixEntries = prefixes
            .map(p => ({ part: p.part, meaning: findMeaning(p.part, 'prefix', rootsMap, prefixMap, suffixMap) || p.part }));
          const suffixEntries = suffixes
            .map(s => ({ part: s.part, meaning: findMeaning(s.part, 'suffix', rootsMap, prefixMap, suffixMap) || s.part }));

          const mnemonic = [
            ...prefixEntries.map(p => p.meaning),
            rootMeaning,
            ...suffixEntries.map(s => s.meaning),
          ].join(' + ');

          entry.morphology = {
            prefix: prefixEntries.length > 0 ? prefixEntries : undefined,
            root: { part: rootParts[0].part, meaning: rootMeaning },
            suffix: suffixEntries.length > 0 ? suffixEntries : undefined,
            mnemonic,
          };
          morphAdded++;
        }
      }
    }

    // Add etymology from Etymonline if not already present
    if (!entry.etymology) {
      const etym = etymMap.get(word);
      if (etym && etym.etymology.length > 10) {
        // Extract origin language (look for "from X" pattern)
        const langMatch = etym.etymology.match(/from (\w+)\b/i);
        const origin = langMatch ? langMatch[1] : '';
        // Keep full first sentence, no truncation
        const firstSentence = etym.etymology.split(/\.\s/)[0] + '.';

        entry.etymology = {
          origin: origin || '',
          originalMeaning: '',
          story: firstSentence,
          entryPeriod: etym.years && etym.years[0] ? `~${etym.years[0]}` : undefined,
        };
        etymAdded++;
      }
    }
  }

  writeFileSync(path, JSON.stringify(entries, null, 2) + '\n');
  console.log(`✓  ${file}: +${morphAdded} morphology, +${etymAdded} etymology`);
  totalMorphAdded += morphAdded;
  totalEtymAdded += etymAdded;
}

console.log(`\nTotal: +${totalMorphAdded} morphology, +${totalEtymAdded} etymology across all banks`);
console.log('Run `bun run build` to update dist/');
