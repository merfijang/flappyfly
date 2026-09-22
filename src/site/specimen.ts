// The specimen: every dot is one real neuron of the running connectome, placed by brain region,
// lit when the server reports that it fired in the last 100 ms. Wings are drawn, not neurons.
import { regionPoint, rng, wingPoint, project, type Projection } from './flyShape';

const WING_DOTS = 2600;

export class Specimen {
  private readonly ctx: CanvasRenderingContext2D;
  private points: Float32Array = new Float32Array(0);
  private heat: Float32Array = new Float32Array(0);
  private readonly wings: Float32Array;
  private count = 0;
  private wingFlash = 0;
  private pointer = 0; private pointerTarget = 0;
  private t = 0;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly p: Projection = { x: 0, y: 0, depth: 0 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    const r = rng(7);
    this.wings = new Float32Array(WING_DOTS * 3);
    for (let i = 0; i < WING_DOTS; i++) this.wings.set(wingPoint(i % 2 ? 1 : -1, r), i * 3);
    new ResizeObserver(() => this.fit()).observe(canvas);
    window.addEventListener('pointermove', (e: PointerEvent) => { this.pointerTarget = (e.clientX / innerWidth - 0.5) * 0.5; });
    this.fit();
    requestAnimationFrame(this.frame);
  }

  /** One dot per display neuron, positioned by its region. */
  setNeurons(region: Uint8Array) {
    const r = rng(1);
    this.count = region.length;
    this.points = new Float32Array(this.count * 3);
    this.heat = new Float32Array(this.count);
    for (let k = 0; k < this.count; k++) this.points.set(regionPoint(region[k], r), k * 3);
  }

  /** Bits from the server: 1 = fired in the last 100 ms. */
  activity(bits: Uint8Array) {
    for (let k = 0; k < this.count; k++) if (bits[k]) this.heat[k] = 1;
  }

  flap() { this.wingFlash = 1; }

  private fit() {
    const r = this.canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(2, Math.floor(r.width * d));
    this.canvas.height = Math.max(2, Math.floor(r.height * d));
  }

  private readonly frame = () => {
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height, dpr = Math.min(devicePixelRatio || 1, 2);
    c.fillStyle = '#080b12'; c.fillRect(0, 0, W, H);
    this.pointer += (this.pointerTarget - this.pointer) * 0.05;
    const yaw = (this.reduced ? 0 : Math.sin(this.t * 0.17) * 0.22) + this.pointer, pitch = 0.58;
    const S = Math.min(W * 0.62, H * 1.05), cx = W * 0.47, cy = H * 0.5;
    const p = this.p;

    // wings first so the body draws over them; a flap lifts and brightens them for a moment
    const lift = this.wingFlash;
    for (let i = 0; i < WING_DOTS; i++) {
      const x = this.wings[i * 3], y = this.wings[i * 3 + 1] + lift * (0.2 - x) * 0.35, z = this.wings[i * 3 + 2] * (1 + lift * 0.4);
      project([x, y, z], yaw, pitch, p);
      c.globalAlpha = 0.16 + Math.max(0, p.depth + 0.5) * 0.12 + lift * 0.3;
      c.fillStyle = '#9fb4d6';
      const s = 0.9 * dpr; c.fillRect(cx - p.x * S, cy - p.y * S, s, s);
    }

    for (let k = 0; k < this.count; k++) {
      project([this.points[k * 3], this.points[k * 3 + 1], this.points[k * 3 + 2]], yaw, pitch, p);
      const h = this.heat[k], near = Math.max(0, Math.min(1, p.depth + 0.5));
      c.globalAlpha = Math.min(1, 0.16 + near * 0.34 + h * 0.8);
      c.fillStyle = h > 0.35 ? '#f4fbff' : near > 0.55 ? '#bfdcff' : '#6f9ccf';
      const s = (0.6 + near * 0.7 + h * 1.4) * dpr;
      c.fillRect(cx - p.x * S, cy - p.y * S, s, s);
      if (h > 0) this.heat[k] = h < 0.02 ? 0 : h * 0.82;
    }
    c.globalAlpha = 1;
    this.wingFlash *= 0.86;
    if (!this.reduced) this.t += 0.016;
    requestAnimationFrame(this.frame);
  };
}
