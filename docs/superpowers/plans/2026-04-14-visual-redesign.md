# Flipword Visual Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate Flipword's visual identity from functional to refined/intellectual across all surfaces — icons, popup, content script, decode panel, and animations.

**Architecture:** Update the existing theme system with refined color tokens, redesign the popup layout in-place (no new files for popup), update CSS animations, generate new SVG-based icons, and restructure the popup tab navigation to consolidate settings under a "More" tab.

**Tech Stack:** TypeScript, Preact + htm, Chrome Extension Manifest V3, Bun build

**Spec:** `docs/superpowers/specs/2026-04-14-visual-redesign-design.md`

---

### Task 1: Extend Theme Type with New Tokens

**Files:**
- Modify: `src/core/types.ts:121-152`

- [ ] **Step 1: Add new fields to Theme interface**

In `src/core/types.ts`, update the `Theme` interface to support the new design system tokens:

```typescript
export interface Theme {
  id: ThemeId;
  name: string;
  nameCn: string;
  /** 3-letter abbreviation for compact theme selector */
  abbr: string;
  mark: ThemeMarkStyle;
  decode: {
    border: string;
    borderRadius: string;
    background: string;
    headerFont: string;
    labelStyle: string;
  };
  popup: {
    background: string;
    foreground: string;
    accent: string;
    fontFamily: string;
    /** 2px outer border color for popup container */
    outerBorder: string;
    /** Border radius for swatch preview in theme selector */
    swatchRadius: string;
  };
  cssVariables: Record<string, string>;
}
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/joejiang/Flipword && bunx tsc --noEmit`
Expected: Type errors in `themes.ts` (missing `abbr`, `outerBorder`, `swatchRadius`) — this is correct, we fix those in Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "refactor: extend Theme type with popup outer border, swatch radius, and abbreviation fields"
```

---

### Task 2: Rewrite Theme Definitions

**Files:**
- Modify: `src/core/themes.ts`

- [ ] **Step 1: Replace all theme definitions**

Replace the entire contents of `src/core/themes.ts`:

```typescript
import type { Theme } from './types.js';

export const THEMES: Record<string, Theme> = {
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    nameCn: '杂志编辑风',
    abbr: 'EDT',
    mark: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontStyle: 'italic',
      color: '#B91C1C',
      borderBottom: '1.5px solid #B91C1C',
      padding: '0 1px',
    },
    decode: {
      border: '2px solid #B91C1C',
      borderRadius: '4px',
      background: '#FAFAF7',
      headerFont: 'Georgia, serif',
      labelStyle: 'font-variant: small-caps; letter-spacing: 0.5px; color: #A8A29E; font-size: 9px;',
    },
    popup: {
      background: '#FAFAF7',
      foreground: '#1C1917',
      accent: '#B91C1C',
      fontFamily: 'Georgia, serif',
      outerBorder: '#B91C1C',
      swatchRadius: '4px',
    },
    cssVariables: {
      '--wg-bg': '#FAFAF7',
      '--wg-fg': '#1C1917',
      '--wg-accent': '#B91C1C',
      '--wg-mark-font': 'Georgia, "Times New Roman", serif',
      '--wg-mono': '"Courier New", monospace',
      '--wg-muted': '#A8A29E',
      '--wg-border': '#E7E5E4',
      '--wg-border-heavy': '#B91C1C',
      '--wg-highlight': '#DC2626',
    },
  },
  brutalist: {
    id: 'brutalist',
    name: 'Brutalist',
    nameCn: '粗野主义',
    abbr: 'BRT',
    mark: {
      fontFamily: '"SF Mono", Menlo, "Courier New", monospace',
      background: '#09090B',
      color: '#FAFAFA',
      padding: '1px 6px',
      letterSpacing: '0.5px',
    },
    decode: {
      border: '2px solid #09090B',
      borderRadius: '0',
      background: '#FFFFFF',
      headerFont: '"SF Mono", Menlo, monospace',
      labelStyle: 'text-transform: uppercase; letter-spacing: 1.5px; font-size: 9px; color: #A1A1AA; font-family: "SF Mono", Menlo, monospace;',
    },
    popup: {
      background: '#FFFFFF',
      foreground: '#09090B',
      accent: '#09090B',
      fontFamily: '"SF Mono", Menlo, monospace',
      outerBorder: '#09090B',
      swatchRadius: '0',
    },
    cssVariables: {
      '--wg-bg': '#FFFFFF',
      '--wg-fg': '#09090B',
      '--wg-accent': '#09090B',
      '--wg-mark-font': '"SF Mono", Menlo, "Courier New", monospace',
      '--wg-mono': '"SF Mono", Menlo, "Courier New", monospace',
      '--wg-muted': '#71717A',
      '--wg-border': '#E4E4E7',
      '--wg-border-heavy': '#09090B',
      '--wg-highlight': '#DC2626',
    },
  },
  soft: {
    id: 'soft',
    name: 'Soft',
    nameCn: '柔和彩蛋风',
    abbr: 'SFT',
    mark: {
      background: 'linear-gradient(120deg, #EDE9FE, #FCE7F3)',
      color: '#6D28D9',
      borderRadius: '12px',
      padding: '2px 8px',
      fontWeight: '600',
    },
    decode: {
      border: '2px solid #6D28D9',
      borderRadius: '16px',
      background: '#FDFBFF',
      headerFont: '-apple-system, "Helvetica Neue", sans-serif',
      labelStyle: 'font-weight: 600; letter-spacing: 0.5px; color: #9CA3AF; font-size: 9px;',
    },
    popup: {
      background: 'linear-gradient(145deg, #FAF8FF, #FDF8FC)',
      foreground: '#1E1B2E',
      accent: '#6D28D9',
      fontFamily: '-apple-system, "Helvetica Neue", sans-serif',
      outerBorder: '#6D28D9',
      swatchRadius: '10px',
    },
    cssVariables: {
      '--wg-bg': '#FDFBFF',
      '--wg-fg': '#1E1B2E',
      '--wg-accent': '#6D28D9',
      '--wg-mark-font': 'inherit',
      '--wg-mono': '"SF Mono", Menlo, monospace',
      '--wg-muted': '#9CA3AF',
      '--wg-border': '#E9E5F5',
      '--wg-border-heavy': '#6D28D9',
      '--wg-highlight': '#DC2626',
    },
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    nameCn: '精确克制风',
    abbr: 'MIN',
    mark: {
      color: '#0071E3',
      borderBottom: '1.5px solid #0071E3',
      padding: '0 0 0.5px 0',
    },
    decode: {
      border: '2px solid #0071E3',
      borderRadius: '8px',
      background: '#FFFFFF',
      headerFont: '-apple-system, "SF Pro Text", sans-serif',
      labelStyle: 'letter-spacing: 0.3px; font-size: 10px; color: #86868B;',
    },
    popup: {
      background: '#FFFFFF',
      foreground: '#1D1D1F',
      accent: '#0071E3',
      fontFamily: '-apple-system, "SF Pro Text", sans-serif',
      outerBorder: '#0071E3',
      swatchRadius: '6px',
    },
    cssVariables: {
      '--wg-bg': '#FFFFFF',
      '--wg-fg': '#1D1D1F',
      '--wg-accent': '#0071E3',
      '--wg-mark-font': 'inherit',
      '--wg-mono': '"SF Mono", Menlo, monospace',
      '--wg-muted': '#86868B',
      '--wg-border': '#E8E8ED',
      '--wg-border-heavy': '#0071E3',
      '--wg-highlight': '#DC2626',
    },
  },
};

