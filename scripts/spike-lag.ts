// Spike: how much does readout smoothing cost in lag, and what does that do in-game?
import { loadBrain } from '../server/brainFiles';
import { buildGroups, sense } from '../src/core/sensing';
import { FlappyGame } from '../src/game/FlappyGame';
import { FlyDecoder } from '../src/brain/FlyDecoder';
const brain = loadBrain(), g = buildGroups(brain.meta), m = brain.meta;
const dnClass = new Set(['descending_neuron', 'descending_neuron_tbc']), groups = new Map<string, number[]>();
for (let i = 0; i < m.n; i++) if (dnClass.has(m.superclasses[m.classIdx[i]])) { const k = `${m.types[m.typeIdx[i]]} ${m.side[i] === 2 ? 'R' : 'L'}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(i); }
const names = [...groups.keys()], ids = names.map((k) => Int32Array.from(groups.get(k)!)), G = names.length;
const rateInto = (out: Float32Array) => { for (let k = 0; k < G; k++) { let h = 0; for (const id of ids[k]) h += brain.spiked[id]; out[k] = h / ids[k].length; } };

const STEPS = 9000, raw: Float32Array[] = [], want: number[] = [];
let rnd = 7; const R = () => ((rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0) / 4294967296);
let birdY = 320, vy = 0, gap = 320, pipeX = 480; brain.reset(1);
const buf = new Float32Array(G);
for (let i = 0; i < STEPS; i++) {
  if (i % 150 === 0) { gap = 155 + R() * 310; birdY = 120 + R() * 400; vy = -140 + R() * 300; pipeX = 350 + R() * 180; }
  vy += 22.4; birdY += vy * 0.02; const y = birdY > gap + 8 && vy > -60 ? 1 : 0; if (y) vy = -355; pipeX -= 2.64;
  sense(brain, g, { birdY, birdVelocityY: vy, pipeX, pipeWidth: 72, gapTop: gap - 105, gapBottom: gap + 105, gapCenterY: gap, distanceToPipe: pipeX - 112 });
  brain.step(); rateInto(buf); raw.push(Float32Array.from(buf)); want.push(y);
}
function build(alpha: number) {
  const tr = new Float32Array(G), X: Float32Array[] = [], Y: number[] = [];
  for (let i = 0; i < STEPS; i++) {
    for (let k = 0; k < G; k++) tr[k] = alpha * tr[k] + (1 - alpha) * raw[i][k];
    if (i % 150 > 20) { X.push(Float32Array.from(tr)); Y.push(want[i]); }
  }
  return { X, Y };
}
function fitAndScore(alpha: number, K: number) {
  const { X, Y } = build(alpha), n = X.length;
  const mean = new Float64Array(G), sd = new Float64Array(G), corr = new Float64Array(G);
  for (const x of X) for (let k = 0; k < G; k++) mean[k] += x[k] / n;
  for (const x of X) for (let k = 0; k < G; k++) sd[k] += (x[k] - mean[k]) ** 2 / n;
  const my = Y.reduce((a, b) => a + b, 0) / n;
  for (let k = 0; k < G; k++) { sd[k] = Math.sqrt(sd[k]); let c = 0; for (let i = 0; i < n; i++) c += (X[i][k] - mean[k]) * (Y[i] - my); corr[k] = sd[k] > 1e-6 ? c / n / (sd[k] * Math.sqrt(my * (1 - my))) : 0; }
  const sel = [...Array(G).keys()].filter((k) => sd[k] > 0.004).sort((a, b) => Math.abs(corr[b]) - Math.abs(corr[a])).slice(0, K);
  const d = sel.length, w = new Float64Array(d + 1);
  for (let ep = 0; ep < 250; ep++) {
    const gw = new Float64Array(d + 1);
    for (let i = 0; i < n; i += 2) { let z = w[d]; for (let j = 0; j < d; j++) z += w[j] * (X[i][sel[j]] - mean[sel[j]]) / sd[sel[j]]; const p = 1 / (1 + Math.exp(-z)), e = p - Y[i]; for (let j = 0; j < d; j++) gw[j] += e * (X[i][sel[j]] - mean[sel[j]]) / sd[sel[j]]; gw[d] += e; }
    for (let j = 0; j <= d; j++) w[j] -= 0.6 * gw[j] / (n / 2) + (j < d ? 1e-3 * w[j] : 0);
  }
  let acc = 0, cnt = 0; for (let i = 1; i < n; i += 2) { let z = w[d]; for (let j = 0; j < d; j++) z += w[j] * (X[i][sel[j]] - mean[sel[j]]) / sd[sel[j]]; acc += (z > 0 ? 1 : 0) === Y[i] ? 1 : 0; cnt++; }
  // fly it
  const tr = new Float32Array(G), r2 = new Float32Array(G); let total = 0, best = 0;
  for (let s = 0; s < 6; s++) {
    brain.reset(3000 + s); tr.fill(0); const dec = new FlyDecoder(2, 260); let dead = false;
    const game = new FlappyGame(3000 + s, () => { dead = true; }); game.start();
    while (!dead && game.elapsed < 45) {
      sense(brain, g, game.capture()); brain.step(); rateInto(r2);
      for (const k of sel) tr[k] = alpha * tr[k] + (1 - alpha) * r2[k];
      let z = w[d]; for (let j = 0; j < d; j++) z += w[j] * (tr[sel[j]] - mean[sel[j]]) / sd[sel[j]];
      if (dec.decide(game.elapsed * 1000, z > 0) === 'FLAP') game.flap();
      game.update(0.02);
    }
    total += game.score; best = Math.max(best, game.score);
  }
  console.log(`alpha=${alpha} K=${K} heldout acc=${(acc / cnt).toFixed(3)} → mean ${(total / 6).toFixed(1)} pipes, best ${best}`);
}
for (const alpha of [0.86, 0.6, 0.3, 0]) fitAndScore(alpha, 32);
fitAndScore(0, 64); fitAndScore(0.3, 64);
