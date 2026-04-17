import { ParticlePool } from './particles.js';
import type { CritEvent } from '../crit/index.js';
import type { Theme } from '../core/types.js';
import { EXTENSION_PREFIX } from '../core/constants.js';

let canvas: HTMLCanvasElement | null = null;
let pool: ParticlePool | null = null;

function ensureCanvas(): ParticlePool {
  if (canvas && pool) return pool;

  canvas = document.createElement('canvas');
  canvas.id = `${EXTENSION_PREFIX}-fx`;
  canvas.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: 2147483647;
  `;
  // Set actual pixel dimensions
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.documentElement.appendChild(canvas);

  // Resize handler
  window.addEventListener('resize', () => {
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });

  pool = new ParticlePool(canvas);
  return pool;
}

/** Play canvas FX for high-tier crits only */
export function playCanvasCrit(event: CritEvent, theme: Theme): void {
  // Only Godlike (×20), Beyond Godlike (×30+), and daily-complete use canvas
  if (event.type === 'combo-20') {
    playGodlike(event, theme);
  } else if (event.type === 'combo-30') {
    playBeyondGodlike(event, theme);
  } else if (event.type === 'daily-complete') {
    playDailyComplete(theme);
  }
}

function getThemeColors(theme: Theme): string[] {
  const accent = theme.cssVariables['--wg-accent'] ?? '#111';
  const fg = theme.cssVariables['--wg-fg'] ?? '#333';
  // Generate a palette from the theme
  return [accent, fg, '#ffd60a', '#ff6b6b'];
}

function playGodlike(event: CritEvent, theme: Theme): void {
  const p = ensureCanvas();
  const origin = event.position ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const colors = getThemeColors(theme);

  // Burst of 200 particles
  p.emit(origin, 200, {
    colors,
    speedRange: [3, 12],
    sizeRange: [2, 6],
    lifeRange: [30, 80],
    spread: Math.PI * 2,
  });

  // Screen shake via CSS
  document.body.style.animation = 'none';
  document.body.offsetHeight; // force reflow
  document.body.style.transition = 'transform 0.05s';
  let shakes = 0;
  const shake = () => {
    if (shakes >= 6) {
      document.body.style.transform = '';
      document.body.style.transition = '';
      return;
    }
    const x = (Math.random() - 0.5) * 8;
    const y = (Math.random() - 0.5) * 8;
    document.body.style.transform = `translate(${x}px, ${y}px)`;
    shakes++;
    setTimeout(shake, 50);
  };
  shake();
}

function playBeyondGodlike(event: CritEvent, theme: Theme): void {
  const p = ensureCanvas();
  const colors = getThemeColors(theme);

  // Cascading particle rain from top
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const x = Math.random() * window.innerWidth;
      p.emit({ x, y: -10 }, 50, {
        colors,
        speedRange: [1, 4],
        sizeRange: [1.5, 4],
        lifeRange: [40, 100],
        spread: Math.PI * 0.5,
        gravity: 0.2,
      });
    }, i * 150);
  }

  // Brief color inversion
  document.documentElement.style.filter = 'invert(1)';
  setTimeout(() => {
    document.documentElement.style.filter = '';
  }, 200);
}

function playDailyComplete(theme: Theme): void {
  const p = ensureCanvas();
  const colors = ['#ffd60a', '#ff9f0a', '#30d158', '#5ac8fa', ...getThemeColors(theme)];
  const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // Centered celebration burst
  p.emit(center, 300, {
    colors,
    speedRange: [2, 10],
    sizeRange: [2, 7],
    lifeRange: [40, 100],
    spread: Math.PI * 2,
  });
}
