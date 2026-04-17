import { collectTextNodes, observeMutations, observeSPANavigation } from './scanner/index.js';
import { detectLanguage } from './scanner/language.js';
import { findMatches, selectWords, type RawMatch } from './nlp/index.js';
import { loadWordBanks, loadFullEntry, mergeCustomWords, type WordBank } from './nlp/word-bank.js';
import { createFlipSpan, replaceInTextNode } from './renderer/index.js';
import { scanEnglishWords } from './radar/index.js';
import { annotateWord, replaceWithAnnotation } from './radar/annotate.js';
import { showDecodePanel, type DecodeCallbacks } from './decode/index.js';
import { showFirstRun, completeOnboardingFromWordClick } from './onboarding/index.js';
import { getTheme, generateThemeCSS } from './core/themes.js';
import { LEVEL_CONFIGS, DEFAULT_SETTINGS, EXTENSION_PREFIX } from './core/constants.js';
import { sendMessage } from './core/messages.js';
import { loadLocale } from './core/i18n.js';
import type { UserSettings, Theme } from './core/types.js';
import { CritTracker, observeRecognition } from './crit/index.js';
import { playCSSCrit } from './crit/css-effects.js';
import { initPresence, updatePresenceCount, setPresencePaused, removePresence } from './presence/indicator.js';


type RawMatchWithNode = RawMatch & { textNode: Text };

let settings: UserSettings = DEFAULT_SETTINGS;
let wordBank: WordBank | null = null;
let theme: Theme = getTheme('brutalist');
let wordStates: Record<string, import('./core/types.js').UserWordState> = {};

// Idempotency guards — prevent duplicate observers/listeners on re-init
let mutationObserver: MutationObserver | null = null;
let scrollHandler: (() => void) | null = null;
let spaPatched = false;
let storageListenerAttached = false;
let keyboardNavAttached = false;
let currentFocusIndex = -1;
let siteBlocked = false; // tracks whether current site is on skip list

const critTracker = new CritTracker((event) => {
  // Only first-blood pulse and cleared fade — no score, no sound, no spectacle
  if (event.type === 'first-blood' || event.type === 'cleared') {
    playCSSCrit(event, theme);
  }
});

async function init(): Promise<void> {
  // Load settings (fallback to defaults if background unavailable)
  try {
    settings = await sendMessage({ type: 'GET_SETTINGS' });
  } catch {
    settings = DEFAULT_SETTINGS;
  }




  // Check site blocklist — skip if current site is blocked
  try {
    const result = await chrome.storage.local.get('wg_site_blocklist');
    const blocklist: string[] = result['wg_site_blocklist'] ?? [];
    const hostname = location.hostname;
    if (blocklist.some(pattern => hostname === pattern || hostname.endsWith('.' + pattern))) {
      siteBlocked = true;
      return; // Site blocked — don't activate
    }
  } catch {}

  // Load persisted locale for presence indicator i18n
  await loadLocale();

  theme = getTheme(settings.theme);
  injectThemeCSS(theme);

  // Check onboarding — show lightweight first-run card, not a blocking wizard
  if (!settings.onboarded) {
    showFirstRun({
      onActivate: () => {
        // Reload settings (now L1 + news+tech) and start flipping
        sendMessage({ type: 'GET_SETTINGS' }).then(s => {
          settings = s;
          theme = getTheme(settings.theme);
          injectThemeCSS(theme);
          startFlipping();
        }).catch(() => startFlipping());
      },
      onSkipSite: async () => {
        const hostname = location.hostname;
        const result = await chrome.storage.local.get('wg_site_blocklist');
        const blocklist: string[] = result['wg_site_blocklist'] ?? [];
        if (!blocklist.includes(hostname)) {
          await chrome.storage.local.set({ wg_site_blocklist: [...blocklist, hostname] });
        }
      },
    });
    return; // Don't flip yet — wait for user to click "立即体验"
  }

  // Init presence indicator (always, even when paused — shows paused state)
  initPresence({
    onPause: () => {
      sendMessage({ type: 'SAVE_SETTINGS', settings: { paused: true } }).catch(() => {});
    },
    onResume: () => {
      sendMessage({ type: 'SAVE_SETTINGS', settings: { paused: false } }).catch(() => {});
    },
    onSkipSite: async () => {
      const hostname = location.hostname;
      const result = await chrome.storage.local.get('wg_site_blocklist');
      const blocklist: string[] = result['wg_site_blocklist'] ?? [];
      if (!blocklist.includes(hostname)) {
        await chrome.storage.local.set({ wg_site_blocklist: [...blocklist, hostname] });
      }
    },
  });

  if (settings.paused) {
    setPresencePaused(true);
    return;
  }

  const lang = detectLanguage();

  if (lang === 'zh') {
    await startFlipping();
  } else if (lang === 'en' && settings.radarEnabled) {
    await startRadar();
  }

  // Keyboard navigation for flipped words (attach once)
  if (!keyboardNavAttached) {
    keyboardNavAttached = true;
    attachKeyboardNav();
  }
  // 'other' → do nothing

  // Attach storage listener only once
  if (!storageListenerAttached) {
    storageListenerAttached = true;
    attachStorageListener();
  }
}

