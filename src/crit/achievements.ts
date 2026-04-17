export interface Achievement {
  id: string;
  name: string;
  nameCn: string;
  description: string;
  condition: (stats: AchievementContext) => boolean;
  icon: string;
}

export interface AchievementContext {
  totalCleared: number;
  totalExposures: number;
  bestCombo: number;
  streak: number;
  customWordsCount: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-flip',
    name: 'First Flip',
    nameCn: '首次 Flip',
    description: 'Trigger your first word replacement',
    condition: ctx => ctx.totalExposures >= 1,
    icon: '⚡',
  },
  {
    id: 'combo-10',
    name: 'Combo Master',
    nameCn: '连击大师',
    description: 'Reach a 10x combo',
    condition: ctx => ctx.bestCombo >= 10,
    icon: '🔥',
  },
  {
    id: 'clear-10',
    name: 'Decoder',
    nameCn: '解码者',
    description: 'Clear 10 words',
    condition: ctx => ctx.totalCleared >= 10,
    icon: '🔓',
  },
  {
    id: 'clear-100',
    name: 'Centurion',
    nameCn: '百词斩',
    description: 'Clear 100 words',
    condition: ctx => ctx.totalCleared >= 100,
    icon: '💯',
  },
  {
    id: 'clear-500',
    name: 'Full Immersion',
    nameCn: '全面沉浸',
    description: 'Clear 500 words — unlocks Level 4',
    condition: ctx => ctx.totalCleared >= 500,
    icon: '🔒',
  },
  {
    id: 'streak-7',
    name: 'Weekly Warrior',
    nameCn: '周周不断',
    description: 'Maintain a 7-day streak',
    condition: ctx => ctx.streak >= 7,
    icon: '📅',
  },
  {
    id: 'streak-30',
    name: 'Monthly Devotion',
    nameCn: '月度坚持',
    description: 'Maintain a 30-day streak',
    condition: ctx => ctx.streak >= 30,
    icon: '🏆',
  },
  {
    id: 'custom-10',
    name: 'Curator',
    nameCn: '策展人',
    description: 'Add 10 custom words',
    condition: ctx => ctx.customWordsCount >= 10,
    icon: '✏️',
  },
];

export function showAchievementToast(achievement: Achievement): void {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: var(--wg-fg, #111); color: var(--wg-bg, #fff);
    padding: 12px 24px; font-family: var(--wg-mono, monospace);
    font-size: 13px; z-index: 2147483647;
    animation: wg-combo-float 3s ease-out forwards;
  `;
  toast.textContent = `${achievement.icon} ${achievement.name} — ${achievement.description}`;
  document.documentElement.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
