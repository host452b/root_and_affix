import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { t } from '../core/i18n.js';

interface WeekReportData {
  thisWeek: number;
  lastWeek: number;
  domains: string[];
  masteryRate: number;
  streak: number;
}

interface DailyData {
  date: string;
  count: number;
}

/**
 * High-DPI weekly report card.
 * 1080×1350 canvas (3x of 360×450 logical) for retina-sharp sharing.
 */
function renderReportCanvas(data: WeekReportData, daily: DailyData[]): string {
  const DPR = 3;
  const LW = 360;
  const LH = 450;
  const W = LW * DPR;
  const H = LH * DPR;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(DPR, DPR);

  // ── Background: warm off-white paper ──
  const bg = ctx.createLinearGradient(0, 0, 0, LH);
  bg.addColorStop(0, '#FAF8F5');
  bg.addColorStop(1, '#F3EFE9');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, LW, LH);

  // Paper grain texture — subtle warm horizontal lines
  ctx.strokeStyle = 'rgba(120,100,70,0.03)';
  ctx.lineWidth = 0.5;
  for (let y = 0; y < LH; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LW, y);
    ctx.stroke();
  }

  const PAD = 32;
  const RIGHT = LW - PAD;

  // ── Top: brand + date ──
  ctx.fillStyle = '#8C7A62';
  ctx.font = '500 10px monospace';
  ctx.fillText('FlipWord', PAD, 36);

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const fmt = (d: Date) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${fmt(weekAgo)} – ${fmt(now)}`, RIGHT, 36);
  ctx.textAlign = 'left';

  // ── Thin divider ──
  ctx.strokeStyle = '#D6CDBF';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(PAD, 50);
  ctx.lineTo(RIGHT, 50);
  ctx.stroke();

  // ── Hero number ──
  ctx.fillStyle = '#1A1612';
  ctx.font = '800 72px monospace';
  ctx.fillText(`${data.thisWeek}`, PAD, 118);

  // Unit label
  ctx.fillStyle = '#8C7A62';
  ctx.font = '400 13px sans-serif';
  ctx.fillText('个英文表达，本周吸收', PAD, 140);

  // ── Week comparison pill ──
  const diff = data.thisWeek - data.lastWeek;
  if (diff !== 0) {
    const pillText = `${diff > 0 ? '+' : ''}${diff} vs 上周`;
    ctx.font = '500 11px monospace';
    const pillW = ctx.measureText(pillText).width + 16;
    const pillX = PAD;
    const pillY = 152;

    // Pill background
    ctx.fillStyle = diff > 0 ? 'rgba(45, 106, 55, 0.1)' : 'rgba(180, 70, 50, 0.1)';
    roundRect(ctx, pillX, pillY, pillW, 22, 3);
    ctx.fill();

    // Pill border
    ctx.strokeStyle = diff > 0 ? 'rgba(45, 106, 55, 0.25)' : 'rgba(180, 70, 50, 0.25)';
    ctx.lineWidth = 0.5;
    roundRect(ctx, pillX, pillY, pillW, 22, 3);
    ctx.stroke();

    // Pill text
    ctx.fillStyle = diff > 0 ? '#2D6A37' : '#B44632';
    ctx.font = '500 11px monospace';
    ctx.fillText(pillText, pillX + 8, pillY + 15);
  }

  // ── 7-day bar chart ──
  const barAreaTop = 196;
  const barAreaH = 80;
  const barGap = 6;
  const totalBarW = RIGHT - PAD;
  const barW = (totalBarW - barGap * 6) / 7;
  const maxCount = Math.max(...daily.map(d => d.count), 1);

  // Day labels
  const dayLabels = ['一', '二', '三', '四', '五', '六', '日'];

  daily.forEach((day, i) => {
    const x = PAD + i * (barW + barGap);
    const barH = Math.max(2, (day.count / maxCount) * barAreaH);
    const barY = barAreaTop + barAreaH - barH;

    // Bar with gradient
    const isToday = i === daily.length - 1;
    if (day.count > 0) {
      const barGrad = ctx.createLinearGradient(x, barY, x, barAreaTop + barAreaH);
      if (isToday) {
        barGrad.addColorStop(0, '#1A1612');
        barGrad.addColorStop(1, '#5C4F3D');
      } else {
        barGrad.addColorStop(0, '#C4B9A8');
        barGrad.addColorStop(1, '#D6CDBF');
      }
      ctx.fillStyle = barGrad;
    } else {
      ctx.fillStyle = '#EDE8E0';
    }
    roundRect(ctx, x, barY, barW, barH, 2);
    ctx.fill();

    // Count on top of bar (only if > 0)
    if (day.count > 0) {
      ctx.fillStyle = isToday ? '#1A1612' : '#8C7A62';
      ctx.font = `${isToday ? '600' : '400'} 9px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${day.count}`, x + barW / 2, barY - 5);
      ctx.textAlign = 'left';
    }

    // Day label
    ctx.fillStyle = '#A89B88';
    ctx.font = '400 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dayLabels[i] ?? '', x + barW / 2, barAreaTop + barAreaH + 14);
    ctx.textAlign = 'left';
  });

  // ── Stats grid (2×2) ──
  const gridY = 310;
  const halfW = (RIGHT - PAD - 16) / 2;

  // Domain
  drawStatCell(ctx, PAD, gridY, halfW, '领域', data.domains.slice(0, 2).join(' · ') || '—');
  // Mastery
  drawStatCell(ctx, PAD + halfW + 16, gridY, halfW, '掌握率', `${data.masteryRate}%`);
  // Streak
  if (data.streak > 0) {
    drawStatCell(ctx, PAD, gridY + 40, halfW, '连续', `${data.streak} 天`);
  }

  // ── Bottom tagline ──
  ctx.strokeStyle = '#D6CDBF';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(PAD, LH - 36);
  ctx.lineTo(RIGHT, LH - 36);
  ctx.stroke();

  ctx.fillStyle = '#A89B88';
  ctx.font = '400 9px monospace';
  ctx.fillText('flip to english.', PAD, LH - 18);

  return canvas.toDataURL('image/png');
}

function drawStatCell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, value: string) {
  ctx.fillStyle = '#A89B88';
  ctx.font = '400 9px monospace';
  ctx.fillText(label, x, y);

  ctx.fillStyle = '#3D3529';
  ctx.font = '500 12px monospace';
  ctx.fillText(value, x, y + 16);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function WeeklyReport({ data, daily }: { data: WeekReportData; daily: DailyData[] }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    const url = renderReportCanvas(data, daily);
    setImageUrl(url);
  }

  async function copyToClipboard() {
    if (!imageUrl) return;
    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      downloadImage();
    }
  }

  function downloadImage() {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `flipword-weekly-${new Date().toISOString().split('T')[0]}.png`;
    a.click();
  }

  const mono = 'font-family: var(--wg-mono, monospace);';

  if (!imageUrl) {
    return html`
      <div style="padding: 14px 20px; border-top: 1px solid var(--wg-border, #E4E4E7);">
        <button
          onClick=${generate}
          style="
            width: 100%; padding: 10px; cursor: pointer; border: none;
            ${mono} font-size: 11px; letter-spacing: 0.5px;
            background: var(--wg-fg, #09090B); color: var(--wg-bg, #fff);
            transition: opacity 150ms ease-out;
          "
        >生成本周卡片</button>
      </div>
    `;
  }

  return html`
    <div style="padding: 14px 20px; border-top: 1px solid var(--wg-border, #E4E4E7);">
      <img src=${imageUrl} style="width: 100%; border: 1px solid var(--wg-border, #E4E4E7);" alt="Weekly report card" />
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button
          onClick=${copyToClipboard}
          style="
            flex: 1; padding: 8px; cursor: pointer; border: none;
            ${mono} font-size: 10px;
            background: ${copied ? '#16A34A' : 'var(--wg-fg, #09090B)'};
            color: var(--wg-bg, #fff);
            transition: background 150ms ease-out;
          "
        >${copied ? 'copied' : 'copy'}</button>
        <button
          onClick=${downloadImage}
          style="
            flex: 1; padding: 8px; cursor: pointer;
            border: 1px solid var(--wg-border, #E4E4E7);
            background: none; color: var(--wg-fg, #09090B);
            ${mono} font-size: 10px;
          "
        >save</button>
      </div>
    </div>
  `;
}
