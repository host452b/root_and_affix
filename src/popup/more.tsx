import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Community } from './community.js';
import { DataExport } from './export.js';
import { sendMessage } from '../core/messages.js';
import { t } from '../core/i18n.js';

type Section = 'community' | 'export' | null;

function getSections(): Array<{ id: Section; label: string }> {
  return [
    { id: 'community', label: t('more.import') },
    { id: 'export', label: t('more.export') },
  ];
}

export function MoreTab() {
  const [open, setOpen] = useState<Section>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [reflipDone, setReflipDone] = useState(false);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [newSite, setNewSite] = useState('');

  // Load blocklist on mount
  useState(() => {
    chrome.storage.local.get('wg_site_blocklist').then(r => {
      setBlocklist(r['wg_site_blocklist'] ?? []);
    });
  });

  async function addToBlocklist() {
    const site = newSite.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!site || blocklist.includes(site)) return;
    const updated = [...blocklist, site];
    await chrome.storage.local.set({ wg_site_blocklist: updated });
    setBlocklist(updated);
    setNewSite('');
  }

  async function removeFromBlocklist(site: string) {
    const updated = blocklist.filter(s => s !== site);
    await chrome.storage.local.set({ wg_site_blocklist: updated });
    setBlocklist(updated);
  }

  async function blockCurrentSite() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const hostname = new URL(tab.url).hostname;
    if (blocklist.includes(hostname)) return;
    const updated = [...blocklist, hostname];
    await chrome.storage.local.set({ wg_site_blocklist: updated });
    setBlocklist(updated);
  }

  async function handleReflip() {
    // Send message directly to the active tab's content script
    // Fall back to storage signal only if direct message fails (e.g. no content script)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'REFLIP' });
      } else {
        chrome.storage.local.set({ wg_reflip: Date.now() });
      }
    } catch {
      // Content script not injected on this page — fall back to storage
      chrome.storage.local.set({ wg_reflip: Date.now() });
    }
    setReflipDone(true);
    setTimeout(() => setReflipDone(false), 1500);
  }

  async function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    // Clear all user data
    await chrome.storage.local.clear();
    // Reload extension
    chrome.runtime.reload();
  }

  return html`
    <div>
      ${getSections().map(section => html`
        <div key=${section.id}>
          <button
            onClick=${() => setOpen(open === section.id ? null : section.id)}
            style="
              width: 100%; padding: 12px 20px; text-align: left; cursor: pointer;
              background: none; border: none;
              border-bottom: 1px solid var(--wg-border, #E4E4E7);
              font-family: var(--wg-mono, monospace); font-size: 10px;
              letter-spacing: 1.5px; color: ${open === section.id ? 'var(--wg-fg, #09090B)' : 'var(--wg-muted, #A1A1AA)'};
              font-weight: ${open === section.id ? '700' : '400'};
              display: flex; justify-content: space-between; align-items: center;
              transition: color 150ms ease-out;
            "
          >
            <span>${section.label}</span>
            <span style="font-size: 11px; transform: ${open === section.id ? 'rotate(90deg)' : 'rotate(0)'}; transition: transform 150ms ease-out;">›</span>
          </button>
          ${open === section.id && html`
            <div>
              ${section.id === 'community' && html`<${Community} />`}
              ${section.id === 'export' && html`<${DataExport} />`}
            </div>
          `}
        </div>
      `)}

      <!-- Skip Sites -->
      <div style="padding: 14px 20px; border-top: 1px solid var(--wg-border, #E4E4E7);">
        <div style="font-size: 11px; letter-spacing: 0.5px; color: var(--wg-muted, #A1A1AA); margin-bottom: 8px;">
          ${t('more.blocklist')}
        </div>
        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
          <input
            type="text"
            placeholder="example.com"
            value=${newSite}
            onInput=${(e: Event) => setNewSite((e.target as HTMLInputElement).value)}
            onKeyDown=${(e: KeyboardEvent) => e.key === 'Enter' && addToBlocklist()}
            style="flex: 1; padding: 5px 8px; font-size: 10px; border: 1px solid var(--wg-border, #E4E4E7); background: var(--wg-bg, #fff); color: var(--wg-fg); outline: none; min-width: 0;"
          />
          <button onClick=${addToBlocklist} style="padding: 5px 10px; font-size: 10px; cursor: pointer; border: none; background: var(--wg-fg, #09090B); color: var(--wg-bg, #fff);">+</button>
          <button onClick=${blockCurrentSite} style="padding: 5px 10px; font-size: 9px; cursor: pointer; border: 1px solid var(--wg-border, #E4E4E7); background: none; color: var(--wg-muted);" title=${t('more.blockCurrent')}>${t('more.blockCurrent')}</button>
        </div>
        ${blocklist.length > 0 && html`
          <div style="max-height: 120px; overflow-y: auto;">
            ${blocklist.map(site => html`
              <div key=${site} style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 10px; color: var(--wg-fg);">
                <span>${site}</span>
                <button onClick=${() => removeFromBlocklist(site)} style="background: none; border: none; cursor: pointer; color: var(--wg-muted); font-size: 12px; padding: 0 4px;">×</button>
              </div>
            `)}
          </div>
        `}
      </div>

      <!-- Re-flip action -->
      <div style="padding: 14px 20px; border-top: 1px solid var(--wg-border, #E4E4E7);">
        <button
          onClick=${handleReflip}
          aria-label="Re-flip current page"
          style="
            width: 100%; padding: 10px; cursor: pointer; border: none;
            font-family: var(--wg-mono, monospace); font-size: 10px;
            letter-spacing: 0.5px;
            transition: all 150ms ease-out;
            ${reflipDone
              ? 'background: #30d158; color: #fff;'
              : 'background: var(--wg-fg, #09090B); color: var(--wg-bg, #fff);'
            }
          "
        >${reflipDone ? 'DONE' : t('more.reflip')}</button>
      </div>

      <!-- Danger zone — visually separated -->
      <div style="padding: 14px 20px; border-top: 2px solid var(--wg-highlight, #DC2626);">
        <button
          onClick=${handleReset}
          aria-label=${confirmReset ? 'Confirm reset — this cannot be undone' : 'Reset all data'}
          style="
            width: 100%; padding: 10px; cursor: pointer; border: none;
            font-family: var(--wg-mono, monospace); font-size: 10px;
            letter-spacing: 0.5px;
            transition: all 150ms ease-out;
            ${confirmReset
              ? 'background: var(--wg-highlight, #DC2626); color: #fff;'
              : 'background: none; border: 1px solid var(--wg-highlight, #DC2626); color: var(--wg-highlight, #DC2626); opacity: 0.6;'
            }
          "
        >${confirmReset ? t('more.resetConfirm') : t('more.reset')}</button>
        ${confirmReset && html`
          <div style="font-size: 10px; color: var(--wg-highlight, #DC2626); margin-top: 6px;">
            ${t('more.resetWarning')}
          </div>
        `}
      </div>
    </div>
  `;
}
