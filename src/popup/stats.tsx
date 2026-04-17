import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { sendMessage } from '../core/messages.js';
import { t } from '../core/i18n.js';
import { WeeklyReport } from './weekly-report.js';
import type { UserWordState, WordStatus } from '../core/types.js';

const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

const STATUS_ORDER: WordStatus[] = ['new', 'seen', 'learning', 'reviewing', 'mastered'];
const STATUS_COLORS: Record<WordStatus, string> = {
  new: '#A1A1AA',
  seen: '#93c5fd',
  learning: '#6ee7b7',
  reviewing: '#fcd34d',
  mastered: '#34d399',
};
const STATUS_LABELS: Record<WordStatus, string> = {
  new: 'New',
  seen: 'Seen',
  learning: 'Learning',
  reviewing: 'Reviewing',
  mastered: 'Mastered',
};

function toSparkline(values: number[]): string {
  const max = Math.max(...values, 1);
  return values.map(v => SPARK_CHARS[Math.min(7, Math.round((v / max) * 7))]).join('');
}

export function Stats() {
  const [weekSummary, setWeekSummary] = useState<{ thisWeek: number; lastWeek: number; domains: string[]; masteryRate: number; streak: number } | null>(null);
  const [weekly, setWeekly] = useState<{ date: string; count: number }[]>([]);
  const [wordStates, setWordStates] = useState<UserWordState[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    Promise.all([
      sendMessage({ type: 'GET_WEEK_SUMMARY' }),
      sendMessage({ type: 'GET_WEEKLY_STATS' }),
      sendMessage({ type: 'GET_ALL_WORD_STATES' }),
    ]).then(([ws, w, states]) => {
      setWeekSummary(ws);
      setWeekly(w);
      setWordStates(states);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return html`<div style="padding: 40px; text-align: center; color: var(--wg-muted, #999); font-size: 12px;">${t('stats.loading')}</div>`;
  }

  const ws = weekSummary ?? { thisWeek: 0, lastWeek: 0, domains: [], masteryRate: 0, streak: 0 };
  const diff = ws.thisWeek - ws.lastWeek;
  const sparkline = toSparkline(weekly.map(d => d.count));

  // Mastery buckets
  const buckets: Record<WordStatus, number> = { new: 0, seen: 0, learning: 0, reviewing: 0, mastered: 0 };
  for (const state of wordStates) {
    if (state.status in buckets) buckets[state.status]++;
  }
  const tracked = wordStates.filter(s => s.status !== 'new');
  const totalTracked = tracked.length;

  // Recently mastered (most recent first)
  const mastered = wordStates
    .filter(s => s.status === 'mastered')
    .sort((a, b) => (b.masteredAt ?? 0) - (a.masteredAt ?? 0));
  const displayMastered = showAll ? mastered : mastered.slice(0, 15);

  const mono = 'font-family: var(--wg-mono, monospace);';
  const sectionLabel = `font-size: 10px; letter-spacing: 1px; color: var(--wg-muted, #A1A1AA); ${mono} margin-bottom: 10px;`;

  if (wordStates.length === 0) {
    return html`
      <div style="padding: 40px 20px; text-align: center;">
        <div style="font-size: 13px; color: var(--wg-muted, #A1A1AA); line-height: 1.6;">
          ${t('stats.emptyHint')}
        </div>
      </div>
    `;
  }

  return html`
    <div style="padding: 16px 20px; overflow-y: auto; max-height: 460px;">

      <!-- Week Summary -->
      <div style="margin-bottom: 20px;">
        <div style=${sectionLabel}>${t('stats.weekSummary')}</div>
        <div style="${mono} font-size: 28px; font-weight: 700; line-height: 1; letter-spacing: -0.5px;">
          ${ws.thisWeek}
          <span style="font-size: 13px; font-weight: 400; color: var(--wg-muted, #A1A1AA); margin-left: 4px;">${t('stats.expressions')}</span>
        </div>
        <div style="font-size: 11px; margin-top: 6px; ${mono}
          color: ${diff > 0 ? '#16A34A' : diff < 0 ? '#DC2626' : 'var(--wg-muted, #A1A1AA)'};
        ">
          ${diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0'} ${t('stats.vsLastWeek')}
        </div>
        ${ws.domains.length > 0 && html`
          <div style="font-size: 11px; color: var(--wg-muted, #A1A1AA); margin-top: 4px; ${mono}">
            ${ws.domains.slice(0, 3).join(' · ')}
          </div>
        `}
      </div>

      <!-- 7-day Sparkline -->
      <div style="margin-bottom: 20px; padding: 12px 0; border-top: 1px solid var(--wg-border, #E4E4E7); border-bottom: 1px solid var(--wg-border, #E4E4E7); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style=${sectionLabel}>${t('stats.last7')}</div>
          <div style="${mono} font-size: 18px; letter-spacing: 2px; line-height: 1;">
            ${sparkline}
          </div>
        </div>
        ${ws.streak > 0 && html`
          <div style="text-align: right;">
            <div style="${mono} font-size: 22px; font-weight: 700; line-height: 1;">${ws.streak}</div>
            <div style="font-size: 9px; color: var(--wg-muted, #A1A1AA); margin-top: 2px; ${mono}">
              ${t('stats.streak')}
            </div>
          </div>
        `}
      </div>

      <!-- Mastery Progress -->
      <div style="margin-bottom: 20px;">
        <div style=${sectionLabel}>${t('stats.mastery')} · ${ws.masteryRate}% ${t('stats.masteryRate')}</div>
        ${totalTracked > 0 ? html`
          <div style="display: flex; height: 12px; overflow: hidden; margin-bottom: 8px;">
            ${STATUS_ORDER.filter(s => buckets[s] > 0).map(s => html`
              <div key=${s} style="
                flex: ${buckets[s]};
                background: ${STATUS_COLORS[s]};
                min-width: 2px;
              " title="${STATUS_LABELS[s]}: ${buckets[s]}"></div>
            `)}
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${STATUS_ORDER.filter(s => buckets[s] > 0).map(s => html`
              <div key=${s} style="display: flex; align-items: center; gap: 4px; font-size: 10px;">
                <div style="width: 8px; height: 8px; background: ${STATUS_COLORS[s]};"></div>
                <span style="color: var(--wg-muted, #999);">${STATUS_LABELS[s]}</span>
                <span style="${mono} font-weight: 600;">${buckets[s]}</span>
              </div>
            `)}
          </div>
        ` : html`
          <div style="font-size: 11px; color: var(--wg-muted, #bbb);">${t('stats.noWords')}</div>
        `}
      </div>

      <!-- Recently Mastered -->
      <div>
        <div style=${sectionLabel}>${t('stats.recentMastered')}</div>
        ${mastered.length === 0
          ? html`<div style="font-size: 11px; color: var(--wg-muted, #A1A1AA);">${t('stats.noMastered')}</div>`
          : html`
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${displayMastered.map(ws => html`
                <span key=${ws.wordId} style="
                  ${mono} font-size: 11px; font-weight: 500;
                  padding: 3px 8px;
                  background: ${STATUS_COLORS.mastered}22;
                  color: ${STATUS_COLORS.mastered};
                  border: 1px solid ${STATUS_COLORS.mastered}44;
                ">
                  ${ws.wordId}
                </span>
              `)}
            </div>
            ${!showAll && mastered.length > 15 && html`
              <button
                onClick=${() => setShowAll(true)}
                style="
                  background: none; border: none; cursor: pointer;
                  font-size: 10px; color: var(--wg-muted, #A1A1AA);
                  ${mono} padding: 8px 0 0; margin: 0;
                "
              >${t('stats.viewAll')} (${mastered.length})</button>
            `}
          `
        }
      </div>

      <!-- Weekly Report Card -->
      <${WeeklyReport} data=${ws} daily=${weekly} />
    </div>
  `;
}
