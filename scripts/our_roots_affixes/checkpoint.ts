import { readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { atomicWriteJson } from './atomic-write.js';
import type { CheckpointRecord } from './types.js';

export function writeCheckpoint(dir: string, rec: CheckpointRecord): void {
  mkdirSync(dir, { recursive: true });
  atomicWriteJson(join(dir, `${rec.bucketId}.done.json`), rec);
}

export function listCompletedBuckets(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.done.json'))
    .map(f => f.replace(/\.done\.json$/, ''));
}

export function isBucketDone(dir: string, bucketId: string): boolean {
  return existsSync(join(dir, `${bucketId}.done.json`));
}
