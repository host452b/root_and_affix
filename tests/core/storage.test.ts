import { describe, expect, test } from 'bun:test';
import { newWordState, localDateStr } from '../../src/core/storage.js';

describe('newWordState', () => {
  test('creates correct defaults', () => {
    const state = newWordState('aberrant');
    expect(state.wordId).toBe('aberrant');
    expect(state.status).toBe('new');
    expect(state.exposureCount).toBe(0);
    expect(state.easeFactor).toBe(2.5);
    expect(state.interval).toBe(0);
    expect(state.masteredAt).toBeNull();
    expect(state.clearedCount).toBe(0);
    expect(state.repetitions).toBe(0);
    expect(state.clickCount).toBe(0);
    expect(state.hoverCount).toBe(0);
    expect(state.decodedAt).toBeNull();
    expect(state.correctRecognitions).toBe(0);
    expect(state.contextDiversity).toBe(0);
  });

  test('sets timestamps to now', () => {
    const before = Date.now();
    const state = newWordState('test');
    const after = Date.now();
    expect(state.firstSeenAt).toBeGreaterThanOrEqual(before);
    expect(state.firstSeenAt).toBeLessThanOrEqual(after);
    expect(state.lastExposureAt).toBe(state.firstSeenAt);
    expect(state.nextReviewAt).toBe(state.firstSeenAt);
  });
});

describe('localDateStr', () => {
  test('formats current date as YYYY-MM-DD', () => {
    const result = localDateStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('pads single-digit months and days', () => {
    const jan1 = new Date(2026, 0, 5); // Jan 5
    expect(localDateStr(jan1)).toBe('2026-01-05');
  });

  test('handles Dec 31 correctly', () => {
    const dec31 = new Date(2025, 11, 31);
    expect(localDateStr(dec31)).toBe('2025-12-31');
  });

  test('uses local timezone, not UTC', () => {
    // Create a date that would differ between local and UTC for certain timezones
    const result = localDateStr(new Date());
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });

  test('Feb 28 leap year', () => {
    const leap = new Date(2024, 1, 29); // Feb 29 2024 is a leap year
    expect(localDateStr(leap)).toBe('2024-02-29');
  });
});
