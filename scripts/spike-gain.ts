// THROWAWAY spike: does a stronger visual drive make the DN readout more informative?
import { loadBrain } from '../server/brainFiles';
import { buildGroups, readFeatures, FEATURES } from '../src/core/sensing';
import { FlyEncoder } from '../src/brain/FlyEncoder';
const brain = loadBrain(), g = buildGroups(brain.meta), F = FEATURES.length;
for (const gain of [1, 3, 6, 12]) {
  brain.reset(1); const raw = new Float32Array(F), tr = new Float32Array(F); const xs: number[][] = [], ys: number[] = [];
  let rnd = 7; const R = () => ((rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0) / 4294967296);
  let birdY = 320, vy = 0, gap = 320, pipeX = 480;
  for (let i = 0; i < 3000; i++) {
    if (i % 150 === 0) { gap = 155 + R() * 310; birdY = 120 + R() * 400; vy = -140 + R() * 300; pipeX = 350 + R() * 180; }
    vy += 22.4; birdY += vy * 0.02; const label = birdY > gap + 8 && vy > -60 ? 1 : 0; if (label) vy = -355; pipeX -= 2.64;
    const s = FlyEncoder.encode({ birdY, birdVelocityY: vy, pipeX, pipeWidth: 72, gapTop: gap - 105, gapBottom: gap + 105, gapCenterY: gap, distanceToPipe: pipeX - 112 });
    for (const ids of g.lc4) brain.stimulate(ids, s.lc4 * gain); for (const ids of g.lplc2) brain.stimulate(ids, s.lplc2 * gain);
    brain.stimulate(g.lc10L, (s.lc10Left + s.upward * 0.35) * gain); brain.stimulate(g.lc10R, (s.lc10Right + s.downward * 0.35) * gain);
    brain.step(); readFeatures(brain, g, raw); for (let k = 0; k < F; k++) tr[k] = tr[k] * 0.86 + raw[k] * 0.14;
    if (i % 150 > 20) { xs.push([...tr]); ys.push(label); }
  }
  // least-squares linear probe, train on 80%, report correlation on held-out 20%
  const D = F + 1, A = Array.from({ length: D }, () => new Float64Array(D)), b = new Float64Array(D);
  const X = xs.map((x) => [...x, 1]);
  X.forEach((x, i) => { if (i % 5 === 0) return; for (let p = 0; p < D; p++) { b[p] += x[p] * ys[i]; for (let q = 0; q < D; q++) A[p][q] += x[p] * x[q]; } });
  for (let p = 0; p < D; p++) A[p][p] += 1e-3;
  for (let c = 0; c < D; c++) { let piv = c; for (let r = c + 1; r < D; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r; [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]]; for (let r = 0; r < D; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let q = c; q < D; q++) A[r][q] -= f * A[c][q]; b[r] -= f * b[c]; } }
  const w = Array.from({ length: D }, (_, p) => b[p] / A[p][p]);
  const test = X.map((x, i) => [x.reduce((s, v, p) => s + v * w[p], 0), ys[i]]).filter((_, i) => i % 5 === 0);
  const mp = test.reduce((s, t) => s + t[0], 0) / test.length, my = test.reduce((s, t) => s + t[1], 0) / test.length;
  let sxy = 0, sxx = 0, syy = 0; for (const [p, y] of test) { sxy += (p - mp) * (y - my); sxx += (p - mp) ** 2; syy += (y - my) ** 2; }
  const acc = test.filter(([p, y]) => (p > my ? 1 : 0) === y).length / test.length;
  console.log(`gain=${gain} heldout r=${(sxy / Math.sqrt(sxx * syy)).toFixed(3)} acc=${acc.toFixed(3)} base=${Math.max(my, 1 - my).toFixed(3)} spikes/step=${(brain.totalSpikes / 3000).toFixed(0)}`);
}
