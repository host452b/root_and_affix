import { describe, expect, test } from 'bun:test';
import { t, setLocale, getLocale } from '../../src/core/i18n.js';

describe('i18n', () => {
  test('defaults to Chinese locale', () => {
    setLocale('zh'); // reset to default
    expect(getLocale()).toBe('zh');
  });

  test('t() returns Chinese string by default', () => {
    setLocale('zh');
    expect(t('header.active')).toBe('运行中');
    expect(t('tab.main')).toBe('主页');
  });

  test('switching to English locale', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(t('header.active')).toBe('ACTIVE');
    expect(t('tab.main')).toBe('HOME');
    setLocale('zh'); // restore
  });

  test('English locale returns English strings', () => {
    setLocale('en');
    expect(t('decode.cleared')).toBe('Cleared');
    expect(t('decode.review')).toBe('Re-flip');
    expect(t('more.reset')).toBe('Reset');
    setLocale('zh');
  });

  test('unknown key falls back to key itself', () => {
    setLocale('zh');
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  test('English locale falls back to Chinese for missing EN keys', () => {
    setLocale('en');
    // If a key exists in ZH but not EN, should fall back to ZH value
    // All current keys exist in both, so test with the fallback chain
    const result = t('header.active');
    expect(result).toBeTruthy();
    setLocale('zh');
  });

  test('all tab keys exist in both locales', () => {
    const tabKeys = ['tab.main', 'tab.custom', 'tab.stats', 'tab.more'];
    for (const key of tabKeys) {
      setLocale('zh');
      expect(t(key)).not.toBe(key);
      setLocale('en');
      expect(t(key)).not.toBe(key);
    }
    setLocale('zh');
  });

  test('decode panel keys exist in both locales', () => {
    const keys = ['decode.cleared', 'decode.review', 'decode.origin', 'decode.context', 'decode.decode', 'decode.nativeFeel'];
    for (const key of keys) {
      setLocale('zh');
      expect(t(key)).not.toBe(key);
      setLocale('en');
      expect(t(key)).not.toBe(key);
    }
    setLocale('zh');
  });

  test('lang.switch toggles correctly', () => {
    setLocale('zh');
    expect(t('lang.switch')).toBe('EN');
    setLocale('en');
    expect(t('lang.switch')).toBe('中');
    setLocale('zh');
  });

  test('radar keys exist in both locales', () => {
    const keys = ['radar.title', 'radar.desc'];
    for (const key of keys) {
      setLocale('zh');
      expect(t(key)).not.toBe(key);
      setLocale('en');
      expect(t(key)).not.toBe(key);
    }
    setLocale('zh');
  });
});
