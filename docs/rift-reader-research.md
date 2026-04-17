# Rift Reader — PDF Integration Research

**Task 38 · Flipword · Exploratory**
**Date: 2026-04-08**

---

## 1. PDF.js Integration Approach: Chrome's Built-in Viewer

### Chrome's built-in PDF viewer

Chrome renders PDFs using its own internal extension hosted at:

```
chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/
```

This is a privileged, first-party extension page. Third-party extensions **cannot** inject content scripts into it because:

1. `content_scripts.matches` patterns are matched against the page URL. `chrome-extension://` URLs from *other* extensions are explicitly excluded — they don't match `<all_urls>`.
2. Even with `programmatic` injection via `chrome.scripting.executeScript`, Chrome rejects injection into URLs that start with `chrome-extension://` belonging to other extensions (see MV3 permission model).
3. The PDF text layer in Chrome's built-in viewer is rendered inside a shadow DOM that is not accessible from outside the extension origin.

### Could we detect a PDF being viewed?

Yes — partially:

- A background service worker can listen to `chrome.webNavigation.onCommitted` (requires `"webNavigation"` permission) and check if `details.url` ends with `.pdf` or the response `Content-Type` is `application/pdf`.
- However, detecting the URL is only half the battle. We cannot reach into the built-in viewer page to extract text or inject spans.

### Conclusion on built-in viewer injection

**Not viable.** Chrome's architecture intentionally walls off the built-in PDF viewer from third-party content script injection. There is no supported API to overlay content on top of it.

---

## 2. Alternative Approach: Custom PDF Viewer Page

### Architecture

Create an extension page at `chrome-extension://[id]/pages/rift-reader.html` that:

