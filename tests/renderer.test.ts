import { describe, expect, test } from 'bun:test';
import { createFlipSpan } from '../src/renderer/index.js';

// Note: createFlipSpan requires a DOM environment (document.createElement)
// which is available via happy-dom in the test config.

describe('createFlipSpan', () => {
  test('creates span with correct word text', () => {
    const match = {
      originalText: '环境',
      sentenceContext: '保护环境',
      targetWord: 'environment',
      wordEntry: { id: 'environment', word: 'environment', phonetic: '', meanings: [], difficulty: [], chineseMappings: [] },
      confidenceScore: 0.9,
      matchMethod: 'context' as const,
      startOffset: 2,
      endOffset: 4,
    };
    const theme = {
      id: 'brutalist' as const,
      name: 'Brutalist',
      nameCn: '',
      abbr: 'BRT',
      mark: { background: '#09090B', color: '#FAFAFA', padding: '1px 6px' },
      decode: { border: '', borderRadius: '', background: '', headerFont: '', labelStyle: '' },
      popup: { background: '', foreground: '', accent: '', fontFamily: '', outerBorder: '', swatchRadius: '' },
      cssVariables: {},
    };

    const { span } = createFlipSpan(match, theme);
    expect(span.textContent).toBe('environment');
    expect(span.title).toBe('环境');
    expect(span.style.fontSize).toBe('inherit');
    expect(span.style.cursor).toBe('pointer');
  });
});
