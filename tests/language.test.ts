import { describe, expect, test, beforeEach } from 'bun:test';
import { detectLanguage } from '../src/scanner/language.js';

// Note: these tests run in happy-dom which provides document/body

describe('detectLanguage', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('lang');
    document.body.textContent = '';
  });

  test('detects Chinese from body text', () => {
    document.body.textContent = '这是一段中文内容，包含了足够多的汉字来触发中文检测。人工智能技术的发展改变了世界。';
    expect(detectLanguage()).toBe('zh');
  });

  test('detects English from body text', () => {
    document.body.textContent = 'This is a long enough English text that should be detected as English by the language detector. It needs to have more than a hundred Latin characters to cross the threshold.';
    expect(detectLanguage()).toBe('en');
  });

  test('detects zh from lang attribute', () => {
    document.documentElement.lang = 'zh-CN';
    expect(detectLanguage()).toBe('zh');
  });

  test('mixed Chinese/English page → zh (our target scenario)', () => {
    document.body.textContent = '这篇文章讨论了 artificial intelligence 在现代社会中的应用。随着 technology 的发展，我们的生活方式发生了巨大变化。';
    expect(detectLanguage()).toBe('zh');
  });

  test('English lang but Chinese content → zh', () => {
    document.documentElement.lang = 'en';
    document.body.textContent = '这是一个中文网站但是 lang 标签写了 en。这种情况很常见，我们应该检测实际内容而不是盲目信任 lang 属性。这段文字包含足够多的中文字符。';
    expect(detectLanguage()).toBe('zh');
  });

  test('empty body → other', () => {
    expect(detectLanguage()).toBe('other');
  });
});
