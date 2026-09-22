// Feature normalisation: run the brain on plausible flight trajectories and record
// the mean/std of each readout trace. Seeded, so the same brain always gives the same numbers.
import type { Connectome } from './connectome';
import type { Normalization } from './policy';
import { FEATURES, readFeatures, sense, type SensoryGroups } from './sensing';

export function calibrate(brain: Connectome, groups: SensoryGroups, steps = 3000, seed = 1): Normalization {
  const F = FEATURES.length, raw = new Float32Array(F), tr = new Float32Array(F);
  const sum = new Float64Array(F), sq = new Float64Array(F);
  let rng = seed >>> 0, n = 0;
  const rand = () => (rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296;
  let birdY = 320, vy = 0, gap = 320, pipeX = 480;
  brain.reset(seed);
  for (let i = 0; i < steps; i++) {
    if (i % 150 === 0) { gap = 155 + rand() * 310; birdY = 120 + rand() * 400; vy = -140 + rand() * 300; pipeX = 350 + rand() * 180; }
    // a simple pilot keeps the trajectory realistic; it only shapes the sampled states
    vy += 22.4; birdY += vy * 0.02; if (birdY > gap + 8 && vy > -60) vy = -355; pipeX -= 2.64;
    sense(brain, groups, { birdY, birdVelocityY: vy, pipeX, pipeWidth: 72, gapTop: gap - 105, gapBottom: gap + 105, gapCenterY: gap, distanceToPipe: pipeX - 112 });
    brain.step(); readFeatures(brain, groups, raw);
    for (let k = 0; k < F; k++) tr[k] = tr[k] * 0.86 + raw[k] * 0.14;
    if (i % 150 > 20) { n++; for (let k = 0; k < F; k++) { sum[k] += tr[k]; sq[k] += tr[k] * tr[k]; } }
  }
  const mean = Array.from(sum, (s) => s / n);
  const std = Array.from(sq, (s, k) => Math.max(0.02, Math.sqrt(Math.max(0, s / n - mean[k] ** 2))));
  return { mean, std };
}
