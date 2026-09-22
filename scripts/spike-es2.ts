// THROWAWAY spike v2: OpenAI-style ES (antithetic pairs share a seed, rank-shaped), 1 attempt = 1 sample.
import { loadBrain } from '../server/brainFiles';
import { buildGroups, sense, readFeatures, FEATURES } from '../src/core/sensing';
import { FlappyGame } from '../src/game/FlappyGame';
import { FlyDecoder } from '../src/brain/FlyDecoder';
const ablate = process.argv[2] === 'ablate', ATTEMPTS = Number(process.argv[3] ?? 400), CAP = 30, POP = 10, SIGMA = 0.5, LR = 0.5;
const MEAN = [0.1672, 0.2081, 0.7190, 0.6927, 0.8522, 0.8248, 0.0663, 0.1020, 0.0434, 0.0524, 0.5910, 0.5598];
const STD = [0.0606, 0.0599, 0.2207, 0.2198, 0.2347, 0.2425, 0.0490, 0.0524, 0.0495, 0.0461, 0.2919, 0.2804];
const brain = loadBrain(), g = buildGroups(brain.meta), F = FEATURES.length, D = F + 1;
const raw = new Float32Array(F), tr = new Float32Array(F);
let r = 12345; const U = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
const N = () => { let u = 0; while (!u) u = U(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * U()); };
function play(theta: number[], seed: number) {
  brain.reset(seed); tr.fill(0); const dec = new FlyDecoder(2, 260); let dead = false;
  const game = new FlappyGame(seed, () => { dead = true; }); game.start();
  while (!dead && game.elapsed < CAP) {
    sense(brain, g, game.capture()); brain.step(); readFeatures(brain, g, raw);
    let z = theta[F];
    for (let k = 0; k < F; k++) { tr[k] = tr[k] * 0.86 + raw[k] * 0.14; if (!ablate) z += theta[k] * (tr[k] - MEAN[k]) / STD[k]; }
    if (dec.decide(game.elapsed * 1000, 1 / (1 + Math.exp(-z)) >= 0.5) === 'FLAP') game.flap();
    game.update(0.02);
  }
  return { fit: game.score + game.elapsed / 2.1, score: game.score };
}
let theta = [...Array(F).fill(0), -0.35]; const t0 = Date.now(); let gen = 0, best = 0;
for (let a = 0; a < ATTEMPTS; a += POP) {
  const eps: number[][] = [], fits: number[] = [];
  for (let k = 0; k < POP / 2; k++) {
    const e = Array.from({ length: D }, N), seed = ((gen * 131 + k) * 2654435761) >>> 0;
    for (const sgn of [1, -1]) { const res = play(theta.map((x, i) => x + sgn * SIGMA * e[i]), seed); eps.push(e.map((v) => sgn * v)); fits.push(res.fit); best = Math.max(best, res.score); }
  }
  const order = fits.map((_, i) => i).sort((i, j) => fits[i] - fits[j]), u = Array(POP).fill(0);
  order.forEach((i, rank) => (u[i] = rank / (POP - 1) - 0.5));
  for (let d = 0; d < D; d++) { let s = 0; for (let i = 0; i < POP; i++) s += u[i] * eps[i][d]; theta[d] += (LR / (POP * SIGMA)) * s; }
  gen++;
  console.log(`${ablate ? 'ABL' : 'FULL'} gen=${gen} attempts=${a + POP} meanFit=${(fits.reduce((s, x) => s + x, 0) / POP).toFixed(2)} maxFit=${Math.max(...fits).toFixed(2)} best=${best} min=${((Date.now() - t0) / 60000).toFixed(1)}`);
}
const evals = Array.from({ length: 20 }, (_, i) => play(theta, 999000 + i));
console.log(`${ablate ? 'ABL' : 'FULL'} FINAL mean theta over 20 fresh seeds: meanScore=${(evals.reduce((s, e) => s + e.score, 0) / 20).toFixed(2)} meanFit=${(evals.reduce((s, e) => s + e.fit, 0) / 20).toFixed(2)} max=${Math.max(...evals.map((e) => e.score))} theta=${theta.map((x) => x.toFixed(2)).join(',')}`);
