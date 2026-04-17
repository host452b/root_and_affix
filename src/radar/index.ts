import { BLACKLIST_TAGS, EXTENSION_PREFIX, SCANNER_BATCH_LIMIT } from '../core/constants.js';
import type { WordEntry } from '../core/types.js';
import type { WordBank } from '../nlp/word-bank.js';

export interface RadarMatch {
  textNode: Text;
  word: string;
  wordEntry: WordEntry;
  startOffset: number;
  endOffset: number;
}

function shouldSkipRadarNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (BLACKLIST_TAGS.has(parent.tagName)) return true;
  if (!node.textContent?.trim()) return true;
  // Skip already-annotated nodes (both invasion mode and radar mode)
  if (parent.closest(`[data-${EXTENSION_PREFIX}]`)) return true;
  if (parent.closest('[data-wg-radar]')) return true;
  return false;
}

// Common English suffix patterns for lemmatization
const SUFFIX_RULES: Array<[RegExp, string]> = [
  [/ies$/i, 'y'],     // studies → study
  [/ied$/i, 'y'],     // studied → study
  [/ves$/i, 'f'],     // halves → half
  [/ses$/i, 'se'],    // analyses → analyse
  [/zing$/i, 'ze'],   // analyzing → analyze
  [/ting$/i, 'te'],   // creating → create
  [/ning$/i, 'n'],    // running → run (doubled consonant)
  [/ing$/i, ''],      // going → go
  [/ness$/i, ''],     // awareness → aware
  [/ment$/i, ''],     // development → develop
  [/tion$/i, 'te'],   // creation → create
  [/ally$/i, 'al'],   // fundamentally → fundamental
  [/ly$/i, ''],       // quickly → quick
  [/ed$/i, ''],       // walked → walk
  [/er$/i, ''],       // bigger → big
  [/est$/i, ''],      // biggest → big
  [/es$/i, ''],       // watches → watch
  [/s$/i, ''],        // books → book
];

function lemmatize(word: string): string[] {
  const lower = word.toLowerCase();
  const candidates = [lower];
  for (const [pattern, replacement] of SUFFIX_RULES) {
    if (pattern.test(lower)) {
      const stem = lower.replace(pattern, replacement);
      if (stem.length >= 3 && stem !== lower) candidates.push(stem);
    }
  }
  return candidates;
}

export function scanEnglishWords(root: Element, bank: WordBank): RadarMatch[] {
  const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
  const matches: RadarMatch[] = [];
  const seen = new Set<string>(); // deduplicate same word on page

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Text) {
      if (shouldSkipRadarNode(node)) return NodeFilter.FILTER_REJECT;
      // Skip text inside links (same rule as Chinese mode)
      if (node.parentElement?.closest('a[href]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const text = textNode.textContent ?? '';

    for (const segment of segmenter.segment(text)) {
      if (!segment.isWordLike) continue;
      const lower = segment.segment.toLowerCase();
      if (seen.has(lower)) continue;

      // Try exact match first, then lemmatized forms
      let entry = bank.byId.get(lower);
      if (!entry) {
        for (const stem of lemmatize(lower)) {
          entry = bank.byId.get(stem);
          if (entry) break;
        }
      }
      if (!entry) continue;

      seen.add(lower);
      matches.push({
        textNode,
        word: segment.segment,
        wordEntry: entry,
        startOffset: segment.index,
        endOffset: segment.index + segment.segment.length,
      });
    }
  }

  return matches;
}
