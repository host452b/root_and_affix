/**
 * Full word bank quality audit — Phase 2.
 *
 * Scans ALL banks for issues across 8 dimensions:
 * 1. Structural: empty fields, bad POS, malformed data
 * 2. Single-char Chinese mappings (over-match risk)
 * 3. ASCII/garbage in Chinese mappings
 * 4. Dictionary fragment mappings (not natural Chinese expressions)
 * 5. Cross-bank collisions (same Chinese → too many English words)
 * 6. Too-basic words (users already know these)
 * 7. POS mismatch (noun definition but verb POS tag)
 * 8. Overly long/explanatory Chinese mappings
 *
 * Outputs:
 * - Per-bank issue reports to docs/lexicon-audit/
 * - Auto-fixes for clear-cut issues
 * - Summary statistics
 *
 * Usage: bun scripts/full-audit.ts [--fix]
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';

const FIX_MODE = process.argv.includes('--fix');

interface ChineseMapping { chinese: string; partOfSpeech: string; contextHint?: string; }
interface WordEntry {
  id: string; word: string; phonetic: string;
  meanings: Array<{ partOfSpeech: string; definition: string; definitionCn: string }>;
  difficulty: string[]; chineseMappings: ChineseMapping[];
  morphology?: any; etymology?: any;
}

interface Issue {
  word: string; field: string; severity: 'critical' | 'warning' | 'info';
  description: string; action: 'remove_mapping' | 'remove_entry' | 'flag' | 'none';
  mapping?: string;
}

// --- Rules ---

const TOO_BASIC = new Set([
  'get', 'go', 'come', 'let', 'set', 'put', 'run', 'see', 'give', 'take',
  'make', 'do', 'say', 'tell', 'keep', 'hold', 'turn', 'look', 'show',
  'call', 'find', 'ask', 'try', 'use', 'move', 'play', 'work', 'pay',
  'have', 'has', 'had', 'been', 'was', 'were', 'are', 'the', 'and',
]);

// Chinese terms that are too common/ambiguous to be useful triggers
const OVERLY_COMMON_CN = new Set([
  '的', '了', '在', '是', '有', '和', '个', '上', '下', '中',
  '大', '小', '多', '少', '好', '不', '人', '国', '年', '说',
]);

// Dictionary fragment patterns (look like glosses, not natural expressions)
const DICT_FRAGMENT_RE = /^(使|令|被|把|将|让).{1,3}$/;
const EXPLANATORY_RE = /^.{7,}$/; // Mappings > 6 chars are suspect

function auditEntry(entry: WordEntry, bankId: string): Issue[] {
  const issues: Issue[] = [];

  // 1. Structural
  if (!entry.word || !entry.id) {
    issues.push({ word: entry.word || '?', field: 'structure', severity: 'critical', description: 'Missing word or id', action: 'remove_entry' });
  }
  if (!entry.chineseMappings || entry.chineseMappings.length === 0) {
    issues.push({ word: entry.word, field: 'chineseMappings', severity: 'critical', description: 'No Chinese mappings', action: 'remove_entry' });
  }

  // 2. Single-char
  for (const m of entry.chineseMappings || []) {
    if (m.chinese.length === 1) {
      issues.push({ word: entry.word, field: 'chineseMappings', severity: 'critical', description: `Single-char "${m.chinese}" over-matches`, action: 'remove_mapping', mapping: m.chinese });
    }
  }

  // 3. ASCII garbage
  for (const m of entry.chineseMappings || []) {
    if (/^[\x00-\x7F]+$/.test(m.chinese)) {
      issues.push({ word: entry.word, field: 'chineseMappings', severity: 'critical', description: `ASCII mapping "${m.chinese}"`, action: 'remove_mapping', mapping: m.chinese });
    }
  }

  // 4. Dictionary fragments
  for (const m of entry.chineseMappings || []) {
    if (DICT_FRAGMENT_RE.test(m.chinese)) {
      issues.push({ word: entry.word, field: 'chineseMappings', severity: 'warning', description: `Fragment "${m.chinese}" (使…/令…/被… pattern)`, action: 'remove_mapping', mapping: m.chinese });
    }
    if (m.chinese.length > 6) {
      issues.push({ word: entry.word, field: 'chineseMappings', severity: 'warning', description: `Too long "${m.chinese}" (${m.chinese.length} chars)`, action: 'remove_mapping', mapping: m.chinese });
    }
  }

  // 5. Overly common Chinese
  for (const m of entry.chineseMappings || []) {
    if (OVERLY_COMMON_CN.has(m.chinese)) {
      issues.push({ word: entry.word, field: 'chineseMappings', severity: 'critical', description: `Overly common "${m.chinese}"`, action: 'remove_mapping', mapping: m.chinese });
    }
  }

  // 6. Too basic English
  if (TOO_BASIC.has(entry.word.toLowerCase())) {
    issues.push({ word: entry.word, field: 'word', severity: 'warning', description: 'Too basic for learning', action: 'remove_entry' });
  }

  // 7. POS mismatch
  if (entry.meanings.length > 0 && entry.chineseMappings.length > 0) {
    const defPos = entry.meanings[0].partOfSpeech?.toLowerCase() ?? '';
    const defCn = entry.meanings[0].definitionCn ?? '';
    // Check if definition says noun but Chinese mapping is a verb phrase
    if (defPos.startsWith('n') && /^(使|让|令|把|被|去|来)/.test(defCn)) {
      issues.push({ word: entry.word, field: 'meanings', severity: 'info', description: `POS "${defPos}" but definition starts with verb-like Chinese`, action: 'flag' });
    }
  }

  // 8. Punctuation in mappings
  for (const m of entry.chineseMappings || []) {
    if (/[""''（）()【】\[\]、，。；：！？…～~]/.test(m.chinese)) {
      issues.push({ word: entry.word, field: 'chineseMappings', severity: 'warning', description: `Punctuation in "${m.chinese}"`, action: 'remove_mapping', mapping: m.chinese });
    }
  }

  return issues;
}

// --- Cross-bank collision analysis ---
function buildCollisionMap(allBanks: Record<string, WordEntry[]>): Map<string, Array<{ word: string; bank: string }>> {
  const map = new Map<string, Array<{ word: string; bank: string }>>();
  for (const [bankId, entries] of Object.entries(allBanks)) {
    for (const entry of entries) {
      for (const m of entry.chineseMappings) {
        if (!map.has(m.chinese)) map.set(m.chinese, []);
        map.get(m.chinese)!.push({ word: entry.word, bank: bankId });
      }
    }
  }
  return map;
}

// --- Main ---
mkdirSync('docs/lexicon-audit', { recursive: true });

const BANKS = readdirSync('data/word-banks')
  .filter(f => f.endsWith('.json') && f !== 'stats.json')
  .map(f => f.replace('.json', ''));

// Load all banks
const allBanks: Record<string, WordEntry[]> = {};
for (const bankId of BANKS) {
  allBanks[bankId] = JSON.parse(readFileSync(`data/word-banks/${bankId}.json`, 'utf-8'));
}

// Build collision map
const collisions = buildCollisionMap(allBanks);
const highCollisions = [...collisions.entries()]
  .filter(([_, entries]) => new Set(entries.map(e => e.word)).size >= 5)
  .sort((a, b) => b[1].length - a[1].length);

console.log(`Cross-bank: ${highCollisions.length} Chinese terms map to 5+ English words\n`);

// Audit each bank
let totalIssues = 0;
let totalFixed = 0;
const summaryLines: string[] = [];

for (const bankId of BANKS) {
  const entries = allBanks[bankId];
  const issues: Issue[] = [];

  for (const entry of entries) {
    issues.push(...auditEntry(entry, bankId));
  }

  // Count by severity
  const critical = issues.filter(i => i.severity === 'critical').length;
  const warning = issues.filter(i => i.severity === 'warning').length;
  const info = issues.filter(i => i.severity === 'info').length;
  totalIssues += issues.length;

  const line = `${bankId}: ${entries.length} words | ${critical} critical, ${warning} warning, ${info} info`;
  console.log(line);
  summaryLines.push(line);

  // Auto-fix if --fix flag
  if (FIX_MODE && issues.length > 0) {
    const toRemoveEntries = new Set(issues.filter(i => i.action === 'remove_entry').map(i => i.word));
    const toRemoveMappings = new Map<string, Set<string>>();
    for (const issue of issues) {
      if (issue.action === 'remove_mapping' && issue.mapping) {
        if (!toRemoveMappings.has(issue.word)) toRemoveMappings.set(issue.word, new Set());
        toRemoveMappings.get(issue.word)!.add(issue.mapping);
      }
    }

    let fixed = 0;
    const cleaned: WordEntry[] = [];
    for (const entry of entries) {
      if (toRemoveEntries.has(entry.word)) { fixed++; continue; }
      const badMappings = toRemoveMappings.get(entry.word);
      if (badMappings) {
        entry.chineseMappings = entry.chineseMappings.filter(m => !badMappings.has(m.chinese));
        fixed += badMappings.size;
      }
      if (entry.chineseMappings.length > 0) {
        cleaned.push(entry);
      } else {
        fixed++; // dropped entry with no remaining mappings
      }
    }

    writeFileSync(`data/word-banks/${bankId}.json`, JSON.stringify(cleaned, null, 2) + '\n');
    console.log(`  → fixed ${fixed} issues, ${cleaned.length} entries remain`);
    totalFixed += fixed;
  }

  // Write audit report
  const reportPath = `docs/lexicon-audit/${bankId}-r1.md`;
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const warningIssues = issues.filter(i => i.severity === 'warning');

  const report = `# ${bankId} — Round 1 Audit

**Date:** ${new Date().toISOString().slice(0, 10)}
**Entries:** ${entries.length}
**Issues:** ${critical} critical, ${warning} warning, ${info} info
${FIX_MODE ? `**Fixed:** ${issues.filter(i => i.action !== 'flag' && i.action !== 'none').length} auto-fixed` : '**Mode:** Report only (run with --fix to auto-fix)'}

## Critical Issues
${criticalIssues.length === 0 ? 'None.\n' : criticalIssues.slice(0, 50).map(i => `- \`${i.word}\`: ${i.description}`).join('\n') + (criticalIssues.length > 50 ? `\n- ... +${criticalIssues.length - 50} more` : '')}

## Warnings
${warningIssues.length === 0 ? 'None.\n' : warningIssues.slice(0, 30).map(i => `- \`${i.word}\`: ${i.description}`).join('\n') + (warningIssues.length > 30 ? `\n- ... +${warningIssues.length - 30} more` : '')}
`;
  writeFileSync(reportPath, report);
}

// Cross-bank collision report
const collisionReport = `# Cross-Bank Collision Report

**Date:** ${new Date().toISOString().slice(0, 10)}
**Chinese terms mapping to 5+ English words:** ${highCollisions.length}

## Top 30 Most Ambiguous

${highCollisions.slice(0, 30).map(([cn, entries]) => {
  const unique = [...new Set(entries.map(e => e.word))];
  return `### ${cn} → ${unique.length} English words
${unique.map(w => `- ${w} (${entries.filter(e => e.word === w).map(e => e.bank).join(', ')})`).join('\n')}
`;
}).join('\n')}
`;
writeFileSync('docs/lexicon-audit/cross-bank-collisions.md', collisionReport);

console.log(`\n=== Summary ===`);
console.log(`Total issues: ${totalIssues}`);
if (FIX_MODE) console.log(`Total fixed: ${totalFixed}`);
console.log(`Cross-bank collisions (5+): ${highCollisions.length}`);
console.log(`Reports: docs/lexicon-audit/*.md`);
