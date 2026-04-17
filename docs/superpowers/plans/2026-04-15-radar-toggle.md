# Radar Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users toggle Radar Mode (English page word annotation) on/off from the popup settings drawer.

**Architecture:** Add `radarEnabled` boolean to `UserSettings`, gate `startRadar()` on it, handle live toggle in the storage listener, and render a toggle row in the popup settings drawer after Word Banks.

**Tech Stack:** Preact + htm, Chrome extension storage, Bun test runner.

---

### Task 1: Add `radarEnabled` to the data layer

**Files:**
- Modify: `src/core/types.ts:104-110`
- Modify: `src/core/constants.ts:17-23`

- [ ] **Step 1: Add field to UserSettings interface**

In `src/core/types.ts`, add `radarEnabled` to the `UserSettings` interface:

```ts
export interface UserSettings {
  theme: ThemeId;
  invasionLevel: InvasionLevel;
  wordBanks: string[];
  paused: boolean;
  onboarded: boolean;
  radarEnabled: boolean;
}
```

- [ ] **Step 2: Add default value**

In `src/core/constants.ts`, add `radarEnabled: true` to `DEFAULT_SETTINGS`:

```ts
export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'brutalist',
  invasionLevel: 1,
  wordBanks: ['news', 'tech'],
  paused: false,
  onboarded: false,
  radarEnabled: true,
};
```

- [ ] **Step 3: Run type check**

Run: `bun run check`
Expected: PASS — no type errors (existing code doesn't destructure UserSettings exhaustively).

- [ ] **Step 4: Run existing tests**

Run: `bun test`
Expected: All 106 tests PASS — default `true` preserves current behavior.

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/constants.ts
git commit -m "feat: add radarEnabled to UserSettings (default true)"
```

---

### Task 2: Add i18n keys

**Files:**
- Modify: `src/core/i18n.ts`
- Modify: `tests/core/i18n.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/core/i18n.test.ts`, inside the existing `describe('i18n', ...)` block, after the last test:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/core/i18n.test.ts`
Expected: FAIL — `t('radar.title')` returns `'radar.title'` (the key itself, meaning missing).

- [ ] **Step 3: Add i18n strings**

In `src/core/i18n.ts`, add to the `ZH` object (after the `'more.resetWarning'` line):

```ts
  // Radar
  'radar.title': '英文标注',
  'radar.desc': '浏览英文网站时，标注词库中的单词',
```

Add to the `EN` object (after the `'more.resetWarning'` line):

```ts
  'radar.title': 'English Annotation',
  'radar.desc': 'Annotate word-bank words on English pages',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/core/i18n.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/i18n.ts tests/core/i18n.test.ts
git commit -m "feat: add radar toggle i18n keys (zh/en)"
```

---

### Task 3: Gate `startRadar()` and handle live toggle in content script

**Files:**
- Modify: `src/content.ts:118-124` (init gate)
- Modify: `src/content.ts:218-234` (storage listener, add radarEnabled handler)

- [ ] **Step 1: Gate startRadar() on radarEnabled**

In `src/content.ts`, change line 122 from:

```ts
  } else if (lang === 'en') {
    await startRadar();
  }
```

to:

```ts
  } else if (lang === 'en' && settings.radarEnabled) {
    await startRadar();
  }
```

- [ ] **Step 2: Add live toggle handler in attachStorageListener**

In `src/content.ts`, inside `attachStorageListener`, after the `paused` toggle block (after line 234's `return;`) and before the word bank change block (line 237), add:

```ts
  // Radar toggle → add or remove English annotations in-place
  if (prev.radarEnabled !== settings.radarEnabled) {
    const lang = detectLanguage();
    if (lang === 'en') {
      if (!settings.radarEnabled) {
        // Remove all radar marks, restore original text
        document.querySelectorAll('[data-wg-radar]').forEach(mark => {
          mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
        });
        if (mutationObserver) { mutationObserver.disconnect(); mutationObserver = null; }
        if (scrollHandler) { window.removeEventListener('scroll', scrollHandler); scrollHandler = null; }
      } else {
        // Re-enable radar
        wordBank = null;
        await startRadar();
      }
    }
    return;
  }
```

- [ ] **Step 3: Run type check**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 4: Run all tests**

Run: `bun test`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content.ts
git commit -m "feat: gate radar mode on radarEnabled setting with live toggle"
```

---

### Task 4: Add toggle row to popup settings drawer

**Files:**
- Modify: `src/popup/index.tsx:276-317` (insert after Word Bank section)

- [ ] **Step 1: Add the radar toggle row**

In `src/popup/index.tsx`, replace the Word Bank section closing `</div>` (the one at line 317 that closes the Word Bank `<div style="padding: 14px 20px;">`) with the following — keeping that closing `</div>` and adding the new section after it:

Find this exact block (lines 316-317):

```
              })}
            </div>
```

This is the end of the Word Bank section. After this `</div>`, and before the `</div>` that closes the settings drawer (line 318), insert the radar toggle section:

```ts
            <!-- Radar Toggle -->
            <div style="padding: 14px 20px; border-top: 1px solid var(--wg-border, #E4E4E7);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 10px; letter-spacing: 1px; color: var(--wg-muted, #A1A1AA); font-family: var(--wg-mono, monospace);">
                    ${t('radar.title')}
                  </div>
                  <div style="font-size: 9px; color: var(--wg-muted, #A1A1AA); margin-top: 3px; font-family: var(--wg-mono, monospace);">
                    ${t('radar.desc')}
                  </div>
                </div>
                <button
                  onClick=${() => updateSetting({ radarEnabled: !settings.radarEnabled })}
                  aria-label=${settings.radarEnabled ? 'Disable English annotation' : 'Enable English annotation'}
                  style="
                    padding: 4px 10px; font-size: 10px; cursor: pointer; border: none;
                    font-family: var(--wg-mono, monospace); font-weight: 600;
                    letter-spacing: 0.5px; transition: all 150ms ease-out;
                    ${settings.radarEnabled
                      ? `background: ${theme.popup.foreground}; color: ${activeTextColor};`
                      : `background: none; border: 1px solid var(--wg-border, #E4E4E7); color: var(--wg-muted, #A1A1AA);`
                    }
                  "
                >${settings.radarEnabled ? 'ON' : 'OFF'}</button>
              </div>
            </div>
```

- [ ] **Step 2: Run type check**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Build and verify**

Run: `bun run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/popup/index.tsx
git commit -m "feat: add radar mode toggle to popup settings drawer"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Load extension in Chrome**

1. Open `chrome://extensions`
2. Click "Load unpacked" → select `dist/` folder
3. Open any English page (e.g. news.ycombinator.com)

- [ ] **Step 2: Verify radar is ON by default**

Expected: English words from the active word bank are annotated with colored underlines.

- [ ] **Step 3: Toggle radar OFF**

1. Click the Flipword popup icon
2. Click "调整设置 →" to open settings drawer
3. Scroll to bottom — see "英文标注" row with ON button
4. Click to toggle OFF
5. Expected: all `<mark data-wg-radar>` annotations disappear immediately from the page without reload.

- [ ] **Step 4: Toggle radar ON**

1. Click ON again
2. Expected: annotations reappear on the page without reload.

- [ ] **Step 5: Verify Chinese pages unaffected**

1. Navigate to a Chinese page (e.g. zhihu.com)
2. Expected: normal Flip behavior, no radar marks. The toggle has no effect on Chinese pages.
