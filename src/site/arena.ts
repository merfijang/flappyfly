// The game as the server plays it: pipes and the fly drawn as dots, from streamed frames.
import type { Frame } from '../shared/protocol';
import { bodyPoint, project, rng, wingPoint, type Projection } from './flyShape';

const W = 480, H = 640, GROUND = 594, PIPE_W = 72, BIRD_X = 112;

export class Arena {
  private readonly ctx: CanvasRenderingContext2D;
  private frameData: Frame | null = null;
  private readonly fly: Float32Array;
  private readonly wing: Float32Array;
  private wingFlash = 0;
  private readonly p: Projection = { x: 0, y: 0, depth: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    const d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = W * d; canvas.height = H * d; this.ctx.scale(d, d);
    const r = rng(3), body: number[] = [], wing: number[] = [];
    for (let i = 0; i < 420; i++) body.push(...bodyPoint(r));
    for (let i = 0; i < 160; i++) wing.push(...wingPoint(i % 2 ? 1 : -1, r));
    this.fly = Float32Array.from(body); this.wing = Float32Array.from(wing);
    requestAnimationFrame(this.draw);
  }

  show(frame: Frame | null) {
    if (frame?.flap) this.wingFlash = 1;
    this.frameData = frame;
  }

  private readonly draw = () => {
    const c = this.ctx, f = this.frameData;
    c.fillStyle = '#080b12'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(143,198,255,.07)';
    for (let y = 16; y < GROUND; y += 24) for (let x = 12; x < W; x += 24) c.fillRect(x, y, 1.2, 1.2);
    if (f) for (const [x, top, bottom] of f.pipes) { this.pipe(x, 0, top); this.pipe(x, bottom, GROUND); }
    c.fillStyle = 'rgba(191,220,255,.45)';
    for (let x = 2; x < W; x += 6) c.fillRect(x, GROUND, 2, 2);
    this.drawFly(f ? f.y : 320, f ? f.vy : 0);
    if (f) {
      c.fillStyle = '#e6ecf5'; c.textAlign = 'center';
      c.font = 'italic 400 64px "Instrument Serif", Georgia, serif';
      c.fillText(String(f.score), W / 2, 84);
    }
    this.wingFlash *= 0.8;
    requestAnimationFrame(this.draw);
  };

  /** A pipe is a column of dots; its lip at the gap is drawn brighter. */
  private pipe(x: number, from: number, to: number) {
    const c = this.ctx;
    c.fillStyle = 'rgba(159,180,214,.5)';
    for (let y = from + 3; y < to - 2; y += 5) for (let px = x + 3; px < x + PIPE_W - 2; px += 5) c.fillRect(px, y, 1.6, 1.6);
    c.strokeStyle = 'rgba(191,220,255,.28)'; c.lineWidth = 1; c.strokeRect(x + 0.5, from + 0.5, PIPE_W - 1, to - from - 1);
    const lip = from === 0 ? to : from;
    c.fillStyle = '#bfdcff';
    for (let px = x - 4; px < x + PIPE_W + 4; px += 4) c.fillRect(px, lip + (from === 0 ? -2 : 0), 2.2, 2.2);
  }

  private drawFly(y: number, vy: number) {
    const c = this.ctx, p = this.p, tilt = Math.max(-0.4, Math.min(0.5, vy / 700)), S = 78;
    const cos = Math.cos(tilt), sin = Math.sin(tilt), lift = this.wingFlash;
    const put = (x: number, py: number, z: number, alpha: number, color: string, size: number) => {
      project([x, py, z], 0.3, 0.55, p);
      const dx = -p.x * S * -1, dy = -p.y * S; // head to the right, flying forward
      c.globalAlpha = alpha; c.fillStyle = color;
      c.fillRect(BIRD_X + dx * cos - dy * sin, y + dx * sin + dy * cos, size, size);
    };
    for (let i = 0; i < this.wing.length; i += 3) put(this.wing[i], this.wing[i + 1] + lift * 0.25, this.wing[i + 2], 0.25 + lift * 0.5, '#9fb4d6', 1.3);
    for (let i = 0; i < this.fly.length; i += 3) put(this.fly[i], this.fly[i + 1], this.fly[i + 2], 0.85, '#f4fbff', 1.5);
    c.globalAlpha = 1;
  }
}
