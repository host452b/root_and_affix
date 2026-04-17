import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { sendMessage } from '../core/messages.js';
import type { CustomWordEntry } from '../core/storage.js';

export function CustomBank() {
  const [words, setWords] = useState<CustomWordEntry[]>([]);
  const [word, setWord] = useState('');
  const [chinese, setChinese] = useState('');
  const [csvError, setCsvError] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    sendMessage({ type: 'GET_CUSTOM_WORDS' }).then(setWords).catch(() => {});
  }, []);

  async function handleAdd() {
    const trimWord = word.trim();
    const trimChinese = chinese.trim();
    if (!trimWord || !trimChinese) return;

    setAdding(true);
    try {
      await sendMessage({ type: 'ADD_CUSTOM_WORD', word: trimWord, chinese: trimChinese, tags: ['CUSTOM'] });
      const updated = await sendMessage({ type: 'GET_CUSTOM_WORDS' });
      setWords(updated);
      setWord('');
      setChinese('');
      // Signal content script to re-merge custom words
      chrome.storage.local.set({ wg_custom_changed: Date.now() });
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    await sendMessage({ type: 'DELETE_CUSTOM_WORD', id });
    setWords(prev => prev.filter(w => w.id !== id));
    chrome.storage.local.set({ wg_custom_changed: Date.now() });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleAdd();
  }

  async function handleCsvImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setCsvError('');

    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Skip header if it starts with "english" or "word" (case-insensitive)
    const startIdx = /^(english|word)/i.test(lines[0]) ? 1 : 0;

    const validLines: Array<{ word: string; chinese: string; tags: string[] }> = [];
    for (const line of lines.slice(startIdx)) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) continue;
      const tags = parts[2]
        ? parts[2].split(';').map(t => t.trim()).filter(Boolean)
        : ['CUSTOM'];
      validLines.push({ word: parts[0], chinese: parts[1], tags });
    }

    if (validLines.length === 0) {
      setCsvError('No valid entries found. Expected format: english,chinese[,tag1;tag2]');
      input.value = '';
      return;
    }

    try {
      await sendMessage({ type: 'IMPORT_CUSTOM_CSV', csv: text });
      const updated = await sendMessage({ type: 'GET_CUSTOM_WORDS' });
      setWords(updated);
      // Signal content script to re-merge
      chrome.storage.local.set({ wg_custom_changed: Date.now() });
    } catch {
      setCsvError('Import failed. Please try again.');
    }
    input.value = '';
  }

  const inputStyle = `
    flex: 1; padding: 7px 10px;
    background: var(--wg-input-bg, #f5f5f5);
    border: 1.5px solid var(--wg-border, #E4E4E7);
    font-size: 12px; color: inherit;
    font-family: inherit; outline: none;
  `;

  const btnStyle = (active: boolean) => `
    padding: 7px 14px; cursor: pointer; border: none;
    font-family: var(--wg-mono, monospace); font-size: 11px; font-weight: 600;
    background: var(--wg-accent, #222); color: #fff;
    opacity: ${active ? 1 : 0.5};
  `;

  return html`
    <div style="padding: 16px 20px;">
      <!-- Section label -->
      <div style="font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 12px; font-family: var(--wg-mono, monospace);">
        Custom Words
      </div>

      <!-- Add form -->
      <div style="display: flex; gap: 6px; margin-bottom: 8px;">
        <input
          type="text"
          placeholder="English"
          value=${word}
          onInput=${(e: Event) => setWord((e.target as HTMLInputElement).value)}
          onKeyDown=${handleKeyDown}
          style="flex: 2; padding: 7px 10px; background: var(--wg-input-bg, #f5f5f5); border: 1.5px solid var(--wg-border, #E4E4E7); font-size: 12px; color: inherit; font-family: inherit; outline: none; min-width: 0;"
        />
        <input
          type="text"
          placeholder="中文"
          value=${chinese}
          onInput=${(e: Event) => setChinese((e.target as HTMLInputElement).value)}
          onKeyDown=${handleKeyDown}
          style="flex: 1; padding: 7px 10px; background: var(--wg-input-bg, #f5f5f5); border: 1.5px solid var(--wg-border, #E4E4E7); font-size: 12px; color: inherit; font-family: inherit; outline: none; min-width: 0;"
        />
        <button
          onClick=${handleAdd}
          disabled=${adding || !word.trim() || !chinese.trim()}
          style="flex-shrink: 0; padding: 7px 12px; cursor: pointer; border: none; font-family: var(--wg-mono, monospace); font-size: 10px; font-weight: 600; background: var(--wg-fg, #09090B); color: var(--wg-bg, #fff); opacity: ${!adding && word.trim() && chinese.trim() ? '1' : '0.4'};"
        >ADD</button>
      </div>

      <!-- CSV import -->
      <div style="margin-bottom: 12px;">
        <label style="
          display: inline-block; cursor: pointer;
          font-size: 10px; letter-spacing: 1px;
          color: var(--wg-muted, #999);
          text-decoration: underline;
        ">
          Import CSV (english,chinese,tags)
          <input
            type="file"
            accept=".csv,.txt"
            onChange=${handleCsvImport}
            style="display: none;"
          />
        </label>
        ${csvError && html`
          <div style="font-size: 10px; color: #d33; margin-top: 4px;">${csvError}</div>
        `}
      </div>

      <!-- Word list -->
      ${words.length === 0
        ? html`<div style="font-size: 11px; color: var(--wg-muted, #bbb); padding: 8px 0;">No custom words yet.</div>`
        : html`
          <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--wg-border, #E4E4E7);">
            ${words.map(w => html`
              <div key=${w.id} style="
                display: flex; align-items: center; justify-content: space-between;
                padding: 8px 12px;
                border-bottom: 1px solid var(--wg-border, #E4E4E7);
                font-size: 12px;
              ">
                <div style="flex: 1; min-width: 0;">
                  <span style="font-weight: 600;">${w.word}</span>
                  <span style="color: var(--wg-muted, #999); margin-left: 8px;">${w.chinese}</span>
                  ${w.tags.length > 0 && w.tags[0] !== 'CUSTOM' && html`
                    <span style="margin-left: 6px; font-size: 9px; color: var(--wg-accent, #666); letter-spacing: 0.5px;">
                      ${w.tags.join(' · ')}
                    </span>
                  `}
                </div>
                <button
                  onClick=${() => handleDelete(w.id)}
                  style="
                    background: none; border: none; cursor: pointer;
                    color: var(--wg-muted, #bbb); font-size: 14px; padding: 0 0 0 8px;
                    line-height: 1;
                  "
                  title="Delete"
                >×</button>
              </div>
            `)}
          </div>
          <div style="font-size: 10px; color: var(--wg-muted, #bbb); margin-top: 6px; text-align: right;">
            ${words.length} word${words.length !== 1 ? 's' : ''}
          </div>
        `
      }
    </div>
  `;
}
