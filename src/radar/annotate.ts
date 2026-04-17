import type { Theme, WordStatus } from '../core/types.js';
import type { RadarMatch } from './index.js';

const HIGH_DIFFICULTY_TAGS = new Set(['GRE', 'TOEFL', 'SAT', 'GMAT', 'CAT']);

/**
 * Creates a <mark> element that wraps the matched word and applies visual
 * styling according to the word's current learning status and the active theme.
 */
export function annotateWord(
  match: RadarMatch,
  status: WordStatus,
  theme: Theme,
): HTMLElement {
  const mark = document.createElement('mark');
  mark.setAttribute('data-wg-radar', status);
  mark.textContent = match.word;

  // Reset browser default <mark> styling
  mark.style.background = 'transparent';
  mark.style.color = 'inherit';
  mark.style.padding = '0';

  const accent = theme.popup.accent;

  switch (status) {
    case 'new':
      // Strong emphasis — 2px border-bottom with theme accent + CSS pulse
      mark.style.borderBottom = `2px solid ${accent}`;
      mark.setAttribute('data-wg-radar-new', '');
      break;

    case 'seen':
    case 'learning':
      // Moderate emphasis — 1.5px amber/orange underline
      mark.style.borderBottom = '1.5px solid #f59e0b';
      break;

    case 'reviewing':
      // Light emphasis — 1px underline using the accent colour at half opacity
      mark.style.borderBottom = `1px solid ${accent}`;
      mark.style.opacity = '0.75';
      break;

    case 'mastered':
      // Minimal — subtle green underline
      mark.style.borderBottom = '1.5px solid #22c55e';
      mark.style.opacity = '0.6';
      break;
  }

  // High-difficulty tag indicator (small superscript)
  const tags = match.wordEntry.difficulty ?? [];
  const isHard = tags.some(t => HIGH_DIFFICULTY_TAGS.has(t.toUpperCase()));
  if (isHard) {
    const sup = document.createElement('sup');
    sup.textContent = '★';
    sup.style.fontSize = '0.6em';
    sup.style.color = accent;
    sup.style.marginLeft = '1px';
    sup.style.verticalAlign = 'super';
    mark.appendChild(sup);
  }

  return mark;
}

/**
 * Splits the text node at the match boundaries and inserts the <mark> element,
 * using the same DocumentFragment approach as src/renderer/index.ts.
 */
export function replaceWithAnnotation(match: RadarMatch, mark: HTMLElement): void {
  const { textNode, startOffset, endOffset } = match;
  const text = textNode.textContent ?? '';

  const before = text.slice(0, startOffset);
  const after = text.slice(endOffset);

  const parent = textNode.parentNode;
  if (!parent) return;

  const frag = document.createDocumentFragment();
  if (before) frag.appendChild(document.createTextNode(before));
  frag.appendChild(mark);
  if (after) frag.appendChild(document.createTextNode(after));

  parent.replaceChild(frag, textNode);
}
