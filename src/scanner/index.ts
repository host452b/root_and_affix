import { BLACKLIST_TAGS, EXTENSION_PREFIX, SCANNER_BATCH_LIMIT, SCANNER_DEBOUNCE_MS } from '../core/constants.js';

const CHINESE_RE = /[\u4e00-\u9fff]/;

export function hasChinese(text: string): boolean {
  return CHINESE_RE.test(text);
}

export function shouldSkipNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (BLACKLIST_TAGS.has(parent.tagName)) return true;
  if (!node.textContent?.trim()) return true;
  if (parent.closest(`[data-${EXTENSION_PREFIX}]`)) return true;
  // Skip text inside links — replacing would break user navigation
  if (parent.closest('a[href]')) return true;
  return false;
}

export function collectTextNodes(root: Element): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Text) {
      if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
      if (!hasChinese(node.textContent ?? '')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
    // No hard limit — shouldSkipNode already skips processed nodes
    // Previously capped at SCANNER_BATCH_LIMIT (200), which caused
    // lazy-loaded content below the fold to be missed on scroll
  }
  return nodes;
}

export type ScanCallback = (nodes: Text[]) => void;

export function observeMutations(root: Element, onNew: ScanCallback, requireChinese = true): MutationObserver {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingMutations: MutationRecord[] = [];

  const observer = new MutationObserver((mutations) => {
    // Accumulate mutations across debounce periods (don't discard)
    pendingMutations.push(...mutations);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const batch = pendingMutations;
      pendingMutations = [];
      const newNodes: Text[] = [];
      const seen = new Set<Node>();

      for (const mutation of batch) {
        // Handle new nodes (lazy-loaded content)
        for (const added of mutation.addedNodes) {
          if (seen.has(added)) continue;
          seen.add(added);
          if (added.nodeType === Node.TEXT_NODE) {
            const text = added as Text;
            if (!shouldSkipNode(text) && (!requireChinese || hasChinese(text.textContent ?? ''))) {
              newNodes.push(text);
            }
          } else if (added.nodeType === Node.ELEMENT_NODE) {
            if (requireChinese) {
              newNodes.push(...collectTextNodes(added as Element));
            } else {
              // For non-Chinese mode, collect all text nodes (no Chinese filter)
              const walker = document.createTreeWalker(added as Element, NodeFilter.SHOW_TEXT, {
                acceptNode(node: Text) {
                  return shouldSkipNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
                },
              });
              while (walker.nextNode()) newNodes.push(walker.currentNode as Text);
            }
          }
        }
        // Handle text content changes in existing nodes (framework updates)
        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          const text = mutation.target as Text;
          if (!seen.has(text) && !shouldSkipNode(text) && (!requireChinese || hasChinese(text.textContent ?? ''))) {
            seen.add(text);
            newNodes.push(text);
          }
        }
      }
      if (newNodes.length > 0) onNew(newNodes);
    }, SCANNER_DEBOUNCE_MS);
  });

  observer.observe(root, { childList: true, subtree: true, characterData: true });
  return observer;
}

export function observeSPANavigation(callback: () => void): void {
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);

  history.pushState = (...args) => { origPush(...args); callback(); };
  history.replaceState = (...args) => { origReplace(...args); callback(); };
  window.addEventListener('popstate', callback);
}
