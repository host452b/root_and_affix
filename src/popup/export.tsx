import { html } from 'htm/preact';
import { sendMessage } from '../core/messages.js';
import { localDateStr } from '../core/storage.js';

export function DataExport() {
  async function exportJSON() {
    const states = await sendMessage({ type: 'GET_ALL_WORD_STATES' });
    const data = {
      format: 'flipword-progress-v1',
      exportedAt: new Date().toISOString(),
      wordCount: states.length,
      states,
    };
    download(JSON.stringify(data, null, 2), `flipword-progress-${date()}.json`, 'application/json');
  }

  async function exportCSV() {
    const states = await sendMessage({ type: 'GET_ALL_WORD_STATES' });
    const header = 'word,status,exposures,clicks,ease_factor,interval,next_review,cleared_date\n';
    const rows = states.map((s: any) =>
      [s.wordId, s.status, s.exposureCount, s.clickCount, s.easeFactor.toFixed(2), s.interval,
       localDateStr(new Date(s.nextReviewAt)),
       s.masteredAt ? localDateStr(new Date(s.masteredAt)) : ''
      ].join(',')
    ).join('\n');
    download(header + rows, `flipword-progress-${date()}.csv`, 'text/csv');
  }

  function download(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function date() { return localDateStr(); }

  return html`
    <div style="padding: 16px 20px;">
      <div style="font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 12px; font-family: var(--wg-mono, monospace);">
        Data Export
      </div>
      <div style="display: flex; gap: 8px;">
        <button onClick=${exportJSON} style="
          flex: 1; padding: 10px; text-align: center; cursor: pointer;
          background: var(--wg-fg, #111); color: var(--wg-bg, #fff); border: none;
          font-size: 11px; font-family: var(--wg-mono, monospace); letter-spacing: 0.5px;
        ">EXPORT JSON</button>
        <button onClick=${exportCSV} style="
          flex: 1; padding: 10px; text-align: center; cursor: pointer;
          border: 1.5px solid var(--wg-fg, #111); background: none;
          font-size: 11px; font-family: var(--wg-mono, monospace); letter-spacing: 0.5px;
          color: var(--wg-fg, #111);
        ">EXPORT CSV</button>
      </div>
    </div>
  `;
}