function attachStorageListener(): void {
  chrome.storage.onChanged.addListener(async (changes) => {
  // Site blocklist changed → check if current site is now blocked or unblocked
  if (changes['wg_site_blocklist']) {
    const blocklist: string[] = changes['wg_site_blocklist'].newValue ?? [];
    const hostname = location.hostname;
    const isBlocked = blocklist.some(pattern => hostname === pattern || hostname.endsWith('.' + pattern));

    if (isBlocked && !siteBlocked) {
      // Just got blocked — tear down: remove all flips + radar marks, stop observers
      siteBlocked = true;
      removePresence();
      document.querySelectorAll(`[data-${EXTENSION_PREFIX}]`).forEach(span => {
        const original = (span as HTMLElement).dataset[`${EXTENSION_PREFIX}Original`] ?? '';
        span.replaceWith(document.createTextNode(original));
      });
      // Also remove radar-mode marks (English page annotations)
      document.querySelectorAll('[data-wg-radar]').forEach(mark => {
        mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
      });
      if (mutationObserver) { mutationObserver.disconnect(); mutationObserver = null; }
      if (scrollHandler) { window.removeEventListener('scroll', scrollHandler); scrollHandler = null; }
      pageFlippedWords.clear();
      wordBank = null;
      return;
    } else if (!isBlocked && siteBlocked) {
      // Just got unblocked — reactivate
      siteBlocked = false;
      pageFlippedWords.clear();
      wordBank = null;
      await startFlipping();
      return;
    }
  }

  // Re-flip: clear all flipped words and re-scan from scratch
  if (changes['wg_reflip'] && !siteBlocked) {
    // Remove all flipped spans, restore original text
    document.querySelectorAll(`[data-${EXTENSION_PREFIX}]`).forEach(span => {
      const original = (span as HTMLElement).dataset[`${EXTENSION_PREFIX}Original`] ?? '';
      span.replaceWith(document.createTextNode(original));
    });
    pageFlippedWords.clear();
    wordBank = null; // force full reload
    await startFlipping();
    return;
  }

  // Custom words changed (add or delete) → reload base bank + re-merge from scratch
  if (changes['wg_custom_changed']) {
    // Remove existing flips and clear dedup — handles both add and delete
    document.querySelectorAll(`[data-${EXTENSION_PREFIX}]`).forEach(span => {
      const original = (span as HTMLElement).dataset[`${EXTENSION_PREFIX}Original`] ?? '';
      span.replaceWith(document.createTextNode(original));
    });
    pageFlippedWords.clear();
    wordBank = null; // force full bank reload so deleted words are gone
    await startFlipping();
    return;
  }

  if (!changes['wg_settings']) return;

  const prev = settings;
  try {
    settings = await sendMessage({ type: 'GET_SETTINGS' });
  } catch {
    return;
  }

  const newTheme = getTheme(settings.theme);

  // Theme change → just re-inject CSS, no reload
  if (prev.theme !== settings.theme) {
    theme = newTheme;
    injectThemeCSS(theme);
  }

  // Paused toggle → remove or re-add flipped words
  if (prev.paused !== settings.paused) {
    setPresencePaused(settings.paused);
    if (settings.paused) {
      // Remove all flipped spans, restore original text
      document.querySelectorAll(`[data-${EXTENSION_PREFIX}]`).forEach(span => {
        const original = (span as HTMLElement).dataset[`${EXTENSION_PREFIX}Original`] ?? '';
        span.replaceWith(document.createTextNode(original));
      });
    } else {
      // Re-scan the page — clear dedup set so words can appear again
      pageFlippedWords.clear();
      wordBank = null; // force reload
      await startFlipping();
    }
    return;
  }

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

  // Word bank, level, or custom words change → re-scan without reload
  if (prev.wordBanks.join(',') !== settings.wordBanks.join(',') || prev.invasionLevel !== settings.invasionLevel) {
    // Remove existing flipped words
    document.querySelectorAll(`[data-${EXTENSION_PREFIX}]`).forEach(span => {
      const original = (span as HTMLElement).dataset[`${EXTENSION_PREFIX}Original`] ?? '';
      span.replaceWith(document.createTextNode(original));
    });
    // Re-scan with new settings — clear dedup set
    pageFlippedWords.clear();
    wordBank = null;
    await startFlipping();
  }
  });
}

