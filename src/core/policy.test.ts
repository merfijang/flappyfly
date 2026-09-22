import { describe, expect, it } from 'vitest';
import { NeuralPolicy, paramCount, type Readout } from './policy';
import { buildGroups } from './sensing';
import { tinyBrain } from './testing';
import type { FlappyState } from '../types';

const state = (birdY: number): FlappyState => ({ birdY, birdVelocityY: 100, pipeX: 300, pipeWidth: 72, gapTop: 200, gapBottom: 410, gapCenterY: 305, distanceToPipe: 188 });
const readout = (names: string[]): Readout => ({ names, mean: names.map(() => 0), std: names.map(() => 1) });
const theta = (bias: number, weights: number[]) => [...weights, bias];

function flapsOverOneSecond(policy: NeuralPolicy, s: FlappyState) {
  let flaps = 0;
  for (let t = 0; t < 50; t++) if (policy.tick(s, t * 20).flap) flaps++;
  return flaps;
}

describe('NeuralPolicy', () => {
  it('has one weight per readout group plus a bias', () => expect(paramCount(readout(['DNp01 L', 'DNp01 R']))).toBe(3));

  it('flaps at the decoder rate when the bias alone says yes, and never when it says no', () => {
    const brain = tinyBrain(), r = readout(['DNp01 L']);
    const policy = new NeuralPolicy(brain, buildGroups(brain.meta), r);
    policy.begin(theta(20, [0]), 1);
    const yes = flapsOverOneSecond(policy, state(300));
    expect(yes).toBeGreaterThanOrEqual(3);
    expect(yes).toBeLessThanOrEqual(4); // 260 ms cooldown
    policy.begin(theta(-20, [0]), 1);
    expect(flapsOverOneSecond(policy, state(300))).toBe(0);
  });

  it('decides only from neurons: with no readout groups, game state changes nothing', () => {
    const brain = tinyBrain(), policy = new NeuralPolicy(brain, buildGroups(brain.meta), readout([]));
    const run = (y: number) => { policy.begin([0.01], 7); return Array.from({ length: 50 }, (_, t) => policy.tick(state(y), t * 20)); };
    expect(run(50)).toEqual(run(580));
  });

  it('reacts to what the eyes report, through the neurons it reads', () => {
    const brain = tinyBrain(), r = readout(['DNp01 L']);
    const policy = new NeuralPolicy(brain, buildGroups(brain.meta), r);
    // in the tiny brain nothing is wired, so drive the readout cell as a stand-in for the pathway
    const groups = buildGroups(brain.meta);
    const spy = { ...groups, lc10L: policy.readoutCells[0] };
    const p2 = new NeuralPolicy(brain, spy, r);
    p2.begin(theta(-5, [20]), 1);
    const below = flapsOverOneSecond(p2, state(590));
    p2.begin(theta(-5, [20]), 1);
    const above = flapsOverOneSecond(p2, state(40));
    expect(below).toBeGreaterThan(0);
    expect(above).toBe(0);
  });

  it('rejects a parameter vector of the wrong length', () => {
    const brain = tinyBrain(), policy = new NeuralPolicy(brain, buildGroups(brain.meta), readout(['DNp01 L']));
    expect(() => policy.begin([1, 2, 3], 1)).toThrow();
  });

  it('explores when given a random source', () => {
    const brain = tinyBrain(), policy = new NeuralPolicy(brain, buildGroups(brain.meta), readout(['DNp01 L']));
    policy.begin(theta(0, [0]), 1); // p = 0.5
    const acts = Array.from({ length: 40 }, (_, t) => policy.tick(state(300), t * 20, () => (t % 2 ? 0.2 : 0.8)).action);
    expect(new Set(acts)).toEqual(new Set([true, false]));
  });
});
