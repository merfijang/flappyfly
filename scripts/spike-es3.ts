// Spike: the shipping learner (antithetic ES on the readout) under new conditions —
// stronger visual drive, faster traces, measured readout, slower game. Prints the learning curve.
import { calibrateReadout } from '../src/core/calibrate';
import { GAME_SPEED, STEP_SECONDS } from '../src/core/pace';
import { NeuralPolicy, paramCount } from '../src/core/policy';
import { buildGroups } from '../src/core/sensing';
import { FlappyGame, type Course } from '../src/game/FlappyGame';
import { loadBrain } from '../server/brainFiles';
import { fitness, initialTrainer, Trainer } from '../server/trainer';

const ATTEMPTS = Number(process.argv[2] ?? 400), KEEP = Number(process.argv[3] ?? 64);
const SPEED = Number(process.argv[4] ?? GAME_SPEED), GAP = Number(process.argv[5] ?? 210), SPAWN = Number(process.argv[6] ?? 2.1);
const course: Course = { gap: GAP, spawnEvery: SPAWN, speed: 132 };
const brain = loadBrain(), groups = buildGroups(brain.meta);
const t0 = Date.now();
const readout = calibrateReadout(brain, groups, brain.meta, { keep: KEEP });
console.log(`calibrated in ${((Date.now() - t0) / 1000).toFixed(0)}s: ${readout.names.slice(0, 6).join(', ')} …`);
const policy = new NeuralPolicy(brain, groups, readout);
const trainer = new Trainer(initialTrainer([...Array(paramCount(readout) - 1).fill(0), -0.35], { pop: 10, sigma: 0.5, lr: 0.5 }));
const scores: number[] = [], fits: number[] = [];
for (let a = 1; a <= ATTEMPTS; a++) {
  const sample = trainer.next();
  let dead = false;
  const game = new FlappyGame(sample.seed, () => { dead = true; }, course);
  game.start(); policy.begin(sample.theta, sample.seed);
  while (!dead && game.elapsed < 45) {
    const { flap } = policy.tick(game.capture(), (game.elapsed / SPEED) * 1000);
    if (flap) game.flap();
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
