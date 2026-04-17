# Source Code Changelog

## 2026-04-15 (Part 2)

### Product: Strip Gamification, Rate-Based Density, UX Polish

**Gamification stripped** — removed "spectacle" layer, kept subtle feedback:
- Deleted: score engine (+N floats), sound effects, achievement toasts, combo HUD, canvas particles, flip counter
- Deleted: L4 achievement gate (all levels freely selectable)
- Deleted: audio settings UI from popup
- Kept: first-blood pulse (0.3s), cleared fade+strikethrough, streak as stats indicator

**Rate-based density** — levels now scale with content length:
- L1: 10 words / 1000 chars (1%)
- L2: 25 words / 1000 chars (2.5%)
- L3: 50 words / 1000 chars (5%)
- L4: 120 words / 1000 chars (12%)
- Page-level target = `max(3, round(totalChars / 1000 × rate))`
- Selection changed from SM-2 priority to random sampling (shuffle + slice)

**Decode panel context** — original Chinese word highlighted in sentence:
- Bold + underline on the matched Chinese word
- English replacement shown in parentheses: `**准备**(prepare)`

**Weekly report card redesign**:
- 3x DPR (1080×1350) for retina-sharp sharing
- Warm paper palette: off-white gradient, warm-gray typography, ink-brown bars
- 7-day bar chart with today highlighted, count labels, day names

---

## 2026-04-15

### Performance: co

 Architecture
- **Startup data reduced 7x** (35MB → ~5MB)
  - `loadWordBanks()` now strips morphology/etymology/nativeFeel via `toLightEntry()`
  - No longer fetches roots.json, affixes.json, or etymology.json at startup
  - No more runtime `enrichWordBank()` call (was iterating 43K words)
- **On-demand decode data** via `loadFullEntry()`
  - Full entry (morphology, etymology) fetched when user clicks a word
  - First click per bank: ~50-100ms (fetch + parse), masked by 200ms panel animation
  - Subsequent clicks: instant (bank cached as `Map<wordId, WordEntry>`)
- **Future improvement options:**
  - Split bank JSON into `{bank}.light.json` (matching only) and `{bank}.full.json` (complete)
  - Move bank loading to background service worker (share across tabs)
  - Use IndexedDB cache for pre-parsed banks (persist across sessions)
  - Pre-compute all morphology at build time (eliminate runtime analysis entirely)

### Gamification: Complete Reward Loop
- **Cleared → CritTracker**: DecodeCallbacks pattern, onClear routes through critTracker.cleared()
- **Score engine** (`src/crit/score.ts`): first-blood +3, recognized +5, cleared +12, review-hit +8
  - Combo multiplier: x1.0 / x1.2 (5+) / x1.5 (10+) / x2.0 (20+)
- **Floating +N score** near word on every scored event
- **daily-complete trigger**: flipCount=30 fires canvas particles + celebration sound
- **Achievement toasts**: MARK_CLEARED returns newly unlocked IDs, content shows toast

### Integration Fixes (from ISSUE.MD)
- Content script idempotency: guards for observer/scroll/SPA/storage listener
- All dates unified to `localDateStr()` (no more UTC `toISOString()`)
- Radar mutation works on English pages (`requireChinese=false`)
- contextHint wired into `scoreMatch()` (boost/penalize based on hint keywords)
- Community import sends `wg_custom_changed` + shows actual new count
- Decode listener cleanup (`pendingCleanup` for mousemove/mouseup)
- Firefox support removed
- getBoundingClientRect guard (`isConnected` check)

## 2026-04-14

### Rebrand: WordGlitch → Flipword
- All user-facing strings, manifest, package.json renamed
- Internal variables: GlitchResult → FlipResult, glitchNodes → flipNodes, etc.
- CSS prefix `wg` kept (internal only)

### Visual Redesign
- 4 themes refined: deeper accents, consistent tokens, new border-heavy/highlight vars
- Popup: 320px → 360px, outer accent border, visual theme swatches, word bank chips
- Decode panel: enter/exit animation, dot-separated morphology, draggable by header
- Icons: neon "W" → split black/white "W" (flip concept)
- Content CSS: 150ms transitions, translateY hover lift, reduced-motion support

### Core Features
- **Progressive synonym selection**: byChinese Map<string, WordEntry[]>, picks first unmastered
- **Auto-morphology**: analyzeMorphology() decomposes words using roots + affixes at load time
- **Lazy-load support**: MutationObserver accumulates mutations, scroll re-scan every 500ms
- **Simplified renderer**: removed shrink/hover-expand, all words show at inherited font-size

### Popup Restructure
- Tab renamed: Community → More (accordion: community, LLM, audio, export)
- Word bank selector promoted to main tab
- Level selector shows word count range
- Pause button moved to header as icon
