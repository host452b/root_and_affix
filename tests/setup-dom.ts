import { Window } from 'happy-dom';

const win = new Window({ url: 'https://localhost/' });

// Expose DOM globals needed by scanner and renderer tests
(globalThis as unknown as Record<string, unknown>).window = win;
(globalThis as unknown as Record<string, unknown>).document = win.document;
(globalThis as unknown as Record<string, unknown>).Node = win.Node;
(globalThis as unknown as Record<string, unknown>).NodeFilter = win.NodeFilter;
(globalThis as unknown as Record<string, unknown>).Element = win.Element;
(globalThis as unknown as Record<string, unknown>).HTMLElement = win.HTMLElement;
