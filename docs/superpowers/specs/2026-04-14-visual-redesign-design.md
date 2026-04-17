# Flipword Visual Redesign — Design Spec

**Date:** 2026-04-14
**Status:** Approved
**Direction:** Refined & Intellectual, Light-first, System Fonts + Design System

## 1. Brand Identity

**Personality:** Premium reading tool for serious learners. Think Readwise, Arc Browser — clean, typographic, sophisticated. The "glitch" concept is expressed through interaction design (word replacement, morphology decoding), not through visual noise.

**Default theme:** Brutalist (unchanged).

**All 4 themes** (Editorial, Brutalist, Soft, Minimal) are retained and redesigned to share the same spacing, layout, and interaction patterns while differing in typography treatment, color palette, and border-radius.

## 2. Icon — Lens / Focus

Replace the current neon cyan/magenta "W" icon with a scholarly Lens/Focus mark.

**Concept:** Serif "W" (Georgia) inside a circular lens outline, with a crimson accent line suggesting a magnifying glass handle.

**Sizes required:**
- **128×128** — Chrome Web Store. Standard stroke weight.
- **48×48** — Extension management page. Heavier strokes for clarity.
- **16×16** — Toolbar. Heaviest strokes to remain legible.

**Design rules:**
- White background (stands out in any Chrome toolbar theme)
- Georgia serif "W" — ties to the literary identity
- Circle stroke: `#09090B`
- Handle accent: `#B91C1C` (crimson)
- Stroke weight increases proportionally at smaller sizes
- Chrome handles the container rounded-rect shape; icon is just the symbol
- Output format: SVG source → exported as PNG at each size

## 3. Design System Foundation

### 3.1 Spacing Scale (4pt grid)

| Token | Value | Use |
|-------|-------|-----|
| `xs` | 4px | Tight gaps (between tag and meaning) |
| `sm` | 8px | Standard gap (flex gaps, icon margins) |
| `md` | 12px | Section internal padding |
| `lg` | 16px | Section vertical padding |
| `xl` | 20px | Section horizontal padding |
| `2xl` | 24px | Decode panel internal padding |
| `3xl` | 32px | Large section breaks |

### 3.2 Border Radius Scale

| Token | Value | Used by |
|-------|-------|---------|
| `none` | 0 | Brutalist (all elements) |
| `sm` | 4px | Editorial (buttons, cards) |
| `md` | 6px | Minimal (buttons, inputs) |
| `lg` | 8px | Minimal (cards, decode panel) |
| `xl` | 12px | Soft (cards, buttons) |
| `2xl` | 16px | Soft (decode panel) |
| `full` | 9999px | Pill shapes (Soft word marks) |

### 3.3 Elevation Scale

| Token | Value | Use |
|-------|-------|-----|
| `flat` | none | Brutalist (all elements) |
| `subtle` | `0 1px 2px rgba(0,0,0,0.05)` | Hover lift hints |
| `card` | `0 2px 8px rgba(0,0,0,0.08)` | Cards, elevated surfaces |
| `panel` | `0 8px 24px rgba(0,0,0,0.1)` | Decode panel |
| `overlay` | `0 12px 32px rgba(0,0,0,0.12)` | Modal overlays |

### 3.4 Transition Tokens

| Token | Value | Use |
|-------|-------|-----|
| `fast` | 150ms ease-out | Hover states, toggles |
| `normal` | 200ms ease-out | Panel open, tab switch |
| `slow` | 300ms ease-out | Page transitions |
| `exit` | 120ms ease-in | Panel close, element removal |

### 3.5 Z-index Scale

| Token | Value |
|-------|-------|
| `base` | 0 |
| `raised` | 10 |
| `overlay` | 2147483646 |
| `panel` | 2147483647 |

Note: Content script z-indexes stay at max int to guarantee layering above host page.

## 4. Color System

All themes share the same base token names. Components reference tokens, not raw hex values.