async function startFlipping(): Promise<void> {
  // Load word bank(s)
  if (!wordBank) {
    try {
      wordBank = await loadWordBanks(settings.wordBanks.length > 0 ? settings.wordBanks : ['ielts']);
    } catch (e) {
      console.warn('[Flipword] Failed to load word bank:', e);
      return;
    }
  }

  // Merge custom words into the word bank
  try {
    const customWords = await sendMessage({ type: 'GET_CUSTOM_WORDS' });
    if (customWords && customWords.length > 0) {
      wordBank = mergeCustomWords(wordBank, customWords);
    }
  } catch {
    // Custom words unavailable — proceed without
  }

  // Load word states for progressive synonym selection + SM-2 priority
  try {
    const allStates = await sendMessage({ type: 'GET_ALL_WORD_STATES' });
    wordStates = {};
    for (const s of allStates) wordStates[s.wordId] = s;
  } catch {
    wordStates = {};
  }

  flipPageBatched();

  // Watch for dynamic content (idempotent — only one observer at a time)
  if (mutationObserver) mutationObserver.disconnect();
  mutationObserver = observeMutations(document.body, (newNodes) => {
    if (settings.paused || !wordBank) return;
    flipNodes(newNodes);
  });

  // Watch for SPA navigation (patch only once)
  if (!spaPatched) {
    spaPatched = true;
    observeSPANavigation(() => {
      if (settings.paused) return;
      setTimeout(flipPageBatched, 300);
    });
  }

  // Re-scan on scroll (idempotent — remove old handler first)
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  scrollHandler = () => {
    if (settings.paused || !wordBank) return;
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = null;
      flipPageBatched();
    }, 500);
  };
  window.addEventListener('scroll', scrollHandler, { passive: true });
}

// Track which English words are already on this page (across all batches)
const pageFlippedWords = new Set<string>();
let pageTargetWords = 0; // calculated from page text length × rate

function flipPageBatched(): void {
  if (!wordBank) return;
  const nodes = collectTextNodes(document.body);

  // Calculate page-level target from total text length and level rate
  const levelConfig = LEVEL_CONFIGS[settings.invasionLevel];
  const totalChars = nodes.reduce((sum, n) => sum + (n.textContent?.length ?? 0), 0);
  pageTargetWords = Math.max(3, Math.round((totalChars / 1000) * levelConfig.rate));

  const BATCH_SIZE = 20;
  let i = 0;

  function processBatch() {
    const batch = nodes.slice(i, i + BATCH_SIZE);
    if (batch.length === 0) return;
    flipNodes(batch);
    i += BATCH_SIZE;
    if (i < nodes.length) {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(processBatch, { timeout: 200 });
      } else {
        setTimeout(processBatch, 0);
      }
    }
  }

  processBatch();
}

