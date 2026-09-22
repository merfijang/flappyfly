// Spike: is the bottleneck the neurons, or the control loop (flap gating + signal lag)?
import { FlappyGame } from '../src/game/FlappyGame';
import { FlyDecoder } from '../src/brain/FlyDecoder';

function run(label: string, opts: { gate: 'decoder' | 'cooldown'; lagMs: number; margin?: number }, seeds = 12) {
  let total = 0, best = 0;
  for (let s = 0; s < seeds; s++) {
    let dead = false; const game = new FlappyGame(2000 + s, () => { dead = true; }); game.start();
    const dec = new FlyDecoder(2, 260); const history: boolean[] = []; let lastFlap = -Infinity;
    while (!dead && game.elapsed < 60) {
      const st = game.capture();
      const want = st.birdY > st.gapCenterY + (opts.margin ?? 8) && st.birdVelocityY > -60;
      history.push(want);
      const lagSteps = Math.round(opts.lagMs / 20);
      const seen = history[Math.max(0, history.length - 1 - lagSteps)];
      const now = game.elapsed * 1000;
      if (opts.gate === 'decoder') { if (dec.decide(now, seen) === 'FLAP') game.flap(); }
      else if (seen && now - lastFlap >= 260) { lastFlap = now; game.flap(); }
      game.update(0.02);
    }
    total += game.score; best = Math.max(best, game.score);
  }
  console.log(`${label.padEnd(42)} mean ${(total / seeds).toFixed(1)} pipes, best ${best}`);
}
run('oracle, decoder gate, no lag', { gate: 'decoder', lagMs: 0 });
run('oracle, cooldown only, no lag', { gate: 'cooldown', lagMs: 0 });
run('oracle, decoder gate, 100 ms lag', { gate: 'decoder', lagMs: 100 });
run('oracle, decoder gate, 200 ms lag', { gate: 'decoder', lagMs: 200 });
run('oracle, decoder gate, 300 ms lag', { gate: 'decoder', lagMs: 300 });
run('oracle, cooldown only, 200 ms lag', { gate: 'cooldown', lagMs: 200 });
run('oracle margin 0, decoder gate, no lag', { gate: 'decoder', lagMs: 0, margin: 0 });
run('oracle margin -40, decoder gate, no lag', { gate: 'decoder', lagMs: 0, margin: -40 });
