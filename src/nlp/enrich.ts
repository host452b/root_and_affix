import type { WordEntry, Morphology } from '../core/types.js';

interface EtymologyData {
  wordId: string;
  origin: string;
  originalMeaning: string;
  story: string;
  entryPeriod?: string;
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

export type { EtymologyData, RootData, AffixData };

// Common English compound words with their decomposition and Chinese meanings
const COMPOUNDS: Record<string, { parts: Array<{ part: string; meaning: string }>; mnemonic: string }> = {
  'welfare': { parts: [{ part: 'well', meaning: '好' }, { part: 'fare', meaning: '生活/过活' }], mnemonic: '好 + 生活 → 福利' },
  'widespread': { parts: [{ part: 'wide', meaning: '广' }, { part: 'spread', meaning: '传播' }], mnemonic: '广 + 传播 → 广泛的' },
  'understand': { parts: [{ part: 'under', meaning: '在…之中' }, { part: 'stand', meaning: '站' }], mnemonic: '站在其中 → 理解' },
  'withstand': { parts: [{ part: 'with', meaning: '对抗' }, { part: 'stand', meaning: '站' }], mnemonic: '对抗而立 → 抵抗' },
  'withdraw': { parts: [{ part: 'with', meaning: '向回' }, { part: 'draw', meaning: '拉' }], mnemonic: '向回拉 → 撤回' },
  'withhold': { parts: [{ part: 'with', meaning: '向回' }, { part: 'hold', meaning: '持有' }], mnemonic: '持住不放 → 扣留' },
  'overcome': { parts: [{ part: 'over', meaning: '越过' }, { part: 'come', meaning: '来' }], mnemonic: '越过而来 → 克服' },
  'outcome': { parts: [{ part: 'out', meaning: '出' }, { part: 'come', meaning: '来' }], mnemonic: '出来的 → 结果' },
  'outline': { parts: [{ part: 'out', meaning: '外' }, { part: 'line', meaning: '线' }], mnemonic: '外部线条 → 轮廓' },
  'outweigh': { parts: [{ part: 'out', meaning: '超过' }, { part: 'weigh', meaning: '重量' }], mnemonic: '超过重量 → 比…重要' },
  'outlook': { parts: [{ part: 'out', meaning: '向外' }, { part: 'look', meaning: '看' }], mnemonic: '向外看 → 前景/展望' },
  'output': { parts: [{ part: 'out', meaning: '出' }, { part: 'put', meaning: '放' }], mnemonic: '放出 → 产出' },
  'outstanding': { parts: [{ part: 'out', meaning: '突出' }, { part: 'standing', meaning: '站立' }], mnemonic: '站出来的 → 杰出的' },
  'outskirts': { parts: [{ part: 'out', meaning: '外' }, { part: 'skirts', meaning: '边缘' }], mnemonic: '外边缘 → 郊区' },
  'outspoken': { parts: [{ part: 'out', meaning: '外' }, { part: 'spoken', meaning: '说' }], mnemonic: '说出来的 → 直言不讳的' },
  'overlook': { parts: [{ part: 'over', meaning: '越过' }, { part: 'look', meaning: '看' }], mnemonic: '看过去/看漏 → 忽略' },
  'overthrow': { parts: [{ part: 'over', meaning: '翻转' }, { part: 'throw', meaning: '扔' }], mnemonic: '翻转扔掉 → 推翻' },
  'overwhelm': { parts: [{ part: 'over', meaning: '完全' }, { part: 'whelm', meaning: '淹没' }], mnemonic: '完全淹没 → 压倒' },
  'overnight': { parts: [{ part: 'over', meaning: '经过' }, { part: 'night', meaning: '夜' }], mnemonic: '经过一夜 → 一夜之间' },
  'overseas': { parts: [{ part: 'over', meaning: '越过' }, { part: 'seas', meaning: '海' }], mnemonic: '越过海 → 海外的' },
  'undertake': { parts: [{ part: 'under', meaning: '承担' }, { part: 'take', meaning: '拿' }], mnemonic: '承担起来 → 从事' },
  'undermine': { parts: [{ part: 'under', meaning: '在…下' }, { part: 'mine', meaning: '挖' }], mnemonic: '在下面挖 → 暗中破坏' },
  'undergo': { parts: [{ part: 'under', meaning: '经受' }, { part: 'go', meaning: '经过' }], mnemonic: '经受过去 → 经历' },
  'uphold': { parts: [{ part: 'up', meaning: '向上' }, { part: 'hold', meaning: '举' }], mnemonic: '向上举 → 维护/支持' },
  'uprising': { parts: [{ part: 'up', meaning: '向上' }, { part: 'rising', meaning: '升起' }], mnemonic: '向上升起 → 起义' },
  'uproar': { parts: [{ part: 'up', meaning: '起来' }, { part: 'roar', meaning: '吼' }], mnemonic: '吼起来 → 骚动' },
  'upbringing': { parts: [{ part: 'up', meaning: '向上' }, { part: 'bringing', meaning: '带' }], mnemonic: '向上带大 → 养育' },
  'downfall': { parts: [{ part: 'down', meaning: '向下' }, { part: 'fall', meaning: '落' }], mnemonic: '向下落 → 衰落' },
  'downturn': { parts: [{ part: 'down', meaning: '向下' }, { part: 'turn', meaning: '转' }], mnemonic: '向下转 → 衰退' },
  'breakdown': { parts: [{ part: 'break', meaning: '破' }, { part: 'down', meaning: '下' }], mnemonic: '破掉 → 崩溃/故障' },
  'breakthrough': { parts: [{ part: 'break', meaning: '突破' }, { part: 'through', meaning: '穿过' }], mnemonic: '破穿 → 突破' },
  'drawback': { parts: [{ part: 'draw', meaning: '拉' }, { part: 'back', meaning: '回' }], mnemonic: '拉回来 → 缺点' },
  'feedback': { parts: [{ part: 'feed', meaning: '喂/传递' }, { part: 'back', meaning: '回' }], mnemonic: '传递回来 → 反馈' },
  'setback': { parts: [{ part: 'set', meaning: '设置' }, { part: 'back', meaning: '回' }], mnemonic: '往回设 → 挫折' },
  'backdrop': { parts: [{ part: 'back', meaning: '后' }, { part: 'drop', meaning: '落/幕' }], mnemonic: '后面的幕 → 背景' },
  'backbone': { parts: [{ part: 'back', meaning: '背' }, { part: 'bone', meaning: '骨' }], mnemonic: '背部的骨 → 脊梁/支柱' },
  'background': { parts: [{ part: 'back', meaning: '后' }, { part: 'ground', meaning: '地' }], mnemonic: '后面的地 → 背景' },
  'handbook': { parts: [{ part: 'hand', meaning: '手' }, { part: 'book', meaning: '书' }], mnemonic: '手边的书 → 手册' },
  'handout': { parts: [{ part: 'hand', meaning: '手' }, { part: 'out', meaning: '出' }], mnemonic: '递出去的 → 讲义/施舍' },
  'headline': { parts: [{ part: 'head', meaning: '头' }, { part: 'line', meaning: '行' }], mnemonic: '头行 → 标题' },
  'headquarters': { parts: [{ part: 'head', meaning: '头/首' }, { part: 'quarters', meaning: '住所' }], mnemonic: '首脑住所 → 总部' },
  'household': { parts: [{ part: 'house', meaning: '房屋' }, { part: 'hold', meaning: '持有' }], mnemonic: '持有房屋 → 家庭' },
  'framework': { parts: [{ part: 'frame', meaning: '框架' }, { part: 'work', meaning: '工作' }], mnemonic: '框架工作 → 框架体系' },
  'network': { parts: [{ part: 'net', meaning: '网' }, { part: 'work', meaning: '工作' }], mnemonic: '网状工作 → 网络' },
  'teamwork': { parts: [{ part: 'team', meaning: '团队' }, { part: 'work', meaning: '工作' }], mnemonic: '团队工作 → 合作' },
  'homework': { parts: [{ part: 'home', meaning: '家' }, { part: 'work', meaning: '工作' }], mnemonic: '家里的工作 → 作业' },
  'workshop': { parts: [{ part: 'work', meaning: '工作' }, { part: 'shop', meaning: '店' }], mnemonic: '工作的店 → 工坊/研讨会' },
  'landscape': { parts: [{ part: 'land', meaning: '土地' }, { part: 'scape', meaning: '景色' }], mnemonic: '土地景色 → 风景' },
  'landmark': { parts: [{ part: 'land', meaning: '土地' }, { part: 'mark', meaning: '标记' }], mnemonic: '土地上的标记 → 地标' },
  'landlord': { parts: [{ part: 'land', meaning: '土地' }, { part: 'lord', meaning: '主人' }], mnemonic: '土地的主人 → 房东' },
  'mainstream': { parts: [{ part: 'main', meaning: '主要' }, { part: 'stream', meaning: '流' }], mnemonic: '主要的流 → 主流' },
  'meanwhile': { parts: [{ part: 'mean', meaning: '中间' }, { part: 'while', meaning: '时间' }], mnemonic: '中间的时间 → 同时' },
  'nonetheless': { parts: [{ part: 'none', meaning: '无' }, { part: 'the', meaning: '那' }, { part: 'less', meaning: '更少' }], mnemonic: '即便如此 → 尽管如此' },
  'furthermore': { parts: [{ part: 'further', meaning: '更远' }, { part: 'more', meaning: '更多' }], mnemonic: '更远更多 → 此外' },
  'moreover': { parts: [{ part: 'more', meaning: '更多' }, { part: 'over', meaning: '之上' }], mnemonic: '更多之上 → 而且' },
  'therefore': { parts: [{ part: 'there', meaning: '那里' }, { part: 'fore', meaning: '在前' }], mnemonic: '因此在前 → 因此' },
  'thereafter': { parts: [{ part: 'there', meaning: '那' }, { part: 'after', meaning: '之后' }], mnemonic: '在那之后 → 此后' },
  'whereas': { parts: [{ part: 'where', meaning: '何处' }, { part: 'as', meaning: '如同' }], mnemonic: '在何种情况下 → 然而/鉴于' },
  'whoever': { parts: [{ part: 'who', meaning: '谁' }, { part: 'ever', meaning: '任何' }], mnemonic: '任何谁 → 无论谁' },
  'whatever': { parts: [{ part: 'what', meaning: '什么' }, { part: 'ever', meaning: '任何' }], mnemonic: '任何什么 → 无论什么' },
  'whenever': { parts: [{ part: 'when', meaning: '何时' }, { part: 'ever', meaning: '任何' }], mnemonic: '任何时候 → 无论何时' },
  'wherever': { parts: [{ part: 'where', meaning: '何处' }, { part: 'ever', meaning: '任何' }], mnemonic: '任何地方 → 无论哪里' },
  'however': { parts: [{ part: 'how', meaning: '如何' }, { part: 'ever', meaning: '任何' }], mnemonic: '无论如何 → 然而' },
  'altogether': { parts: [{ part: 'all', meaning: '全部' }, { part: 'together', meaning: '一起' }], mnemonic: '全部一起 → 完全' },
  'straightforward': { parts: [{ part: 'straight', meaning: '直' }, { part: 'forward', meaning: '向前' }], mnemonic: '直直向前 → 简单直接的' },
  'counterpart': { parts: [{ part: 'counter', meaning: '对应' }, { part: 'part', meaning: '部分' }], mnemonic: '对应的部分 → 对等的人/物' },
  'counteract': { parts: [{ part: 'counter', meaning: '反' }, { part: 'act', meaning: '行动' }], mnemonic: '反向行动 → 抵消' },
  'countryside': { parts: [{ part: 'country', meaning: '乡村' }, { part: 'side', meaning: '侧' }], mnemonic: '乡村那边 → 农村' },
  'lifestyle': { parts: [{ part: 'life', meaning: '生活' }, { part: 'style', meaning: '方式' }], mnemonic: '生活方式' },
  'lifetime': { parts: [{ part: 'life', meaning: '生命' }, { part: 'time', meaning: '时间' }], mnemonic: '生命时间 → 一生' },
  'livelihood': { parts: [{ part: 'live', meaning: '生活' }, { part: 'lihood', meaning: '状态' }], mnemonic: '生活的状态 → 生计' },
  'forthcoming': { parts: [{ part: 'forth', meaning: '向前' }, { part: 'coming', meaning: '来' }], mnemonic: '即将来的 → 即将到来的' },
  'shortcoming': { parts: [{ part: 'short', meaning: '短/缺' }, { part: 'coming', meaning: '到来' }], mnemonic: '短缺之处 → 缺点' },
  'marketplace': { parts: [{ part: 'market', meaning: '市场' }, { part: 'place', meaning: '地方' }], mnemonic: '市场的地方 → 市场' },
  'workplace': { parts: [{ part: 'work', meaning: '工作' }, { part: 'place', meaning: '地方' }], mnemonic: '工作的地方 → 职场' },
  'commonplace': { parts: [{ part: 'common', meaning: '普通' }, { part: 'place', meaning: '地方' }], mnemonic: '普通的地方 → 司空见惯的' },
  'nevertheless': { parts: [{ part: 'never', meaning: '从不' }, { part: 'the', meaning: '那' }, { part: 'less', meaning: '更少' }], mnemonic: '不比那更少 → 尽管如此' },
  'notwithstanding': { parts: [{ part: 'not', meaning: '不' }, { part: 'with', meaning: '与' }, { part: 'standing', meaning: '站立' }], mnemonic: '不因而动摇 → 尽管' },
};

/**
 * Auto-analyze word morphology using roots and affixes databases.
 * Also handles compound word decomposition.
 * Returns null if no meaningful decomposition is found.
 */
function analyzeMorphology(
  word: string,
  rootsData: RootData[],
  affixesData: AffixData[],
): Morphology | null {
  const lower = word.toLowerCase();
  if (lower.length < 5) return null; // Too short to decompose

  // Check compound words first
  const compound = COMPOUNDS[lower];
  if (compound) {
    return {
      root: compound.parts[0],
      suffix: compound.parts.length > 1 ? compound.parts.slice(1) : undefined,
      mnemonic: compound.mnemonic,
    };
  }

  const prefixes = affixesData.filter(a => a.type === 'prefix');
  const suffixes = affixesData.filter(a => a.type === 'suffix');

  // Try to find a root that matches
  let bestRoot: { data: RootData; start: number; end: number } | null = null;

  for (const root of rootsData) {
    // Check if this root's examples include our word
    if (root.examples.some(ex => ex.toLowerCase() === lower)) {
      // Find root position in the word
      const idx = lower.indexOf(root.root.toLowerCase());
      if (idx !== -1) {
        if (!bestRoot || root.root.length > bestRoot.data.root.length) {
          bestRoot = { data: root, start: idx, end: idx + root.root.length };
        }
      }
    }
  }

  // Also try direct substring matching for roots
  if (!bestRoot) {
    for (const root of rootsData) {
      const variants = root.root.toLowerCase().split('/');
      for (const variant of variants) {
        const idx = lower.indexOf(variant);
        if (idx !== -1 && variant.length >= 3) {
          if (!bestRoot || variant.length > bestRoot.data.root.length) {
            bestRoot = { data: root, start: idx, end: idx + variant.length };
          }
        }
      }
    }
  }

  if (!bestRoot) return null;

  const beforeRoot = lower.slice(0, bestRoot.start);
  const afterRoot = lower.slice(bestRoot.end);

  // Match prefix
  const matchedPrefixes: Array<{ part: string; meaning: string }> = [];
  if (beforeRoot.length >= 2) {
    for (const pfx of prefixes) {
      const variants = pfx.affix.replace(/-/g, '').split('/');
      for (const v of variants) {
        if (beforeRoot === v || beforeRoot.startsWith(v)) {
          matchedPrefixes.push({ part: v, meaning: pfx.meaningCn });
          break;
        }
      }
      if (matchedPrefixes.length > 0) break;
    }
  }

  // Match suffix
  const matchedSuffixes: Array<{ part: string; meaning: string }> = [];
  if (afterRoot.length >= 2) {
    for (const sfx of suffixes) {
      const variants = sfx.affix.replace(/-/g, '').split('/');
      for (const v of variants) {
        if (afterRoot === v || afterRoot.endsWith(v) || afterRoot.startsWith(v)) {
          matchedSuffixes.push({ part: v, meaning: sfx.meaningCn });
          break;
        }
      }
      if (matchedSuffixes.length > 0) break;
    }
  }

  // Need at least root + one affix for a meaningful decomposition
  if (matchedPrefixes.length === 0 && matchedSuffixes.length === 0) return null;

  const rootPart = lower.slice(bestRoot.start, bestRoot.end);

  return {
    prefix: matchedPrefixes.length > 0 ? matchedPrefixes : undefined,
    root: { part: rootPart, meaning: bestRoot.data.meaningCn },
    suffix: matchedSuffixes.length > 0 ? matchedSuffixes : undefined,
    mnemonic: buildMnemonic(matchedPrefixes, bestRoot.data, matchedSuffixes),
  };
}

function buildMnemonic(
  prefixes: Array<{ part: string; meaning: string }>,
  root: RootData,
  suffixes: Array<{ part: string; meaning: string }>,
): string {
  const parts: string[] = [];
  for (const p of prefixes) parts.push(p.meaning);
  parts.push(root.meaningCn);
  for (const s of suffixes) parts.push(s.meaning);
  return parts.join(' + ');
}

export function enrichWordBank(
  entries: WordEntry[],
  etymologyData: EtymologyData[],
  rootsData?: RootData[],
  affixesData?: AffixData[],
): WordEntry[] {
  const etymMap = new Map(etymologyData.map(e => [e.wordId, e]));

  return entries.map(entry => {
    let enriched = entry;

    // Add etymology if available
    const etym = etymMap.get(entry.id);
    if (etym && !entry.etymology) {
      enriched = {
        ...enriched,
        etymology: {
          origin: etym.origin,
          originalMeaning: etym.originalMeaning,
          story: etym.story,
          entryPeriod: etym.entryPeriod,
        },
      };
    }

    // Auto-analyze morphology if not already present
    if (!entry.morphology && rootsData && affixesData) {
      const morphology = analyzeMorphology(entry.word, rootsData, affixesData);
      if (morphology) {
        enriched = { ...enriched, morphology };
      }
    }

    return enriched;
  });
}
