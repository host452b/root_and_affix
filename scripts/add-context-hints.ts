/**
 * Phase C: Add contextHint to high-frequency polysemous Chinese mappings.
 *
 * For Chinese words that map to 3+ English words, add a contextHint
 * field to each mapping indicating when this particular English word
 * is the right translation.
 *
 * Usage: bun scripts/add-context-hints.ts
 */

import { readFileSync, writeFileSync } from 'fs';

interface ChineseMapping {
  chinese: string;
  partOfSpeech: string;
  contextHint?: string;
}

interface WordEntry {
  id: string;
  word: string;
  meanings: Array<{ partOfSpeech: string; definition: string; definitionCn: string }>;
  chineseMappings: ChineseMapping[];
  [key: string]: any;
}

// Context hints for the most ambiguous Chinese → English mappings
// Format: english_word → { chinese: contextHint }
const HINTS: Record<string, Record<string, string>> = {
  // 开始 → multiple words
  'inaugurate': { '开始': '正式开创/就职' },
  'embark': { '开始': '着手/登船' },
  'initiate': { '开始': '发起/创始' },
  'onset': { '开始': '(疾病/坏事)发作' },
  'outset': { '开始': '最初/起始' },
  'commence': { '开始': '正式开始' },
  'threshold': { '开始': '门槛/起点' },

  // 巨大的 → multiple words
  'massive': { '巨大的': '体积/规模巨大' },
  'tremendous': { '巨大的': '极大的/了不起的' },
  'colossal': { '巨大的': '巨像般的/庞大' },
  'enormous': { '巨大的': '数量/体积极大' },
  'immense': { '巨大的': '无限的/广大' },
  'mighty': { '巨大的': '强大的/有力的' },
  'profound': { '巨大的': '深远的/深刻的' },

  // 阻止/阻碍 → multiple words
  'deter': { '阻止': '威慑使不敢做' },
  'inhibit': { '阻止': '抑制/约束', '阻碍': '抑制生长/发展' },
  'prevent': { '阻止': '预防/使不发生' },
  'hinder': { '阻碍': '妨碍进展' },
  'impede': { '阻碍': '阻碍前进' },
  'obstruct': { '阻碍': '堵塞/挡路', '妨碍': '阻挠' },
  'thwart': { '阻碍': '挫败/使落空' },

  // 减轻 → multiple words
  'mitigate': { '减轻': '缓和(严重性)' },
  'alleviate': { '减轻': '减轻(痛苦/负担)' },
  'relieve': { '减轻': '解除/缓解' },
  'ease': { '减轻': '使舒适/放松' },
  'lessen': { '减轻': '使变少/变小' },
  'soothe': { '减轻': '安抚/镇定' },

  // 管理 → multiple words
  'administer': { '管理': '行政管理' },
  'supervise': { '管理': '监督/指导' },
  'regulate': { '管理': '调节/规范' },
  'govern': { '管理': '统治/治理' },
  'conduct': { '管理': '经营/引导' },

  // 证明 → multiple words
  'testify': { '证明': '作证/证实' },
  'certify': { '证明': '颁发证书' },
  'substantiate': { '证明': '用事实证实' },
  'authenticate': { '证明': '鉴定真伪' },
  'verify': { '证明': '核实/查证' },
  'demonstrate': { '证明': '论证/示范' },

  // 支持 → multiple words
  'advocate': { '支持': '拥护/倡导' },
  'bolster': { '支持': '加强/支撑' },
  'sustain': { '支持': '持续支撑' },
  'uphold': { '支持': '维护(法律/原则)' },
  'endorse': { '支持': '公开赞同/代言' },

  // 破坏 → multiple words
  'sabotage': { '破坏': '蓄意破坏' },
  'demolish': { '破坏': '拆毁建筑' },
  'devastate': { '破坏': '毁灭性打击' },
  'undermine': { '破坏': '暗中削弱' },
  'wreck': { '破坏': '使遭毁灭' },

  // 理解 → multiple words
  'comprehend': { '理解': '全面理解' },
  'perceive': { '理解': '察觉/感知' },
  'grasp': { '理解': '领悟/抓住要点' },
  'apprehend': { '理解': '领会/逮捕' },
  'interpret': { '理解': '解释/口译' },
  'fathom': { '理解': '彻底理解/探测' },

  // 明显的 → multiple words
  'obvious': { '明显的': '显而易见的' },
  'conspicuous': { '明显的': '引人注目的' },
  'manifest': { '明显的': '明白无误的' },
  'overt': { '明显的': '公开的/不隐藏' },
  'patent': { '明显的': '明摆着的' },
  'palpable': { '明显的': '可感知的/明显' },
  'salient': { '显著的': '突出的/最重要的' },

  // 激励 → multiple words
  'inspire': { '激励': '鼓舞/启发' },
  'motivate': { '激励': '激发动机' },
  'encourage': { '激励': '鼓励/促进' },
  'stimulate': { '刺激': '刺激/促进', '激励': '激发兴趣' },
  'incite': { '激励': '煽动/激起' },

  // 放弃 → multiple words
  'abandon': { '放弃': '完全抛弃' },
  'surrender': { '放弃': '投降/交出' },
  'forsake': { '放弃': '遗弃/背弃' },
  'resign': { '放弃': '辞职/顺从' },
  'relinquish': { '放弃': '不情愿地放弃' },
  'renounce': { '放弃': '正式宣布放弃' },

  // 严厉的 → multiple words
  'harsh': { '严厉的': '刻薄的/恶劣的' },
  'stern': { '严厉的': '严肃不苟言笑' },
  'rigorous': { '严厉的': '严格精确的' },
  'austere': { '严厉的': '朴素严格的' },
  'stringent': { '严厉的': '(法规)严格的' },
  'severe': { '严厉的': '严峻的/剧烈的' },
};

const BANKS = ['ielts', 'toefl', 'gre', 'business', 'academic'];
let totalHintsAdded = 0;

for (const bankName of BANKS) {
  const path = `data/word-banks/${bankName}.json`;
  const entries: WordEntry[] = JSON.parse(readFileSync(path, 'utf-8'));
  let hintsAdded = 0;

  for (const entry of entries) {
    const wordHints = HINTS[entry.word];
    if (!wordHints) continue;

    for (const mapping of entry.chineseMappings) {
      const hint = wordHints[mapping.chinese];
      if (hint && !mapping.contextHint) {
        mapping.contextHint = hint;
        hintsAdded++;
      }
    }
  }

  writeFileSync(path, JSON.stringify(entries, null, 2) + '\n');
  console.log(`${bankName}: +${hintsAdded} context hints`);
  totalHintsAdded += hintsAdded;
}

console.log(`\nTotal: +${totalHintsAdded} context hints added`);
