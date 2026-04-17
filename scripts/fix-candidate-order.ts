/**
 * Fix candidate ordering for high-frequency Chinese words.
 *
 * The byChinese map stores candidates in word-bank insertion order.
 * When multiple entries share a Chinese mapping, the FIRST one wins
 * at runtime (pickEntry takes candidates[0] for new users).
 *
 * This script reorders word bank entries so that for known-ambiguous
 * Chinese words, the most natural/common English translation comes first.
 *
 * Usage: bun scripts/fix-candidate-order.ts
 */

import { readFileSync, writeFileSync } from 'fs';

interface WordEntry {
  id: string;
  word: string;
  [key: string]: any;
  chineseMappings: Array<{ chinese: string; partOfSpeech: string; contextHint?: string }>;
}

// For these Chinese words, specify the preferred English word (should come first in the bank)
// Format: chinese → preferred English word
const PREFERRED_ORDER: Record<string, string[]> = {
  // Most common translation should be first
  '环境': ['environment', 'setting', 'circumstance', 'condition'],
  '管理': ['management', 'manage', 'administration', 'supervise', 'regulate'],
  '表现': ['performance', 'expression', 'behavior', 'display', 'show'],
  '开始': ['begin', 'start', 'initiate', 'commence', 'embark', 'inaugurate'],
  '支持': ['support', 'advocate', 'sustain', 'uphold', 'bolster', 'endorse'],
  '理解': ['understand', 'comprehend', 'grasp', 'perceive', 'interpret'],
  '证明': ['prove', 'demonstrate', 'verify', 'certify', 'testify', 'authenticate'],
  '保护': ['protect', 'preserve', 'safeguard', 'shield', 'guard', 'conservation'],
  '放弃': ['abandon', 'give up', 'surrender', 'resign', 'forsake', 'relinquish'],
  '减轻': ['reduce', 'relieve', 'alleviate', 'mitigate', 'ease', 'lessen'],
  '阻止': ['prevent', 'stop', 'deter', 'inhibit', 'halt', 'block'],
  '阻碍': ['hinder', 'impede', 'obstruct', 'hamper', 'barrier', 'obstacle'],
  '破坏': ['destroy', 'damage', 'demolish', 'sabotage', 'devastate', 'wreck'],
  '促进': ['promote', 'facilitate', 'encourage', 'foster', 'advance', 'stimulate'],
  '控制': ['control', 'dominate', 'regulate', 'restrain', 'govern', 'rule'],
  '增加': ['increase', 'add', 'enhance', 'augment', 'raise', 'boost'],
  '激励': ['motivate', 'inspire', 'encourage', 'stimulate', 'incentive'],
  '承认': ['admit', 'acknowledge', 'recognize', 'concede', 'accept'],
  '处理': ['handle', 'process', 'deal with', 'treat', 'manage', 'tackle'],
  '超过': ['exceed', 'surpass', 'outweigh', 'outnumber', 'transcend'],
  '结合': ['combine', 'integrate', 'merge', 'unite', 'association'],
  '分配': ['allocate', 'distribute', 'assign', 'allot', 'dispense'],
  '允许': ['allow', 'permit', 'let', 'grant', 'consent', 'approve'],
  '提供': ['provide', 'offer', 'supply', 'furnish', 'render'],
  '取消': ['cancel', 'abolish', 'annul', 'revoke', 'rescind'],
  '明显的': ['obvious', 'apparent', 'evident', 'conspicuous', 'manifest'],
  '巨大的': ['huge', 'enormous', 'massive', 'tremendous', 'colossal'],
  '严厉的': ['strict', 'severe', 'harsh', 'stern', 'rigorous'],
  '有害的': ['harmful', 'detrimental', 'toxic', 'noxious', 'deleterious'],
  '基本的': ['basic', 'fundamental', 'essential', 'elementary', 'primary'],
  '显著的': ['significant', 'remarkable', 'notable', 'conspicuous', 'prominent'],
};

const BANKS = ['ielts', 'toefl', 'gre', 'business', 'academic'];
let totalReordered = 0;

for (const bankName of BANKS) {
  const path = `data/word-banks/${bankName}.json`;
  const entries: WordEntry[] = JSON.parse(readFileSync(path, 'utf-8'));

  // Build index: chinese → list of entry indices
  const chineseIndex: Record<string, number[]> = {};
  for (let i = 0; i < entries.length; i++) {
    for (const m of entries[i].chineseMappings) {
      if (!chineseIndex[m.chinese]) chineseIndex[m.chinese] = [];
      chineseIndex[m.chinese].push(i);
    }
  }

  // For each preferred-order Chinese word, reorder entries so preferred comes first
  let bankReordered = 0;
  for (const [chinese, preferredWords] of Object.entries(PREFERRED_ORDER)) {
    const indices = chineseIndex[chinese];
    if (!indices || indices.length < 2) continue;

    // Find the preferred entry and move it to the earliest position
    const preferredWord = preferredWords.find(pw =>
      indices.some(idx => entries[idx].word === pw)
    );
    if (!preferredWord) continue;

    const preferredIdx = indices.find(idx => entries[idx].word === preferredWord);
    const earliestIdx = Math.min(...indices);

    if (preferredIdx !== undefined && preferredIdx !== earliestIdx) {
      // Swap entries so preferred word comes first
      const temp = entries[earliestIdx];
      entries[earliestIdx] = entries[preferredIdx];
      entries[preferredIdx] = temp;
      bankReordered++;
    }
  }

  writeFileSync(path, JSON.stringify(entries, null, 2) + '\n');
  if (bankReordered > 0) {
    console.log(`${bankName}: reordered ${bankReordered} ambiguous mappings`);
    totalReordered += bankReordered;
  }
}

console.log(`\nTotal: ${totalReordered} high-frequency words reordered for better first-candidate selection`);
