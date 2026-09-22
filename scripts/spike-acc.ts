// Spike: replace the "two spikes in 100 ms" gate with an evidence accumulator, and learn on it.
import { calibrateReadout } from '../src/core/calibrate';
import { STEP_SECONDS } from '../src/core/pace';
import { buildGroups, groupsByName, readRates, sense, TRACE_KEEP } from '../src/core/sensing';
import { FlappyGame, type Course } from '../src/game/FlappyGame';
import { loadBrain } from '../server/brainFiles';
import { fitness, initialTrainer, Trainer } from '../server/trainer';

const ATTEMPTS = Number(process.argv[2] ?? 400), KEEP = Number(process.argv[3] ?? 64);
const SPEED = Number(process.argv[4] ?? 0.5), GAP = Number(process.argv[5] ?? 260), SPAWN = Number(process.argv[6] ?? 2.6);
const ACC_DECAY = Number(process.argv[7] ?? 0.8), COOLDOWN = Number(process.argv[8] ?? 260);
const course: Course = { gap: GAP, spawnEvery: SPAWN, speed: 132 };
const brain = loadBrain(), groups = buildGroups(brain.meta);
const t0 = Date.now();
const readout = calibrateReadout(brain, groups, brain.meta, { keep: KEEP });
const ids = groupsByName(brain.meta, readout.names), K = ids.length;
console.log(`calibrated in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${K} groups`);
const rates = new Float32Array(K), traces = new Float32Array(K);
const trainer = new Trainer(initialTrainer([...Array(K).fill(0), -0.35], { pop: 10, sigma: 0.5, lr: 0.5 }));
const scores: number[] = [], fits: number[] = [];
for (let a = 1; a <= ATTEMPTS; a++) {
  const sample = trainer.next(), theta = sample.theta;
  let dead = false;
  const game = new FlappyGame(sample.seed, () => { dead = true; }, course);
  game.start(); brain.reset(sample.seed); traces.fill(0);
  let acc = 0, lastFlap = -Infinity;
  while (!dead && game.elapsed < 45) {
    sense(brain, groups, game.capture()); brain.step(); readRates(brain, ids, rates);
    let z = theta[K];
    for (let k = 0; k < K; k++) {
      traces[k] = TRACE_KEEP * traces[k] + (1 - TRACE_KEEP) * rates[k];
      z += theta[k] * ((traces[k] - readout.mean[k]) / Math.max(0.02, readout.std[k]));
    }
    acc = ACC_DECAY * acc + z; // evidence for flapping piles up while the neurons keep saying so
    const nowMs = (game.elapsed / SPEED) * 1000;
    if (acc > 0 && nowMs - lastFlap >= COOLDOWN) { game.flap(); lastFlap = nowMs; acc = 0; }
    game.update(STEP_SECONDS * SPEED);
  }
  const f = fitness(game.score, game.elapsed);
  trainer.report(sample.index, f);
  scores.push(game.score); fits.push(f);
  if (a % 25 === 0) {
    const s = scores.slice(-25), f2 = fits.slice(-25);
    console.log(`a=${a} gen=${trainer.state.generation} meanFit=${(f2.reduce((x, y) => x + y, 0) / f2.length).toFixed(2)} meanPipes=${(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2)} best=${Math.max(...scores)} min=${((Date.now() - t0) / 60000).toFixed(1)}`);
  }
}
