# Radar Mode Toggle — Design Spec

**Date:** 2026-04-15
**Scope:** Add a user-facing toggle to enable/disable Radar Mode (English page annotation).

## Problem

Radar Mode automatically annotates word-bank vocabulary on English pages. There is no way for users to turn this off — it's always-on when the page language is detected as English.

## Solution

A simple `radarEnabled` boolean setting, exposed as a toggle in the popup settings drawer.

## Changes

### 1. Data Layer

**`src/core/types.ts`** — Add `radarEnabled: boolean` to `UserSettings`.

**`src/core/constants.ts`** — Set `radarEnabled: true` in `DEFAULT_SETTINGS`.

No migration needed. Missing key in storage resolves to `true` via the existing defaults-spread pattern in `background.ts`, preserving current behavior for existing users.

### 2. Content Script

**`src/content.ts`**

**Init path (line ~122):** Gate `startRadar()` on `settings.radarEnabled`:

```ts
} else if (lang === 'en' && settings.radarEnabled) {
  await startRadar();
}
```

**Storage listener (`attachStorageListener`):** Handle `radarEnabled` changes in-place (no page reload):

- **Off:** Remove all `[data-wg-radar]` marks, restore original text nodes. Disconnect mutation observer and scroll handler.
- **On (page is English):** Call `startRadar()`.

Follows the "不打断阅读流" principle — same pattern used for `paused` toggle.

### 3. Popup UI

**`src/popup/index.tsx`** — New row in the collapsible settings drawer, placed after Word Banks.

Layout:
```
┌──────────────────────────────────┐
│ 英文标注                    [ON] │
│ 浏览英文网站时，标注词库中的单词   │
└──────────────────────────────────┘
```

- Label: `t('radar.title')`
- Description: `t('radar.desc')` — one-line copy that explains the feature without needing further documentation.
- Toggle: small rectangular `ON`/`OFF` button in monospace, matching the drawer's existing visual style. Not the 3D flip toggle (reserved for global ON/OFF).
- Click calls `updateSetting({ radarEnabled: !settings.radarEnabled })`.

### 4. i18n

**`src/core/i18n.ts`** — Two new keys:

| Key | zh | en |
|-----|----|----|
| `radar.title` | 英文标注 | English Annotation |
| `radar.desc` | 浏览英文网站时，标注词库中的单词 | Annotate word-bank words on English pages |

### 5. Testing

Existing tests pass unchanged — `radarEnabled` defaults to `true`, so no behavioral regression. No new test file required; the toggle is a thin settings wire.

## Out of Scope

- Radar Mode visual customization (underline colors, status styles)
- Per-site radar enable/disable (the existing site blocklist covers this)
- Tri-state mode selector (Chinese-only / English-only / Both)