export function getTheme(id: string): Theme {
  return THEMES[id] ?? THEMES.brutalist;
}

export function generateThemeCSS(theme: Theme): string {
  return Object.entries(theme.cssVariables)
    .map(([key, val]) => `${key}: ${val};`)
    .join('\n  ');
}
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/joejiang/Flipword && bunx tsc --noEmit`
Expected: PASS (all new fields present)

- [ ] **Step 3: Commit**

```bash
git add src/core/themes.ts
git commit -m "style: refine all 4 theme palettes — deeper accents, consistent tokens, add border-heavy/highlight"
```

---

### Task 3: Generate New Extension Icons

**Files:**
- Create: `icons/icon.svg` (source)
- Replace: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

- [ ] **Step 1: Create SVG source icon**

Create `icons/icon.svg` — the master vector source for the Lens/Focus "W" icon:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="#FFFFFF"/>
  <circle cx="56" cy="56" r="32" stroke="#09090B" stroke-width="5" fill="none"/>
  <text x="56" y="68" text-anchor="middle" font-family="Georgia, serif" font-size="40" font-weight="700" fill="#09090B">W</text>
  <line x1="78" y1="78" x2="104" y2="104" stroke="#B91C1C" stroke-width="5" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: Generate PNG icons at all sizes using a build script**

Create a small script to convert SVG to PNG. Since we use Bun, we can use a canvas-based approach. Add this to `scripts/generate-icons.ts`:

```typescript
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// Icon SVGs at each size with adjusted stroke weights for legibility
const sizes: Array<{ size: number; strokeCircle: number; strokeHandle: number; fontSize: number; cx: number; cy: number; r: number; textY: number; handleX1: number; handleY1: number; handleX2: number; handleY2: number }> = [
  { size: 128, strokeCircle: 5, strokeHandle: 5, fontSize: 40, cx: 56, cy: 56, r: 32, textY: 68, handleX1: 78, handleY1: 78, handleX2: 104, handleY2: 104 },
  { size: 48, strokeCircle: 4, strokeHandle: 4, fontSize: 30, cx: 21, cy: 21, r: 12, textY: 27, handleX1: 29, handleY1: 29, handleX2: 39, handleY2: 39 },
  { size: 16, strokeCircle: 2.5, strokeHandle: 2.5, fontSize: 10, cx: 7, cy: 7, r: 4, textY: 9.5, handleX1: 10, handleY1: 10, handleX2: 13, handleY2: 13 },
];

for (const s of sizes) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s.size}" height="${s.size}" viewBox="0 0 ${s.size} ${s.size}">
  <rect width="${s.size}" height="${s.size}" fill="#FFFFFF"/>
  <circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" stroke="#09090B" stroke-width="${s.strokeCircle}" fill="none"/>
  <text x="${s.cx}" y="${s.textY}" text-anchor="middle" font-family="Georgia, serif" font-size="${s.fontSize}" font-weight="700" fill="#09090B">W</text>
  <line x1="${s.handleX1}" y1="${s.handleY1}" x2="${s.handleX2}" y2="${s.handleY2}" stroke="#B91C1C" stroke-width="${s.strokeHandle}" stroke-linecap="round"/>
</svg>`;
  writeFileSync(`icons/icon${s.size}.svg`, svg);
  console.log(`Generated icons/icon${s.size}.svg`);
}

console.log('\nSVG files generated. Convert to PNG using:');
console.log('  For each size: open the SVG in a browser, screenshot, or use resvg/sharp/Inkscape CLI');
console.log('  Example with resvg: resvg icon128.svg icon128.png --width 128 --height 128');
```

Run: `cd /Users/joejiang/Flipword && bun scripts/generate-icons.ts`

- [ ] **Step 3: Convert SVGs to PNGs**

Use `resvg` or a browser-based method to rasterize. If `resvg-js` is available:

```bash
cd /Users/joejiang/Flipword
bunx resvg-js icons/icon128.svg icons/icon128.png -w 128 -h 128
bunx resvg-js icons/icon48.svg icons/icon48.png -w 48 -h 48
bunx resvg-js icons/icon16.svg icons/icon16.png -w 16 -h 16
```

If `resvg-js` doesn't work as a CLI, use this Bun script alternative — create `scripts/svg-to-png.ts`:

```typescript
import sharp from 'sharp';

for (const size of [16, 48, 128]) {
  await sharp(`icons/icon${size}.svg`)
    .resize(size, size)
    .png()
    .toFile(`icons/icon${size}.png`);
  console.log(`icons/icon${size}.png ✓`);
}
```

Run: `bun add -d sharp && bun scripts/svg-to-png.ts`

Verify the generated PNGs look correct by opening them.

- [ ] **Step 4: Commit**