1. **Accepts PDF input** via file picker (`<input type="file">`) or URL parameter (`?url=...`).
2. **Renders the PDF** using [pdf.js](https://mozilla.github.io/pdf.js/) (Mozilla's open-source PDF renderer), bundled into the extension.
3. **Extracts text layers** from each page using `page.getTextContent()` — pdf.js provides structured text items with position, font size, and transform data.
4. **Applies Flipword matching** by running the extracted text items through the existing NLP pipeline (`src/nlp/`) to find Chinese words eligible for glitch replacement.
5. **Renders annotations** as absolutely-positioned `<span>` elements overlaid on top of the pdf.js canvas/SVG layer, aligned to the text item bounding boxes.
6. **Handles page navigation** with previous/next controls and direct page-number input.

### How pdf.js text layers work

pdf.js renders in two passes:
- **Canvas layer** — pixel-accurate visual rendering of the page.
- **Text layer** — a `<div>` containing absolutely-positioned `<span>` elements, one per text item, placed over the canvas. Each span carries the visible text, positioned via CSS `transform`.

This text layer is designed for browser text selection and accessibility. It is exactly the hook Flipword needs:

```
page.getTextContent() → TextContent {
  items: TextItem[] {
    str: string           // the text string for this item
    transform: number[]   // [a, b, c, d, tx, ty] — affine transform
    width: number
    height: number
    fontName: string
  }
}
```

Flipword can scan `str` for Chinese text, apply the NLP matching, and replace the corresponding `<span>` in the text layer with a glitch span — exactly the same as `replaceInTextNode` in `src/renderer/index.ts`.

### Integration with existing Flipword modules

| Module | Role in Rift Reader |
|--------|-------------------|
| `src/nlp/` | Runs on extracted `TextItem.str` strings to find eligible Chinese words |
| `src/renderer/index.ts` → `createGlitchSpan` | Creates the annotated spans for matched words |
| `src/core/storage.ts` | Reads user word bank and settings (invasion level, theme) |
| `src/decode/index.ts` | Powers the decode modal when a glitch span is clicked |
| `src/crit/index.ts` | Fires critical-hit animations on first decode |

The Rift Reader page is a self-contained extension page that imports the same modules as `content.ts`, but targets pdf.js text layer nodes instead of live DOM text nodes.

---

## 3. Technical Challenges

### 3.1 PDF text extraction quality

Not all PDFs have an embedded text layer:
- **Scanned PDFs** are image-only — `page.getTextContent()` returns empty items or garbled OCR artifacts.
- **CJK fonts** are often embedded as subsets with custom encoding tables. pdf.js handles most common CJK encodings (GB2312, Big5, UTF-8 CMap), but rare or hand-crafted fonts may produce mojibake.
- **Columnar / vertical text** (classical Chinese documents, traditional newspapers) uses vertical writing modes that pdf.js may flatten or misorder.

**Mitigation**: Detect empty/low text yield after extraction and display a warning banner. For truly image-only PDFs, future work could integrate a client-side OCR engine (Tesseract.js), but this is out of scope for the prototype.

### 3.2 CJK font rendering in pdf.js

pdf.js loads CJK fonts from its own CMaps (character map files). The extension bundle must include the CMap resources from `pdfjs-dist/cmaps/` and configure the pdf.js worker accordingly:

```js
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.js');
GlobalWorkerOptions.cMapUrl = chrome.runtime.getURL('cmaps/');
GlobalWorkerOptions.cMapPacked = true;
```

CMaps add ~2–4 MB to the bundle. Acceptable for an extension feature gated behind a dedicated page.

### 3.3 Performance with large documents

- pdf.js renders pages on-demand (virtualization). Rendering all pages upfront is wasteful.
- Flipword's NLP pipeline (`src/nlp/context.ts`) involves dictionary lookups and possibly LLM calls (`src/nlp/llm.ts`) — these should be deferred until the page is visible (intersection observer on page containers).
- Memory: a 200-page Chinese academic PDF can have 5,000+ text items. The scanner should batch-process in chunks (reusing `SCANNER_BATCH_LIMIT` from `src/core/constants.ts`) and yield between chunks to avoid blocking the main thread.

### 3.4 Reading position and bookmarks

pdf.js does not maintain reading position across sessions natively. Options:
- Store `{ fileHash, pageNumber, scrollOffset }` in `chrome.storage.local` keyed by a SHA-256 of the file's first 64 KB (cheap fingerprint without reading the whole file).
- Resume position on next open via a `?resume=<hash>` query parameter or by looking up the hash in storage at load time.
- Bookmarks could use pdf.js destination objects (`page.getDestinations()`), though full outline support is post-prototype work.

---

## 4. Recommendation

**Use the custom viewer page approach.**

Injecting into Chrome's built-in PDF viewer is blocked by the browser's security model and is not a supported extension pattern. The custom viewer page gives full control over the rendering pipeline, text extraction, and annotation injection. It also means the feature works identically on Firefox (which also blocks third-party injection into its built-in PDF viewer) by reusing `manifest.firefox.json`.

The custom page approach aligns with how productivity extensions like Hypothesis, Readwise, and Reeder handle PDF annotation — they all ship their own pdf.js-based viewer rather than fighting the browser's built-in one.

**Implementation order for a v1 prototype:**

1. Bundle `pdfjs-dist` worker + CMap files.
2. Build `src/pages/rift-reader.html` + `src/pages/rift-reader.ts` as a new entry point in `build.ts`.
3. Wire `page.getTextContent()` output into the existing `src/nlp/` pipeline.
4. Inject glitch spans into the pdf.js text layer using `createGlitchSpan` / `replaceInTextNode`.
5. Add a toolbar: open file, page navigation, glitch density display.

---

## 5. Prototype Scope

A minimal "walking skeleton" prototype should demonstrate:

1. **File accept** — drag-and-drop or `<input type="file">` picks a PDF.
2. **Page render** — pdf.js renders page 1 to a `<canvas>`.
3. **Text layer** — pdf.js text layer spans appear above the canvas.
4. **Glitch annotation** — at least one Chinese text item gets replaced with a `<wg-glitch>` span using the existing renderer.
5. **Decode on click** — clicking a glitch span opens the decode card (same as in the content script).

What the prototype explicitly defers:
- Multi-page navigation UI (beyond basic prev/next).
- Resume position across sessions.
- LLM-enriched matching (API key wiring).
- Scanned-PDF / OCR fallback.
- CMap bundle optimization.

The file `src/pages/rift-reader.html` (below) is the entry point shell for this prototype.

---

## References

- [pdf.js GitHub](https://github.com/mozilla/pdf.js) — Mozilla's PDF renderer used by Firefox and broadly adopted.
- [pdfjs-dist npm](https://www.npmjs.com/package/pdfjs-dist) — pre-built distribution for bundling.
- [Chrome Extensions: Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — documents URL match pattern restrictions (confirms chrome-extension:// exclusion).
- [Chrome Extensions: Manifest V3 permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) — covers `scripting` and `webNavigation`.
- [pdf.js TextContent API](https://mozilla.github.io/pdf.js/api/draft/interfaces/TextContent.html) — the text extraction interface used for annotation.
