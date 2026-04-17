import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { sendMessage } from '../core/messages.js';
import { localDateStr } from '../core/storage.js';

export function Community() {
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importCount, setImportCount] = useState(0);

  async function handleExport() {
    // Get all custom words and export as JSON
    const customWords = await sendMessage({ type: 'GET_CUSTOM_WORDS' });
    const exportData = {
      format: 'flipword-bank-v1',
      exportedAt: new Date().toISOString(),
      wordCount: customWords.length,
      words: customWords,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flipword-custom-${localDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate format
      if (data.format !== 'flipword-bank-v1' || !Array.isArray(data.words)) {
        setImportStatus('error');
        return;
      }

      // Count before import
      const before = await sendMessage({ type: 'GET_CUSTOM_WORDS' });
      const beforeCount = before.length;

      // Import each word (ADD_CUSTOM_WORD deduplicates internally)
      for (const word of data.words) {
        if (word.word && word.chinese) {
          await sendMessage({
            type: 'ADD_CUSTOM_WORD',
            word: word.word,
            chinese: word.chinese,
            tags: word.tags ?? [],
          });
        }
      }

      // Count actual new additions
      const after = await sendMessage({ type: 'GET_CUSTOM_WORDS' });
      setImportCount(after.length - beforeCount);
      setImportStatus('success');
      // Signal content script to re-merge
      chrome.storage.local.set({ wg_custom_changed: Date.now() });
    } catch {
      setImportStatus('error');
    }
  }

  return html`
    <div style="padding: 16px 20px;">
      <div style="font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 12px; font-family: var(--wg-mono, monospace);">
        Import / Export
      </div>

      <!-- Export -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px;">Export</div>
        <div style="font-size: 11px; color: var(--wg-muted); margin-bottom: 8px;">
          Export your custom words as a JSON file to share with others.
        </div>
        <button onClick=${handleExport} style="
          width: 100%; padding: 10px; text-align: center; cursor: pointer;
          background: var(--wg-fg, #111); color: var(--wg-bg, #fff); border: none;
          font-size: 12px; font-family: var(--wg-mono, monospace); letter-spacing: 0.5px;
        ">EXPORT CUSTOM WORDS</button>
      </div>

      <!-- Import -->
      <div>
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px;">Import</div>
        <div style="font-size: 11px; color: var(--wg-muted); margin-bottom: 8px;">
          Import a Flipword word bank file (.json).
        </div>
        <label style="
          display: block; width: 100%; padding: 10px; text-align: center; cursor: pointer;
          border: 1.5px dashed var(--wg-border, #E4E4E7); font-size: 12px;
          font-family: var(--wg-mono, monospace); color: var(--wg-muted, #999);
        ">
          CHOOSE FILE
          <input type="file" accept=".json" onChange=${handleImport} style="display: none;" />
        </label>

        ${importStatus === 'success' && html`
          <div style="margin-top: 8px; font-size: 11px; color: #30d158;">
            ✓ Imported ${importCount} words successfully
          </div>
        `}
        ${importStatus === 'error' && html`
          <div style="margin-top: 8px; font-size: 11px; color: #ff3b30;">
            ✗ Invalid format. Use a Flipword export (.json) file.
          </div>
        `}
      </div>
    </div>
  `;
}
