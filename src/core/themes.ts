import type { Theme } from './types.js';

export const THEMES: Record<string, Theme> = {
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    nameCn: '杂志编辑风',
    abbr: 'EDT',
    mark: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontStyle: 'italic',
      color: '#B91C1C',
      borderBottom: '1.5px solid #B91C1C',
      padding: '0 1px',
    },
    decode: {
      border: '2px solid #B91C1C',
      borderRadius: '4px',
      background: '#FAFAF7',
      headerFont: 'Georgia, serif',
      labelStyle: 'font-variant: small-caps; letter-spacing: 0.5px; color: #A8A29E; font-size: 9px;',
    },
    popup: {
      background: '#FAFAF7',
      foreground: '#1C1917',
      accent: '#B91C1C',
      fontFamily: 'Georgia, serif',
      outerBorder: '#B91C1C',
      swatchRadius: '4px',
    },
    cssVariables: {
      '--wg-bg': '#FAFAF7',
      '--wg-fg': '#1C1917',
      '--wg-accent': '#B91C1C',
      '--wg-mark-font': 'Georgia, "Times New Roman", serif',
      '--wg-mono': '"Courier New", monospace',
      '--wg-muted': '#A8A29E',
      '--wg-border': '#E7E5E4',
      '--wg-border-heavy': '#B91C1C',
      '--wg-highlight': '#DC2626',
    },
  },
  brutalist: {
    id: 'brutalist',
    name: 'Brutalist',
    nameCn: '粗野主义',
    abbr: 'BRT',
    mark: {
      fontFamily: '"SF Mono", Menlo, "Courier New", monospace',
      background: '#09090B',
      color: '#FAFAFA',
      padding: '1px 6px',
      letterSpacing: '0.5px',
    },
    decode: {
      border: '2px solid #09090B',
      borderRadius: '0',
      background: '#FFFFFF',
      headerFont: '"SF Mono", Menlo, monospace',
      labelStyle: 'text-transform: uppercase; letter-spacing: 1.5px; font-size: 9px; color: #A1A1AA; font-family: "SF Mono", Menlo, monospace;',
    },
    popup: {
      background: '#FFFFFF',
      foreground: '#09090B',
      accent: '#09090B',
      fontFamily: '"SF Mono", Menlo, monospace',
      outerBorder: '#09090B',
      swatchRadius: '0',
    },
    cssVariables: {
      '--wg-bg': '#FFFFFF',
      '--wg-fg': '#09090B',
      '--wg-accent': '#09090B',
      '--wg-mark-font': '"SF Mono", Menlo, "Courier New", monospace',
      '--wg-mono': '"SF Mono", Menlo, "Courier New", monospace',
      '--wg-muted': '#71717A',
      '--wg-border': '#E4E4E7',
      '--wg-border-heavy': '#09090B',
      '--wg-highlight': '#DC2626',
    },
  },
  soft: {
    id: 'soft',
    name: 'Soft',
    nameCn: '柔和彩蛋风',
    abbr: 'SFT',
    mark: {
      background: 'linear-gradient(120deg, #EDE9FE, #FCE7F3)',
      color: '#6D28D9',
      borderRadius: '12px',
      padding: '2px 8px',
      fontWeight: '600',
    },
    decode: {
      border: '2px solid #6D28D9',
      borderRadius: '16px',
      background: '#FDFBFF',
      headerFont: '-apple-system, "Helvetica Neue", sans-serif',
      labelStyle: 'font-weight: 600; letter-spacing: 0.5px; color: #9CA3AF; font-size: 9px;',
    },
    popup: {
      background: 'linear-gradient(145deg, #FAF8FF, #FDF8FC)',
      foreground: '#1E1B2E',
      accent: '#6D28D9',
      fontFamily: '-apple-system, "Helvetica Neue", sans-serif',
      outerBorder: '#6D28D9',
      swatchRadius: '10px',
    },
    cssVariables: {
      '--wg-bg': '#FDFBFF',
      '--wg-fg': '#1E1B2E',
      '--wg-accent': '#6D28D9',
      '--wg-mark-font': 'inherit',
      '--wg-mono': '"SF Mono", Menlo, monospace',
      '--wg-muted': '#9CA3AF',
      '--wg-border': '#E9E5F5',
      '--wg-border-heavy': '#6D28D9',
      '--wg-highlight': '#DC2626',
    },
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    nameCn: '精确克制风',
    abbr: 'MIN',
    mark: {
      color: '#0071E3',
      borderBottom: '1.5px solid #0071E3',
      padding: '0 0 0.5px 0',
    },
    decode: {
      border: '2px solid #0071E3',
      borderRadius: '8px',
      background: '#FFFFFF',
      headerFont: '-apple-system, "SF Pro Text", sans-serif',
      labelStyle: 'letter-spacing: 0.3px; font-size: 10px; color: #86868B;',
    },
    popup: {
      background: '#FFFFFF',
      foreground: '#1D1D1F',
      accent: '#0071E3',
      fontFamily: '-apple-system, "SF Pro Text", sans-serif',
      outerBorder: '#0071E3',
      swatchRadius: '6px',
    },
    cssVariables: {
      '--wg-bg': '#FFFFFF',
      '--wg-fg': '#1D1D1F',
      '--wg-accent': '#0071E3',
      '--wg-mark-font': 'inherit',
      '--wg-mono': '"SF Mono", Menlo, monospace',
      '--wg-muted': '#86868B',
      '--wg-border': '#E8E8ED',
      '--wg-border-heavy': '#0071E3',
      '--wg-highlight': '#DC2626',
    },
  },
};

export function getTheme(id: string): Theme {
  return THEMES[id] ?? THEMES.brutalist;
}

export function generateThemeCSS(theme: Theme): string {
  return Object.entries(theme.cssVariables)
    .map(([key, val]) => `${key}: ${val};`)
    .join('\n  ');
}
