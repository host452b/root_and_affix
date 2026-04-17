/**
 * First-run experience card.
 *
 * Not a settings wizard. Shows a lightweight card in bottom-right,
 * offers to activate FlipWord with a safe preset (L1 + news+tech).
 * Auto-collapses to a dot after 8s. Max 3 appearances if ignored.
 */

import { EXTENSION_PREFIX } from '../core/constants.js';
import { sendMessage } from '../core/messages.js';

const CARD_ID = `${EXTENSION_PREFIX}-firstrun`;
const MAX_SHOWS = 3;

type FirstRunState = 'offer' | 'active' | 'collapsed';

let cardEl: HTMLDivElement | null = null;
let state: FirstRunState = 'offer';
let collapseTimer: ReturnType<typeof setTimeout> | null = null;
let onActivated: (() => void) | null = null;

/**
 * Show first-run card. Returns a promise that resolves when the user
 * activates (clicks "立即体验"), or rejects if they skip/ignore.
 */
export function showFirstRun(callbacks: {
  onActivate: () => void;
  onSkipSite: () => void;
}): void {
  onActivated = callbacks.onActivate;

  // Check show count — max 3 appearances
  chrome.storage.local.get('wg_firstrun_count').then(r => {
    const count = r['wg_firstrun_count'] ?? 0;
    if (count >= MAX_SHOWS) {
      // Auto-onboard with news preset after 3 ignored appearances
      sendMessage({
        type: 'SAVE_SETTINGS',
        settings: { onboarded: true, invasionLevel: 1, wordBanks: ['news', 'tech'] },
      }).catch(() => {});
      return;
    }
    chrome.storage.local.set({ wg_firstrun_count: count + 1 });
    renderCard(callbacks);
  });
}

function renderCard(callbacks: { onActivate: () => void; onSkipSite: () => void }): void {
  injectStyles();

  cardEl = document.createElement('div');
  cardEl.id = CARD_ID;
  cardEl.className = `${EXTENSION_PREFIX}-firstrun`;
  updateCardContent(callbacks);

  document.documentElement.appendChild(cardEl);

  // Enter animation
  requestAnimationFrame(() => {
    if (cardEl) cardEl.style.opacity = '1';
  });

  // Auto-collapse after 8s if no interaction
  collapseTimer = setTimeout(() => {
    if (state === 'offer') collapse(callbacks);
  }, 8000);
}

function updateCardContent(callbacks: { onActivate: () => void; onSkipSite: () => void }): void {
  if (!cardEl) return;

  if (state === 'offer') {
    cardEl.innerHTML = `
      <div class="${EXTENSION_PREFIX}-firstrun-body">
        <div class="${EXTENSION_PREFIX}-firstrun-text">试试让这页慢慢长出英语</div>
        <div class="${EXTENSION_PREFIX}-firstrun-actions">
          <button data-action="activate" class="${EXTENSION_PREFIX}-firstrun-btn ${EXTENSION_PREFIX}-firstrun-btn--primary">立即体验</button>
          <button data-action="skip" class="${EXTENSION_PREFIX}-firstrun-btn ${EXTENSION_PREFIX}-firstrun-btn--muted">跳过本站</button>
        </div>
      </div>
    `;
  } else if (state === 'active') {
    cardEl.innerHTML = `
      <div class="${EXTENSION_PREFIX}-firstrun-body">
        <div class="${EXTENSION_PREFIX}-firstrun-text">已进入体验 · 点击高亮词查看释义</div>
        <div class="${EXTENSION_PREFIX}-firstrun-actions">
          <button data-action="continue" class="${EXTENSION_PREFIX}-firstrun-btn ${EXTENSION_PREFIX}-firstrun-btn--primary">继续</button>
        </div>
      </div>
    `;
  } else if (state === 'collapsed') {
    cardEl.innerHTML = `<div class="${EXTENSION_PREFIX}-firstrun-dot"></div>`;
  }

  // Wire up button clicks
  cardEl.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = (e.currentTarget as HTMLElement).getAttribute('data-action');
      if (action === 'activate') handleActivate(callbacks);
      else if (action === 'skip') handleSkip(callbacks);
      else if (action === 'continue') handleContinue();
    });
  });

  // Collapsed dot: click to re-expand
  const dot = cardEl.querySelector(`.${EXTENSION_PREFIX}-firstrun-dot`);
  if (dot) {
    dot.addEventListener('click', () => {
      state = 'offer';
      updateCardContent(callbacks);
      collapseTimer = setTimeout(() => {
        if (state === 'offer') collapse(callbacks);
      }, 8000);
    });
  }
}

