import { describe, test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildManifest, bucketize } from '../../scripts/our_roots_affixes/stage-0-manifest.js';

const mockBank = [
  { id: 'inflate', word: 'inflate', phonetic: '/a/', meanings: [{ partOfSpeech: 'v', definition: 'x', definitionCn: '使膨胀' }] },
  { id: 'inflation', word: 'inflation', phonetic: '/b/', meanings: [{ partOfSpeech: 'n', definition: 'x', definitionCn: '通货膨胀' }] },
];
const mockBank2 = [
  { id: 'inflation', word: 'inflation', phonetic: '/b/', meanings: [{ partOfSpeech: 'n', definition: 'x', definitionCn: '通货膨胀' }] },
  { id: 'deflate', word: 'deflate', phonetic: '/c/', meanings: [{ partOfSpeech: 'v', definition: 'x', definitionCn: '放气' }] },
];

describe('buildManifest', () => {
  test('dedups and records source banks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wb-'));
    writeFileSync(join(dir, 'bank1.json'), JSON.stringify(mockBank));
    writeFileSync(join(dir, 'bank2.json'), JSON.stringify(mockBank2));
    const m = buildManifest(dir);
    expect(m.totalWords).toBe(3);
    const inflation = m.entries.find(e => e.word === 'inflation');
    expect(inflation?.sourceBanks.sort()).toEqual(['bank1', 'bank2']);
    rmSync(dir, { recursive: true });
  });

  test('normalizes word to lowercase', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wb-'));
    writeFileSync(join(dir, 'x.json'), JSON.stringify([
      { word: 'INFLATE', phonetic: '/a/', meanings: [{ partOfSpeech: 'v', definition: '', definitionCn: 'y' }] },
    ]));
    const m = buildManifest(dir);
    expect(m.entries[0].word).toBe('inflate');
    rmSync(dir, { recursive: true });
  });
});

describe('bucketize', () => {
  test('splits 50-word buckets with alphabetic prefix', () => {
    const words = Array.from({ length: 120 }, (_, i) => ({
      word: (i < 100 ? 'a' : 'b') + String(i).padStart(3, '0'),
      phonetic: '', definitionCn: '', sourceBanks: [],
    }));
    const plan = bucketize(words, 50);
    expect(plan.totalBuckets).toBe(3);
    expect(plan.buckets.map(b => b.id)).toEqual(['a-001', 'a-002', 'b-001']);
    expect(plan.buckets[0].words.length).toBe(50);
    expect(plan.buckets[1].words.length).toBe(50);
    expect(plan.buckets[2].words.length).toBe(20);
  });
});
