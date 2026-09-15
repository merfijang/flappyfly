import { describe, expect, it } from 'vitest';
import { onlineLearningThreshold, trainedFlapRequest } from './TrainedFlightPolicy';

const state = (birdY: number, birdVelocityY: number) => ({
  birdY, birdVelocityY, pipeX: 250, pipeWidth: 72, gapTop: 200,
  gapBottom: 410, gapCenterY: 305, distanceToPipe: 138
});

describe('trainedFlapRequest', () => {
  it('never flaps above the gap even with a saturated learned output', () => {
    expect(trainedFlapRequest(state(250, 100), 1, .42)).toBe(false);
  });
  it('never double-flaps during a fast climb', () => {
    expect(trainedFlapRequest(state(340, -200), 1, .42)).toBe(false);
  });
  it('only recovers once the readout has learned enough confidence', () => {
    expect(trainedFlapRequest(state(340, 20), .4, .42)).toBe(false);
    expect(trainedFlapRequest(state(340, 20), .8, .42)).toBe(true);
  });
  it('gradually converges from the ordinary-training threshold to the fast-trained threshold', () => {
    expect(onlineLearningThreshold(0, .42)).toBe(.68);
    expect(onlineLearningThreshold(500, .42)).toBeCloseTo(.55);
    expect(onlineLearningThreshold(1000, .42)).toBeCloseTo(.42);
  });
});
