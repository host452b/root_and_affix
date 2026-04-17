import { html } from 'htm/preact';
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { sendMessage } from '../core/messages.js';
import { THEMES } from '../core/themes.js';
import { LEVEL_CONFIGS } from '../core/constants.js';
import { BANKS, getBankLabel, getBanksByTier, TIER_LABELS, type DifficultyTier } from '../core/banks.js';
import { t, getLocale, setLocale, loadLocale, type Locale } from '../core/i18n.js';
import { CustomBank } from './custom-bank.js';
import { Stats } from './stats.js';
import { MoreTab } from './more.js';
import type { UserSettings, InvasionLevel } from '../core/types.js';

type PopupTab = 'main' | 'stats' | 'settings';

// Unicode sparkline characters for 7-day trend
const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

function toSparkline(values: number[]): string {
  const max = Math.max(...values, 1);
  return values.map(v => SPARK_CHARS[Math.min(7, Math.round((v / max) * 7))]).join('');
}

function Popup() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [summary, setSummary] = useState<{ todayWords: number; yesterdayWords: number; domains: string[]; streak: number } | null>(null);
  const [weekly, setWeekly] = useState<{ date: string; count: number }[]>([]);
  const [activeTab, setActiveTab] = useState<PopupTab>('main');
  const [locale, setLocaleState] = useState<Locale>(getLocale());
  const [settingsOpen, setSettingsOpen] = useState(false);

  function toggleLocale() {
    const next = locale === 'zh' ? 'en' : 'zh';
    setLocale(next);
    setLocaleState(next);
  }

  useEffect(() => {
    loadLocale().then(setLocaleState);
    sendMessage({ type: 'GET_SETTINGS' }).then(setSettings).catch(() => {});
    sendMessage({ type: 'GET_TODAY_SUMMARY' }).then(setSummary).catch(() => {});
    sendMessage({ type: 'GET_WEEKLY_STATS' }).then(setWeekly).catch(() => {});
  }, []);

  if (!settings) return html`<div style="padding: 40px; text-align: center; color: var(--wg-muted, #A1A1AA); font-size: 12px;">Loading...</div>`;

  const theme = THEMES[settings.theme];
  const levelConfig = LEVEL_CONFIGS[settings.invasionLevel];
  const activeTextColor = theme.popup.background.startsWith('linear-gradient') ? '#fff' : theme.popup.background;

  async function updateSetting(partial: Partial<UserSettings>) {
    const updated = await sendMessage({ type: 'SAVE_SETTINGS', settings: partial });
    setSettings(updated);
  }

  const tabStyle = (active: boolean) => `
    flex: 1; padding: 10px 4px; text-align: center; cursor: pointer;
    font-family: ${theme.popup.fontFamily}; font-size: 11px; letter-spacing: 0.5px;
    border: none; transition: color 150ms ease-out;
    ${active
      ? `background: ${theme.popup.background}; color: ${theme.popup.foreground}; font-weight: 600; border-bottom: 2px solid ${theme.popup.foreground};`
      : `background: transparent; color: var(--wg-muted, #A1A1AA); border-bottom: 2px solid transparent;`
    }
  `;

  // Summary data
  const todayWords = summary?.todayWords ?? 0;
  const diff = todayWords - (summary?.yesterdayWords ?? 0);
  const domains = summary?.domains ?? [];
  const streak = summary?.streak ?? 0;
  const sparkline = toSparkline(weekly.map(w => w.count));

  // Mode summary
  const modeSummary = `${levelConfig.nameCn} · ${domains.length > 0 ? domains.slice(0, 2).join('/') : getBankLabel(settings.wordBanks[0] ?? 'ielts')}`;

  return html`
    <div style="
      background: ${theme.popup.background};
      color: ${theme.popup.foreground};
      font-family: ${theme.popup.fontFamily};
      min-height: 480px;
      border: 2px solid ${theme.popup.outerBorder};
    ">
      <!-- Header -->
      <div style="padding: 16px 20px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid ${theme.popup.outerBorder};">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px; font-weight: 700; letter-spacing: -0.3px;">FlipWord</span>
            <button onClick=${toggleLocale} style="
              font-size: 10px; padding: 2px 6px; cursor: pointer;
              background: none; border: 1px solid var(--wg-border, #E4E4E7);
              color: var(--wg-muted, #A1A1AA); font-family: ${theme.popup.fontFamily};
              border-radius: 2px;
            ">${t('lang.switch')}</button>
          </div>
          <div style="font-size: 10px; color: var(--wg-muted, #A1A1AA); letter-spacing: 1px; margin-top: 3px;">
            ${settings.paused ? t('header.off') : t('header.active')}
          </div>
        </div>
        <!-- Flip Toggle -->
        <div
          onClick=${() => updateSetting({ paused: !settings.paused })}
          role="switch"
          aria-checked=${!settings.paused}
          aria-label=${settings.paused ? 'Enable FlipWord' : 'Disable FlipWord'}
          style="width: 40px; height: 24px; cursor: pointer; perspective: 200px;"
          title=${settings.paused ? 'Enable FlipWord' : 'Disable FlipWord'}
        >
          <div style="
            width: 100%; height: 100%; position: relative;
            transition: transform 0.4s ease-out;
            transform-style: preserve-3d;
            transform: ${settings.paused ? 'rotateY(180deg)' : 'rotateY(0deg)'};
          ">
            <div style="
              position: absolute; inset: 0; backface-visibility: hidden;
              background: ${theme.popup.foreground}; border-radius: 4px;
              display: flex; align-items: center; justify-content: center;
              font-family: var(--wg-mono, monospace); font-size: 10px; font-weight: 700;
              color: ${activeTextColor}; letter-spacing: 0.5px;
            ">ON</div>
            <div style="
              position: absolute; inset: 0; backface-visibility: hidden;
              transform: rotateY(180deg);
              background: var(--wg-border, #E4E4E7); border-radius: 4px;
              display: flex; align-items: center; justify-content: center;
              font-family: var(--wg-mono, monospace); font-size: 10px; font-weight: 700;
              color: var(--wg-muted, #A1A1AA); letter-spacing: 0.5px;
            ">OFF</div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div style="display: flex;">
        ${(['main', 'stats', 'settings'] as PopupTab[]).map(tab => html`
          <button key=${tab} onClick=${() => setActiveTab(tab)} style=${tabStyle(activeTab === tab)}>
            ${t(`tab.${tab === 'settings' ? 'more' : tab}`)}
          </button>
        `)}
      </div>

      <!-- Tab Content -->
      ${activeTab === 'main' ? html`
        <!-- Today Immersion Summary -->
        <div style="padding: 20px 20px 16px;">
          <div style="font-size: 10px; letter-spacing: 1px; color: var(--wg-muted, #A1A1AA); margin-bottom: 12px; font-family: var(--wg-mono, monospace);">
            ${t('home.todayTitle')}
          </div>
          ${todayWords > 0 ? html`
            <div style="font-family: var(--wg-mono, monospace); font-size: 28px; font-weight: 700; line-height: 1; letter-spacing: -0.5px;">
              ${todayWords}
              <span style="font-size: 13px; font-weight: 400; color: var(--wg-muted, #A1A1AA); margin-left: 4px;">${t('home.expressions')}</span>
            </div>
            ${domains.length > 0 && html`
              <div style="font-size: 11px; color: var(--wg-muted, #A1A1AA); margin-top: 6px; font-family: var(--wg-mono, monospace);">
                ${domains.slice(0, 3).join(' · ')}
              </div>
            `}
            <div style="font-size: 11px; margin-top: 8px; font-family: var(--wg-mono, monospace);
              color: ${diff > 0 ? '#16A34A' : diff < 0 ? '#DC2626' : 'var(--wg-muted, #A1A1AA)'};
            ">
              ${diff > 0 ? `+${diff} ${t('home.vsYesterday.more')}`
                : diff < 0 ? `${diff} ${t('home.vsYesterday.less')}`
                : t('home.vsYesterday.same')}
            </div>
          ` : html`
            <div style="font-size: 13px; color: var(--wg-muted, #A1A1AA); line-height: 1.5;">
              ${t('home.noActivity')}
            </div>
          `}
        </div>

        <!-- Weekly Sparkline + Streak -->
        <div style="padding: 12px 20px; border-top: 1px solid var(--wg-border, #E4E4E7); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 10px; letter-spacing: 1px; color: var(--wg-muted, #A1A1AA); margin-bottom: 6px; font-family: var(--wg-mono, monospace);">
              ${t('home.weekTrend')}
            </div>
            <div style="font-family: var(--wg-mono, monospace); font-size: 18px; letter-spacing: 2px; line-height: 1;">
              ${sparkline}
            </div>
          </div>
          ${streak > 0 && html`
            <div style="text-align: right;">
              <div style="font-family: var(--wg-mono, monospace); font-size: 22px; font-weight: 700; line-height: 1;">
                ${streak}
              </div>
              <div style="font-size: 9px; color: var(--wg-muted, #A1A1AA); margin-top: 2px; font-family: var(--wg-mono, monospace);">
                ${t('stats.streak')}
              </div>
            </div>
          `}
        </div>

        <!-- Current Mode + Settings Trigger -->
        <div style="padding: 12px 20px; border-top: 1px solid var(--wg-border, #E4E4E7);">
          <div style="font-size: 10px; letter-spacing: 1px; color: var(--wg-muted, #A1A1AA); margin-bottom: 6px; font-family: var(--wg-mono, monospace);">
            ${t('home.currentMode')}
          </div>
          <div style="font-size: 12px; font-family: var(--wg-mono, monospace); margin-bottom: 8px;">
            ${modeSummary}
          </div>
          <button
            onClick=${() => setSettingsOpen(!settingsOpen)}
            style="
              background: none; border: none; cursor: pointer;
              font-size: 11px; color: var(--wg-muted, #A1A1AA);
              font-family: var(--wg-mono, monospace); padding: 0;
              transition: color 150ms ease-out;
            "
          >${t('home.adjustSettings')}</button>
        </div>

        <!-- Collapsible Settings Drawer -->
        ${settingsOpen && html`
          <div style="border-top: 1px solid var(--wg-border, #E4E4E7);">
            <!-- Level Selector -->
            <div style="padding: 14px 20px; border-bottom: 1px solid var(--wg-border, #E4E4E7);">
              <div style="font-size: 10px; letter-spacing: 1px; color: var(--wg-muted, #A1A1AA); margin-bottom: 8px; font-family: var(--wg-mono, monospace);">
                ${t('level.title')}
              </div>
              <div style="display: flex; gap: 6px;">
                ${([1,2,3,4] as InvasionLevel[]).map(level => {
                  return html`
                    <button
                      key=${level}
                      onClick=${() => updateSetting({ invasionLevel: level })}
                      aria-label=${`Level ${level}`}
                      style="
                        flex: 1; padding: 7px; text-align: center; border: none;
                        font-size: 11px; cursor: pointer;
                        transition: background 150ms ease-out, color 150ms ease-out;
                        ${settings.invasionLevel === level
                          ? `background: ${theme.popup.foreground}; color: ${activeTextColor}; font-weight: 600;`
                          : `background: none; border: 1px solid var(--wg-border, #E4E4E7); color: var(--wg-muted, #A1A1AA);`
                        }
                      "
                    >L${level}</button>
                  `;
                })}
              </div>
              <div style="font-size: 9px; color: var(--wg-muted, #A1A1AA); margin-top: 6px; font-family: var(--wg-mono, monospace);">
                ${locale === 'en' ? levelConfig.hintEn : levelConfig.hint}
              </div>
            </div>

            <!-- Theme Selector -->
            <div style="padding: 14px 20px; border-bottom: 1px solid var(--wg-border, #E4E4E7);">
              <div style="font-size: 10px; letter-spacing: 1px; color: var(--wg-muted, #A1A1AA); margin-bottom: 8px; font-family: var(--wg-mono, monospace);">
                ${t('theme.title')}
              </div>
              <div style="display: flex; gap: 8px;">
                ${Object.values(THEMES).map(th => html`
                  <button
                    key=${th.id}
                    onClick=${() => updateSetting({ theme: th.id })}
                    aria-label=${`Theme: ${th.name}`}
                    style="display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; background: none; border: none; padding: 0; ${settings.theme !== th.id ? 'opacity: 0.6;' : ''} transition: opacity 150ms ease-out;"
                  >
                    <div style="
                      width: 28px; height: 28px;
                      border-radius: ${th.popup.swatchRadius};
                      background: ${th.id === 'brutalist' ? '#09090B' : th.id === 'soft' ? 'linear-gradient(135deg,#FAF8FF,#FDF8FC)' : th.popup.background};
                      border: ${settings.theme === th.id ? `2px solid ${th.popup.outerBorder}` : `1.5px solid ${th.id === 'brutalist' ? '#09090B' : th.popup.outerBorder}`};
                    "></div>
                    <div style="font-size: 9px; font-family: var(--wg-mono, monospace); color: ${settings.theme === th.id ? theme.popup.foreground : 'var(--wg-muted, #A1A1AA)'}; font-weight: ${settings.theme === th.id ? '600' : '400'};">
                      ${th.abbr}
                    </div>
                  </button>
                `)}
              </div>
            </div>

            <!-- Word Bank Selector -->
            <div style="padding: 14px 20px;">
              <div style="font-size: 10px; letter-spacing: 1px; color: var(--wg-muted, #A1A1AA); margin-bottom: 8px; font-family: var(--wg-mono, monospace);">
                ${t('bank.title')}
              </div>
              ${([1, 2, 3, 4] as DifficultyTier[]).map(tier => {
                const tierBanks = getBanksByTier(tier);
                return html`
                  <div key=${tier} style="margin-bottom: 8px;">
                    <div style="font-size: 9px; color: var(--wg-muted, #A1A1AA); margin-bottom: 4px; font-family: var(--wg-mono, monospace); letter-spacing: 1px;">
                      ${t(`bank.tier${tier}`)}
                    </div>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                      ${tierBanks.map(({ id: bank }) => {
                        const isActive = settings.wordBanks.includes(bank);
                        return html`
                          <button
                            key=${bank}
                            onClick=${() => {
                              const banks = isActive
                                ? settings.wordBanks.filter(b => b !== bank)
                                : [...settings.wordBanks, bank];
                              if (banks.length > 0) updateSetting({ wordBanks: banks });
                            }}
                            aria-label=${`${getBankLabel(bank)} word bank`}
                            aria-pressed=${isActive}
                            style="
                              padding: 5px 10px; font-size: 10px; cursor: pointer; border: none;
                              font-family: var(--wg-mono, monospace); text-transform: uppercase;
                              transition: background 150ms ease-out, color 150ms ease-out;
                              ${isActive
                                ? `background: ${theme.popup.foreground}; color: ${activeTextColor}; font-weight: 600;`
                                : `background: none; border: 1px solid var(--wg-border, #E4E4E7); color: var(--wg-muted, #A1A1AA);`
                              }
                            "
                          >${getBankLabel(bank)}</button>
                        `;
                      })}
                    </div>
                  </div>
                `;
              })}
            </div>
            <!-- Radar Toggle -->
            <div style="padding: 14px 20px; border-top: 1px solid var(--wg-border, #E4E4E7);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 10px; letter-spacing: 1px; color: var(--wg-muted, #A1A1AA); font-family: var(--wg-mono, monospace);">
                    ${t('radar.title')}
                  </div>
                  <div style="font-size: 9px; color: var(--wg-muted, #A1A1AA); margin-top: 3px; font-family: var(--wg-mono, monospace);">
                    ${t('radar.desc')}
                  </div>
                </div>
                <button
                  onClick=${() => updateSetting({ radarEnabled: !settings.radarEnabled })}
                  aria-label=${settings.radarEnabled ? 'Disable English annotation' : 'Enable English annotation'}
                  style="
                    padding: 4px 10px; font-size: 10px; cursor: pointer; border: none;
                    font-family: var(--wg-mono, monospace); font-weight: 600;
                    letter-spacing: 0.5px; transition: all 150ms ease-out;
                    ${settings.radarEnabled
                      ? `background: ${theme.popup.foreground}; color: ${activeTextColor};`
                      : `background: none; border: 1px solid var(--wg-border, #E4E4E7); color: var(--wg-muted, #A1A1AA);`
                    }
                  "
                >${settings.radarEnabled ? 'ON' : 'OFF'}</button>
              </div>
            </div>
          </div>
        `}
      `
      : activeTab === 'stats' ? html`<${Stats} />`
      : html`
        <!-- Settings tab: custom bank + more -->
        <${CustomBank} />
        <${MoreTab} />
      `
      }
    </div>
  `;
}

render(html`<${Popup} />`, document.getElementById('app')!);
