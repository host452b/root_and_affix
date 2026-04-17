export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string;
  size: number;
}

const MAX_PARTICLES = 500;

export class ParticlePool {
  particles: Particle[] = [];
  private running = false;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    // Pause when tab hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.running = false;
      else if (this.particles.length > 0) this.startLoop();
    });
  }

  emit(origin: { x: number; y: number }, count: number, config: {
    colors: string[];
    speedRange: [number, number];
    sizeRange: [number, number];
    lifeRange: [number, number];
    spread?: number;  // angle spread in radians, default full circle
    gravity?: number;
  }): void {
    const spread = config.spread ?? Math.PI * 2;
    const baseAngle = -Math.PI / 2; // upward

    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const speed = config.speedRange[0] + Math.random() * (config.speedRange[1] - config.speedRange[0]);
      const life = config.lifeRange[0] + Math.random() * (config.lifeRange[1] - config.lifeRange[0]);

      this.particles.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        size: config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]),
      });
    }

    if (!this.running) this.startLoop();
  }

  private startLoop(): void {
    this.running = true;
    const tick = () => {
      this.update();
      this.draw();
      if (this.particles.length > 0 && this.running) {
        requestAnimationFrame(tick);
      } else {
        this.running = false;
        this.clear();
      }
    };
    requestAnimationFrame(tick);
  }

  private update(): void {
    const gravity = 0.15;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += gravity;
      p.life--;
      p.size *= 0.98;
      if (p.life <= 0 || p.size < 0.3) {
        this.particles.splice(i, 1);
      }
    }
  }

  private draw(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  private clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  isActive(): boolean { return this.running; }
}
