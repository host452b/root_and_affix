import { describe, expect, test } from 'bun:test';
import { THEMES, getTheme, generateThemeCSS } from '../../src/core/themes.js';

describe('themes', () => {
  test('all 4 themes defined', () => {
    expect(Object.keys(THEMES)).toEqual(['editorial', 'brutalist', 'soft', 'minimal']);
  });

  test('each theme has required fields', () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(theme.mark).toBeTruthy();
      expect(theme.decode).toBeTruthy();
      expect(theme.popup).toBeTruthy();
      expect(theme.cssVariables).toBeTruthy();
      expect(theme.cssVariables['--wg-accent']).toBeTruthy();
    }
  });

  test('getTheme returns brutalist for unknown id', () => {
    expect(getTheme('nonexistent').id).toBe('brutalist');
  });

  test('generateThemeCSS produces valid CSS', () => {
    const css = generateThemeCSS(THEMES.brutalist);
    expect(css).toContain('--wg-fg: #09090B;');
    expect(css).toContain('--wg-accent: #09090B;');
  });
});
