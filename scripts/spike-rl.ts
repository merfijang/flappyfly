// Spike: REINFORCE on the DN readout — learns from every decision inside an attempt,
// instead of one fitness number per attempt like the evolution strategy.
import { loadBrain } from '../server/brainFiles';
import { buildGroups, sense } from '../src/core/sensing';
import { FlappyGame } from '../src/game/FlappyGame';
import { FlyDecoder } from '../src/brain/FlyDecoder';
const ALPHA = Number(process.argv[2] ?? 0.3), K = Number(process.argv[3] ?? 32), ATTEMPTS = Number(process.argv[4] ?? 600);
const brain = loadBrain(), g = buildGroups(brain.meta), m = brain.meta;
const dnClass = new Set(['descending_neuron', 'descending_neuron_tbc']), groups = new Map<string, number[]>();
for (let i = 0; i < m.n; i++) if (dnClass.has(m.superclasses[m.classIdx[i]])) { const k = `${m.types[m.typeIdx[i]]} ${m.side[i] === 2 ? 'R' : 'L'}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(i); }
const names = [...groups.keys()], allIds = names.map((k) => Int32Array.from(groups.get(k)!)), G = names.length;
const rateOf = (a: Int32Array) => { let h = 0; for (const id of a) h += brain.spiked[id]; return h / a.length; };

// calibration: pick the DN groups whose activity varies most while flying, and their mean/sd
const tr = new Float32Array(G), sum = new Float64Array(G), sq = new Float64Array(G);
let rnd = 7; const R = () => ((rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0) / 4294967296);
let birdY = 320, vy = 0, gap = 320, pipeX = 480, n = 0; brain.reset(1);
for (let i = 0; i < 4000; i++) {
  if (i % 150 === 0) { gap = 155 + R() * 310; birdY = 120 + R() * 400; vy = -140 + R() * 300; pipeX = 350 + R() * 180; }
  vy += 22.4; birdY += vy * 0.02; if (birdY > gap + 8 && vy > -60) vy = -355; pipeX -= 2.64;
  sense(brain, g, { birdY, birdVelocityY: vy, pipeX, pipeWidth: 72, gapTop: gap - 105, gapBottom: gap + 105, gapCenterY: gap, distanceToPipe: pipeX - 112 });
  brain.step();
  for (let k = 0; k < G; k++) tr[k] = ALPHA * tr[k] + (1 - ALPHA) * rateOf(allIds[k]);
  if (i % 150 > 20) { n++; for (let k = 0; k < G; k++) { sum[k] += tr[k]; sq[k] += tr[k] * tr[k]; } }
}
const mean = Array.from(sum, (s) => s / n), sd = Array.from(sq, (s, k) => Math.sqrt(Math.max(0, s / n - mean[k] ** 2)));
const sel = [...Array(G).keys()].sort((a, b) => sd[b] - sd[a]).slice(0, K);
console.log('features:', sel.slice(0, 8).map((k) => names[k]).join(', '), '…');
const D = sel.length, w = new Float64Array(D + 1); w[D] = -0.5;
let baseline = 0; const scores: number[] = [];
let rng = 99; const U = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296);
const GAMMA = 0.97, LR = 0.08;
for (let a = 1; a <= ATTEMPTS; a++) {
  brain.reset(a * 7919); tr.fill(0); const dec = new FlyDecoder(2, 260);
  let dead = false; const game = new FlappyGame(a * 7919, () => { dead = true; }); game.start();
  const xs: Float64Array[] = [], acts: number[] = [], ps: number[] = [], rews: number[] = [];
  let lastScore = 0;
  while (!dead && game.elapsed < 45) {
    sense(brain, g, game.capture()); brain.step();
    const x = new Float64Array(D);
    for (let j = 0; j < D; j++) { const k = sel[j]; tr[k] = ALPHA * tr[k] + (1 - ALPHA) * rateOf(allIds[k]); x[j] = (tr[k] - mean[k]) / Math.max(0.02, sd[k]); }
    let z = w[D]; for (let j = 0; j < D; j++) z += w[j] * x[j];
    const p = 1 / (1 + Math.exp(-z)), act = U() < p ? 1 : 0;
    if (dec.decide(game.elapsed * 1000, act === 1) === 'FLAP') game.flap();
    game.update(0.02);
    xs.push(x); acts.push(act); ps.push(p);
    rews.push(0.01 + (game.score - lastScore) * 1); lastScore = game.score;
  }
  if (dead) rews[rews.length - 1] -= 1;
  let G_t = 0; const returns = new Float64Array(rews.length);
  for (let t = rews.length - 1; t >= 0; t--) { G_t = rews[t] + GAMMA * G_t; returns[t] = G_t; }
  const meanRet = returns.reduce((s, x) => s + x, 0) / Math.max(1, returns.length);
  baseline = baseline * 0.9 + meanRet * 0.1;
  const scale = LR / Math.max(30, rews.length);
  for (let t = 0; t < rews.length; t++) {
    const adv = returns[t] - baseline, e = (acts[t] - ps[t]) * adv * scale;
    for (let j = 0; j < D; j++) w[j] += e * xs[t][j];
    w[D] += e;
  }
  scores.push(game.score);
  if (a % 25 === 0) {
    const last = scores.slice(-25);
    console.log(`a=${a} mean ${(last.reduce((s, x) => s + x, 0) / last.length).toFixed(2)} pipes, best ${Math.max(...scores)}, |w| ${Math.hypot(...w).toFixed(2)}`);
  }
}
