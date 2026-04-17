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
      font-weight: 700;
      font-size: 16px;
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
      [data-${EXTENSION_PREFIX}] {
        animation: none !important;
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

function playCleared(event: CritEvent): void {
  const span = document.querySelector(`[data-${EXTENSION_PREFIX}="${event.wordId}"]`) as HTMLElement | null;
  if (!span) return;

  span.style.animation = 'wg-cleared-fade 0.4s ease-out forwards';
  span.setAttribute(`data-${EXTENSION_PREFIX}-cleared`, '');
}

