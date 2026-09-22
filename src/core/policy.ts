// The fly's controller: eyes → connectome → descending-neuron readout → flap.
// The decision sees the game only through the neurons; θ (weights + bias) is the only thing that learns.
import { FlyDecoder } from '../brain/FlyDecoder';
import type { FlappyState } from '../types';
import type { Connectome } from './connectome';
import { FEATURES, readFeatures, sense, type SensoryGroups } from './sensing';

export interface Normalization { mean: number[]; std: number[] }

export const PARAM_COUNT = FEATURES.length + 1;

export class NeuralPolicy {
  private theta: number[] = new Array(PARAM_COUNT).fill(0);
  private readonly raw = new Float32Array(FEATURES.length);
  private readonly traces = new Float32Array(FEATURES.length);
  private readonly decoder = new FlyDecoder(2, 260);

  constructor(private readonly brain: Connectome, private readonly groups: SensoryGroups, private readonly norm: Normalization) {}

  /** Start a fresh attempt: new readout parameters, reset membrane state and noise seed. */
  begin(theta: number[], seed: number) {
    if (theta.length !== PARAM_COUNT) throw new Error(`theta needs ${PARAM_COUNT} values, got ${theta.length}`);
    this.theta = [...theta];
    this.brain.reset(seed); this.traces.fill(0); this.decoder.reset();
  }

  /** One 20 ms step while flying. */
  tick(state: FlappyState, nowMs: number): { flap: boolean; p: number } {
    sense(this.brain, this.groups, state);
    this.brain.step();
    readFeatures(this.brain, this.groups, this.raw);
    const { mean, std } = this.norm, w = this.theta;
    let z = w[FEATURES.length];
    for (let k = 0; k < FEATURES.length; k++) {
      this.traces[k] = this.traces[k] * 0.86 + this.raw[k] * 0.14;
      z += w[k] * (this.traces[k] - mean[k]) / std[k];
    }
    const p = 1 / (1 + Math.exp(-z));
    return { flap: this.decoder.decide(nowMs, p >= 0.5) === 'FLAP', p };
  }

  /** One 20 ms step with no sensory input (between attempts): spontaneous activity only. */
  idle() { this.brain.step(); }
}