function flipNodes(nodes: Text[]): void {
  if (!wordBank) return;

  // Page-level cap: stop adding words once we've hit the target
  const remaining = pageTargetWords - pageFlippedWords.size;
  if (remaining <= 0) return;

  const allMatches: RawMatchWithNode[] = [];

  for (const node of nodes) {
    const text = node.textContent ?? '';
    const matches = findMatches(text, wordBank, wordStates);
    // Filter out words already flipped on this page (cross-batch dedup)
    const newMatches = matches.filter(m => !pageFlippedWords.has(m.targetWord));
    allMatches.push(...newMatches.map(m => ({ ...m, textNode: node })));
  }

  const selected = selectWords(allMatches, remaining, wordStates) as RawMatchWithNode[];

  // Sort by offset descending so replacements don't shift earlier offsets
  selected.sort((a, b) => b.startOffset - a.startOffset);

  for (const match of selected) {
    pageFlippedWords.add(match.targetWord); // track globally
    const { span } = createFlipSpan(match, theme);

    // Start recognition timer — fires if user doesn't click within 5s
    observeRecognition(span, match.wordEntry.id, critTracker);

    // Click handler → Decode panel (lazy-loads full entry with morphology/etymology)
    span.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!span.isConnected) return; // span may have been removed by re-scan
      const context = match.sentenceContext.slice(
        Math.max(0, match.startOffset - 30),
        Math.min(match.sentenceContext.length, match.endOffset + 30),
      );
      const fullEntry = await loadFullEntry(match.wordEntry.id, wordBank!);
      if (!span.isConnected) return; // span removed during async load
      const rect = span.getBoundingClientRect();
      const pos = { x: rect.left + rect.width / 2, y: rect.top };
      const isFirstClick = !settings.onboarded;
      showDecodePanel(fullEntry, context, theme, {
        onClear: (wordId) => {
          critTracker.cleared(wordId, pos);
        },
        showFirstHint: isFirstClick,
      }, match.originalText);

      // First word click during onboarding → mark as onboarded
      if (isFirstClick) {
        completeOnboardingFromWordClick();
        settings.onboarded = true;
      }
    });

    // Record exposure — check if daily goal hit
    sendMessage({ type: 'RECORD_EXPOSURE', wordId: match.wordEntry.id, bankIds: wordBank?.bankIds }).then((resp: any) => {
      if (resp?.dailyComplete) critTracker.dailyComplete();
    }).catch(() => {});

    try {
      replaceInTextNode(match.textNode, match, span);
    } catch {
      // Node may have been removed by page scripts
    }
  }

  // Update presence indicator word count
  updatePresenceCount();
}

async function startRadar(): Promise<void> {
  // Load word bank(s)
  if (!wordBank) {
    try {
      wordBank = await loadWordBanks(settings.wordBanks.length > 0 ? settings.wordBanks : ['ielts']);
    } catch (e) {
      console.warn('[Flipword] Failed to load word bank:', e);
      return;
    }
  }

  radarScan();

  // Watch for dynamic content (idempotent, no Chinese filter for English pages)
  if (mutationObserver) mutationObserver.disconnect();
  mutationObserver = observeMutations(document.body, () => {
    if (settings.paused || !wordBank) return;
    radarScan();
  }, false);

  // Watch for SPA navigation (patch only once)
  if (!spaPatched) {
    spaPatched = true;
    observeSPANavigation(() => {
      if (settings.paused) return;
      setTimeout(radarScan, 300);
    });
  }

  // Re-scan on scroll (idempotent)
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  scrollHandler = () => {
    if (settings.paused || !wordBank) return;
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = null;
      radarScan();
    }, 500);
  };
  window.addEventListener('scroll', scrollHandler, { passive: true });
}

