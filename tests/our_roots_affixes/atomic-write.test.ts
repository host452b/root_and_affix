import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { atomicWriteJson, atomicWriteText } from '../../scripts/our_roots_affixes/atomic-write.js';

describe('atomicWriteJson', () => {
  test('writes object as JSON', () => {
    const p = join(tmpdir(), `atw-${Date.now()}.json`);
    atomicWriteJson(p, { a: 1, b: 'x' });
    expect(readFileSync(p, 'utf-8')).toBe(JSON.stringify({ a: 1, b: 'x' }, null, 2));
    unlinkSync(p);
  });

  test('no .tmp file remains after success', () => {
    const p = join(tmpdir(), `atw-${Date.now()}.json`);
    atomicWriteJson(p, { ok: true });
    expect(existsSync(p + '.tmp')).toBe(false);
    unlinkSync(p);
  });
});

describe('atomicWriteText', () => {
  test('writes text content', () => {
    const p = join(tmpdir(), `atw-${Date.now()}.txt`);
    atomicWriteText(p, 'hello world');
    expect(readFileSync(p, 'utf-8')).toBe('hello world');
    unlinkSync(p);
  });
});
