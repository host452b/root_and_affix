import { describe, test, expect, beforeEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  writeCheckpoint,
  listCompletedBuckets,
  isBucketDone,
} from '../../scripts/our_roots_affixes/checkpoint.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ckpt-'));
});

describe('checkpoint', () => {
  test('writeCheckpoint creates done file', () => {
    writeCheckpoint(dir, { bucketId: 'a-001', timestamp: 'now', tokensIn: 1, tokensOut: 2, hash: 'h' });
    expect(existsSync(join(dir, 'a-001.done.json'))).toBe(true);
    rmSync(dir, { recursive: true });
  });

  test('listCompletedBuckets returns all done', () => {
    writeCheckpoint(dir, { bucketId: 'a-001', timestamp: 'n', tokensIn: 0, tokensOut: 0, hash: 'h' });
    writeCheckpoint(dir, { bucketId: 'b-002', timestamp: 'n', tokensIn: 0, tokensOut: 0, hash: 'h' });
    expect(listCompletedBuckets(dir).sort()).toEqual(['a-001', 'b-002']);
    rmSync(dir, { recursive: true });
  });

  test('isBucketDone reflects state', () => {
    expect(isBucketDone(dir, 'a-001')).toBe(false);
    writeCheckpoint(dir, { bucketId: 'a-001', timestamp: 'n', tokensIn: 0, tokensOut: 0, hash: 'h' });
    expect(isBucketDone(dir, 'a-001')).toBe(true);
    rmSync(dir, { recursive: true });
  });
});