**Base tokens** (all themes): `--wg-bg`, `--wg-fg`, `--wg-accent`, `--wg-muted`, `--wg-border`, `--wg-mono`
**Extended tokens** (all themes): `--wg-border-heavy` (outer/structural borders), `--wg-highlight` (crit/feedback states)

For themes without explicit extended values: `--wg-border-heavy` defaults to `--wg-accent`, `--wg-highlight` defaults to `#DC2626`.

### 4.1 Editorial

| Token | Value | Notes |
|-------|-------|-------|
| `--wg-bg` | `#FAFAF7` | Warm parchment |
| `--wg-fg` | `#1C1917` | Warm near-black |
| `--wg-accent` | `#B91C1C` | Deep crimson (was `#c44`) |
| `--wg-muted` | `#A8A29E` | Warm gray (was `#999`) |
| `--wg-border` | `#E7E5E4` | Warm light gray (was `#ddd`) |
| `--wg-mono` | (unchanged) | `"Courier New", monospace` |

### 4.2 Brutalist

| Token | Value | Notes |
|-------|-------|-------|
| `--wg-bg` | `#FFFFFF` | Pure white |
| `--wg-fg` | `#09090B` | Near-black (was `#111`) |
| `--wg-accent` | `#09090B` | Black as accent (unchanged concept) |
| `--wg-muted` | `#71717A` | Zinc gray (was `#999`) |
| `--wg-border` | `#E4E4E7` | Light zinc (structural borders stay `#09090B`) |
| `--wg-border-heavy` | `#09090B` | Outer borders, header dividers |
| `--wg-highlight` | `#DC2626` | Red for crit/feedback states only |
| `--wg-mono` | (unchanged) | `"SF Mono", Menlo, monospace` |

### 4.3 Soft

| Token | Value | Notes |
|-------|-------|-------|
| `--wg-bg` | `linear-gradient(145deg, #FAF8FF, #FDF8FC)` | Refined lavender-rose |
| `--wg-fg` | `#1E1B2E` | Deep indigo-black (was `#2d2d3a`) |
| `--wg-accent` | `#6D28D9` | Refined violet (was `#7b4fa2`) |
| `--wg-muted` | `#9CA3AF` | Neutral gray, not purple-tinted |
| `--wg-border` | `#E9E5F5` | Light lavender (was `#e8d5f5`) |
| `--wg-mono` | (unchanged) | `"SF Mono", Menlo, monospace` |

### 4.4 Minimal

| Token | Value | Notes |
|-------|-------|-------|
| `--wg-bg` | `#FFFFFF` | Pure white |
| `--wg-fg` | `#1D1D1F` | Apple near-black (unchanged) |
| `--wg-accent` | `#0071E3` | Apple blue (was `#0066CC`) |
| `--wg-muted` | `#86868B` | Apple gray (was `#aaa`) |
| `--wg-border` | `#E8E8ED` | Light gray (was `#e5e5e5`) |
| `--wg-mono` | (unchanged) | `"SF Mono", Menlo, monospace` |

## 5. Typography System

System fonts only — no bundled web fonts. Distinction comes from how fonts are used.

### 5.1 Type Scale (shared)

| Token | Size | Weight | Line-height | Use |
|-------|------|--------|-------------|-----|
| `display` | 26px | 700 | 1.0 | Stat numbers |
| `title` | 22px | 700 | 1.2 | Decode panel word heading |
| `heading` | 15px | 700 | 1.2 | Popup header title |
| `body` | 13px | 400 | 1.6 | Descriptions, paragraph text |
| `label` | 9px | 600 | 1.0 | Section labels (+ letterspacing per theme) |
| `caption` | 11px | 400 | 1.4 | Helper text, timestamps |
| `tag` | 10px | 600 | 1.0 | Level buttons, bank chips, tab labels |

### 5.2 Per-Theme Typography

