import { describe, test, expect } from 'bun:test';
import { withRetry } from '../../scripts/our_roots_affixes/retry.js';

describe('withRetry', () => {
  test('returns value on first success', async () => {
    let calls = 0;
    const r = await withRetry(async () => { calls++; return 42; }, { maxRetries: 3, baseDelayMs: 1 });
    expect(r).toBe(42);
    expect(calls).toBe(1);
  });

  test('retries on failure then succeeds', async () => {
    let calls = 0;
    const r = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error('boom');
      return 'ok';
    }, { maxRetries: 5, baseDelayMs: 1 });
    expect(r).toBe('ok');
    expect(calls).toBe(3);
  });

  test('throws after maxRetries exceeded', async () => {
    let calls = 0;
    await expect(withRetry(async () => {
      calls++;
      throw new Error('boom');
    }, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow('boom');
    expect(calls).toBe(3); // initial + 2 retries
  });
});
