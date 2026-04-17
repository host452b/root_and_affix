import { describe, expect, test } from 'bun:test';
import { validateWordBank, WORD_BANK_SCHEMA_VERSION } from '../../src/core/api.js';

describe('validateWordBank', () => {
  test('accepts valid package', () => {
    const result = validateWordBank({
      format: WORD_BANK_SCHEMA_VERSION,
      name: 'Test Bank',
      wordCount: 1,
      words: [{
        id: 'test', word: 'test', phonetic: '/test/',
        meanings: [], difficulty: [],
        chineseMappings: [{ chinese: '测试', partOfSpeech: 'n' }],
      }],
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.words.length).toBe(1);
  });

  test('rejects wrong format', () => {
    const result = validateWordBank({ format: 'wrong', words: [] });
    expect(result.valid).toBe(false);
  });

  test('rejects missing words array', () => {
    const result = validateWordBank({ format: WORD_BANK_SCHEMA_VERSION });
    expect(result.valid).toBe(false);
  });

  test('rejects entries without required fields', () => {
    const result = validateWordBank({
      format: WORD_BANK_SCHEMA_VERSION,
      words: [{ id: 'x' }], // missing word, chineseMappings
    });
    expect(result.valid).toBe(false);
  });

  test('rejects non-object input', () => {
    expect(validateWordBank(null).valid).toBe(false);
    expect(validateWordBank('string').valid).toBe(false);
  });
});
