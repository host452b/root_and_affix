import type { Theme, ThemeMarkStyle } from '../core/types.js';
import { EXTENSION_PREFIX } from '../core/constants.js';
import type { RawMatch } from '../nlp/index.js';

function applyMarkStyle(el: HTMLElement, style: ThemeMarkStyle): void {
  if (style.fontFamily) el.style.fontFamily = style.fontFamily;
  if (style.background) el.style.background = style.background;
  if (style.color) el.style.color = style.color;
  if (style.borderBottom) el.style.borderBottom = style.borderBottom;
  if (style.borderRadius) el.style.borderRadius = style.borderRadius;
  if (style.padding) el.style.padding = style.padding;
  if (style.fontStyle) el.style.fontStyle = style.fontStyle;
  if (style.fontWeight) el.style.fontWeight = style.fontWeight;
  if (style.letterSpacing) el.style.letterSpacing = style.letterSpacing;
}

export interface FlipResult {
  span: HTMLSpanElement;
}

export function createFlipSpan(
  match: RawMatch,
  theme: Theme,
): FlipResult {
  const span = document.createElement('span');
  span.dataset[EXTENSION_PREFIX] = match.targetWord;
  span.dataset[`${EXTENSION_PREFIX}Original`] = match.originalText;
  span.textContent = match.targetWord;
  span.style.cursor = 'pointer';
  // Inherit font-size from parent element (matches surrounding Chinese text size)
  span.style.fontSize = 'inherit';

  applyMarkStyle(span, theme.mark);

  // Tooltip: show original Chinese on hover
  span.title = match.originalText;

  return { span };
}

export function replaceInTextNode(
  textNode: Text,
  match: RawMatch,
  span: HTMLSpanElement,
): void {
  const text = textNode.textContent ?? '';
  const before = text.slice(0, match.startOffset);
  const after = text.slice(match.endOffset);

  const parent = textNode.parentNode!;
  const frag = document.createDocumentFragment();

  if (before) frag.appendChild(document.createTextNode(before));
  frag.appendChild(span);
  if (after) frag.appendChild(document.createTextNode(after));

  parent.replaceChild(frag, textNode);
}
