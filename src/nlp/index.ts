import type { WordEntry, MatchMethod, UserWordState } from '../core/types.js';
import type { WordBank } from './word-bank.js';
import { CONFIDENCE_THRESHOLD } from '../core/constants.js';
import { analyzeContext, scoreMatch } from './context.js';
import { isDueForReview } from '../core/sm2.js';

export interface RawMatch {
  originalText: string;
  sentenceContext: string;
  targetWord: string;
  wordEntry: WordEntry;
  confidenceScore: number;
  matchMethod: MatchMethod;
  startOffset: number;
  endOffset: number;
}

/**
 * Pick the best entry for a Chinese word.
 * Respects curated candidate order as baseline. POS-aware verb boost only activates
 * when there's genuine noun/verb ambiguity (first candidate is noun, a verb alternative
 * exists, and next segment confirms verb context).
 * Then applies SM-2 progressive release.
 */
function pickEntry(
  candidates: WordEntry[],
  wordStates?: Record<string, UserWordState>,
  chineseWord?: string,
  nextSegment?: string | null,
): WordEntry {
  if (candidates.length === 1) return candidates[0];

  // POS-based reranking: only when there's genuine noun→verb ambiguity.
  // Conditions (all must be true):
  //   1. First candidate is a noun
  //   2. A verb candidate exists in top 3 positions
  //   3. The Chinese word is the verb candidate's PRIMARY (first) mapping —
  //      confirms it's a genuine translation, not a secondary gloss
  //      (e.g. "prepare" has 准备 as first mapping ✓, "budget" has 预算 ✗)
  //   4. Next segment exists (verb context signal)
  let reranked = candidates;
  if (nextSegment && nextSegment.length >= 2 && chineseWord) {
    const firstPos = candidates[0].chineseMappings.find(m => m.chinese === chineseWord)?.partOfSpeech
      ?? candidates[0].meanings[0]?.partOfSpeech ?? '';
    if (firstPos === 'n') {
      let verbIdx = -1;
      for (let i = 1; i < Math.min(candidates.length, 3); i++) {
        const p = candidates[i].chineseMappings.find(m => m.chinese === chineseWord)?.partOfSpeech
          ?? candidates[i].meanings[0]?.partOfSpeech ?? '';
        if (p === 'v' || p === 'vt' || p === 'vi') {
          // Guard: Chinese word must be the verb entry's first mapping
          if (candidates[i].chineseMappings[0]?.chinese === chineseWord) {
            verbIdx = i;
          }
          break;
        }
      }
      if (verbIdx > 0) {
        reranked = [candidates[verbIdx], ...candidates.filter((_, i) => i !== verbIdx)];
      }
    }
  }

  if (!wordStates) return reranked[0];

  // Progressive release: pick first unmastered candidate (in reranked order)
  for (const entry of reranked) {
    const state = wordStates[entry.id];
    if (!state || state.status !== 'mastered') {
      return entry;
    }
  }
  // All mastered — return first (curated best) for review
  return reranked[0];
}

export function findMatches(text: string, bank: WordBank, wordStates?: Record<string, UserWordState>): RawMatch[] {
  const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
  const matches: RawMatch[] = [];
  const contextAnalysis = analyzeContext(text);

  // Collect segments into array so we can peek at next segment
  const segList: Array<{ segment: string; isWordLike: boolean }> = [];
  for (const s of segmenter.segment(text)) {
    segList.push({ segment: s.segment, isWordLike: s.isWordLike ?? false });
  }

  let offset = 0;
  for (let i = 0; i < segList.length; i++) {
    const { segment, isWordLike } = segList[i];
    if (isWordLike) {
      const candidates = bank.byChinese.get(segment);
      if (candidates && candidates.length > 0) {
        // Peek at next word-like segment for POS context
        let nextSeg: string | null = null;
        for (let j = i + 1; j < segList.length; j++) {
          if (segList[j].isWordLike) { nextSeg = segList[j].segment; break; }
        }
        const entry = pickEntry(candidates, wordStates, segment, nextSeg);
        const confidenceScore = scoreMatch(segment, text, entry, contextAnalysis);
        // Skip low-confidence matches to avoid "technically correct but contextually wrong" replacements
        if (confidenceScore < CONFIDENCE_THRESHOLD) continue;
        matches.push({
          originalText: segment,
          sentenceContext: text,
          targetWord: entry.word,
          wordEntry: entry,
          confidenceScore,
          matchMethod: 'context',
          startOffset: offset,
          endOffset: offset + segment.length,
        });
      }
    }
    offset += segment.length;
  }

  return matches;
}

export function selectWords(matches: RawMatch[], maxWords: number, wordStates?: Record<string, UserWordState>): RawMatch[] {
  // Deduplicate: each English word only appears once per page
  const seenWords = new Set<string>();
  const unique: RawMatch[] = [];
  for (const match of matches) {
    if (seenWords.has(match.targetWord)) continue;
    // Skip words cleared 3+ times (mastered blacklist — user fully knows this word)
    const wordState = wordStates?.[match.wordEntry.id];
    if (wordState && (wordState.clearedCount ?? 0) >= 3) continue;
    seenWords.add(match.targetWord);
    unique.push(match);
  }

  // Random sampling: shuffle all candidates, then take up to maxWords
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }

  const candidates = unique.slice(0, maxWords);

  // Spacing filter: if two selected words are too close in the source text (< 4 chars apart),
  // keep only the one with higher learning value. Prevents "中英混写" visual.
  return spaceOutWords(candidates, wordStates);
}

/** Calculate learning value score — higher = more worth showing */
function wordValue(match: RawMatch, wordStates?: Record<string, UserWordState>): number {
  let score = 0;
  const state = wordStates?.[match.wordEntry.id];

  // Due for review = highest priority
  if (state && isDueForReview(state)) score += 100;

  // Less familiar = higher value
  if (state) {
    if (state.status === 'new') score += 30;
    else if (state.status === 'seen') score += 25;
    else if (state.status === 'learning') score += 20;
    else if (state.status === 'reviewing') score += 10;
    // mastered = 0
    score -= (state.clearedCount ?? 0) * 5;
  } else {
    score += 30; // unknown = new
  }

  // Longer English words = higher learning value
  score += Math.min(10, match.targetWord.length);

  return score;
}

/** Remove words that are too close together, keeping the more valuable one */
function spaceOutWords(selected: RawMatch[], wordStates?: Record<string, UserWordState>): RawMatch[] {
  if (selected.length <= 1) return selected;

  const MIN_GAP = 4; // minimum characters between two flipped words

  // Sort by position in text
  const sorted = [...selected].sort((a, b) => a.startOffset - b.startOffset);

  const result: RawMatch[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    const curr = sorted[i];

    // Check if same sentence (same sentenceContext) and too close
    if (prev.sentenceContext === curr.sentenceContext &&
        curr.startOffset - prev.endOffset < MIN_GAP) {
      // Too close — keep the one with higher value
      const prevVal = wordValue(prev, wordStates);
      const currVal = wordValue(curr, wordStates);
      if (currVal > prevVal) {
        result[result.length - 1] = curr; // replace prev with curr
      }
      // else keep prev, skip curr
    } else {
      result.push(curr);
    }
  }

  return result;
}