function handleActivate(callbacks: { onActivate: () => void; onSkipSite: () => void }): void {
  if (collapseTimer) clearTimeout(collapseTimer);

  // Save first-run preset: L1 + news + tech
  sendMessage({
    type: 'SAVE_SETTINGS',
    settings: {
      invasionLevel: 1,
      wordBanks: ['news', 'tech'],
      paused: false,
    },
  }).catch(() => {});

  state = 'active';
  updateCardContent(callbacks);
  callbacks.onActivate();
}

function handleSkip(callbacks: { onActivate: () => void; onSkipSite: () => void }): void {
  if (collapseTimer) clearTimeout(collapseTimer);
  callbacks.onSkipSite();
  removeCard();
}

function handleContinue(): void {
  // Explicit "continue" = mark onboarded
  sendMessage({
    type: 'SAVE_SETTINGS',
    settings: { onboarded: true },
  }).catch(() => {});
  removeCard();
}

function collapse(callbacks: { onActivate: () => void; onSkipSite: () => void }): void {
  state = 'collapsed';
  updateCardContent(callbacks);
}

function removeCard(): void {
  if (cardEl) {
    cardEl.style.opacity = '0';
    setTimeout(() => { cardEl?.remove(); cardEl = null; }, 200);
  }
}

/**
 * Called by content.ts when user clicks their first word during onboarding.
 * Marks onboarded and removes the card.
 */
export function completeOnboardingFromWordClick(): void {
  if (!cardEl) return; // Not in onboarding
  sendMessage({
    type: 'SAVE_SETTINGS',
    settings: { onboarded: true },
  }).catch(() => {});
  removeCard();
}

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = `${CARD_ID}-styles`;
  style.textContent = `
    .${EXTENSION_PREFIX}-firstrun {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483645;
      opacity: 0;
      transition: opacity 200ms ease-out;
    }

    .${EXTENSION_PREFIX}-firstrun-body {
      background: var(--wg-bg, #fff);
      border: 1.5px solid var(--wg-border, #E4E4E7);
      padding: 14px 18px;
      font-family: var(--wg-mono, monospace);
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      max-width: 280px;
    }

    .${EXTENSION_PREFIX}-firstrun-text {
      font-size: 13px;
      color: var(--wg-fg, #09090B);
      line-height: 1.5;
      margin-bottom: 12px;
    }

    .${EXTENSION_PREFIX}-firstrun-actions {
      display: flex;
      gap: 8px;
    }

    .${EXTENSION_PREFIX}-firstrun-btn {
      font-family: var(--wg-mono, monospace);
      font-size: 11px;
      padding: 6px 14px;
      cursor: pointer;
      border: none;
      transition: background 150ms ease-out;
    }

    .${EXTENSION_PREFIX}-firstrun-btn--primary {
      background: var(--wg-fg, #09090B);
      color: var(--wg-bg, #fff);
    }
    .${EXTENSION_PREFIX}-firstrun-btn--primary:hover {
      opacity: 0.85;
    }

    .${EXTENSION_PREFIX}-firstrun-btn--muted {
      background: none;
      border: 1px solid var(--wg-border, #E4E4E7);
      color: var(--wg-muted, #A1A1AA);
    }
    .${EXTENSION_PREFIX}-firstrun-btn--muted:hover {
      background: var(--wg-border, #E4E4E7);
    }

    .${EXTENSION_PREFIX}-firstrun-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--wg-fg, #09090B);
      opacity: 0.4;
      cursor: pointer;
      animation: ${EXTENSION_PREFIX}-breathe 4s ease-in-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .${EXTENSION_PREFIX}-firstrun {
        transition: none;
      }
      .${EXTENSION_PREFIX}-firstrun-dot {
        animation: none;
      }
    }
  `;
  document.head.appendChild(style);
}
