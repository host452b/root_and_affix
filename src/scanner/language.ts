const CHINESE_RE = /[\u4e00-\u9fff]/g;
const LATIN_RE = /[a-zA-Z]/g;

/**
 * Detect page language. For mixed Chinese/English pages, prefer 'zh'
 * since those are the pages where Flipword is most useful — Chinese
 * content with some English is exactly our target scenario.
 */
export function detectLanguage(_root?: Element): 'zh' | 'en' | 'other' {
  // Check lang attribute on <html> — but only trust it for pure English
  // Many Chinese sites have lang="en" or no lang attribute
  const lang = document.documentElement.lang?.toLowerCase().trim();
  if (lang && (lang === 'en' || lang.startsWith('en-'))) {
    // Double-check: if body has Chinese chars, it's actually zh
    const sample = (document.body?.textContent ?? '').slice(0, 3000);
    const chineseCount = (sample.match(CHINESE_RE) ?? []).length;
    if (chineseCount > 20) return 'zh'; // Has significant Chinese content
    return 'en';
  }
  if (lang && (lang === 'zh' || lang.startsWith('zh-'))) return 'zh';

  // Sample text from body — use a larger sample for better accuracy
  const body = document.body;
  if (!body) return 'other';

  const text = (body.textContent ?? '').slice(0, 5000);
  if (!text.trim()) return 'other';

  const chineseCount = (text.match(CHINESE_RE) ?? []).length;
  const latinCount = (text.match(LATIN_RE) ?? []).length;

  // Any meaningful amount of Chinese → treat as zh (mixed pages are our target)
  if (chineseCount > 10) return 'zh';
  if (latinCount > 100 && chineseCount === 0) return 'en';

  return 'other';
}