```bash
git add icons/ scripts/generate-icons.ts
git commit -m "art: replace neon icon with Lens/Focus scholarly mark at 16/48/128px"
```

---

### Task 4: Update manifest.json with icon16

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Add icon16 references**

In `manifest.json`, add the 16px icon to both `action.default_icon` and `icons`:

```json
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
```

- [ ] **Step 2: Commit**

```bash
git add manifest.json
git commit -m "config: add icon16 to manifest default_icon and icons"
```

---

### Task 5: Update Content Script CSS

**Files:**
- Modify: `src/content.css`

- [ ] **Step 1: Replace content.css with refined animations**

Replace the full contents of `src/content.css`:

```css
/* Flipword content script styles — theme-injected via JS */

[data-wg] {
  cursor: pointer;
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}

[data-wg]:hover {
  opacity: 0.88;
  transform: translateY(-0.5px);
}

/* Cleared state */
[data-wg-cleared] {
  opacity: 0.4;
  text-decoration: line-through;
  pointer-events: none;
}

/* ── Radar Mode ─────────────────────────────────────────────── */

[data-wg-radar] {
  cursor: pointer;
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}

[data-wg-radar]:hover {
  opacity: 0.88;
  transform: translateY(-0.5px);
}

@keyframes wg-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

[data-wg-radar-new] {
  animation: wg-pulse 2s ease-in-out infinite;
}

/* ── Reduced Motion ─────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  [data-wg],
  [data-wg-radar] {
    transition: none;
  }

  [data-wg]:hover,
  [data-wg-radar]:hover {
    transform: none;
  }

  [data-wg-radar-new] {
    animation: none;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/content.css
git commit -m "style: refine content script hover/cleared animations, add reduced-motion support"
```

---

### Task 6: Update Crit CSS Effects

**Files:**
- Modify: `src/crit/css-effects.ts`

- [ ] **Step 1: Replace css-effects.ts with refined animations**

Replace the full contents of `src/crit/css-effects.ts`:

