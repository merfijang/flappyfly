import { describe, expect, it } from 'vitest';
import { NeuralPolicy, PARAM_COUNT } from './policy';
import { buildGroups, FEATURES } from './sensing';
import { tinyBrain } from './testing';
import type { FlappyState } from '../types';

const state = (birdY: number): FlappyState => ({ birdY, birdVelocityY: 100, pipeX: 300, pipeWidth: 72, gapTop: 200, gapBottom: 410, gapCenterY: 305, distanceToPipe: 188 });
const norm = { mean: FEATURES.map(() => 0), std: FEATURES.map(() => 1) };
const theta = (bias: number, w = 0) => [...FEATURES.map(() => w), bias];

function flapsOverOneSecond(policy: NeuralPolicy, s: FlappyState) {
  let flaps = 0;
  for (let t = 0; t < 50; t++) if (policy.tick(s, t * 20).flap) flaps++;
  return flaps;
}

describe('NeuralPolicy', () => {
  it('has one weight per feature plus a bias', () => expect(PARAM_COUNT).toBe(FEATURES.length + 1));

  it('flaps at the decoder rate when the bias alone says yes, and never when it says no', () => {
    const brain = tinyBrain(), policy = new NeuralPolicy(brain, buildGroups(brain.meta), norm);
    policy.begin(theta(20), 1);
    const yes = flapsOverOneSecond(policy, state(300));
    expect(yes).toBeGreaterThanOrEqual(3);
    expect(yes).toBeLessThanOrEqual(4); // 260 ms cooldown
    policy.begin(theta(-20), 1);
    expect(flapsOverOneSecond(policy, state(300))).toBe(0);
  });

  it('decides only from neurons: with the sensory groups disconnected, game state changes nothing', () => {
    const brain = tinyBrain(), groups = { ...buildGroups(brain.meta), lc4: [], lplc2: [], lc10L: new Int32Array(), lc10R: new Int32Array() };
    const policy = new NeuralPolicy(brain, groups, norm);
    const run = (y: number) => { policy.begin(theta(0.01, 3), 7); return Array.from({ length: 50 }, (_, t) => policy.tick(state(y), t * 20)); };
    expect(run(50)).toEqual(run(580));
  });

  it('reacts to what the eyes report once visual neurons drive the readout', () => {
    const brain = tinyBrain(), groups = buildGroups(brain.meta);
    // wire the readout straight to the LC10a cells so the test sees sensing → neurons → decision
    groups.features = groups.features.map((_, i) => (i === 0 ? groups.lc10L : new Int32Array()));
    const policy = new NeuralPolicy(brain, groups, norm);
    const w = [20, ...Array(FEATURES.length - 1).fill(0), -5];
    policy.begin(w, 1); const below = flapsOverOneSecond(policy, state(590)); // far below the gap → LC10a L driven
    policy.begin(w, 1); const above = flapsOverOneSecond(policy, state(40));
    expect(below).toBeGreaterThan(0);
    expect(above).toBe(0);
  });

  it('rejects a parameter vector of the wrong length', () => {
    const brain = tinyBrain(), policy = new NeuralPolicy(brain, buildGroups(brain.meta), norm);
    expect(() => policy.begin([1, 2], 1)).toThrow();
  });
});
