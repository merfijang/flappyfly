// Spike: does the visual input actually carry a graded signal, or does it saturate?
// Holds the fly at a fixed offset from the gap and measures firing rates.
import { loadBrain } from '../server/brainFiles';
import { buildGroups } from '../src/core/sensing';
import { FlyEncoder } from '../src/brain/FlyEncoder';
const brain = loadBrain(), g = buildGroups(brain.meta), m = brain.meta;
const dnClass = new Set(['descending_neuron', 'descending_neuron_tbc']), groups = new Map<string, number[]>();
for (let i = 0; i < m.n; i++) if (dnClass.has(m.superclasses[m.classIdx[i]])) { const k = `${m.types[m.typeIdx[i]]} ${m.side[i] === 2 ? 'R' : 'L'}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(i); }
const names = [...groups.keys()], dnIds = names.map((k) => Int32Array.from(groups.get(k)!));
const rate = (a: Int32Array) => { let h = 0; for (const id of a) h += brain.spiked[id]; return h / a.length; };

function hold(offset: number, vy: number, gain: number, steps = 120) {
  brain.reset(5); const gapCenter = 320, birdY = gapCenter + offset;
  const s = FlyEncoder.encode({ birdY, birdVelocityY: vy, pipeX: 300, pipeWidth: 72, gapTop: gapCenter - 105, gapBottom: gapCenter + 105, gapCenterY: gapCenter, distanceToPipe: 188 });
  let lcL = 0, lcR = 0; const dn = new Float64Array(names.length);
  for (let i = 0; i < steps; i++) {
    for (const ids of g.lc4) brain.stimulate(ids, s.lc4 * gain);
    for (const ids of g.lplc2) brain.stimulate(ids, s.lplc2 * gain);
    brain.stimulate(g.lc10L, (s.lc10Left + s.upward * 0.35) * gain);
    brain.stimulate(g.lc10R, (s.lc10Right + s.downward * 0.35) * gain);
    brain.step();
    if (i >= 40) { lcL += rate(g.lc10L); lcR += rate(g.lc10R); for (let k = 0; k < names.length; k++) dn[k] += rate(dnIds[k]); }
  }
  const n = steps - 40;
  return { lcL: lcL / n, lcR: lcR / n, dn: Array.from(dn, (v) => v / n) };
}
for (const gain of [3, 6, 12]) {
  console.log(`--- stimulus gain ${gain}`);
  const rows = [-150, -80, -30, 0, 30, 80, 150].map((off) => ({ off, ...hold(off, 100, gain) }));
  for (const r of rows) console.log(`  offset ${String(r.off).padStart(4)} px  LC10a L ${r.lcL.toFixed(3)}  R ${r.lcR.toFixed(3)}`);
  // which DN groups change most across offsets?
  const spread = rows[0].dn.map((_, k) => Math.max(...rows.map((r) => r.dn[k])) - Math.min(...rows.map((r) => r.dn[k])));
  const top = [...spread.keys()].sort((a, b) => spread[b] - spread[a]).slice(0, 6);
  console.log('  most position-sensitive DNs:', top.map((k) => `${names[k]} ${rows.map((r) => r.dn[k].toFixed(2)).join('/')}`).join('  |  '));
}
