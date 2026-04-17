/**
 * Flipword Score Engine
 *
 * Separated from SM-2 (learning rhythm). Score is for:
 * - Instant feedback (per-action points)
 * - Session motivation (combo multiplier)
 * - Daily goals
 * - Long-term progression
 */

export interface ScoreEvent {
  action: 'first-blood' | 'recognized' | 'cleared' | 'review-hit';
  wordId: string;
  comboCount: number;
  points: number;
}

const BASE_POINTS = {
  'first-blood': 3,     // First time seeing a word
  'recognized': 5,      // Recognized without clicking (5s timer)
  'cleared': 12,        // Marked as mastered
  'review-hit': 8,      // Recognized a due-for-review word
};

function comboMultiplier(combo: number): number {
  if (combo >= 20) return 2.0;
  if (combo >= 10) return 1.5;
  if (combo >= 5) return 1.2;
  return 1.0;
}

export function calculateScore(action: ScoreEvent['action'], comboCount: number): number {
  const base = BASE_POINTS[action] ?? 0;
  const multiplier = comboMultiplier(comboCount);
  return Math.round(base * multiplier);
}

// Session score state
let sessionScore = 0;
let todayScore = 0;

export function addScore(points: number): number {
  sessionScore += points;
  todayScore += points;
  return sessionScore;
}

export function getSessionScore(): number { return sessionScore; }
export function getTodayScore(): number { return todayScore; }
export function setTodayScore(score: number): void { todayScore = score; }
export function resetSessionScore(): void { sessionScore = 0; }
