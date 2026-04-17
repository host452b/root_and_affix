import { describe, expect, test } from 'bun:test';
import { hasChinese, shouldSkipNode } from '../src/scanner/index.js';

describe('hasChinese', () => {
  test('detects Chinese characters', () => {
    expect(hasChinese('今天天气很好')).toBe(true);
    expect(hasChinese('这是一个test')).toBe(true);
  });

  test('rejects non-Chinese text', () => {
    expect(hasChinese('Hello world')).toBe(false);
    expect(hasChinese('12345')).toBe(false);
    expect(hasChinese('')).toBe(false);
  });
});

describe('shouldSkipNode', () => {
  test('skips blacklisted tags', () => {
    const script = document.createElement('script');
    script.textContent = '中文';
    expect(shouldSkipNode(script.firstChild as Text)).toBe(true);
  });

  test('skips already-glitched nodes', () => {
    const div = document.createElement('div');
    div.setAttribute('data-wg', 'test');
    div.textContent = '中文';
    expect(shouldSkipNode(div.firstChild as Text)).toBe(true);
  });

  test('accepts normal Chinese text node', () => {
    const p = document.createElement('p');
    p.textContent = '今天天气很好';
    document.body.appendChild(p);
    expect(shouldSkipNode(p.firstChild as Text)).toBe(false);
    p.remove();
  });
});
