// Spike v2: balanced fit (label = "below the gap"), threshold search, and a sanity control
// that fits the same way on the true game state instead of neurons.
import { loadBrain } from '../server/brainFiles';
import { buildGroups, sense } from '../src/core/sensing';
import { FlappyGame } from '../src/game/FlappyGame';
import { FlyDecoder } from '../src/brain/FlyDecoder';
const brain = loadBrain(), g = buildGroups(brain.meta), m = brain.meta;
const dnClass = new Set(['descending_neuron', 'descending_neuron_tbc']), groups = new Map<string, number[]>();
for (let i = 0; i < m.n; i++) if (dnClass.has(m.superclasses[m.classIdx[i]])) { const k = `${m.types[m.typeIdx[i]]} ${m.side[i] === 2 ? 'R' : 'L'}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(i); }
const names = [...groups.keys()], ids = names.map((k) => Int32Array.from(groups.get(k)!)), G = names.length;
const rateInto = (out: Float32Array) => { for (let k = 0; k < G; k++) { let h = 0; for (const id of ids[k]) h += brain.spiked[id]; out[k] = h / ids[k].length; } };

const STEPS = 9000, raw: Float32Array[] = [], below: number[] = [], state: [number, number][] = [];
let rnd = 7; const R = () => ((rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0) / 4294967296);
let birdY = 320, vy = 0, gap = 320, pipeX = 480; brain.reset(1);
const buf = new Float32Array(G);
for (let i = 0; i < STEPS; i++) {
  if (i % 150 === 0) { gap = 155 + R() * 310; birdY = 120 + R() * 400; vy = -140 + R() * 300; pipeX = 350 + R() * 180; }
  vy += 22.4; birdY += vy * 0.02; if (birdY > gap + 8 && vy > -60) vy = -355; pipeX -= 2.64;
  sense(brain, g, { birdY, birdVelocityY: vy, pipeX, pipeWidth: 72, gapTop: gap - 105, gapBottom: gap + 105, gapCenterY: gap, distanceToPipe: pipeX - 112 });
  brain.step(); rateInto(buf);
  raw.push(Float32Array.from(buf)); below.push(birdY > gap ? 1 : 0); state.push([(birdY - gap) / 120, vy / 300]);
}
/** logistic fit with class balancing */
function fit(X: number[][], Y: number[]) {
  const d = X[0].length, w = new Float64Array(d + 1);
  const pos = Y.reduce((a, b) => a + b, 0), neg = Y.length - pos, pw = neg / Math.max(1, pos);
  for (let ep = 0; ep < 400; ep++) {
    const gw = new Float64Array(d + 1); let norm = 0;
    for (let i = 0; i < X.length; i += 2) {
      let z = w[d]; for (let j = 0; j < d; j++) z += w[j] * X[i][j];
      const p = 1 / (1 + Math.exp(-z)), weight = Y[i] ? pw : 1, e = (p - Y[i]) * weight;
      for (let j = 0; j < d; j++) gw[j] += e * X[i][j]; gw[d] += e; norm += weight;
    }
    for (let j = 0; j <= d; j++) w[j] -= 0.5 * gw[j] / norm + (j < d ? 1e-3 * w[j] : 0);
  }
  let tp = 0, tn = 0, p0 = 0, n0 = 0;
  for (let i = 1; i < X.length; i += 2) { let z = w[d]; for (let j = 0; j < d; j++) z += w[j] * X[i][j]; const hit = z > 0; if (Y[i]) { p0++; if (hit) tp++; } else { n0++; if (!hit) tn++; } }
  return { w, balancedAcc: (tp / Math.max(1, p0) + tn / Math.max(1, n0)) / 2 };
}
function flyNeural(alpha: number, sel: number[], w: Float64Array, shift: number, seeds: number) {
  const tr = new Float32Array(G), r2 = new Float32Array(G); let total = 0, best = 0;
  for (let s = 0; s < seeds; s++) {
    brain.reset(3000 + s); tr.fill(0); const dec = new FlyDecoder(2, 260); let dead = false;
    const game = new FlappyGame(3000 + s, () => { dead = true; }); game.start();
    while (!dead && game.elapsed < 45) {
      sense(brain, g, game.capture()); brain.step(); rateInto(r2);
      for (const k of sel) tr[k] = alpha * tr[k] + (1 - alpha) * r2[k];
      let z = w[sel.length] + shift; for (let j = 0; j < sel.length; j++) z += w[j] * tr[sel[j]];
      if (dec.decide(game.elapsed * 1000, z > 0) === 'FLAP') game.flap();
      game.update(0.02);
    }
    total += game.score; best = Math.max(best, game.score);
  }
  return { mean: total / seeds, best };
}
// control: same fitting and gating, but the features are the true state
{
  const X = state.map(([a, b]) => [a, b]), { w, balancedAcc } = fit(X, below);
  let total = 0, best = 0;
  for (let s = 0; s < 6; s++) {
    let dead = false; const game = new FlappyGame(3000 + s, () => { dead = true; }); game.start(); const dec = new FlyDecoder(2, 260);
    while (!dead && game.elapsed < 45) {
      const st = game.capture(), z = w[2] + w[0] * ((st.birdY - st.gapCenterY) / 120) + w[1] * (st.birdVelocityY / 300);
      if (dec.decide(game.elapsed * 1000, z > 0) === 'FLAP') game.flap();
      game.update(0.02);
    }
    total += game.score; best = Math.max(best, game.score);
  }
  console.log(`control (true state, 2 features)   bAcc=${balancedAcc.toFixed(3)} → mean ${(total / 6).toFixed(1)} pipes, best ${best}`);
}
for (const alpha of [0.86, 0.5, 0.2, 0]) {
  const tr = new Float32Array(G), X: number[][] = [], Y: number[] = [];
  for (let i = 0; i < STEPS; i++) { for (let k = 0; k < G; k++) tr[k] = alpha * tr[k] + (1 - alpha) * raw[i][k]; if (i % 150 > 20) { X.push(Array.from(tr)); Y.push(below[i]); } }
  const n = X.length, mean = new Float64Array(G), sd = new Float64Array(G), corr = new Float64Array(G);
  for (const x of X) for (let k = 0; k < G; k++) mean[k] += x[k] / n;
  for (const x of X) for (let k = 0; k < G; k++) sd[k] += (x[k] - mean[k]) ** 2 / n;
  const my = Y.reduce((a, b) => a + b, 0) / n;
  for (let k = 0; k < G; k++) { sd[k] = Math.sqrt(sd[k]); let c = 0; for (let i = 0; i < n; i++) c += (X[i][k] - mean[k]) * (Y[i] - my); corr[k] = sd[k] > 1e-6 ? c / n / (sd[k] * Math.sqrt(my * (1 - my))) : 0; }
  const sel = [...Array(G).keys()].filter((k) => sd[k] > 0.004).sort((a, b) => Math.abs(corr[b]) - Math.abs(corr[a])).slice(0, 32);
  const Xs = X.map((x) => sel.map((k) => (x[k] - mean[k]) / Math.max(0.02, sd[k])));
  const { w, balancedAcc } = fit(Xs, Y);
  // scale the weights back so the flight code can use raw traces
  const wr = new Float64Array(sel.length + 1); let b0 = w[sel.length];
  sel.forEach((k, j) => { const s = Math.max(0.02, sd[k]); wr[j] = w[j] / s; b0 -= (w[j] * mean[k]) / s; });
  wr[sel.length] = b0;
  let bestRun = { mean: -1, best: 0, shift: 0 };
  for (const shift of [-2, -1, -0.5, 0, 0.5, 1, 2]) { const r = flyNeural(alpha, sel, wr, shift, 4); if (r.mean > bestRun.mean) bestRun = { ...r, shift }; }
  const final = flyNeural(alpha, sel, wr, bestRun.shift, 8);
  console.log(`alpha=${alpha} K=32 |r|max=${Math.abs(corr[sel[0]]).toFixed(2)} bAcc=${balancedAcc.toFixed(3)} → mean ${final.mean.toFixed(1)} pipes, best ${final.best} (shift ${bestRun.shift})`);
}