async function radarScan(): Promise<void> {
  if (!wordBank) return;

  const matches = scanEnglishWords(document.body, wordBank);
  if (matches.length === 0) return;

  // Fetch learning states
  const wordIds = [...new Set(matches.map(m => m.wordEntry.id))];
  let states: Record<string, import('./core/types.js').UserWordState> = {};
  try {
    states = await sendMessage({ type: 'GET_WORD_STATES', wordIds });
  } catch {}

  // Sort by offset descending
  matches.sort((a, b) => {
    if (a.textNode === b.textNode) return b.startOffset - a.startOffset;
    return 0;
  });

  for (const match of matches) {
    const state = states[match.wordEntry.id];
    const status = state?.status ?? 'new';
    const mark = annotateWord(match, status, theme);

    mark.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!mark.isConnected) return;
      const context = match.textNode.textContent?.slice(
        Math.max(0, match.startOffset - 30),
        Math.min((match.textNode.textContent?.length ?? 0), match.endOffset + 30),
      ) ?? '';
      const fullEntry = await loadFullEntry(match.wordEntry.id, wordBank!);
      if (!mark.isConnected) return; // mark removed during async load
      const rect = mark.getBoundingClientRect();
      const pos = { x: rect.left + rect.width / 2, y: rect.top };
      showDecodePanel(fullEntry, context, theme, {
        onClear: (wordId) => {
          critTracker.cleared(wordId, pos);
        },
      });
    });

    sendMessage({ type: 'RECORD_EXPOSURE', wordId: match.wordEntry.id, bankIds: wordBank?.bankIds }).catch(() => {});

    try {
      replaceWithAnnotation(match, mark);
    } catch {}
  }
}

/**
 * Keyboard navigation for flipped words.
 * Arrow Down/Right → next word, Arrow Up/Left → previous word.
 * Enter → open decode panel for focused word.
 * Escape → clear focus.
 * Red outline shows current selection.
 */
function attachKeyboardNav(): void {
  function getFlippedWords(): HTMLElement[] {
    return Array.from(document.querySelectorAll(`[data-${EXTENSION_PREFIX}]:not([data-${EXTENSION_PREFIX}-cleared])`)) as HTMLElement[];
  }

  function clearFocus(): void {
    document.querySelectorAll(`[data-wg-focus]`).forEach(el => el.removeAttribute('data-wg-focus'));
    currentFocusIndex = -1;
  }

  function focusWord(index: number): void {
    const words = getFlippedWords();
    if (words.length === 0) return;

    clearFocus();
    currentFocusIndex = ((index % words.length) + words.length) % words.length;
    const target = words[currentFocusIndex];
    target.setAttribute('data-wg-focus', '');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  document.addEventListener('keydown', async (e) => {
    // Don't interfere with input fields or decode panel
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (document.getElementById(`${EXTENSION_PREFIX}-decode`)) return; // decode panel open

    const words = getFlippedWords();
    if (words.length === 0) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      focusWord(currentFocusIndex + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      focusWord(currentFocusIndex - 1);
    } else if (e.key === 'Enter' && currentFocusIndex >= 0) {
      e.preventDefault();
      const target = words[currentFocusIndex];
      if (target) target.click(); // triggers decode panel
    } else if (e.key === 'Escape') {
      clearFocus();
    }
  });
}

function injectThemeCSS(t: Theme): void {
  const existingStyle = document.getElementById(`${EXTENSION_PREFIX}-theme`);
  if (existingStyle) existingStyle.remove();

  const style = document.createElement('style');
  style.id = `${EXTENSION_PREFIX}-theme`;
  style.textContent = `:root { ${generateThemeCSS(t)} }`;
  document.head.appendChild(style);
}

// Audio config listener is handled inside attachStorageListener

// Listen for direct messages from popup (e.g. REFLIP)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'REFLIP' && !siteBlocked) {
    // Clear all flipped spans, restore original text
    document.querySelectorAll(`[data-${EXTENSION_PREFIX}]`).forEach(span => {
      const original = (span as HTMLElement).dataset[`${EXTENSION_PREFIX}Original`] ?? '';
      span.replaceWith(document.createTextNode(original));
    });
    pageFlippedWords.clear();
    wordBank = null; // force full reload
    startFlipping();
  }
});

// Start
init();
