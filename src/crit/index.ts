import { COMBO_WINDOW_MS } from '../core/constants.js';

export type CritType = 'first-blood' | 'combo-5' | 'combo-10' | 'combo-20' | 'combo-30' | 'cleared' | 'daily-complete';

export interface CritEvent {
  type: CritType;
  wordId: string;
  comboCount: number;
  position?: { x: number; y: number };  // screen coords of the word
}

export type CritCallback = (event: CritEvent) => void;

export class CritTracker {
  private comboCount = 0;
  private lastRecognitionAt = 0;
  private recognizedWords = new Set<string>();
  private callback: CritCallback;
  private comboWindowMs: number;

  constructor(callback: CritCallback, comboWindowMs = COMBO_WINDOW_MS) {
    this.callback = callback;
    this.comboWindowMs = comboWindowMs;
  }

  /** Called when user recognizes a word (didn't click decode) */
  recognize(wordId: string, position?: { x: number; y: number }): void {
    const now = Date.now();

    // Check combo window
    if (now - this.lastRecognitionAt > this.comboWindowMs) {
      this.comboCount = 0; // combo broken
    }

    this.comboCount++;
    this.lastRecognitionAt = now;

    // First time recognizing this word ever
    const isFirstBlood = !this.recognizedWords.has(wordId);
    if (isFirstBlood) {
      this.recognizedWords.add(wordId);
      this.callback({ type: 'first-blood', wordId, comboCount: this.comboCount, position });
    }

    // Combo milestones
    if (this.comboCount === 5) {
      this.callback({ type: 'combo-5', wordId, comboCount: 5, position });
    } else if (this.comboCount === 10) {
      this.callback({ type: 'combo-10', wordId, comboCount: 10, position });
    } else if (this.comboCount === 20) {
      this.callback({ type: 'combo-20', wordId, comboCount: 20, position });
    } else if (this.comboCount >= 30 && this.comboCount % 10 === 0) {
      this.callback({ type: 'combo-30', wordId, comboCount: this.comboCount, position });
    }
  }

  /** Called when user clicks a word (breaks combo) */
  breakCombo(): void {
    this.comboCount = 0;
  }

  /** Called when user clears a word */
  cleared(wordId: string, position?: { x: number; y: number }): void {
    this.callback({ type: 'cleared', wordId, comboCount: this.comboCount, position });
  }

  /** Called when daily target is met */
  dailyComplete(): void {
    this.callback({ type: 'daily-complete', wordId: '', comboCount: this.comboCount });
  }

  getComboCount(): number { return this.comboCount; }
}

/**
 * Invasion Mode: Set a timer when a flipped word becomes visible.
 * If 5s pass without a click on that word, count as "recognized".
 */
export function observeRecognition(
  span: HTMLSpanElement,
  wordId: string,
  tracker: CritTracker,
  timeoutMs = 5000,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const start = () => {
    if (timer) return;
    timer = setTimeout(() => {
      if (!span.isConnected) return; // span may have been removed by re-scan
      const rect = span.getBoundingClientRect();
      tracker.recognize(wordId, { x: rect.x + rect.width / 2, y: rect.y });
    }, timeoutMs);
  };

  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };

  // Use IntersectionObserver to detect visibility
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) start();
    else cancel();
  }, { threshold: 0.5 });

  observer.observe(span);

  // Cancel on click (user opened decode = didn't recognize)
  span.addEventListener('click', () => {
    cancel();
    tracker.breakCombo();
  });

  // Cleanup function
  return () => { cancel(); observer.disconnect(); };
}
