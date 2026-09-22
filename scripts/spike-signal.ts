// THROWAWAY spike: is there flap-relevant signal in the 12 DN features?
import { loadBrain } from '../server/brainFiles';
import { buildGroups, sense, readFeatures, FEATURES } from '../src/core/sensing';
const t0 = Date.now(); const brain = loadBrain(); console.log('load ms', Date.now() - t0);
const g = buildGroups(brain.meta); console.log('group sizes', g.features.map((f) => f.length).join(','), 'lc4', g.lc4.map((x) => x.length), 'lc10', g.lc10L.length, g.lc10R.length);
const F = FEATURES.length, raw = new Float32Array(F), tr = new Float32Array(F);
const xs: number[][] = [], below: number[] = [], rising: number[] = [];
let rnd = 7; const R = () => ((rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0) / 4294967296);
let birdY = 320, vy = 0, gap = 320, pipeX = 480; const t1 = Date.now();
for (let i = 0; i < 6000; i++) {
  if (i % 150 === 0) { gap = 155 + R() * 310; birdY = 120 + R() * 400; vy = -140 + R() * 300; pipeX = 350 + R() * 180; }
  vy += 22.4; birdY += vy * 0.02; if (birdY > gap + 8 && vy > -60) vy = -355; pipeX -= 2.64;
  sense(brain, g, { birdY, birdVelocityY: vy, pipeX, pipeWidth: 72, gapTop: gap - 105, gapBottom: gap + 105, gapCenterY: gap, distanceToPipe: pipeX - 112 });
  brain.step(); readFeatures(brain, g, raw);
  for (let k = 0; k < F; k++) tr[k] = tr[k] * 0.86 + raw[k] * 0.14;
  if (i % 150 > 20) { xs.push([...tr]); below.push(birdY > gap ? 1 : 0); rising.push(vy < 0 ? 1 : 0); }
}
console.log('step ms', ((Date.now() - t1) / 6000).toFixed(3), 'spikes/step', (brain.totalSpikes / 6000).toFixed(0));
const corr = (k: number, y: number[]) => { const n = xs.length; let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += xs[i][k]; my += y[i]; } mx /= n; my /= n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const a = xs[i][k] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; } return { mean: mx, std: Math.sqrt(sxx / n), r: sxy / Math.sqrt(sxx * syy || 1) }; };
for (let k = 0; k < F; k++) { const a = corr(k, below), b = corr(k, rising); console.log(FEATURES[k].padEnd(12), 'mean', a.mean.toFixed(4), 'std', a.std.toFixed(4), 'r(below)', a.r.toFixed(3), 'r(rising)', b.r.toFixed(3)); }
