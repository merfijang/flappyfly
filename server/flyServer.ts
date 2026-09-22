// Runs the one shared fly: paid attempts from the queue, idle brain in between, learning after each attempt.
import type { Connectome } from '../src/core/connectome';
import { NeuralPolicy, PARAM_COUNT, type Normalization } from '../src/core/policy';
import type { SensoryGroups } from '../src/core/sensing';
import { FlappyGame } from '../src/game/FlappyGame';
import { pickDisplayNeurons } from '../src/shared/display';
import { encodeBits, type AttemptRecord, type AttemptStart, type ServerMessage, type Stats } from '../src/shared/protocol';
import { FeeAccumulator } from './fees/accumulator';
import type { FeeEvent, WatcherCursor } from './fees/solanaWatcher';
import { fitness, initialTrainer, Trainer, type Sample, type TrainerState } from './trainer';

export interface PersistedState {
  version: 1; trainer: TrainerState; norm: Normalization;
  queue: number; pendingLamports: number; totalFeeLamports: number;
  attempts: number; bestScore: number; bestFitness: number;
  watcher: WatcherCursor | null; history: AttemptRecord[];
}

export function freshState(norm: Normalization): PersistedState {
  return {
    version: 1, trainer: initialTrainer([...Array(PARAM_COUNT - 1).fill(0), -0.35]), norm,
    queue: 0, pendingLamports: 0, totalFeeLamports: 0, attempts: 0, bestScore: 0, bestFitness: 0, watcher: null, history: []
  };
}

export interface Outbox { json(msg: ServerMessage): void; binary(bytes: Uint8Array): void }

export interface FlyServerOptions {
  brain: Connectome; groups: SensoryGroups; state: PersistedState; lamportsPerAttempt: number;
  feeSource: Stats['feeSource']; feeWallet: string | null;
  save: (s: PersistedState) => void; out: Outbox;
  rand?: () => number; capSeconds?: number; pauseTicks?: number; historyLimit?: number;
}

const DT = 0.02, ACTIVITY_EVERY = 5;

export class FlyServer {
  private readonly state: PersistedState;
  private readonly policy: NeuralPolicy;
  private readonly trainer: Trainer;
  private readonly fees: FeeAccumulator;
  private readonly game: FlappyGame;
  private readonly displayIndexOf: Int32Array;
  private readonly hits: Uint8Array;
  private phase: 'idle' | 'flying' | 'pause' = 'idle';
  private sample: Sample | null = null;
  private current: AttemptStart | null = null;
  private deathCause: string | null = null;
  private pauseLeft = 0; private ticks = 0;

  constructor(private readonly o: FlyServerOptions) {
    this.state = o.state;
    this.policy = new NeuralPolicy(o.brain, o.groups, o.state.norm);
    this.trainer = new Trainer(o.state.trainer, o.rand);
    this.fees = new FeeAccumulator(o.lamportsPerAttempt, o.state.pendingLamports);
    this.game = new FlappyGame(1, (cause) => { this.deathCause = cause; });
    const display = pickDisplayNeurons(o.brain.meta);
    this.displayIndexOf = new Int32Array(o.brain.n).fill(-1);
    display.ids.forEach((id, k) => { this.displayIndexOf[id] = k; });
    this.hits = new Uint8Array(display.ids.length);
  }

  get displayCount() { return this.hits.length; }

  stats(): Stats {
    const s = this.state;
    return {
      attempts: s.attempts, generation: s.trainer.generation, queue: s.queue, bestScore: s.bestScore, bestFitness: s.bestFitness,
      totalFeeLamports: s.totalFeeLamports, pendingLamports: this.fees.pending, lamportsPerAttempt: this.o.lamportsPerAttempt,
      feeSource: this.o.feeSource, feeWallet: this.o.feeWallet, flying: this.phase === 'flying'
    };
  }

  hello(): ServerMessage {
    return { type: 'hello', stats: this.stats(), history: this.state.history.slice(-300), current: this.phase === 'flying' ? this.current : null, theta: this.state.trainer.theta, displayCount: this.displayCount };
  }

