/**
 * Import ALL morphemes from MorphoLex into roots.json and affixes.json.
 * Generates Chinese meanings by mapping from existing database + Etymonline hints.
 *
 * Usage: bun scripts/import-morpholex-full.ts
 */

import { readFileSync, writeFileSync } from 'fs';

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

// Load MorphoLex full data
const allRoots: Record<string, string[]> = JSON.parse(readFileSync('/tmp/morpholex_all_roots.json', 'utf-8'));
const allPrefixes: Record<string, string[]> = JSON.parse(readFileSync('/tmp/morpholex_all_prefixes.json', 'utf-8'));
const allSuffixes: Record<string, string[]> = JSON.parse(readFileSync('/tmp/morpholex_all_suffixes.json', 'utf-8'));

// Load existing entries to preserve hand-crafted Chinese meanings
const existingRoots: RootEntry[] = JSON.parse(readFileSync('data/roots-affixes/roots.json', 'utf-8'));
const existingAffixes: AffixEntry[] = JSON.parse(readFileSync('data/roots-affixes/affixes.json', 'utf-8'));

// Build lookup for existing meanings
const existingRootMeanings = new Map<string, { meaning: string; meaningCn: string }>();
for (const r of existingRoots) {
  for (const v of r.root.split('/')) {
    existingRootMeanings.set(v.toLowerCase(), { meaning: r.meaning, meaningCn: r.meaningCn });
  }
}

const existingPrefixMeanings = new Map<string, { meaning: string; meaningCn: string }>();
const existingSuffixMeanings = new Map<string, { meaning: string; meaningCn: string }>();
for (const a of existingAffixes) {
  const clean = a.affix.replace(/-/g, '').toLowerCase();
  for (const v of clean.split('/')) {
    if (a.type === 'prefix') existingPrefixMeanings.set(v, { meaning: a.meaning, meaningCn: a.meaningCn });
    else existingSuffixMeanings.set(v, { meaning: a.meaning, meaningCn: a.meaningCn });
  }
}

// Load Etymonline for meaning hints
const etymonline: Array<{ word: string; etymology: string }> =
  JSON.parse(readFileSync('/tmp/etymonline/index.json', 'utf-8'));
const etymMap = new Map(etymonline.map(e => [e.word.toLowerCase(), e.etymology]));

// Common Latin/Greek root meaning patterns (for auto-generation)
const COMMON_ROOT_MEANINGS: Record<string, [string, string]> = {
  // These cover roots NOT in our existing database
  'scribe': ['write', '写'],
  'spect': ['look', '看'],
  'phone': ['sound', '声音'],
  'graph': ['write', '写/记录'],
  'meter': ['measure', '测量'],
  'scope': ['see/examine', '观察'],
  'morph': ['form', '形态'],
  'phage': ['eat', '吃/噬'],
  'cide': ['kill', '杀'],
  'vore': ['eat', '吃/食'],
  'gamy': ['marriage', '婚姻'],
  'cracy': ['rule', '统治'],
  'archy': ['rule', '统治'],
  'phobia': ['fear', '恐惧'],
  'mania': ['madness', '狂热'],
  'phil': ['love', '爱'],
  'anthro': ['human', '人类'],
  'geo': ['earth', '地球'],
  'hydro': ['water', '水'],
  'pyro': ['fire', '火'],
  'thermo': ['heat', '热'],
  'chromo': ['color', '颜色'],
  'photo': ['light', '光'],
  'auto': ['self', '自我'],
  'homo': ['same', '相同'],
  'hetero': ['different', '不同'],
  'poly': ['many', '多'],
  'mono': ['one', '单一'],
  'neo': ['new', '新'],
  'pseudo': ['false', '假'],
  'proto': ['first', '最初'],
  'macro': ['large', '大'],
  'mega': ['great', '巨大'],
  'tele': ['far', '远'],
  'crypto': ['hidden', '隐藏'],
  'neuro': ['nerve', '神经'],
  'cardio': ['heart', '心脏'],
  'hemo': ['blood', '血'],
  'osteo': ['bone', '骨'],
  'derm': ['skin', '皮肤'],
  'gastro': ['stomach', '胃'],
  'hepat': ['liver', '肝'],
  'ren': ['kidney', '肾'],
  'pneum': ['lung/air', '肺/气'],
  'cephal': ['head', '头'],
  'myo': ['muscle', '肌肉'],
  'lith': ['stone', '石'],
  'xeno': ['foreign', '外来'],
  'phyto': ['plant', '植物'],
  'zoo': ['animal', '动物'],
  'agri': ['field', '田地'],
  'aqua': ['water', '水'],
  'aero': ['air', '空气'],
  'astro': ['star', '星'],
  'cosmo': ['universe', '宇宙'],
  'chrono': ['time', '时间'],
  'techno': ['skill', '技术'],
  'cycl': ['circle', '圆/循环'],
  'dynam': ['power', '力量'],
  'electr': ['electric', '电'],
  'erg': ['work', '工作/能量'],
  'kine': ['move', '运动'],
  'mechan': ['machine', '机械'],
  'opt': ['eye/see', '眼/视'],
  'phon': ['sound', '声音'],
  'radi': ['ray', '射线/放射'],
  'son': ['sound', '声音'],
  'therm': ['heat', '热'],
  'tract': ['pull', '拉'],
  'vert': ['turn', '转'],
  'vit': ['life', '生命'],
  'vor': ['eat', '吞食'],
  'bell': ['war', '战争'],
  'civ': ['citizen', '公民'],
  'junct': ['join', '连接'],
  'liqu': ['liquid', '液体'],
  'luc': ['light', '光'],
  'magn': ['great', '大'],
  'mater': ['mother', '母亲'],
  'mortal': ['death', '死亡'],
  'noct': ['night', '夜'],
  'omni': ['all', '全部'],
  'oper': ['work', '工作'],
  'pac': ['peace', '和平'],
  'pater': ['father', '父亲'],
  'plac': ['please', '取悦'],
  'prim': ['first', '第一'],
  'sacr': ['holy', '神圣'],
  'sanct': ['holy', '神圣'],
  'scend': ['climb', '攀登'],
  'sign': ['mark', '标记'],
  'simil': ['like', '相似'],
  'sol': ['sun/alone', '太阳/独自'],
  'somn': ['sleep', '睡眠'],
  'soph': ['wise', '智慧'],
  'spir': ['breathe', '呼吸'],
  'string': ['tight', '紧'],
  'tempor': ['time', '时间'],
  'terr': ['earth', '土地'],
  'urb': ['city', '城市'],
  'vac': ['empty', '空'],
  'verb': ['word', '词'],
  'via': ['way', '路'],
};

