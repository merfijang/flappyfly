// Spike: learn from every decision inside an attempt (REINFORCE), on the shipping readout.
import { calibrateReadout } from '../src/core/calibrate';
import { STEP_SECONDS } from '../src/core/pace';
import { NeuralPolicy, paramCount } from '../src/core/policy';
import { buildGroups } from '../src/core/sensing';
import { FlappyGame, type Course } from '../src/game/FlappyGame';
import { loadBrain } from '../server/brainFiles';

const ATTEMPTS = Number(process.argv[2] ?? 400), KEEP = Number(process.argv[3] ?? 64);
const SPEED = Number(process.argv[4] ?? 0.5), GAP = Number(process.argv[5] ?? 260), SPAWN = Number(process.argv[6] ?? 2.6);
const LR = Number(process.argv[7] ?? 0.15), GAMMA = Number(process.argv[8] ?? 0.98);
const course: Course = { gap: GAP, spawnEvery: SPAWN, speed: 132 };
const brain = loadBrain(), groups = buildGroups(brain.meta);
const t0 = Date.now();
const readout = calibrateReadout(brain, groups, brain.meta, { keep: KEEP });
const policy = new NeuralPolicy(brain, groups, readout);
const D = paramCount(readout), w = new Float64Array(D); w[D - 1] = -0.35;
let rng = 12345; const U = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296);
let baseline = 0; const scores: number[] = [];
console.log(`calibrated in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${readout.names.length} groups`);
for (let a = 1; a <= ATTEMPTS; a++) {
  const seed = (a * 2654435761) >>> 0;
  let dead = false;
  const game = new FlappyGame(seed, () => { dead = true; }, course);
  game.start(); policy.begin(Array.from(w), seed);
  const xs: Float64Array[] = [], acts: number[] = [], ps: number[] = [], rew: number[] = [];
  let last = 0;
  while (!dead && game.elapsed < 45) {
    const { flap, p, action } = policy.tick(game.capture(), (game.elapsed / SPEED) * 1000, U);
    if (flap) game.flap();
    game.update(STEP_SECONDS * SPEED);
    xs.push(Float64Array.from(policy.features)); acts.push(action ? 1 : 0); ps.push(p);
    rew.push(0.01 + (game.score - last)); last = game.score;
  }
  if (dead) rew[rew.length - 1] -= 1;
  const ret = new Float64Array(rew.length);
  let g = 0;
  for (let t = rew.length - 1; t >= 0; t--) { g = rew[t] + GAMMA * g; ret[t] = g; }
  const mean = ret.reduce((s, x) => s + x, 0) / Math.max(1, ret.length);
  baseline = baseline * 0.9 + mean * 0.1;
  let sd = 0; for (const r of ret) sd += (r - baseline) ** 2;
  sd = Math.sqrt(sd / Math.max(1, ret.length)) || 1;
  const scale = LR / Math.max(50, rew.length);
  for (let t = 0; t < rew.length; t++) {
    const adv = (ret[t] - baseline) / sd, e = (acts[t] - ps[t]) * adv * scale;
    for (let j = 0; j < D - 1; j++) w[j] += e * xs[t][j];
    w[D - 1] += e;
  }
  scores.push(game.score);
  if (a % 25 === 0) {
    const s = scores.slice(-25);
    console.log(`a=${a} meanPipes=${(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2)} best=${Math.max(...scores)} |w|=${Math.hypot(...w).toFixed(2)} min=${((Date.now() - t0) / 60000).toFixed(1)}`);
  }
}