**Editorial:**
- Font stack: `Georgia, "Times New Roman", serif`
- Mark style: italic, crimson color, underline border-bottom
- Labels: `font-variant: small-caps; letter-spacing: 0.5px`
- Decode header: Georgia serif

**Brutalist:**
- Font stack: `"SF Mono", Menlo, "Courier New", monospace`
- Mark style: inverted (white on black), 0.5px letterspacing
- Labels: `text-transform: uppercase; letter-spacing: 1.5px`
- Decode header: SF Mono monospace

**Soft:**
- Font stack: `-apple-system, "Helvetica Neue", sans-serif`
- Mark style: gradient background (`#EDE9FE` → `#FCE7F3`), violet color, 600 weight, pill radius
- Labels: `font-weight: 600; letter-spacing: 0.5px`
- Decode header: system sans-serif

**Minimal:**
- Font stack: `-apple-system, "SF Pro Text", sans-serif`
- Mark style: blue color, underline border-bottom, no background
- Labels: `letter-spacing: 0.3px; font-size: 10px`
- Decode header: system sans-serif

## 6. Popup Redesign

### 6.1 Layout Changes

**Header:**
- Title: 15px, weight 700, letterspacing -0.3px
- Status line: 9px, shows `ACTIVE · L{n} · {BANK_NAME}`
- Pause button: moved to header as a 32×32 icon button (replaces bottom row)
- Bottom border: 2px solid, uses `--wg-border-heavy` or `--wg-accent` per theme

**Tab navigation:**
- 4 tabs: MAIN, CUSTOM, STATS, MORE
- "Community" tab renamed to "MORE" — houses: Community (import/export), LLM Settings, Audio Settings, Data Export
- Active state: 2px bottom border in `--wg-fg`, white bg, bold weight
- Inactive: `--wg-muted` color, `#FAFAFA` bg
- Text: 9px uppercase, 1.5px letterspacing

**Stats grid:**
- Unchanged 2×2 grid
- Numbers: `display` token (26px, 700, -0.5px letterspacing)
- Labels: `label` token (9px, 1.5px letterspacing, `--wg-muted`)
- Dividers: 1px `--wg-border`

**Level selector:**
- Unchanged flex row with 4 buttons
- Active: filled `--wg-fg` bg, white text
- Inactive: 1px `--wg-border` outline
- Locked (L4): 0.4 opacity
- New: helper text below — "8–15 words per page" in `caption` style

**Theme selector:**
- Visual swatches (28×28) instead of text-only buttons
- Each swatch shows the theme's border-radius + accent color or background
- Active: full opacity, 2px border in theme's accent
- Inactive: 0.6 opacity
- 3-letter abbreviations below: BRT, EDT, SFT, MIN

**Word bank selector:**
- Promoted from settings to main tab
- Chip/tag layout with wrap
- Active: filled `--wg-fg` bg
- Inactive: 1px `--wg-border` outline

**Footer:**
- Version left, bank name + word count right
- 9px `--wg-muted`, 0.5px letterspacing

### 6.2 Outer Border

All themes use a 2px solid outer border on the popup container:
- Brutalist: `#09090B`
- Editorial: `#B91C1C`
- Soft: `#6D28D9`
- Minimal: `#0071E3`

This gives each theme a strong frame identity using its accent color.

## 7. Content Script Redesign

### 7.1 Word Marks

No structural changes — current inline span approach works well. Color/style updates per theme as defined in the color system (Section 4).

### 7.2 Decode Panel

**Outer container:**
- `border: 2px solid` using theme's heavy border or accent
- Shadow: `panel` elevation token
- Max width: 380px (unchanged)
- Centered fixed position (unchanged)

**Header section:**
- Word: `title` token (22px, 700)
- Phonetic: 12px monospace, `--wg-muted`
- Part of speech: 11px monospace, `--wg-muted`
- Definition: 13px, `--wg-fg` at 80% opacity

