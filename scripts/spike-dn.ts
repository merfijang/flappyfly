// THROWAWAY spike: which descending-neuron types carry the "below target" / "falling" signal?
import { loadBrain } from '../server/brainFiles';
import { buildGroups, sense } from '../src/core/sensing';
const brain = loadBrain(), g = buildGroups(brain.meta), m = brain.meta;
const dnClass = new Set(['descending_neuron', 'descending_neuron_tbc']);
const groups = new Map<string, number[]>();
for (let i = 0; i < m.n; i++) if (dnClass.has(m.superclasses[m.classIdx[i]])) { const k = `${m.types[m.typeIdx[i]]} ${m.side[i] === 1 ? 'L' : m.side[i] === 2 ? 'R' : 'M'}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(i); }
const keys = [...groups.keys()], G = keys.length, ids = keys.map((k) => Int32Array.from(groups.get(k)!));
console.log('DN groups', G);
const tr = new Float64Array(G), sx = new Float64Array(G), sxx = new Float64Array(G), sxb = new Float64Array(G), sxf = new Float64Array(G);
let sb = 0, sf = 0, n = 0;
let rnd = 7; const R = () => ((rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0) / 4294967296);
let birdY = 320, vy = 0, gap = 320, pipeX = 480;
for (let i = 0; i < 8000; i++) {
  if (i % 150 === 0) { gap = 155 + R() * 310; birdY = 120 + R() * 400; vy = -140 + R() * 300; pipeX = 350 + R() * 180; }
  vy += 22.4; birdY += vy * 0.02; if (birdY > gap + 8 && vy > -60) vy = -355; pipeX -= 2.64;
  sense(brain, g, { birdY, birdVelocityY: vy, pipeX, pipeWidth: 72, gapTop: gap - 105, gapBottom: gap + 105, gapCenterY: gap, distanceToPipe: pipeX - 112 });
  brain.step();
  const below = birdY > gap ? 1 : 0, falling = vy > 0 ? 1 : 0;
  for (let k = 0; k < G; k++) { let h = 0; for (const id of ids[k]) h += brain.spiked[id]; tr[k] = tr[k] * 0.86 + (h / ids[k].length) * 0.14; }
  if (i % 150 > 20) { n++; sb += below; sf += falling; for (let k = 0; k < G; k++) { sx[k] += tr[k]; sxx[k] += tr[k] ** 2; sxb[k] += tr[k] * below; sxf[k] += tr[k] * falling; } }
}
const res = keys.map((key, k) => {
  const mx = sx[k] / n, vx = sxx[k] / n - mx * mx, mb = sb / n, mf = sf / n;
  const rb = (sxb[k] / n - mx * mb) / Math.sqrt(vx * mb * (1 - mb) || 1), rf = (sxf[k] / n - mx * mf) / Math.sqrt(vx * mf * (1 - mf) || 1);
  return { key, size: ids[k].length, mean: mx, rb, rf };
}).filter((r) => r.mean > 0.001);
console.log('active DN groups', res.length);
res.sort((a, b) => Math.abs(b.rb) - Math.abs(a.rb));
for (const r of res.slice(0, 25)) console.log(r.key.padEnd(16), 'n', r.size, 'mean', r.mean.toFixed(3), 'r(below)', r.rb.toFixed(3), 'r(falling)', r.rf.toFixed(3));
