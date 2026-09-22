// Calibration: fly a few plausible trajectories, watch every cell type in the brain, and keep
// the ones whose firing actually follows the gap offset. Those become the readout the fly learns
// on, together with the scale of their rates. Seeded, so the same brain always gives the same set.
import type { Connectome, NeuronMeta } from './connectome';
import type { Readout } from './policy';
import { MIN_GROUP_CELLS, readableGroups, readRates, sense, TRACE_KEEP, type SensoryGroups } from './sensing';

export interface CalibrationOptions { steps?: number; keep?: number; seed?: number; minCells?: number }

export function calibrateReadout(brain: Connectome, groups: SensoryGroups, meta: NeuronMeta, opts: CalibrationOptions = {}): Readout {
  const { steps = 4000, keep = 64, seed = 1, minCells = MIN_GROUP_CELLS } = opts;
  const dn = readableGroups(meta, minCells), G = dn.names.length;
  const rates = new Float32Array(G), traces = new Float32Array(G);
  const sum = new Float64Array(G), sq = new Float64Array(G), sxy = new Float64Array(G);
  let rng = seed >>> 0, n = 0, sy = 0, syy = 0;
  const rand = () => (rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296;
  let birdY = 320, vy = 0, gap = 320, pipeX = 480;
  brain.reset(seed);
  for (let i = 0; i < steps; i++) {
    if (i % 150 === 0) { gap = 155 + rand() * 310; birdY = 120 + rand() * 400; vy = -140 + rand() * 300; pipeX = 350 + rand() * 180; }
    // a simple pilot keeps the trajectories realistic; it only shapes which states are visited
    vy += 22.4; birdY += vy * 0.02; if (birdY > gap + 8 && vy > -60) vy = -355; pipeX -= 2.64;
    sense(brain, groups, { birdY, birdVelocityY: vy, pipeX, pipeWidth: 72, gapTop: gap - 105, gapBottom: gap + 105, gapCenterY: gap, distanceToPipe: pipeX - 112 });
    brain.step(); readRates(brain, dn.ids, rates);
    for (let k = 0; k < G; k++) traces[k] = TRACE_KEEP * traces[k] + (1 - TRACE_KEEP) * rates[k];
    if (i % 150 <= 20) continue; // let the traces settle after a jump
    const offset = (birdY - gap) / 120; // how far below the gap the fly is
    n++; sy += offset; syy += offset * offset;
    for (let k = 0; k < G; k++) { sum[k] += traces[k]; sq[k] += traces[k] * traces[k]; sxy[k] += traces[k] * offset; }
  }
  const my = sy / n, sdy = Math.sqrt(Math.max(1e-9, syy / n - my * my));
  const scored = dn.names.map((name, k) => {
    const mean = sum[k] / n, std = Math.sqrt(Math.max(0, sq[k] / n - mean * mean));
    const corr = std > 1e-6 ? (sxy[k] / n - mean * my) / (std * sdy) : 0;
    return { name, mean, std, corr };
  }).filter((g) => g.std > 0.003);
  scored.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
  const chosen = scored.slice(0, keep);
  return { names: chosen.map((g) => g.name), mean: chosen.map((g) => g.mean), std: chosen.map((g) => Math.max(0.02, g.std)) };
}
