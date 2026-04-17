import type { UserWordState } from './types.js';

/**
 * SM-2 spaced repetition algorithm.
 *
 * Quality scale:
 * 0 — Complete blackout
 * 1 — Wrong, but recognized after reveal
 * 2 — Wrong, but easy to recall after reveal
 * 3 — Correct with serious difficulty
 * 4 — Correct with some hesitation
 * 5 — Perfect recall
 */
export function sm2Update(state: UserWordState, quality: number): UserWordState {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  let { easeFactor, interval, repetitions } = state;

  if (q >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  } else {
    // Incorrect response — reset
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  // Calculate next review timestamp
  const nextReviewAt = Date.now() + interval * 24 * 60 * 60 * 1000;

  return {
    ...state,
    easeFactor,
    interval,
    repetitions,
    nextReviewAt,
  };
}

/**
 * Map user actions to SM-2 quality scores:
 * - "recognized" (didn't click decode) → quality 4-5
 * - "clicked" (opened decode but didn't mark cleared) → quality 2-3
 * - "cleared" (marked as mastered) → quality 5
 * - "failed" (clicked decode immediately) → quality 1
 */
export function actionToQuality(action: 'recognized' | 'clicked' | 'cleared' | 'failed'): number {
  switch (action) {
    case 'recognized': return 4;
    case 'clicked': return 2;
    case 'cleared': return 5;
    case 'failed': return 1;
  }
}

/**
 * Check if a word is due for review.
 */
export function isDueForReview(state: UserWordState): boolean {
  return Date.now() >= state.nextReviewAt;
}
