import { describe, expect, test } from 'bun:test';
import { scanEnglishWords } from '../src/radar/index.js';
import { buildWordBank } from '../src/nlp/word-bank.js';
import type { WordEntry } from '../src/core/types.js';

// ── Minimal mock entries ─────────────────────────────────────────────────────

const MOCK_ENTRIES: WordEntry[] = [
  {
    id: 'environment',
    word: 'environment',
    phonetic: '/ɪnˈvaɪrənmənt/',
    meanings: [{ partOfSpeech: 'n', definition: 'surroundings', definitionCn: '环境' }],
    difficulty: ['IELTS'],
    chineseMappings: [{ chinese: '环境', partOfSpeech: 'n' }],
  },
  {
    id: 'policy',
    word: 'policy',
    phonetic: '/ˈpɒlɪsi/',
    meanings: [{ partOfSpeech: 'n', definition: 'a set of rules', definitionCn: '政策' }],
    difficulty: ['GRE'],
    chineseMappings: [{ chinese: '政策', partOfSpeech: 'n' }],
  },
  {
    id: 'innovation',
    word: 'innovation',
    phonetic: '/ˌɪnəˈveɪʃən/',
    meanings: [{ partOfSpeech: 'n', definition: 'a new idea', definitionCn: '创新' }],
    difficulty: [],
    chineseMappings: [{ chinese: '创新', partOfSpeech: 'n' }],
  },
];

const bank = buildWordBank(MOCK_ENTRIES);

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDiv(text: string): HTMLDivElement {
  const div = document.createElement('div');
  div.textContent = text;
  document.body.appendChild(div);
  return div;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('scanEnglishWords', () => {
  test('finds known words in plain English text', () => {
    const div = makeDiv('Good environment policy drives innovation.');
    const matches = scanEnglishWords(div, bank);
    div.remove();

    const words = matches.map(m => m.wordEntry.id).sort();
    expect(words).toEqual(['environment', 'innovation', 'policy']);
  });

  test('returns empty array when no vocabulary words present', () => {
    const div = makeDiv('The quick brown fox jumps over the lazy dog.');
    const matches = scanEnglishWords(div, bank);
    div.remove();

    expect(matches).toHaveLength(0);
  });

  test('handles case-insensitive matching', () => {
    const div = makeDiv('The ENVIRONMENT must be protected. Policy matters.');
    const matches = scanEnglishWords(div, bank);
    div.remove();

    const words = matches.map(m => m.wordEntry.id).sort();
    expect(words).toEqual(['environment', 'policy']);
  });

  test('preserves original word casing in match.word', () => {
    const div = makeDiv('ENVIRONMENT and Policy and innovation');
    const matches = scanEnglishWords(div, bank);
    div.remove();

    const byId: Record<string, string> = {};
    for (const m of matches) byId[m.wordEntry.id] = m.word;
    expect(byId['environment']).toBe('ENVIRONMENT');
    expect(byId['policy']).toBe('Policy');
    expect(byId['innovation']).toBe('innovation');
  });

  test('reports correct start and end offsets', () => {
    const text = 'Good environment here';
    const div = makeDiv(text);
    const matches = scanEnglishWords(div, bank);
    div.remove();

    expect(matches).toHaveLength(1);
    const m = matches[0];
    expect(text.slice(m.startOffset, m.endOffset)).toBe('environment');
  });

  test('skips nodes inside blacklisted tags', () => {
    const code = document.createElement('code');
    code.textContent = 'environment policy';
    document.body.appendChild(code);

    const matches = scanEnglishWords(code, bank);
    code.remove();

    expect(matches).toHaveLength(0);
  });

  test('returns the correct textNode reference', () => {
    const div = makeDiv('Innovation is key.');
    const matches = scanEnglishWords(div, bank);
    div.remove();

    expect(matches).toHaveLength(1);
    expect(matches[0].textNode.textContent).toBe('Innovation is key.');
  });

  test('handles multiple words in a single text node', () => {
    const div = makeDiv('Environment and policy drive innovation forward.');
    const matches = scanEnglishWords(div, bank);
    div.remove();

    expect(matches).toHaveLength(3);
  });
});
