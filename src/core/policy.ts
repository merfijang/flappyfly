// The fly's controller: eyes → connectome → descending-neuron readout → flap.
// The decision sees the game only through the neurons; θ (weights + bias) is the only thing that learns.
import { FlyDecoder } from '../brain/FlyDecoder';
import type { FlappyState } from '../types';
import type { Connectome, NeuronMeta } from './connectome';
import { groupsByName, readRates, sense, TRACE_KEEP, type SensoryGroups } from './sensing';

/** Which descending groups the flap is read from, and how their rates are scaled. */
export interface Readout { names: string[]; mean: number[]; std: number[] }

export const paramCount = (readout: Readout) => readout.names.length + 1;

export interface Decision { flap: boolean; p: number; action: boolean }

export class NeuralPolicy {
  private readonly ids: Int32Array[];
  private readonly rates: Float32Array;
  private readonly traces: Float32Array;
  /** Normalised readout values of the last step: what a learner needs to credit a decision. */
  readonly features: Float32Array;
  private theta: number[];
  private readonly decoder = new FlyDecoder(2, 260);

  constructor(private readonly brain: Connectome, private readonly groups: SensoryGroups, readonly readout: Readout, meta: NeuronMeta = brain.meta) {
    this.ids = groupsByName(meta, readout.names);
    const n = readout.names.length;
    this.rates = new Float32Array(n); this.traces = new Float32Array(n); this.features = new Float32Array(n);
    this.theta = new Array(n + 1).fill(0);
  }

  /** Start a fresh attempt: new readout parameters, reset membrane state and noise seed. */
  begin(theta: number[], seed: number) {
    if (theta.length !== paramCount(this.readout)) throw new Error(`theta needs ${paramCount(this.readout)} values, got ${theta.length}`);
    this.theta = [...theta];
    this.brain.reset(seed); this.traces.fill(0); this.features.fill(0); this.decoder.reset();
  }

  /**
   * One 20 ms step while flying. With `random` the fly acts stochastically (it explores,
   * which is what lets it learn from its own decisions); without it, p ≥ 0.5 means flap.
   */
  tick(state: FlappyState, nowMs: number, random?: () => number): Decision {
    sense(this.brain, this.groups, state);
    this.brain.step();
    readRates(this.brain, this.ids, this.rates);
    const { mean, std } = this.readout, w = this.theta;
    let z = w[w.length - 1];
    for (let k = 0; k < this.rates.length; k++) {
      this.traces[k] = TRACE_KEEP * this.traces[k] + (1 - TRACE_KEEP) * this.rates[k];
      this.features[k] = (this.traces[k] - mean[k]) / Math.max(0.02, std[k]);
      z += w[k] * this.features[k];
    }
    const p = 1 / (1 + Math.exp(-z));
    const action = random ? random() < p : p >= 0.5;
    return { flap: this.decoder.decide(nowMs, action) === 'FLAP', p, action };
  }

  /** The cells behind each readout group, in order. */
  get readoutCells() { return this.ids; }

  /** One 20 ms step with no sensory input (between attempts): spontaneous activity only. */
  idle() { this.brain.step(); }
}
