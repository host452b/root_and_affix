/**
 * Minimal page-level presence indicator for FlipWord.
 *
 * Default: 8×8 breathing dot (bottom-right).
 * Hover: expands into a pill showing word count + pause/skip controls.
 * Paused state: gray dot, pill shows "resume".
 */

import { EXTENSION_PREFIX } from '../core/constants.js';
import { t } from '../core/i18n.js';

const ID = `${EXTENSION_PREFIX}-presence`;
let indicator: HTMLDivElement | null = null;
let wordCount = 0;
let paused = false;

// Callbacks for content.ts to wire up
let onPause: (() => void) | null = null;
let onResume: (() => void) | null = null;
let onSkipSite: (() => void) | null = null;

export function initPresence(callbacks: {
  onPause: () => void;
  onResume: () => void;
  onSkipSite: () => void;
}): void {
  onPause = callbacks.onPause;
  onResume = callbacks.onResume;
  onSkipSite = callbacks.onSkipSite;

  if (indicator) return;
  injectStyles();

  indicator = document.createElement('div');
  indicator.id = ID;
  indicator.className = `${EXTENSION_PREFIX}-presence`;
  indicator.innerHTML = `<div class="${EXTENSION_PREFIX}-presence-dot"></div>`;

  // Build pill (hidden by default, shown on hover)
  const pill = document.createElement('div');
  pill.className = `${EXTENSION_PREFIX}-presence-pill`;
  pill.innerHTML = buildPillContent();
  indicator.appendChild(pill);

  // Wire up pill button clicks via delegation
  pill.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest(`[data-${EXTENSION_PREFIX}-action]`) as HTMLElement | null;
    if (!btn) return;
    const action = btn.getAttribute(`data-${EXTENSION_PREFIX}-action`);
    if (action === 'pause') onPause?.();
    else if (action === 'resume') onResume?.();
    else if (action === 'skip') onSkipSite?.();
  });

  document.documentElement.appendChild(indicator);
}

export function updatePresenceCount(count?: number): void {
  if (count !== undefined) wordCount = count;
  else wordCount = document.querySelectorAll(`[data-${EXTENSION_PREFIX}]`).length;

  const pill = indicator?.querySelector(`.${EXTENSION_PREFIX}-presence-pill`);
  if (pill) pill.innerHTML = buildPillContent();
}

export function setPresencePaused(isPaused: boolean): void {
  paused = isPaused;
  const dot = indicator?.querySelector(`.${EXTENSION_PREFIX}-presence-dot`) as HTMLElement | null;
  if (dot) {
    dot.style.background = paused ? 'var(--wg-muted, #A1A1AA)' : 'var(--wg-fg, #09090B)';
    dot.style.animationPlayState = paused ? 'paused' : 'running';
  }
  const pill = indicator?.querySelector(`.${EXTENSION_PREFIX}-presence-pill`);
  if (pill) pill.innerHTML = buildPillContent();
}

export function removePresence(): void {
  indicator?.remove();
  indicator = null;
}

function buildPillContent(): string {
  if (paused) {
    return `
      <span class="${EXTENSION_PREFIX}-presence-label">flipword · ${t('presence.paused')}</span>
      <button data-${EXTENSION_PREFIX}-action="resume" class="${EXTENSION_PREFIX}-presence-btn">${t('presence.resume')}</button>
    `;
  }
  return `
    <span class="${EXTENSION_PREFIX}-presence-label">flipword · ${wordCount}</span>
    <button data-${EXTENSION_PREFIX}-action="pause" class="${EXTENSION_PREFIX}-presence-btn">${t('presence.pause')}</button>
    <button data-${EXTENSION_PREFIX}-action="skip" class="${EXTENSION_PREFIX}-presence-btn ${EXTENSION_PREFIX}-presence-btn--muted">${t('presence.skipSite')}</button>
  `;
}

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = `${ID}-styles`;
  style.textContent = `
    .${EXTENSION_PREFIX}-presence {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483644;
      display: flex;
      align-items: center;
      gap: 0;
      pointer-events: auto;
    }

    .${EXTENSION_PREFIX}-presence-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--wg-fg, #09090B);
      opacity: 0.4;
      animation: ${EXTENSION_PREFIX}-breathe 4s ease-in-out infinite;
      cursor: pointer;
      flex-shrink: 0;
    }

    .${EXTENSION_PREFIX}-presence-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0;
      max-width: 0;
      overflow: hidden;
      opacity: 0;
      transition: max-width 200ms ease-out, opacity 150ms ease-out, padding 200ms ease-out;
      white-space: nowrap;
      font-family: var(--wg-mono, monospace);
      font-size: 11px;
      color: var(--wg-fg, #09090B);
    }

    .${EXTENSION_PREFIX}-presence:hover .${EXTENSION_PREFIX}-presence-pill {
      max-width: 320px;
      opacity: 1;
      padding: 6px 12px 6px 10px;
    }

    .${EXTENSION_PREFIX}-presence:hover .${EXTENSION_PREFIX}-presence-dot {
      opacity: 0.8;
      animation: none;
    }

    .${EXTENSION_PREFIX}-presence-label {
      color: var(--wg-muted, #A1A1AA);
      font-size: 10px;
      letter-spacing: 0.5px;
    }

    .${EXTENSION_PREFIX}-presence-btn {
      background: none;
      border: 1px solid var(--wg-border, #E4E4E7);
      color: var(--wg-fg, #09090B);
      font-family: var(--wg-mono, monospace);
      font-size: 10px;
      padding: 3px 8px;
      cursor: pointer;
      transition: background 150ms ease-out;
    }
    .${EXTENSION_PREFIX}-presence-btn:hover {
      background: var(--wg-fg, #09090B);
      color: var(--wg-bg, #fff);
    }

    .${EXTENSION_PREFIX}-presence-btn--muted {
      border-color: transparent;
      color: var(--wg-muted, #A1A1AA);
    }
    .${EXTENSION_PREFIX}-presence-btn--muted:hover {
      background: var(--wg-muted, #A1A1AA);
      color: var(--wg-bg, #fff);
    }

    @keyframes ${EXTENSION_PREFIX}-breathe {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.6; }
    }

    @media (prefers-reduced-motion: reduce) {
      .${EXTENSION_PREFIX}-presence-dot {
        animation: none;
        opacity: 0.4;
      }
      .${EXTENSION_PREFIX}-presence-pill {
        transition: none;
      }
    }
  `;
  document.head.appendChild(style);
}
