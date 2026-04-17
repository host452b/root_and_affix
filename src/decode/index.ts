import { html } from 'htm/preact';
import { render } from 'preact';
import type { WordEntry, Theme } from '../core/types.js';
import { EXTENSION_PREFIX } from '../core/constants.js';
import { sendMessage } from '../core/messages.js';
import { t } from '../core/i18n.js';

let panelRoot: HTMLDivElement | null = null;
let pendingCleanup: (() => void) | null = null;

export type DecodeCallbacks = {
  onClear?: (wordId: string, result?: any) => void;
  onReview?: (wordId: string) => void;
  showFirstHint?: boolean;
};

let activeCallbacks: DecodeCallbacks = {};

export function showDecodePanel(entry: WordEntry, context: string, theme: Theme, callbacks?: DecodeCallbacks, originalText?: string): void {
  activeCallbacks = callbacks ?? {};
  hideDecodePanel();

  panelRoot = document.createElement('div');
  panelRoot.id = `${EXTENSION_PREFIX}-decode`;
  panelRoot.style.cssText = `
    position: fixed; z-index: 2147483647;
    width: 380px; max-height: 80vh; overflow-y: auto;
    border: ${theme.decode.border};
    border-radius: ${theme.decode.borderRadius};
    background: ${theme.decode.background};
    font-family: var(--wg-mono, monospace), -apple-system, sans-serif;
    font-size: 13px; color: var(--wg-fg, #333);
    box-shadow: 0 8px 24px var(--wg-shadow, rgba(0,0,0,0.1));
    opacity: 0;
    transition: opacity 200ms ease-out;
    cursor: default;
  `;
  // Position centered using absolute left/top from the start (not transform)
  // This avoids the transform→absolute switch that breaks dragging
  const panelWidth = 380;
  const startLeft = Math.max(10, (window.innerWidth - panelWidth) / 2);
  const startTop = Math.max(10, window.innerHeight * 0.15);
  panelRoot.style.left = `${startLeft}px`;
  panelRoot.style.top = `${startTop}px`;

  // Make panel draggable
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  panelRoot.addEventListener('mousedown', (e) => {
    if (!panelRoot) return;
    // Only drag from the panel header area (top 50px), not from buttons/content
    const rect = panelRoot.getBoundingClientRect();
    if (e.clientY - rect.top > 50) return;
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;

    isDragging = true;
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    panelRoot!.style.cursor = 'grabbing';
    e.preventDefault();
  });

  const moveHandler = (e: MouseEvent) => {
    if (!isDragging || !panelRoot) return;
    panelRoot.style.left = `${e.clientX - dragOffsetX}px`;
    panelRoot.style.top = `${e.clientY - dragOffsetY}px`;
  };

  const upHandler = () => {
    if (!isDragging || !panelRoot) return;
    isDragging = false;
    panelRoot.style.cursor = 'default';
  };

  document.addEventListener('mousemove', moveHandler);
  document.addEventListener('mouseup', upHandler);

  // Store cleanup references for hideDecodePanel
  pendingCleanup = () => {
    document.removeEventListener('mousemove', moveHandler);
    document.removeEventListener('mouseup', upHandler);
  };

  const overlay = document.createElement('div');
  overlay.id = `${EXTENSION_PREFIX}-overlay`;
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483646;
    background: var(--wg-scrim, rgba(0,0,0,0.15));
    opacity: 0;
    transition: opacity 200ms ease-out;
  `;
  overlay.addEventListener('click', hideDecodePanel);

  // Close on Escape key
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideDecodePanel();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(panelRoot);

  // Trigger enter animation — respect prefers-reduced-motion
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    if (overlay) overlay.style.opacity = '1';
    if (panelRoot) { panelRoot.style.transition = 'none'; panelRoot.style.opacity = '1'; }
  } else {
    requestAnimationFrame(() => {
      if (overlay) overlay.style.opacity = '1';
      if (panelRoot) panelRoot.style.opacity = '1';
    });
  }

  render(html`<${DecodeContent}
    entry=${entry}
    context=${context}
    theme=${theme}
    onClear=${() => handleClear(entry.id)}
    onReview=${() => handleReview(entry.id)}
    onClose=${hideDecodePanel}
    showFirstHint=${callbacks?.showFirstHint ?? false}
    originalText=${originalText ?? ''}
  />`, panelRoot);

  sendMessage({ type: 'RECORD_CLICK', wordId: entry.id }).catch(() => {});
}

export function hideDecodePanel(): void {
  const overlay = document.getElementById(`${EXTENSION_PREFIX}-overlay`);
  const panel = document.getElementById(`${EXTENSION_PREFIX}-decode`);

  if (overlay) overlay.style.opacity = '0';
  if (panel) {
    panel.style.opacity = '0';
  }

  // Clean up global listeners
  if (pendingCleanup) { pendingCleanup(); pendingCleanup = null; }

  // Remove after exit animation
  setTimeout(() => {
    overlay?.remove();
    panel?.remove();
    panelRoot = null;
  }, 120);
}

function DecodeContent({ entry, context, theme, onClear, onReview, onClose, showFirstHint, originalText }: {
  entry: WordEntry;
  context: string;
  theme: Theme;
  onClear: () => void;
  onReview: () => void;
  onClose: () => void;
  showFirstHint?: boolean;
  originalText?: string;
}) {
  const labelStyle = theme.decode.labelStyle;
  const mono = 'font-family: var(--wg-mono, monospace);';

  return html`
    <div style="position: relative;">
      <!-- Close button — 44px touch target -->
      <button onClick=${onClose} aria-label="Close" style="
        position: absolute; top: 6px; right: 6px;
        width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
        background: none; border: none; cursor: pointer;
        font-size: 18px; color: var(--wg-muted, #A1A1AA); line-height: 1;
      ">×</button>

      <!-- Header (drag handle) -->
      <div style="padding: 20px 24px 16px; border-bottom: 1px solid var(--wg-border, #E4E4E7); cursor: grab;">
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
          <div style="${labelStyle}">${t('decode.decode')}</div>
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

      <!-- Etymology — secondary info, shown after morphology and context -->
      ${entry.etymology && entry.etymology.story && html`
        <div style="padding: 12px 24px; border-bottom: 1px solid var(--wg-border, #E4E4E7); opacity: 0.7;">
          <div style="${labelStyle}; font-size: 8px;">${t('decode.origin')}</div>
          <div style="font-size: 11px; color: var(--wg-muted); margin-top: 6px; line-height: 1.6;">
            ${entry.etymology.origin && entry.etymology.origin !== entry.word ? html`<span style="font-weight: 600;">${entry.etymology.origin}</span> · ` : ''}${entry.etymology.entryPeriod ? html`<span>${entry.etymology.entryPeriod}</span> · ` : ''}${entry.etymology.story}
          </div>
        </div>
      `}

      <!-- Native Feel -->
      ${entry.nativeFeel && html`
        <div style="padding: 14px 24px; border-bottom: 1px solid var(--wg-border, #E4E4E7);">
          <div style="${labelStyle}">${t('decode.nativeFeel')}</div>
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
        <div style="${labelStyle}">${t('decode.context')}</div>
        <div style="font-size: 13px; color: var(--wg-fg); opacity: 0.8; margin-top: 8px; line-height: 1.6; border-left: 2px solid var(--wg-fg); padding-left: 12px;">
          "${originalText && context.includes(originalText)
            ? html`${context.split(originalText).map((part, i, arr) =>
                i < arr.length - 1
                  ? html`${part}<span style="font-weight: 700; border-bottom: 1.5px solid var(--wg-fg);">${originalText}</span><span style="font-size: 11px; color: var(--wg-muted, #A1A1AA); ${mono}">(${entry.word})</span>`
                  : part
              )}`
            : context
          }"
        </div>
      </div>

      <!-- Actions -->
      <div style="padding: 14px 24px; display: flex; gap: 8px;">
        <button onClick=${onClear} aria-label="Mark as cleared" style="
          flex: 1; padding: 11px 9px; text-align: center; cursor: pointer;
          background: var(--wg-fg, #09090B); color: var(--wg-bg, #fff); border: none;
          font-size: 12px; font-weight: 600; letter-spacing: 0.5px;
          ${mono} text-transform: uppercase;
        ">${t('decode.cleared')}</button>
        <button onClick=${onReview} aria-label="Continue reviewing" style="
          flex: 1; padding: 11px 9px; text-align: center; cursor: pointer;
          background: none; border: 1.5px solid var(--wg-fg, #09090B);
          color: var(--wg-fg, #09090B);
          font-size: 12px; font-weight: 600; letter-spacing: 0.5px;
          ${mono} text-transform: uppercase;
        ">${t('decode.review')}</button>
      </div>

      ${showFirstHint && html`
        <div style="padding: 0 24px 12px; font-size: 10px; color: var(--wg-muted, #A1A1AA); ${mono} letter-spacing: 0.3px;">
          ← → 切换 · esc 关闭 · 这是你解码的第一个词
        </div>
      `}
    </div>
  `;
}

async function handleClear(wordId: string): Promise<void> {
  const result = await sendMessage({ type: 'MARK_CLEARED', wordId }).catch(() => null);
  activeCallbacks.onClear?.(wordId, result);
  hideDecodePanel();
}

async function handleReview(wordId: string): Promise<void> {
  await sendMessage({ type: 'MARK_REVIEW', wordId }).catch(() => {});
  activeCallbacks.onReview?.(wordId);
  hideDecodePanel();
}
