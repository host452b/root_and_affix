import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { detectLanguage } from '../../src/scanner/language.js';

// Helpers to manipulate the DOM between tests
function setHtmlLang(lang: string | null): void {
  if (lang === null) {
    document.documentElement.removeAttribute('lang');
  } else {
    document.documentElement.lang = lang;
  }
}

function setBodyText(text: string): void {
  document.body.textContent = text;
}

function clearBodyText(): void {
  document.body.textContent = '';
}

describe('detectLanguage', () => {
  beforeEach(() => {
    setHtmlLang(null);
    clearBodyText();
  });

  afterEach(() => {
    setHtmlLang(null);
    clearBodyText();
  });

  test('returns "zh" when lang="zh"', () => {
    setHtmlLang('zh');
    expect(detectLanguage()).toBe('zh');
  });

  test('returns "zh" when lang="zh-CN"', () => {
    setHtmlLang('zh-CN');
    expect(detectLanguage()).toBe('zh');
  });

  test('returns "zh" when lang="zh-TW"', () => {
    setHtmlLang('zh-TW');
    expect(detectLanguage()).toBe('zh');
  });

  test('returns "en" when lang="en"', () => {
    setHtmlLang('en');
    expect(detectLanguage()).toBe('en');
  });

  test('returns "en" when lang="en-US"', () => {
    setHtmlLang('en-US');
    expect(detectLanguage()).toBe('en');
  });

  test('returns "en" when lang="en-GB"', () => {
    setHtmlLang('en-GB');
    expect(detectLanguage()).toBe('en');
  });

  test('falls back to text sampling when no lang attribute', () => {
    // Chinese body text — should detect as zh
    setBodyText('今天天气很好，我们去公园散步。这是一个很好的机会学习新知识。学习语言很有趣，每天都有新的发现。');
    expect(detectLanguage()).toBe('zh');
  });

  test('detects English from body text when no lang attribute', () => {
    setBodyText(
      'The quick brown fox jumps over the lazy dog. ' +
      'This is a standard English sentence used for testing. ' +
      'Language detection should identify this as English text.',
    );
    expect(detectLanguage()).toBe('en');
  });

  test('returns "other" for empty body with no lang attribute', () => {
    expect(detectLanguage()).toBe('other');
  });

  test('returns "zh" for mixed text where Chinese exceeds 20%', () => {
    // ~40 Chinese characters out of ~80 chars total → well over 20%
    setBodyText('环境政策创新技术发展未来学习工作生活社会文化传统艺术音乐体育运动历史地理政治经济科学哲学文学诗歌小说');
    expect(detectLanguage()).toBe('zh');
  });

  test('returns "other" for text that is neither clearly Chinese nor Latin', () => {
    // Numbers and punctuation only — neither threshold met
    setBodyText('12345 67890 !!!! #### $$$$ %%%%');
    expect(detectLanguage()).toBe('other');
  });
});
