// Evolution strategy over the readout parameters θ. One fee-paid attempt = one sample.
// Samples come in antithetic pairs (θ ± σε) flown on the same pipe layout and noise seed,
// and θ moves along the rank-weighted noise once the whole generation has flown.

export interface TrainerState {
  theta: number[]; generation: number; sigma: number; lr: number; pop: number;
  noise: number[][]; seeds: number[]; fitness: (number | null)[];
}

export interface Sample { index: number; generation: number; theta: number[]; seed: number }

export function initialTrainer(theta: number[], opts: { pop?: number; sigma?: number; lr?: number } = {}): TrainerState {
  const pop = opts.pop ?? 10;
  if (pop < 2 || pop % 2) throw new Error('population must be an even number ≥ 2');
  return { theta: [...theta], generation: 0, sigma: opts.sigma ?? 0.5, lr: opts.lr ?? 0.5, pop, noise: [], seeds: [], fitness: Array(pop).fill(null) };
}

/** How far the fly got, in pipes: passed pipes plus the fraction of the next gap (pipes spawn every 2.1 s). */
export const fitness = (score: number, seconds: number) => score + seconds / 2.1;

export class Trainer {
  private readonly issued = new Set<number>();

  constructor(readonly state: TrainerState, private readonly rand: () => number = Math.random) {}

  private gaussian() { let u = 0; while (!u) u = this.rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.rand()); }

  next(): Sample {
    const s = this.state;
    if (!s.noise.length) {
      for (let k = 0; k < s.pop / 2; k++) { s.noise.push(s.theta.map(() => this.gaussian())); s.seeds.push(Math.floor(this.rand() * 2 ** 32) >>> 0); }
    }
    const index = s.fitness.findIndex((f, i) => f === null && !this.issued.has(i));
    if (index < 0) throw new Error('every sample of this generation is already out');
    this.issued.add(index);
    const eps = s.noise[index >> 1], sign = index & 1 ? -1 : 1;
    return { index, generation: s.generation, theta: s.theta.map((x, d) => x + sign * s.sigma * eps[d]), seed: s.seeds[index >> 1] };
  }

  report(index: number, value: number) {
    const s = this.state;
    if (!(index >= 0 && index < s.pop) || s.fitness[index] !== null) throw new Error(`sample ${index} is not awaiting a result`);
    s.fitness[index] = value;
    if (s.fitness.some((f) => f === null)) return;
    const f = s.fitness as number[], order = f.map((_, i) => i).sort((a, b) => f[a] - f[b]), u = Array(s.pop).fill(0);
    order.forEach((i, rank) => (u[i] = rank / (s.pop - 1) - 0.5));
    s.theta = s.theta.map((x, d) => {
      let g = 0; for (let i = 0; i < s.pop; i++) g += u[i] * (i & 1 ? -1 : 1) * s.noise[i >> 1][d];
      return x + (s.lr / (s.pop * s.sigma)) * g;
    });
    s.generation++; s.noise = []; s.seeds = []; s.fitness = Array(s.pop).fill(null); this.issued.clear();
  }
}