  /** Snapshot for disk. An attempt in flight counts as still queued, so a crash never loses a paid attempt. */
  snapshot(): PersistedState {
    return { ...this.state, queue: this.state.queue + (this.phase === 'flying' ? 1 : 0), pendingLamports: this.fees.pending };
  }

  setWatcherCursor(cursor: WatcherCursor) { this.state.watcher = cursor; }

  addFee(e: FeeEvent, cursor?: WatcherCursor) {
    const added = this.fees.add(e.lamports);
    this.state.totalFeeLamports += Math.max(0, e.lamports);
    this.state.queue += added;
    if (cursor) this.state.watcher = cursor;
    this.o.save(this.snapshot());
    this.o.out.json({ type: 'fee', lamports: e.lamports, signature: e.signature, attemptsAdded: added });
    this.o.out.json({ type: 'stats', stats: this.stats() });
  }

  /** Advance the world by one 20 ms step. */
  tick() {
    if (this.phase === 'idle' && this.state.queue > 0) this.startAttempt();
    if (this.phase === 'flying') this.flyStep(); else this.policy.idle();
    if (this.phase === 'pause' && --this.pauseLeft <= 0) this.phase = 'idle';
    this.collectActivity();
  }

  private startAttempt() {
    this.state.queue--;
    this.sample = this.trainer.next();
    this.game.reset(this.sample.seed); this.game.start(); this.deathCause = null;
    this.policy.begin(this.sample.theta, this.sample.seed);
    this.current = { type: 'attempt_start', n: this.state.attempts + 1, generation: this.sample.generation, sample: this.sample.index, pop: this.state.trainer.pop, seed: this.sample.seed };
    this.phase = 'flying';
    this.o.out.json(this.current);
    this.o.out.json({ type: 'stats', stats: this.stats() });
  }

  private flyStep() {
    const g = this.game, { flap, p } = this.policy.tick(g.capture(), g.elapsed * 1000);
    if (flap) g.flap();
    g.update(DT);
    this.o.out.json({
      type: 'frame', t: +g.elapsed.toFixed(2), y: +g.bird.y.toFixed(1), vy: +g.bird.velocityY.toFixed(1),
      pipes: g.pipes.map((q) => [+q.x.toFixed(1), +q.gapTop.toFixed(1), +q.gapBottom.toFixed(1)] as [number, number, number]),
      score: g.score, p: +p.toFixed(3), flap
    });
    const cap = this.o.capSeconds ?? 120;
    if (this.deathCause || g.elapsed >= cap) this.endAttempt(this.deathCause ?? 'SURVIVED THE TIME LIMIT.');
  }

  private endAttempt(cause: string) {
    const g = this.game, s = this.state, sample = this.sample!;
    g.stop();
    const fit = fitness(g.score, g.elapsed);
    this.trainer.report(sample.index, fit);
    s.attempts++;
    s.bestScore = Math.max(s.bestScore, g.score); s.bestFitness = Math.max(s.bestFitness, fit);
    const record: AttemptRecord = { n: s.attempts, generation: sample.generation, score: g.score, fitness: +fit.toFixed(3), seconds: +g.elapsed.toFixed(2), cause, at: Date.now() };
    s.history.push(record);
    const limit = this.o.historyLimit ?? 2000;
    if (s.history.length > limit) s.history.splice(0, s.history.length - limit);
    this.phase = 'pause'; this.pauseLeft = this.o.pauseTicks ?? 75; this.sample = null; this.current = null;
    this.o.save(this.snapshot());
    this.o.out.json({ type: 'attempt_end', record, theta: s.trainer.theta });
    this.o.out.json({ type: 'stats', stats: this.stats() });
  }

  private collectActivity() {
    for (const id of this.o.brain.lastFired()) { const k = this.displayIndexOf[id]; if (k >= 0) this.hits[k] = 1; }
    if (++this.ticks % ACTIVITY_EVERY === 0) { this.o.out.binary(encodeBits(this.hits)); this.hits.fill(0); }
  }
}