function findMeaning(morpheme: string, type: 'root' | 'prefix' | 'suffix'): [string, string] {
  const lower = morpheme.toLowerCase();

  // 1. Check existing database
  if (type === 'root' && existingRootMeanings.has(lower)) {
    const m = existingRootMeanings.get(lower)!;
    return [m.meaning, m.meaningCn];
  }
  if (type === 'prefix' && existingPrefixMeanings.has(lower)) {
    const m = existingPrefixMeanings.get(lower)!;
    return [m.meaning, m.meaningCn];
  }
  if (type === 'suffix' && existingSuffixMeanings.has(lower)) {
    const m = existingSuffixMeanings.get(lower)!;
    return [m.meaning, m.meaningCn];
  }

  // 2. Check common meanings table
  if (COMMON_ROOT_MEANINGS[lower]) return COMMON_ROOT_MEANINGS[lower];
  // Try partial match
  for (const [key, val] of Object.entries(COMMON_ROOT_MEANINGS)) {
    if (lower.startsWith(key) || key.startsWith(lower)) return val;
  }

  // 3. Try to derive from Etymonline
  const etym = etymMap.get(lower);
  if (etym) {
    // Extract meaning hint: "word" often has "from Latin X meaning Y"
    const meaningMatch = etym.match(/meaning\s+"([^"]+)"/i) ?? etym.match(/literally\s+"([^"]+)"/i);
    if (meaningMatch) {
      return [meaningMatch[1], ''];
    }
  }

  return ['', ''];
}

// Build new roots
console.log('Building roots...');
const newRoots: RootEntry[] = [];
const seenRoots = new Set<string>();

// Preserve existing roots
for (const r of existingRoots) {
  seenRoots.add(r.root.split('/')[0].toLowerCase());
  newRoots.push(r);
}

// Add new roots from MorphoLex
let rootsAdded = 0;
for (const [root, examples] of Object.entries(allRoots)) {
  if (seenRoots.has(root.toLowerCase())) continue;
  const [meaning, meaningCn] = findMeaning(root, 'root');
  if (!meaning && !meaningCn) continue; // Skip if we can't find any meaning

  seenRoots.add(root.toLowerCase());
  newRoots.push({
    root,
    meaning,
    meaningCn: meaningCn || meaning, // Fallback to English if no Chinese
    examples: examples.slice(0, 6),
  });
  rootsAdded++;
}

// Build new affixes
console.log('Building affixes...');
const newAffixes: AffixEntry[] = [];
const seenPrefixes = new Set<string>();
const seenSuffixes = new Set<string>();

// Preserve existing affixes
for (const a of existingAffixes) {
  const clean = a.affix.replace(/-/g, '').split('/')[0].toLowerCase();
  if (a.type === 'prefix') seenPrefixes.add(clean);
  else seenSuffixes.add(clean);
  newAffixes.push(a);
}

// Add new prefixes
let prefixesAdded = 0;
for (const [pfx, examples] of Object.entries(allPrefixes)) {
  if (seenPrefixes.has(pfx.toLowerCase())) continue;
  const [meaning, meaningCn] = findMeaning(pfx, 'prefix');
  if (!meaning && !meaningCn) continue;

  seenPrefixes.add(pfx.toLowerCase());
  newAffixes.push({
    type: 'prefix',
    affix: `${pfx}-`,
    meaning,
    meaningCn: meaningCn || meaning,
    examples: examples.slice(0, 4),
  });
  prefixesAdded++;
}

// Add new suffixes
let suffixesAdded = 0;
for (const [sfx, examples] of Object.entries(allSuffixes)) {
  if (seenSuffixes.has(sfx.toLowerCase())) continue;
  const [meaning, meaningCn] = findMeaning(sfx, 'suffix');
  if (!meaning && !meaningCn) continue;

  seenSuffixes.add(sfx.toLowerCase());
  newAffixes.push({
    type: 'suffix',
    affix: `-${sfx}`,
    meaning,
    meaningCn: meaningCn || meaning,
    examples: examples.slice(0, 4),
  });
  suffixesAdded++;
}

// Write output
writeFileSync('data/roots-affixes/roots.json', JSON.stringify(newRoots, null, 2) + '\n');
writeFileSync('data/roots-affixes/affixes.json', JSON.stringify(newAffixes, null, 2) + '\n');

console.log(`\nRoots: ${existingRoots.length} existing + ${rootsAdded} new = ${newRoots.length} total`);
console.log(`Affixes: ${existingAffixes.length} existing + ${prefixesAdded} prefix + ${suffixesAdded} suffix = ${newAffixes.length} total`);
console.log('\nNow re-run: bun scripts/import-morphology.ts');
