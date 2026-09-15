import { Bird } from './Bird'; import { Pipe } from './Pipe'; import { collided } from './Collision';
import { SeededRandom } from '../experiment/SeededRandom'; import type { FlappyState } from '../types';

export class FlappyGame {
  readonly width = 480; readonly height = 640; readonly bird = new Bird(); pipes: Pipe[] = [];
  score = 0; elapsed = 0; running = false; private spawnTimer = 0; private rng: SeededRandom;
  constructor(seed: number, private onDeath: (cause: string) => void) { this.rng = new SeededRandom(seed); this.reset(seed); }
  reset(seed: number) { this.rng = new SeededRandom(seed); this.bird.reset(); this.pipes = []; this.score = 0; this.elapsed = 0; this.spawnTimer = 0; this.spawn(true); }
  start() { this.running = true; }
  stop() { this.running = false; }
  flap() { if (this.running) this.bird.flap(); }
  private spawn(first = false) { const gap=210; this.pipes.push(new Pipe(first ? this.width - 50 : this.width + 80, this.rng.range(86, this.height - 86 - gap), gap)); }
  update(dt: number) {
    if (!this.running) return;
    this.elapsed += dt; this.spawnTimer += dt; this.bird.update(dt);
    if (this.spawnTimer >= 2.1) { this.spawnTimer -= 2.1; this.spawn(); }
    for (const pipe of this.pipes) {
      pipe.update(dt, 132);
      if (!pipe.scored && pipe.x + pipe.width < this.bird.x) { pipe.scored = true; this.score++; }
      if (collided(this.bird, pipe, this.height)) { this.running = false; this.onDeath(this.deathCause(pipe)); return; }
    }
    this.pipes = this.pipes.filter((p) => p.x + p.width > -20);
    if (this.bird.y - this.bird.radius <= 0 || this.bird.y + this.bird.radius >= this.height - 46) { this.running = false; this.onDeath(this.bird.y < 100 ? 'THE FLY FLAPPED TOO EARLY.' : 'THE FLY DID NOT FLAP.'); }
  }
  private deathCause(pipe: Pipe) { return this.bird.y < pipe.gapTop ? 'THE FLY PANICKED.' : 'THE FLY DID NOT FLAP.'; }
  get targetPipe() { return this.pipes.find((p) => p.x + p.width >= this.bird.x) ?? this.pipes[0]; }
  capture(): FlappyState {
    const p = this.targetPipe;
    return { birdY: this.bird.y, birdVelocityY: this.bird.velocityY, pipeX: p.x, pipeWidth: p.width,
      gapTop: p.gapTop, gapBottom: p.gapBottom, gapCenterY: (p.gapTop + p.gapBottom) / 2, distanceToPipe: p.x - this.bird.x };
  }
}
