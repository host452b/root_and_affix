import { describe, expect, test } from 'bun:test';
import { sm2Update, actionToQuality, isDueForReview } from '../../src/core/sm2.js';
import { newWordState } from '../../src/core/storage.js';

describe('sm2Update', () => {
  test('first correct response sets interval to 1 day', () => {
    const state = newWordState('test');
    const updated = sm2Update(state, 4);
    expect(updated.interval).toBe(1);
    expect(updated.repetitions).toBe(1);
  });

  test('second correct response sets interval to 6 days', () => {
    let state = newWordState('test');
    state = sm2Update(state, 4);
    state = sm2Update(state, 4);
    expect(state.interval).toBe(6);
    expect(state.repetitions).toBe(2);
  });

  test('third correct response uses easeFactor', () => {
    let state = newWordState('test');
    state = sm2Update(state, 4); // interval=1
    state = sm2Update(state, 4); // interval=6
    state = sm2Update(state, 4); // interval=6*EF
    expect(state.interval).toBeGreaterThan(6);
    expect(state.repetitions).toBe(3);
  });

  test('incorrect response resets to interval 1', () => {
    let state = newWordState('test');
    state = sm2Update(state, 4);
    state = sm2Update(state, 4);
    state = sm2Update(state, 1); // wrong
    expect(state.interval).toBe(1);
    expect(state.repetitions).toBe(0);
  });

  test('easeFactor never drops below 1.3', () => {
    let state = newWordState('test');
    // Many bad responses
    for (let i = 0; i < 10; i++) {
      state = sm2Update(state, 0);
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  test('perfect responses increase easeFactor', () => {
    let state = newWordState('test');
    const initialEF = state.easeFactor;
    state = sm2Update(state, 5);
    expect(state.easeFactor).toBeGreaterThan(initialEF);
  });

  test('nextReviewAt is in the future', () => {
    const state = newWordState('test');
    const updated = sm2Update(state, 4);
    expect(updated.nextReviewAt).toBeGreaterThan(Date.now());
  });
});

describe('actionToQuality', () => {
  test('maps actions to quality scores', () => {
    expect(actionToQuality('recognized')).toBe(4);
    expect(actionToQuality('clicked')).toBe(2);
    expect(actionToQuality('cleared')).toBe(5);
    expect(actionToQuality('failed')).toBe(1);
  });
});

describe('isDueForReview', () => {
  test('new word is due for review', () => {
    const state = newWordState('test');
    expect(isDueForReview(state)).toBe(true);
  });

  test('recently reviewed word is not due', () => {
    let state = newWordState('test');
    state = sm2Update(state, 4);
    expect(isDueForReview(state)).toBe(false);
  });
});
