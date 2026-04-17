import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { sendMessage } from '../core/messages.js';

export function LLMSettings() {
  const [config, setConfig] = useState({ enabled: false, endpoint: 'http://localhost:11434', model: 'qwen2' });
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');

  useEffect(() => {
    sendMessage({ type: 'GET_LLM_CONFIG' }).then(setConfig).catch(() => {});
  }, []);

  async function save(partial: Partial<typeof config>) {
    const updated = { ...config, ...partial };
    setConfig(updated);
    await sendMessage({ type: 'SAVE_LLM_CONFIG', config: updated }).catch(() => {});
  }

  async function testConnection() {
    setStatus('testing');
    try {
      const resp = await fetch(`${config.endpoint}/api/tags`, { signal: AbortSignal.timeout(3000) });
      setStatus(resp.ok ? 'ok' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return html`
    <div style="padding: 16px 20px;">
      <div style="font-size: 9px; letter-spacing: 1.5px; color: var(--wg-muted, #A1A1AA); text-transform: uppercase; margin-bottom: 10px; font-family: var(--wg-mono, monospace);">
        LLM Disambiguation
      </div>

      <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer;">
        <input type="checkbox" checked=${config.enabled}
          onChange=${(e: Event) => save({ enabled: (e.target as HTMLInputElement).checked })} />
        <span style="font-size: 13px;">Enable LLM (requires local Ollama or remote API)</span>
      </label>

      ${config.enabled && html`
        <div style="font-size: 10px; color: var(--wg-highlight, #DC2626); margin-bottom: 8px; line-height: 1.4;">
          Privacy: When enabled, page text snippets are sent to the configured endpoint for disambiguation. Use a local model (Ollama) to keep data on-device. Do not include credentials in the endpoint URL.
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <input
            value=${config.endpoint}
            onInput=${(e: Event) => save({ endpoint: (e.target as HTMLInputElement).value })}
            placeholder="http://localhost:11434"
            style="padding: 8px; border: 1.5px solid var(--wg-border, #E4E4E7); font-size: 12px; font-family: var(--wg-mono, monospace);"
          />
          <input
            value=${config.model}
            onInput=${(e: Event) => save({ model: (e.target as HTMLInputElement).value })}
            placeholder="qwen2"
            style="padding: 8px; border: 1.5px solid var(--wg-border, #E4E4E7); font-size: 12px; font-family: var(--wg-mono, monospace);"
          />
          <button onClick=${testConnection} style="
            padding: 8px; border: 1.5px solid var(--wg-border, #E4E4E7); background: none;
            font-size: 11px; cursor: pointer; font-family: var(--wg-mono, monospace);
          ">
            ${status === 'testing' ? 'Testing...' : status === 'ok' ? '✓ Connected' : status === 'error' ? '✗ Failed' : 'Test Connection'}
          </button>
        </div>
      `}
    </div>
  `;
}