```typescript
import type { CritEvent, CritType } from './index.js';
import type { Theme } from '../core/types.js';
import { EXTENSION_PREFIX } from '../core/constants.js';

let stylesInjected = false;

function injectCritStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = `${EXTENSION_PREFIX}-crit-styles`;
  style.textContent = `
    @keyframes wg-crit-pulse {
      0% { transform: scale(1); }
      30% { transform: scale(1.12); font-weight: 800; }
      100% { transform: scale(1); }
    }
    @keyframes wg-crit-ring {
      0% { box-shadow: 0 0 0 0 var(--wg-highlight, #DC2626); }
      50% { box-shadow: 0 0 0 2px var(--wg-highlight, #DC2626); }
      100% { box-shadow: 0 0 0 0 transparent; }
    }
    @keyframes wg-combo-float {
      0% { opacity: 1; transform: translateY(0); }
      18% { opacity: 1; transform: translateY(-40px); }
      100% { opacity: 0; transform: translateY(-40px); }
    }
    @keyframes wg-cleared-fade {
      0% { opacity: 1; }
      100% { opacity: 0.4; text-decoration: line-through; }
    }
    .${EXTENSION_PREFIX}-combo-badge {
      position: fixed;
      font-family: var(--wg-mono, monospace);
      font-weight: 800;
      font-size: 28px;
      color: var(--wg-fg, #09090B);
      pointer-events: none;
      z-index: 2147483646;
      animation: wg-combo-float 0.8s ease-out forwards;
    }
    @media (prefers-reduced-motion: reduce) {
      .${EXTENSION_PREFIX}-combo-badge {
        animation: none;
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

/** Trigger a CSS crit effect for daily-tier events */
export function playCSSCrit(event: CritEvent, theme: Theme): void {
  injectCritStyles();

  switch (event.type) {
    case 'first-blood':
      playFirstBlood(event);
      break;
    case 'combo-5':
    case 'combo-10':
      playCombo(event);
      break;
    case 'cleared':
      playCleared(event);
      break;
  }
}

function playFirstBlood(event: CritEvent): void {
  const span = document.querySelector(`[data-${EXTENSION_PREFIX}="${event.wordId}"], [data-${EXTENSION_PREFIX}-radar][data-word="${event.wordId}"]`) as HTMLElement | null;
  if (!span) return;

  span.style.animation = 'wg-crit-pulse 0.3s ease-out, wg-crit-ring 0.2s ease-out';
  span.addEventListener('animationend', () => {
    span.style.animation = '';
  }, { once: true });
}

function playCombo(event: CritEvent): void {
  if (!event.position) return;

  const badge = document.createElement('div');
  badge.className = `${EXTENSION_PREFIX}-combo-badge`;
  badge.textContent = `×${event.comboCount}`;
  badge.style.left = `${event.position.x}px`;
  badge.style.top = `${event.position.y - 20}px`;

  document.documentElement.appendChild(badge);
  badge.addEventListener('animationend', () => badge.remove(), { once: true });

  // Fallback removal for reduced-motion (animation won't fire)
  setTimeout(() => badge.remove(), 1000);
}

function playCleared(event: CritEvent): void {
  const span = document.querySelector(`[data-${EXTENSION_PREFIX}="${event.wordId}"]`) as HTMLElement | null;
  if (!span) return;

  span.style.animation = 'wg-cleared-fade 0.4s ease-out forwards';
  span.setAttribute(`data-${EXTENSION_PREFIX}-cleared`, '');
}

/** Create and show floating combo counter in page corner */
export function updateComboBadge(comboCount: number): void {
  const id = `${EXTENSION_PREFIX}-combo-display`;
  let display = document.getElementById(id);

  if (comboCount === 0) {
    display?.remove();
    return;
  }

  if (!display) {
    display = document.createElement('div');
    display.id = id;
    display.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 2147483645;
      font-family: var(--wg-mono, monospace); font-weight: 800;
      font-size: 24px; color: var(--wg-fg, #09090B);
      pointer-events: none; transition: transform 150ms ease-out;
    `;
    document.documentElement.appendChild(display);
  }

  display.textContent = `×${comboCount}`;
  display.style.transform = 'scale(1.3)';
  setTimeout(() => { if (display) display.style.transform = 'scale(1)'; }, 150);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/crit/css-effects.ts
git commit -m "style: refine crit animations — shorter combo float, crit ring flash, reduced-motion fallback"
```

---

### Task 7: Redesign Decode Panel

**Files:**
- Modify: `src/decode/index.ts`

- [ ] **Step 1: Replace decode panel with redesigned layout**

Replace the full contents of `src/decode/index.ts`:

```typescript
import { html } from 'htm/preact';
import { render } from 'preact';
import type { WordEntry, Theme } from '../core/types.js';
import { EXTENSION_PREFIX } from '../core/constants.js';
import { sendMessage } from '../core/messages.js';

let panelRoot: HTMLDivElement | null = null;

export function showDecodePanel(entry: WordEntry, context: string, theme: Theme): void {
  hideDecodePanel();

  panelRoot = document.createElement('div');
  panelRoot.id = `${EXTENSION_PREFIX}-decode`;
  panelRoot.style.cssText = `
    position: fixed; z-index: 2147483647;
    top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.98);
    width: 380px; max-height: 80vh; overflow-y: auto;
    border: ${theme.decode.border};
    border-radius: ${theme.decode.borderRadius};
    background: ${theme.decode.background};
    font-family: -apple-system, "Helvetica Neue", sans-serif;
    font-size: 14px; color: var(--wg-fg, #333);
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    opacity: 0;
    transition: opacity 200ms ease-out, transform 200ms ease-out;
  `;

  const overlay = document.createElement('div');
  overlay.id = `${EXTENSION_PREFIX}-overlay`;
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483646;
    background: rgba(0,0,0,0.15);
    opacity: 0;
    transition: opacity 200ms ease-out;
  `;
  overlay.addEventListener('click', hideDecodePanel);

  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(panelRoot);

  // Trigger enter animation
  requestAnimationFrame(() => {
    if (overlay) overlay.style.opacity = '1';
    if (panelRoot) {
      panelRoot.style.opacity = '1';
      panelRoot.style.transform = 'translate(-50%, -50%) scale(1)';
    }
  });

  render(html`<${DecodeContent}
    entry=${entry}
    context=${context}
    theme=${theme}
    onClear=${() => handleClear(entry.id)}
    onReview=${() => handleReview(entry.id)}
    onClose=${hideDecodePanel}
  />`, panelRoot);

  sendMessage({ type: 'RECORD_CLICK', wordId: entry.id }).catch(() => {});
}

export function hideDecodePanel(): void {
  const overlay = document.getElementById(`${EXTENSION_PREFIX}-overlay`);
  const panel = document.getElementById(`${EXTENSION_PREFIX}-decode`);

  if (overlay) overlay.style.opacity = '0';
  if (panel) {
    panel.style.opacity = '0';
    panel.style.transform = 'translate(-50%, -50%) scale(0.98)';
  }

  // Remove after exit animation
  setTimeout(() => {
    overlay?.remove();
    panel?.remove();
    panelRoot = null;
  }, 120);
}

function DecodeContent({ entry, context, theme, onClear, onReview, onClose }: {
  entry: WordEntry;
  context: string;
  theme: Theme;
  onClear: () => void;
  onReview: () => void;
  onClose: () => void;
}) {
  const labelStyle = theme.decode.labelStyle;
  const mono = 'font-family: var(--wg-mono, monospace);';

  return html`
    <div style="position: relative;">
      <!-- Close button -->
      <button onClick=${onClose} style="
        position: absolute; top: 14px; right: 14px;
        width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
        background: none; border: none; cursor: pointer;
        font-size: 16px; color: var(--wg-muted, #A1A1AA); line-height: 1;
      ">×</button>

      <!-- Header -->
      <div style="padding: 20px 24px 16px; border-bottom: 1px solid var(--wg-border, #E4E4E7);">
        <div style="font-family: ${theme.decode.headerFont}; font-size: 22px; font-weight: 700; color: var(--wg-fg); letter-spacing: -0.3px;">
          ${entry.word}
        </div>
        <div style="font-size: 12px; color: var(--wg-muted, #A1A1AA); margin-top: 4px; ${mono}">
          ${entry.phonetic}
        </div>
        <div style="margin-top: 10px;">
          ${entry.meanings.map(m => html`
            <div style="font-size: 13px; color: var(--wg-fg); opacity: 0.8; line-height: 1.6;">
              <span style="font-size: 11px; color: var(--wg-muted, #A1A1AA); ${mono} margin-right: 6px;">${m.partOfSpeech}</span>
              ${m.definitionCn}
            </div>
          `)}
        </div>
      </div>

      <!-- Morphology -->
      ${entry.morphology && html`
        <div style="padding: 14px 24px; border-bottom: 1px solid var(--wg-border, #E4E4E7);">
          <div style="${labelStyle}">DECODE</div>
          <div style="${mono} font-size: 12px; margin-top: 8px; line-height: 2; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
            ${entry.morphology.prefix?.map((p, i) => html`
              ${i > 0 && html`<span style="color: var(--wg-border); margin: 0 2px;">·</span>`}
              <span style="background: var(--wg-accent); color: #fff; padding: 2px 6px;">${p.part}-</span>
              <span style="color: var(--wg-muted); font-size: 11px;">${p.meaning}</span>
            `)}
            ${entry.morphology.prefix && entry.morphology.prefix.length > 0 && html`<span style="color: var(--wg-border); margin: 0 2px;">·</span>`}
            <span style="background: var(--wg-accent); color: #fff; padding: 2px 6px;">${entry.morphology.root.part}</span>
            <span style="color: var(--wg-muted); font-size: 11px;">${entry.morphology.root.meaning}</span>
            ${entry.morphology.suffix?.map(s => html`
              <span style="color: var(--wg-border); margin: 0 2px;">·</span>
              <span style="background: var(--wg-accent); color: #fff; padding: 2px 6px;">-${s.part}</span>
              <span style="color: var(--wg-muted); font-size: 11px;">${s.meaning}</span>
            `)}
          </div>
          <div style="font-size: 12px; color: var(--wg-fg); opacity: 0.7; margin-top: 8px; padding-left: 2px;">→ ${entry.morphology.mnemonic}</div>
        </div>
      `}

      <!-- Etymology -->
      ${entry.etymology && html`
        <div style="padding: 14px 24px; border-bottom: 1px solid var(--wg-border, #E4E4E7);">
          <div style="${labelStyle}">ORIGIN</div>
          <div style="font-size: 13px; color: var(--wg-fg); opacity: 0.8; margin-top: 8px; line-height: 1.7;">
            ${entry.etymology.origin} ${entry.etymology.originalMeaning ? html`"${entry.etymology.originalMeaning}"` : ''}
          </div>
          ${entry.etymology.entryPeriod && html`
            <div style="font-size: 12px; color: var(--wg-muted); margin-top: 4px;">
              ${entry.etymology.entryPeriod} · ${entry.etymology.story}
            </div>
          `}
          ${!entry.etymology.entryPeriod && entry.etymology.story && html`
            <div style="font-size: 12px; color: var(--wg-muted); margin-top: 4px;">
              ${entry.etymology.story}
            </div>
          `}
        </div>
      `}

      <!-- Native Feel -->
      ${entry.nativeFeel && html`
        <div style="padding: 14px 24px; border-bottom: 1px solid var(--wg-border, #E4E4E7);">
          <div style="${labelStyle}">NATIVE FEEL</div>
          <div style="font-size: 13px; color: var(--wg-fg); opacity: 0.8; margin-top: 8px; line-height: 1.7;">
            ${entry.nativeFeel.formality} · ${entry.nativeFeel.sentiment}
            ${entry.nativeFeel.usageScenes.length > 0 && html`
              <span> · 常见于${entry.nativeFeel.usageScenes.join('/')}</span>
            `}
          </div>
          ${entry.nativeFeel.synonyms.length > 0 && html`
            <div style="font-size: 12px; color: var(--wg-muted); margin-top: 4px;">
              近义词: ${entry.nativeFeel.synonyms.join(', ')}
            </div>
          `}
          ${entry.nativeFeel.confusables && entry.nativeFeel.confusables.length > 0 && html`
            <div style="font-size: 12px; color: var(--wg-muted); margin-top: 2px;">
              易混: ${entry.nativeFeel.confusables.join(', ')}
            </div>
          `}
          ${entry.nativeFeel.notes && html`
            <div style="font-size: 12px; color: var(--wg-muted); margin-top: 2px;">
              ${entry.nativeFeel.notes}
            </div>
          `}
        </div>
      `}

      <!-- Context -->
      <div style="padding: 14px 24px; border-bottom: 1px solid var(--wg-border, #E4E4E7);">
        <div style="${labelStyle}">CONTEXT</div>
        <div style="font-size: 13px; color: var(--wg-fg); opacity: 0.8; margin-top: 8px; line-height: 1.6; border-left: 2px solid var(--wg-fg); padding-left: 12px;">
          "${context}"
        </div>
      </div>

      <!-- Actions -->
      <div style="padding: 14px 24px; display: flex; gap: 8px;">
        <button onClick=${onClear} style="
          flex: 1; padding: 9px; text-align: center; cursor: pointer;
          background: var(--wg-fg, #09090B); color: var(--wg-bg, #fff); border: none;
          font-size: 12px; font-weight: 600; letter-spacing: 0.5px;
          ${mono} text-transform: uppercase;
        ">CLEARED</button>
        <button onClick=${onReview} style="
          flex: 1; padding: 9px; text-align: center; cursor: pointer;
          background: none; border: 1.5px solid var(--wg-fg, #09090B);
          color: var(--wg-fg, #09090B);
          font-size: 12px; font-weight: 600; letter-spacing: 0.5px;
          ${mono} text-transform: uppercase;
        ">RE-GLITCH</button>
      </div>
    </div>
  `;
}

async function handleClear(wordId: string): Promise<void> {
  await sendMessage({ type: 'MARK_CLEARED', wordId }).catch(() => {});
  hideDecodePanel();
}

async function handleReview(wordId: string): Promise<void> {
  await sendMessage({ type: 'MARK_REVIEW', wordId }).catch(() => {});
  hideDecodePanel();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/decode/index.ts
git commit -m "style: redesign decode panel — refined spacing, dot-separated morphology, context border accent, enter/exit animation"
```

---

### Task 8: Redesign Popup Main Layout

**Files:**
- Modify: `src/popup/index.tsx`

- [ ] **Step 1: Replace popup main component**

Replace the full contents of `src/popup/index.tsx`:

```tsx
import { html } from 'htm/preact';
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { sendMessage } from '../core/messages.js';
import { THEMES } from '../core/themes.js';
import { LEVEL_CONFIGS } from '../core/constants.js';
import { CustomBank } from './custom-bank.js';
import { Stats } from './stats.js';
import { MoreTab } from './more.js';
import type { UserSettings, InvasionLevel } from '../core/types.js';

type PopupTab = 'main' | 'custom' | 'stats' | 'more';

function Popup() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [stats, setStats] = useState({ today: 0, total: 0, cleared: 0, bestCombo: 0 });
  const [activeTab, setActiveTab] = useState<PopupTab>('main');

  useEffect(() => {
    sendMessage({ type: 'GET_SETTINGS' }).then(setSettings).catch(() => {});
    sendMessage({ type: 'GET_STATS' }).then(setStats).catch(() => {});
  }, []);

  if (!settings) return html`<div style="padding: 40px; text-align: center; color: var(--wg-muted, #A1A1AA); font-size: 12px;">Loading...</div>`;

  const theme = THEMES[settings.theme];
  const levelConfig = LEVEL_CONFIGS[settings.invasionLevel];

  async function updateSetting(partial: Partial<UserSettings>) {
    const updated = await sendMessage({ type: 'SAVE_SETTINGS', settings: partial });
    setSettings(updated);
  }

  const tabStyle = (active: boolean) => `
    flex: 1; padding: 10px 4px; text-align: center; cursor: pointer;
    font-family: var(--wg-mono, monospace); font-size: 9px; letter-spacing: 1.5px;
    border: none; text-transform: uppercase; transition: color 150ms ease-out;
    ${active
      ? `background: ${theme.popup.background}; color: ${theme.popup.foreground}; font-weight: 700; border-bottom: 2px solid ${theme.popup.foreground};`
      : `background: #FAFAFA; color: var(--wg-muted, #A1A1AA); border-bottom: 1px solid var(--wg-border, #E4E4E7);`
    }
  `;

  const activeBankName = settings.wordBanks[0]?.toUpperCase() ?? 'NONE';

  return html`
    <div style="
      background: ${theme.popup.background};
      color: ${theme.popup.foreground};
      font-family: ${theme.popup.fontFamily};
      min-height: 400px;
      border: 2px solid ${theme.popup.outerBorder};
    ">
      <!-- Header -->
      <div style="padding: 16px 20px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid ${theme.popup.outerBorder};">
        <div>
          <div style="font-size: 15px; font-weight: 700; letter-spacing: -0.3px;">${'Flipword'}</div>
          <div style="font-size: 9px; color: var(--wg-muted, #A1A1AA); letter-spacing: 1.5px; margin-top: 3px;">
            ${settings.paused ? 'PAUSED' : 'ACTIVE'} · L${settings.invasionLevel} · ${activeBankName}
          </div>
        </div>
        <button
          onClick=${() => updateSetting({ paused: !settings.paused })}
          style="
            width: 32px; height: 32px; border-radius: ${theme.popup.swatchRadius};
            border: 1.5px solid var(--wg-border, #E4E4E7); background: none;
            display: flex; align-items: center; justify-content: center; cursor: pointer;
            transition: border-color 150ms ease-out;
          "
          title=${settings.paused ? 'Resume' : 'Pause'}
        >
          ${settings.paused
            ? html`<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polygon points="2,1 11,6 2,11" fill="${theme.popup.foreground}"/></svg>`
            : html`<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="1.5" width="3" height="9" rx="0.5" fill="${theme.popup.foreground}"/><rect x="7" y="1.5" width="3" height="9" rx="0.5" fill="${theme.popup.foreground}"/></svg>`
          }
        </button>
      </div>

      <!-- Tabs -->
      <div style="display: flex;">
        ${(['main', 'custom', 'stats', 'more'] as PopupTab[]).map(tab => html`
          <button key=${tab} onClick=${() => setActiveTab(tab)} style=${tabStyle(activeTab === tab)}>
            ${tab.toUpperCase()}
          </button>
        `)}
      </div>

      <!-- Tab Content -->
      ${activeTab === 'main' ? html`
        <!-- Stats Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr;">
          <${StatCard} label="TODAY" value=${stats.today} border="right bottom" />
          <${StatCard} label="TOTAL" value=${stats.total} border="bottom" />
          <${StatCard} label="CLEARED" value=${stats.cleared} border="right bottom" />
          <${StatCard} label="BEST COMBO" value=${'×' + stats.bestCombo} border="bottom" />
        </div>

        <!-- Level Selector -->
        <div style="padding: 14px 20px; border-bottom: 1px solid var(--wg-border, #E4E4E7);">
          <div style="font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 10px; font-family: var(--wg-mono, monospace);">
            Invasion Level
          </div>
          <div style="display: flex; gap: 6px;">
            ${([1,2,3,4] as InvasionLevel[]).map(level => html`
              <button
                key=${level}
                onClick=${() => updateSetting({ invasionLevel: level })}
                style="
                  flex: 1; padding: 7px; text-align: center; cursor: pointer;
                  font-family: var(--wg-mono, monospace); font-size: 10px; border: none;
                  transition: background 150ms ease-out;
                  ${settings.invasionLevel === level
                    ? `background: ${theme.popup.foreground}; color: ${theme.popup.background === 'linear-gradient(145deg, #FAF8FF, #FDF8FC)' ? '#fff' : theme.popup.background}; font-weight: 600;`
                    : `background: none; border: 1px solid var(--wg-border, #E4E4E7); color: var(--wg-muted, #A1A1AA);`
                  }
                  ${level === 4 ? 'opacity: 0.4;' : ''}
                "
              >L${level}</button>
            `)}
          </div>
          <div style="font-size: 9px; color: var(--wg-muted, #A1A1AA); margin-top: 6px; font-family: var(--wg-mono, monospace);">
            ${levelConfig.minWords}–${levelConfig.maxWords} words per page
          </div>
        </div>

        <!-- Theme Selector -->
        <div style="padding: 14px 20px; border-bottom: 1px solid var(--wg-border, #E4E4E7);">
          <div style="font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 10px; font-family: var(--wg-mono, monospace);">
            Theme
          </div>
          <div style="display: flex; gap: 8px;">
            ${Object.values(THEMES).map(t => html`
              <div
                key=${t.id}
                onClick=${() => updateSetting({ theme: t.id })}
                style="display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; ${settings.theme !== t.id ? 'opacity: 0.6;' : ''} transition: opacity 150ms ease-out;"
              >
                <div style="
                  width: 28px; height: 28px;
                  border-radius: ${t.popup.swatchRadius};
                  background: ${t.id === 'brutalist' ? '#09090B' : t.id === 'soft' ? 'linear-gradient(135deg,#FAF8FF,#FDF8FC)' : t.popup.background};
                  border: ${settings.theme === t.id ? `2px solid ${t.popup.outerBorder}` : `1.5px solid ${t.id === 'brutalist' ? '#09090B' : t.popup.outerBorder}`};
                "></div>
                <div style="font-size: 8px; font-family: var(--wg-mono, monospace); color: ${settings.theme === t.id ? theme.popup.foreground : 'var(--wg-muted, #A1A1AA)'}; font-weight: ${settings.theme === t.id ? '600' : '400'};">
                  ${t.abbr}
                </div>
              </div>
            `)}
          </div>
        </div>

        <!-- Word Bank Selector -->
        <div style="padding: 14px 20px; border-bottom: 1px solid var(--wg-border, #E4E4E7);">
          <div style="font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 10px; font-family: var(--wg-mono, monospace);">
            Word Bank
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${['ielts', 'toefl', 'gre', 'business', 'academic'].map(bank => {
              const isActive = settings.wordBanks.includes(bank);
              return html`
                <button
                  key=${bank}
                  onClick=${() => {
                    const banks = isActive
                      ? settings.wordBanks.filter(b => b !== bank)
                      : [...settings.wordBanks, bank];
                    if (banks.length > 0) updateSetting({ wordBanks: banks });
                  }}
                  style="
                    padding: 5px 10px; font-size: 10px; cursor: pointer; border: none;
                    font-family: var(--wg-mono, monospace); text-transform: uppercase;
                    transition: background 150ms ease-out;
                    ${isActive
                      ? `background: ${theme.popup.foreground}; color: ${theme.popup.background === 'linear-gradient(145deg, #FAF8FF, #FDF8FC)' ? '#fff' : theme.popup.background}; font-weight: 600;`
                      : `background: none; border: 1px solid var(--wg-border, #E4E4E7); color: var(--wg-muted, #A1A1AA);`
                    }
                  "
                >${bank === 'business' ? 'BIZ' : bank === 'academic' ? 'ACAD' : bank.toUpperCase()}</button>
              `;
            })}
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 10px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 9px; color: var(--wg-muted, #A1A1AA); letter-spacing: 0.5px; font-family: var(--wg-mono, monospace);">v0.1.0</div>
          <div style="font-size: 9px; color: var(--wg-muted, #A1A1AA); letter-spacing: 0.5px; font-family: var(--wg-mono, monospace);">
            ${activeBankName} · ${settings.wordBanks.length > 1 ? `${settings.wordBanks.length} banks` : ''}
          </div>
        </div>
      `
      : activeTab === 'custom' ? html`<${CustomBank} />`
      : activeTab === 'stats' ? html`<${Stats} />`
      : html`<${MoreTab} />`
      }
    </div>
  `;
}

function StatCard({ label, value, border }: {
  label: string; value: string | number; border?: string;
}) {
  const borders = (border ?? '').split(' ');
  const borderStyle = [
    borders.includes('right') && 'border-right: 1px solid var(--wg-border, #E4E4E7)',
    borders.includes('bottom') && 'border-bottom: 1px solid var(--wg-border, #E4E4E7)',
    borders.includes('top') && 'border-top: 1px solid var(--wg-border, #E4E4E7)',
  ].filter(Boolean).join('; ');

  return html`
    <div style="padding: 14px 20px; ${borderStyle}">
      <div style="font-family: var(--wg-mono, monospace); font-size: 26px; font-weight: 700; letter-spacing: -0.5px; line-height: 1;">${value}</div>
      <div style="font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-top: 6px; font-family: var(--wg-mono, monospace);">
        ${label}
      </div>
    </div>
  `;
}

render(html`<${Popup} />`, document.getElementById('app')!);
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/joejiang/Flipword && bunx tsc --noEmit`
Expected: Error about missing `./more.js` module — this is correct, we create it in Task 10.

- [ ] **Step 3: Commit**

```bash
git add src/popup/index.tsx
git commit -m "style: redesign popup — header with pause icon, visual theme swatches, word bank chips, level helper text"
```

---

### Task 9: Update Popup Sub-Components (Stats, CustomBank)

**Files:**
- Modify: `src/popup/stats.tsx`
- Modify: `src/popup/custom-bank.tsx`

- [ ] **Step 1: Update stats.tsx color tokens**

In `src/popup/stats.tsx`, update the `STATUS_COLORS` to use more refined values and update the section label style:

Replace:
```typescript
const STATUS_COLORS: Record<WordStatus, string> = {
  new: '#ccc',
  seen: '#93c5fd',
  learning: '#6ee7b7',
  reviewing: '#fcd34d',
  mastered: '#34d399',
};
```

With:
```typescript
const STATUS_COLORS: Record<WordStatus, string> = {
  new: '#D4D4D8',
  seen: '#93C5FD',
  learning: '#6EE7B7',
  reviewing: '#FCD34D',
  mastered: '#34D399',
};
```

And replace the `sectionLabel` variable:
```typescript
  const sectionLabel = `
    font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA);
    text-transform: uppercase; margin-bottom: 10px; font-family: var(--wg-mono, monospace);
  `;
```

Also update the streak card border from `1.5px` to `1px`:
Replace `border: 1.5px solid var(--wg-border, #eee);` with `border: 1px solid var(--wg-border, #E4E4E7);`

And update the weekly chart bar height from `14px` to `12px` for a more refined look:
Replace `height: 14px;` (the bar track) with `height: 12px;`

- [ ] **Step 2: Update custom-bank.tsx border tokens**

In `src/popup/custom-bank.tsx`, update the section label to match:

Replace the section label div at the top of the component:
```
font-size: 10px; letter-spacing: 1.5px; color: var(--wg-muted, #999); text-transform: uppercase; margin-bottom: 12px;
```
With:
```
font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 12px; font-family: var(--wg-mono, monospace);
```

Update the `inputStyle` border color fallback from `#ddd` to `#E4E4E7`:
```typescript
  const inputStyle = `
    flex: 1; padding: 7px 10px;
    background: var(--wg-input-bg, #f5f5f5);
    border: 1.5px solid var(--wg-border, #E4E4E7);
    font-size: 12px; color: inherit;
    font-family: inherit; outline: none;
  `;
```

Update the word list border from `#eee` to the token:
Replace `border: 1px solid var(--wg-border, #eee);` with `border: 1px solid var(--wg-border, #E4E4E7);`
Replace `border-bottom: 1px solid var(--wg-border, #eee);` with `border-bottom: 1px solid var(--wg-border, #E4E4E7);`

- [ ] **Step 3: Commit**

```bash
git add src/popup/stats.tsx src/popup/custom-bank.tsx
git commit -m "style: update stats and custom-bank to refined tokens — consistent label style, border colors"
```

---

### Task 10: Create "More" Tab (Consolidated Settings)

**Files:**
- Create: `src/popup/more.tsx`
- Modify: `src/popup/community.tsx` (minor token updates)
- Modify: `src/popup/llm-settings.tsx` (minor token updates)
- Modify: `src/popup/audio-settings.tsx` (minor token updates)
- Modify: `src/popup/export.tsx` (minor token updates)

- [ ] **Step 1: Create the MoreTab accordion component**

Create `src/popup/more.tsx`:

```tsx
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Community } from './community.js';
import { LLMSettings } from './llm-settings.js';
import { AudioSettings } from './audio-settings.js';
import { DataExport } from './export.js';

type Section = 'community' | 'llm' | 'audio' | 'export' | null;

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'community', label: 'COMMUNITY WORD BANKS' },
  { id: 'llm', label: 'LLM DISAMBIGUATION' },
  { id: 'audio', label: 'SOUND EFFECTS' },
  { id: 'export', label: 'DATA EXPORT' },
];

export function MoreTab() {
  const [open, setOpen] = useState<Section>(null);

  return html`
    <div>
      ${SECTIONS.map(section => html`
        <div key=${section.id}>
          <button
            onClick=${() => setOpen(open === section.id ? null : section.id)}
            style="
              width: 100%; padding: 12px 20px; text-align: left; cursor: pointer;
              background: none; border: none;
              border-bottom: 1px solid var(--wg-border, #E4E4E7);
              font-family: var(--wg-mono, monospace); font-size: 9px;
              letter-spacing: 1.5px; color: ${open === section.id ? 'var(--wg-fg, #09090B)' : 'var(--wg-muted, #A1A1AA)'};
              font-weight: ${open === section.id ? '700' : '400'};
              display: flex; justify-content: space-between; align-items: center;
              transition: color 150ms ease-out;
            "
          >
            <span>${section.label}</span>
            <span style="font-size: 11px; transform: ${open === section.id ? 'rotate(90deg)' : 'rotate(0)'}; transition: transform 150ms ease-out;">›</span>
          </button>
          ${open === section.id && html`
            <div>
              ${section.id === 'community' && html`<${Community} />`}
              ${section.id === 'llm' && html`<${LLMSettings} />`}
              ${section.id === 'audio' && html`<${AudioSettings} />`}
              ${section.id === 'export' && html`<${DataExport} />`}
            </div>
          `}
        </div>
      `)}
    </div>
  `;
}
```

- [ ] **Step 2: Update sub-component border token fallbacks**

In `src/popup/community.tsx`, update section label style:
Replace `font-size: 10px; letter-spacing: 1.5px; color: var(--wg-muted, #999); text-transform: uppercase; margin-bottom: 12px;`
With: `font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 12px; font-family: var(--wg-mono, monospace);`

Update the import label border from `#ddd` to `#E4E4E7`:
Replace `border: 1.5px dashed var(--wg-border, #ddd);` with `border: 1.5px dashed var(--wg-border, #E4E4E7);`

In `src/popup/llm-settings.tsx`, update section label:
Replace `font-size: 10px; letter-spacing: 1.5px; color: var(--wg-muted, #999); text-transform: uppercase; margin-bottom: 10px;`
With: `font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 10px; font-family: var(--wg-mono, monospace);`

Update input borders from `#ddd` to `#E4E4E7`:
Replace all `border: 1.5px solid var(--wg-border, #ddd);` with `border: 1.5px solid var(--wg-border, #E4E4E7);`

Update the privacy warning color from `#c44` to `var(--wg-highlight, #DC2626)`:
Replace `color: #c44;` with `color: var(--wg-highlight, #DC2626);`

In `src/popup/audio-settings.tsx`, update section label:
Replace `font-size: 10px; letter-spacing: 1.5px; color: var(--wg-muted, #999); text-transform: uppercase; margin-bottom: 10px;`
With: `font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 10px; font-family: var(--wg-mono, monospace);`

In `src/popup/export.tsx`, update section label:
Replace `font-size: 10px; letter-spacing: 1.5px; color: var(--wg-muted, #999); text-transform: uppercase; margin-bottom: 12px;`
With: `font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 12px; font-family: var(--wg-mono, monospace);`

- [ ] **Step 3: Run type check**

Run: `cd /Users/joejiang/Flipword && bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/popup/more.tsx src/popup/community.tsx src/popup/llm-settings.tsx src/popup/audio-settings.tsx src/popup/export.tsx
git commit -m "feat: add More tab with accordion layout, update all sub-components to refined tokens"
```

---

### Task 11: Build and Visual Verification

**Files:** None (verification only)

- [ ] **Step 1: Build the extension**

Run: `cd /Users/joejiang/Flipword && bun run build`
Expected: `Build complete → dist/` with no errors.

- [ ] **Step 2: Run type check**

Run: `cd /Users/joejiang/Flipword && bunx tsc --noEmit`
Expected: PASS with no errors.

- [ ] **Step 3: Verify dist output**

Run: `ls -la /Users/joejiang/Flipword/dist/icons/`
Expected: `icon16.png`, `icon48.png`, `icon128.png` — all with the new Lens/Focus design.

Run: `ls -la /Users/joejiang/Flipword/dist/`
Expected: `manifest.json`, `popup.html`, `popup.js`, `content.js`, `content.css`, `background.js`, `data/`, `icons/`

- [ ] **Step 4: Verify manifest has icon16**

Run: `grep icon16 /Users/joejiang/Flipword/dist/manifest.json`
Expected: Two matches — one in `default_icon` and one in `icons`.

- [ ] **Step 5: Load in Chrome and verify**

Manual verification checklist:
1. Open `chrome://extensions/`, enable Developer mode
2. "Load unpacked" → select `dist/` folder
3. Verify toolbar icon shows the Lens/Focus "W" (not neon)
4. Click extension icon → popup opens with Brutalist theme
5. Verify: 2px black outer border, refined spacing, theme swatches, word bank chips
6. Switch theme to Editorial → verify cream bg + crimson accent + serif font
7. Switch theme to Soft → verify lavender gradient + violet accent + rounded corners
8. Switch theme to Minimal → verify white bg + blue accent + clean sans-serif
9. Navigate to CUSTOM tab → verify refined input styling
10. Navigate to STATS tab → verify chart bars and labels use refined tokens
11. Navigate to MORE tab → verify accordion sections expand/collapse
12. Visit a Chinese web page → verify word marks appear with correct theme styling
13. Click a word → verify decode panel appears with enter animation, refined layout
14. Close decode panel → verify smooth exit animation
