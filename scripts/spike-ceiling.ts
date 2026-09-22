// Spike: how well can a linear readout of descending neurons play, depending on WHICH neurons it reads?
// Fits a readout offline (supervised, as an upper bound) and flies it. Not the learning rule itself.
import { loadBrain } from '../server/brainFiles';
import { buildGroups, sense, readFeatures, FEATURES } from '../src/core/sensing';
import { FlappyGame } from '../src/game/FlappyGame';
import { FlyDecoder } from '../src/brain/FlyDecoder';
const brain = loadBrain(), g = buildGroups(brain.meta), m = brain.meta;
// every DN type, per side, as a candidate feature
const dnClass = new Set(['descending_neuron', 'descending_neuron_tbc']), groups = new Map<string, number[]>();
for (let i = 0; i < m.n; i++) if (dnClass.has(m.superclasses[m.classIdx[i]])) { const k = `${m.types[m.typeIdx[i]]} ${m.side[i] === 2 ? 'R' : 'L'}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(i); }
const names = [...groups.keys()], ids = names.map((k) => Int32Array.from(groups.get(k)!)), G = names.length;
const rate = (a: Int32Array) => { let h = 0; for (const id of a) h += brain.spiked[id]; return h / a.length; };
// 1) record traces on teacher-flown trajectories
const X: Float32Array[] = [], Y: number[] = [], tr = new Float32Array(G);
let rnd = 7; const R = () => ((rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0) / 4294967296);
let birdY = 320, vy = 0, gap = 320, pipeX = 480; brain.reset(1);
for (let i = 0; i < 9000; i++) {
  if (i % 150 === 0) { gap = 155 + R() * 310; birdY = 120 + R() * 400; vy = -140 + R() * 300; pipeX = 350 + R() * 180; }
  vy += 22.4; birdY += vy * 0.02; const y = birdY > gap + 8 && vy > -60 ? 1 : 0; if (y) vy = -355; pipeX -= 2.64;
  sense(brain, g, { birdY, birdVelocityY: vy, pipeX, pipeWidth: 72, gapTop: gap - 105, gapBottom: gap + 105, gapCenterY: gap, distanceToPipe: pipeX - 112 });
  brain.step();
  for (let k = 0; k < G; k++) tr[k] = tr[k] * 0.86 + rate(ids[k]) * 0.14;
  if (i % 150 > 20) { X.push(Float32Array.from(tr)); Y.push(birdY > gap ? 1 : 0); }
}
const n = X.length, mean = new Float64Array(G), sd = new Float64Array(G), corr = new Float64Array(G);
for (const x of X) for (let k = 0; k < G; k++) mean[k] += x[k] / n;
for (const x of X) for (let k = 0; k < G; k++) sd[k] += (x[k] - mean[k]) ** 2 / n;
const my = Y.reduce((a, b) => a + b, 0) / n;
for (let k = 0; k < G; k++) { sd[k] = Math.sqrt(sd[k]); let c = 0; for (let i = 0; i < n; i++) c += (X[i][k] - mean[k]) * (Y[i] - my); corr[k] = sd[k] > 1e-6 ? c / n / (sd[k] * Math.sqrt(my * (1 - my))) : 0; }
const ranked = [...Array(G).keys()].filter((k) => sd[k] > 0.005).sort((a, b) => Math.abs(corr[b]) - Math.abs(corr[a]));
console.log('top DN groups by |r(below)|:', ranked.slice(0, 12).map((k) => `${names[k]} ${corr[k].toFixed(2)}`).join(', '));
// 2) fit a logistic readout on chosen features, then fly it
function fit(sel: number[]) {
  const d = sel.length, w = new Float64Array(d + 1);
  for (let ep = 0; ep < 300; ep++) {
    const gw = new Float64Array(d + 1);
    for (let i = 0; i < n; i += 2) { let z = w[d]; for (let j = 0; j < d; j++) z += w[j] * (X[i][sel[j]] - mean[sel[j]]) / sd[sel[j]]; const p = 1 / (1 + Math.exp(-z)), e = p - Y[i]; for (let j = 0; j < d; j++) gw[j] += e * (X[i][sel[j]] - mean[sel[j]]) / sd[sel[j]]; gw[d] += e; }
    for (let j = 0; j <= d; j++) w[j] -= 0.5 * gw[j] / (n / 2) + (j < d ? 1e-3 * w[j] : 0);
  }
  let acc = 0, cnt = 0; for (let i = 1; i < n; i += 2) { let z = w[d]; for (let j = 0; j < d; j++) z += w[j] * (X[i][sel[j]] - mean[sel[j]]) / sd[sel[j]]; acc += (z > 0 ? 1 : 0) === Y[i] ? 1 : 0; cnt++; }
  return { w, acc: acc / cnt };
}
function fly(sel: number[], w: Float64Array, thresholdShift: number, seeds = 12) {
  const d = sel.length, t2 = new Float32Array(G); let total = 0, best = 0;
  for (let s = 0; s < seeds; s++) {
    brain.reset(1000 + s); t2.fill(0); const dec = new FlyDecoder(2, 260); let dead = false;
    const game = new FlappyGame(1000 + s, () => { dead = true; }); game.start();
    while (!dead && game.elapsed < 60) {
      sense(brain, g, game.capture()); brain.step();
      for (const k of sel) t2[k] = t2[k] * 0.86 + rate(ids[k]) * 0.14;
      let z = w[d] + thresholdShift; for (let j = 0; j < d; j++) z += w[j] * (t2[sel[j]] - mean[sel[j]]) / sd[sel[j]];
      if (dec.decide(game.elapsed * 1000, z > 0) === 'FLAP') game.flap();
      game.update(0.02);
    }
    total += game.score; best = Math.max(best, game.score);
  }
  return { mean: total / seeds, best };
}
const current = FEATURES.map((f) => { const [type, side] = [f.slice(0, -2), f.slice(-1)]; return names.indexOf(`${type} ${side}`); }).filter((k) => k >= 0);
for (const [label, sel] of [['current 12-ish (single-type)', current], ['top 16', ranked.slice(0, 16)], ['top 32', ranked.slice(0, 32)], ['top 64', ranked.slice(0, 64)]] as [string, number[]][]) {
  const { w, acc } = fit(sel);
  let bestRun = { mean: -1, best: 0, shift: 0 };
  for (const shift of [-1.5, -0.75, 0, 0.75, 1.5]) { const r = fly(sel, w, shift, 6); if (r.mean > bestRun.mean) bestRun = { ...r, shift }; }
  const final = fly(sel, w, bestRun.shift, 12);
  console.log(`${label.padEnd(28)} d=${sel.length} heldout acc=${acc.toFixed(3)} → mean ${final.mean.toFixed(2)} pipes, best ${final.best} (shift ${bestRun.shift})`);
}