**Morphology (Decode) section:**
- Label: `label` token, monospace
- Layout: dot-separated flow — `[tag] meaning · [tag] meaning · ...`
- Tags: inverted (accent bg, white text), 2px 6px padding
- Meanings: `--wg-muted` color, 11px
- Mnemonic arrow: 12px, slightly darker than muted

**Context section:**
- Label: `label` token, monospace
- Content: 13px, left-border accent (2px `--wg-fg`), 12px padding-left
- Highlighted word in context: bold `--wg-fg`

**Action buttons:**
- "CLEARED" (primary): filled `--wg-fg` bg, white text
- "RE-GLITCH" (secondary): outlined, `--wg-fg` border + text
- Both: monospace, uppercase, 12px, 0.5px letterspacing
- No emoji symbols (removed ✓ and ↻)

**Overlay:** `rgba(0,0,0,0.15)` (unchanged)

### 7.3 Combo Badge

Unchanged in structure. Animation refined (see Section 8).

## 8. Interactions & Micro-animations

### 8.1 Word Mark Hover

- `opacity: 0.88` + `translateY(-0.5px)` lift
- Transition: `fast` (150ms ease-out)
- Cursor: pointer

### 8.2 Decode Panel Open

- `opacity: 0→1` + `scale(0.98→1)`
- Duration: `normal` (200ms ease-out)

### 8.3 Decode Panel Close

- `opacity: 1→0`
- Duration: `exit` (120ms ease-in)

### 8.4 Combo Badge

- Total: 0.8s
- Phase 1 (snap up): 150ms ease-out, translateY(-40px)
- Phase 2 (fade): 650ms, opacity 1→0

### 8.5 Crit Pulse

- Scale: 1 → 1.12 → 1 over 0.3s
- Font-weight: momentary increase to 800
- Brutalist-specific: `box-shadow: 0 0 0 2px #DC2626` flash for 200ms

### 8.6 Cleared Word

- Total: 0.4s
- Strikethrough animates left→right (gradient mask)
- Opacity drops to 0.4
- pointer-events: none

### 8.7 Popup Tab Switch

- Content crossfade: 150ms

### 8.8 Popup Button States

- Hover: background shift, `fast` transition (150ms)
- Active/press: instant color inversion (0ms — snappy Brutalist feel)
- Focus-visible: 2px outline, 2px offset, `--wg-accent` color

### 8.9 Reduced Motion

All animations respect `prefers-reduced-motion: reduce`:
- All durations → 0ms
- All transforms → none
- Combo badge: static position, opacity fade only (no translateY)
- Crit pulse: color flash only, no scale

## 9. Scope

### In scope:
- `src/core/themes.ts` — Updated color tokens, new tokens (border-heavy, highlight)
- `src/popup/index.tsx` — Popup layout redesign, tab restructure
- `src/popup/*.tsx` — All popup sub-components updated to new design system
- `src/decode/index.ts` — Decode panel visual redesign
- `src/content.css` — Updated hover/cleared/pulse animations
- `src/crit/css-effects.ts` — Updated animation keyframes
- `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png` — New Lens/Focus icon
- `manifest.json` — Add icon16 reference if missing

### Out of scope:
- No functional changes to core logic (SM-2, word matching, scanning)
- No changes to data structures or storage
- No new features (only visual/interaction improvements)
- No web font bundling
- No dark mode (light-first only)

## 10. Implementation Notes

- Icons: Create SVG source, export to PNG at 16/48/128. Increase stroke-width proportionally for smaller sizes.
- Popup outer border: Each theme defines its own outer border color (accent-based).
- The "MORE" tab consolidates: Community, LLM Settings, Audio Settings, Data Export. Each as a collapsible accordion section within MORE (click section header to expand/collapse, one section open at a time).
- Word bank selector chips support multi-select (current behavior allows selecting multiple banks).
- All inline styles continue to use theme object properties — no external CSS files for popup.
- Content script CSS remains minimal (`content.css`) with theme-specific styles injected via JS.
