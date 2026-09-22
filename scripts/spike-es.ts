// THROWAWAY spike: can a (1+1)-ES on the DN readout learn to play, vs. an ablated readout?
import { loadBrain } from '../server/brainFiles';
import { buildGroups, sense, readFeatures, FEATURES } from '../src/core/sensing';
import { FlappyGame } from '../src/game/FlappyGame';
import { FlyDecoder } from '../src/brain/FlyDecoder';
const ablate = process.argv[2] === 'ablate', ATTEMPTS = Number(process.argv[3] ?? 200), CAP = 30;
const MEAN = [0.1672, 0.2081, 0.7190, 0.6927, 0.8522, 0.8248, 0.0663, 0.1020, 0.0434, 0.0524, 0.5910, 0.5598];
const STD = [0.0606, 0.0599, 0.2207, 0.2198, 0.2347, 0.2425, 0.0490, 0.0524, 0.0495, 0.0461, 0.2919, 0.2804];
const brain = loadBrain(), g = buildGroups(brain.meta), F = FEATURES.length;
const raw = new Float32Array(F), tr = new Float32Array(F);
let r = 12345; const U = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
const N = () => { let u = 0; while (!u) u = U(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * U()); };
function play(theta: number[], seed: number) {
  brain.reset(seed); tr.fill(0); const dec = new FlyDecoder(2, 260); let dead = false;
  const game = new FlappyGame(seed, () => { dead = true; }); game.start(); let flaps = 0;
  while (!dead && game.elapsed < CAP) {
    sense(brain, g, game.capture()); brain.step(); readFeatures(brain, g, raw);
    let z = theta[F];
    for (let k = 0; k < F; k++) { tr[k] = tr[k] * 0.86 + raw[k] * 0.14; if (!ablate) z += theta[k] * (tr[k] - MEAN[k]) / STD[k]; }
    if (dec.decide(game.elapsed * 1000, 1 / (1 + Math.exp(-z)) >= 0.5) === 'FLAP') { game.flap(); flaps++; }
    game.update(0.02);
  }
  return { fit: game.score + game.elapsed / 2.1, score: game.score, t: game.elapsed, flaps };
}
let champ = [...Array(F).fill(0), -0.35], fc = -Infinity, sigma = 0.5, best = 0; const t0 = Date.now();
for (let a = 1; a <= ATTEMPTS; a++) {
  const seed = (a * 2654435761) >>> 0;
  if (a % 5 === 0 && fc > -Infinity) { const res = play(champ, seed); fc = 0.5 * fc + 0.5 * res.fit; best = Math.max(best, res.score); }
  else {
    const mut = champ.map((x) => x + sigma * N()); const res = play(mut, seed); best = Math.max(best, res.score);
    if (res.fit > fc) { champ = mut; fc = res.fit; sigma = Math.min(3, sigma * 1.5); } else sigma = Math.max(0.05, sigma * Math.pow(1.5, -0.25));
  }
  if (a % 10 === 0) console.log(`${ablate ? 'ABL' : 'FULL'} a=${a} champFit=${fc.toFixed(2)} sigma=${sigma.toFixed(2)} best=${best} min=${((Date.now() - t0) / 60000).toFixed(1)}`);
}
const evals = Array.from({ length: 20 }, (_, i) => play(champ, 999000 + i));
console.log(`${ablate ? 'ABL' : 'FULL'} FINAL champion over 20 fresh seeds: meanScore=${(evals.reduce((s, e) => s + e.score, 0) / 20).toFixed(2)} meanFit=${(evals.reduce((s, e) => s + e.fit, 0) / 20).toFixed(2)} maxScore=${Math.max(...evals.map((e) => e.score))} theta=${champ.map((x) => x.toFixed(2)).join(',')}`);
