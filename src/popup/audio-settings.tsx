import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { sendMessage } from '../core/messages.js';

export function AudioSettings() {
  const [config, setConfig] = useState({ enabled: false, volume: 0.3 });

  useEffect(() => {
    sendMessage({ type: 'GET_AUDIO_CONFIG' }).then(setConfig).catch(() => {});
  }, []);

  async function save(partial: Partial<typeof config>) {
    const updated = { ...config, ...partial };
    setConfig(updated);
    await sendMessage({ type: 'SAVE_AUDIO_CONFIG', config: updated }).catch(() => {});
  }

  return html`
    <div style="padding: 16px 20px;">
      <div style="font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 10px; font-family: var(--wg-mono, monospace);">
        Sound Effects
      </div>

      <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer;">
        <input type="checkbox" checked=${config.enabled}
          onChange=${(e: Event) => save({ enabled: (e.target as HTMLInputElement).checked })} />
        <span style="font-size: 13px;">Enable crit sound effects</span>
      </label>

      ${config.enabled && html`
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 11px; color: var(--wg-muted, #999); min-width: 50px;">Volume</span>
          <input
            type="range"
            min="0"
            max="100"
            value=${Math.round(config.volume * 100)}
            onInput=${(e: Event) => save({ volume: (e.target as HTMLInputElement).valueAsNumber / 100 })}
            style="flex: 1;"
          />
          <span style="font-size: 11px; color: var(--wg-muted, #999); min-width: 32px; text-align: right;">
            ${Math.round(config.volume * 100)}%
          </span>
        </div>
      `}
    </div>
  `;
}
