// Spike: with a stronger visual drive, can a readout of many descending neurons fly?
import { loadBrain } from '../server/brainFiles';
import { buildGroups } from '../src/core/sensing';
import { FlyEncoder } from '../src/brain/FlyEncoder';
import { FlappyGame } from '../src/game/FlappyGame';
import { FlyDecoder } from '../src/brain/FlyDecoder';
import type { FlappyState } from '../src/types';
const GAIN = Number(process.argv[2] ?? 3), ALPHA = Number(process.argv[3] ?? 0.5), K = Number(process.argv[4] ?? 64);
const brain = loadBrain(), g = buildGroups(brain.meta), m = brain.meta;
const dnClass = new Set(['descending_neuron', 'descending_neuron_tbc']), groups = new Map<string, number[]>();
for (let i = 0; i < m.n; i++) if (dnClass.has(m.superclasses[m.classIdx[i]])) { const k = `${m.types[m.typeIdx[i]]} ${m.side[i] === 2 ? 'R' : 'L'}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(i); }
const names = [...groups.keys()], ids = names.map((k) => Int32Array.from(groups.get(k)!)), G = names.length;
const rateInto = (out: Float32Array) => { for (let k = 0; k < G; k++) { let h = 0; for (const id of ids[k]) h += brain.spiked[id]; out[k] = h / ids[k].length; } };
function stimulate(st: FlappyState) {
  const s = FlyEncoder.encode(st);
  for (const a of g.lc4) brain.stimulate(a, s.lc4 * GAIN);
  for (const a of g.lplc2) brain.stimulate(a, s.lplc2 * GAIN);
  brain.stimulate(g.lc10L, (s.lc10Left + s.upward * 0.35) * GAIN);
  brain.stimulate(g.lc10R, (s.lc10Right + s.downward * 0.35) * GAIN);
}
// record
const STEPS = 9000, X: number[][] = [], Y: number[] = [], tr = new Float32Array(G), buf = new Float32Array(G);
let rnd = 7; const R = () => ((rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0) / 4294967296);
let birdY = 320, vy = 0, gap = 320, pipeX = 480; brain.reset(1);
for (let i = 0; i < STEPS; i++) {
  if (i % 150 === 0) { gap = 155 + R() * 310; birdY = 120 + R() * 400; vy = -140 + R() * 300; pipeX = 350 + R() * 180; }
  vy += 22.4; birdY += vy * 0.02; const want = birdY > gap + 8 && vy > -60 ? 1 : 0; if (want) vy = -355; pipeX -= 2.64;
  stimulate({ birdY, birdVelocityY: vy, pipeX, pipeWidth: 72, gapTop: gap - 105, gapBottom: gap + 105, gapCenterY: gap, distanceToPipe: pipeX - 112 });
  brain.step(); rateInto(buf);
  for (let k = 0; k < G; k++) tr[k] = ALPHA * tr[k] + (1 - ALPHA) * buf[k];
  if (i % 150 > 20) { X.push(Array.from(tr)); Y.push(want); }
}
const n = X.length, mean = new Float64Array(G), sd = new Float64Array(G), corr = new Float64Array(G);
for (const x of X) for (let k = 0; k < G; k++) mean[k] += x[k] / n;
for (const x of X) for (let k = 0; k < G; k++) sd[k] += (x[k] - mean[k]) ** 2 / n;
const my = Y.reduce((a, b) => a + b, 0) / n;
for (let k = 0; k < G; k++) { sd[k] = Math.sqrt(sd[k]); let c = 0; for (let i = 0; i < n; i++) c += (X[i][k] - mean[k]) * (Y[i] - my); corr[k] = sd[k] > 1e-6 ? c / n / (sd[k] * Math.sqrt(my * (1 - my))) : 0; }
const sel = [...Array(G).keys()].filter((k) => sd[k] > 0.003).sort((a, b) => Math.abs(corr[b]) - Math.abs(corr[a])).slice(0, K);
const norm = (x: number[], k: number) => (x[k] - mean[k]) / Math.max(0.02, sd[k]);
const d = sel.length, w = new Float64Array(d + 1);
const pos = Y.reduce((a, b) => a + b, 0), pw = (n - pos) / Math.max(1, pos);
for (let ep = 0; ep < 500; ep++) {
  const gw = new Float64Array(d + 1); let tot = 0;
  for (let i = 0; i < n; i += 2) {
    let z = w[d]; for (let j = 0; j < d; j++) z += w[j] * norm(X[i], sel[j]);
    const p = 1 / (1 + Math.exp(-z)), weight = Y[i] ? pw : 1, e = (p - Y[i]) * weight;
    for (let j = 0; j < d; j++) gw[j] += e * norm(X[i], sel[j]); gw[d] += e; tot += weight;
  }
  for (let j = 0; j <= d; j++) w[j] -= 0.4 * gw[j] / tot + (j < d ? 2e-3 * w[j] : 0);
}
let tp = 0, tn = 0, p0 = 0, n0 = 0;
for (let i = 1; i < n; i += 2) { let z = w[d]; for (let j = 0; j < d; j++) z += w[j] * norm(X[i], sel[j]); const hit = z > 0; if (Y[i]) { p0++; if (hit) tp++; } else { n0++; if (!hit) tn++; } }
const bAcc = (tp / Math.max(1, p0) + tn / Math.max(1, n0)) / 2;
function fly(shift: number, seeds: number) {
  const t2 = new Float32Array(G), r2 = new Float32Array(G); let total = 0, best = 0;
  for (let s = 0; s < seeds; s++) {
    brain.reset(3000 + s); t2.fill(0); const dec = new FlyDecoder(2, 260); let dead = false;
    const game = new FlappyGame(3000 + s, () => { dead = true; }); game.start();
    while (!dead && game.elapsed < 30) {
      stimulate(game.capture()); brain.step(); rateInto(r2);
      for (const k of sel) t2[k] = ALPHA * t2[k] + (1 - ALPHA) * r2[k];
      let z = w[d] + shift; for (let j = 0; j < d; j++) z += w[j] * ((t2[sel[j]] - mean[sel[j]]) / Math.max(0.02, sd[sel[j]]));
      if (dec.decide(game.elapsed * 1000, z > 0) === 'FLAP') game.flap();
      game.update(0.02);
    }
    total += game.score; best = Math.max(best, game.score);
  }
  return { mean: total / seeds, best };
}
let bestRun = { mean: -1, best: 0, shift: 0 };
for (const shift of [-1, -0.5, 0, 0.5, 1]) { const r = fly(shift, 3); if (r.mean > bestRun.mean) bestRun = { ...r, shift }; }
const final = fly(bestRun.shift, 8);
console.log(`gain=${GAIN} alpha=${ALPHA} K=${d} |r|max=${Math.abs(corr[sel[0]]).toFixed(2)} bAcc=${bAcc.toFixed(3)} → mean ${final.mean.toFixed(1)} pipes, best ${final.best} (shift ${bestRun.shift})`);
console.log('top:', sel.slice(0, 8).map((k) => `${names[k]}${corr[k] > 0 ? '+' : '-'}${Math.abs(corr[k]).toFixed(2)}`).join(' '));
