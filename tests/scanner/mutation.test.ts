import { describe, expect, test } from 'bun:test';
import { hasChinese, shouldSkipNode } from '../../src/scanner/index.js';

/**
 * NOTE: collectTextNodes uses document.createTreeWalker with a custom filter
 * function. happy-dom's TreeWalker does not support custom filter objects,
 * so we test the underlying shouldSkipNode + hasChinese logic directly instead
 * — these are the actual decision functions that collectTextNodes delegates to.
 */

describe('shouldSkipNode — link protection', () => {
  test('skips text inside <a href="..."> (no flip inside links)', () => {
    const a = document.createElement('a');
    a.setAttribute('href', 'https://example.com');
    a.textContent = '点击这里查看环境报告';
    document.body.appendChild(a);
    expect(shouldSkipNode(a.firstChild as Text)).toBe(true);
    a.remove();
  });

  test('skips text in nested element inside link', () => {
    const a = document.createElement('a');
    a.setAttribute('href', '/test');
    const span = document.createElement('span');
    span.textContent = '中文链接';
    a.appendChild(span);
    document.body.appendChild(a);
    expect(shouldSkipNode(span.firstChild as Text)).toBe(true);
    a.remove();
  });

  test('allows text in <a> without href', () => {
    const a = document.createElement('a');
    a.textContent = '中文锚点';
    document.body.appendChild(a);
    // <a> without href is not a real link — should not be skipped
    expect(shouldSkipNode(a.firstChild as Text)).toBe(false);
    a.remove();
  });
});

describe('shouldSkipNode — blacklist tags', () => {
  const blacklistTags = ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT'];

  for (const tag of blacklistTags) {
    test(`skips ${tag} content`, () => {
      const el = document.createElement(tag);
      el.textContent = '中文内容';
      document.body.appendChild(el);
      if (el.firstChild) {
        expect(shouldSkipNode(el.firstChild as Text)).toBe(true);
      }
      el.remove();
    });
  }
});

describe('shouldSkipNode — already flipped', () => {
  test('skips node inside data-wg span', () => {
    const span = document.createElement('span');
    span.setAttribute('data-wg', 'environment');
    span.textContent = '已替换';
    document.body.appendChild(span);
    expect(shouldSkipNode(span.firstChild as Text)).toBe(true);
    span.remove();
  });

  test('skips nested text inside data-wg container', () => {
    const div = document.createElement('div');
    div.setAttribute('data-wg', 'test');
    const p = document.createElement('p');
    p.textContent = '嵌套中文';
    div.appendChild(p);
    document.body.appendChild(div);
    expect(shouldSkipNode(p.firstChild as Text)).toBe(true);
    div.remove();
  });
});

describe('shouldSkipNode — normal nodes', () => {
  test('accepts normal paragraph Chinese text', () => {
    const p = document.createElement('p');
    p.textContent = '这是一段正常的中文文本';
    document.body.appendChild(p);
    expect(shouldSkipNode(p.firstChild as Text)).toBe(false);
    p.remove();
  });

  test('accepts text inside div', () => {
    const div = document.createElement('div');
    div.textContent = '保护环境';
    document.body.appendChild(div);
    expect(shouldSkipNode(div.firstChild as Text)).toBe(false);
    div.remove();
  });

  test('accepts text inside span', () => {
    const span = document.createElement('span');
    span.textContent = '创新发展';
    document.body.appendChild(span);
    expect(shouldSkipNode(span.firstChild as Text)).toBe(false);
    span.remove();
  });
});

describe('shouldSkipNode — edge cases', () => {
  test('rejects empty text node', () => {
    const p = document.createElement('p');
    p.textContent = '';
    document.body.appendChild(p);
    if (p.firstChild) {
      expect(shouldSkipNode(p.firstChild as Text)).toBe(true);
    }
    p.remove();
  });

  test('rejects whitespace-only text node', () => {
    const p = document.createElement('p');
    p.textContent = '   \n\t  ';
    document.body.appendChild(p);
    expect(shouldSkipNode(p.firstChild as Text)).toBe(true);
    p.remove();
  });

  test('rejects orphan text node (no parent)', () => {
    const text = document.createTextNode('中文');
    expect(shouldSkipNode(text)).toBe(true);
  });
});

describe('hasChinese — comprehensive', () => {
  test('CJK unified ideographs range', () => {
    expect(hasChinese('环境')).toBe(true);
    expect(hasChinese('政策创新')).toBe(true);
  });

  test('mixed Chinese/English', () => {
    expect(hasChinese('test 中文 test')).toBe(true);
    expect(hasChinese('Hello环境World')).toBe(true);
  });

  test('pure English', () => {
    expect(hasChinese('Hello World')).toBe(false);
  });

  test('numbers and punctuation only', () => {
    expect(hasChinese('12345!@#$%')).toBe(false);
  });

  test('empty string', () => {
    expect(hasChinese('')).toBe(false);
  });

  test('Japanese hiragana/katakana (not Chinese)', () => {
    // Hiragana/katakana are NOT in the Chinese range \u4e00-\u9fff
    expect(hasChinese('こんにちは')).toBe(false);
    expect(hasChinese('カタカナ')).toBe(false);
  });

  test('CJK kanji shared with Chinese', () => {
    // Kanji that are also in the CJK range should match
    expect(hasChinese('日本語の漢字')).toBe(true); // 漢字 is in range
  });
});
