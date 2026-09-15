import { describe, expect, it } from 'vitest';
import { trainedFlapRequest } from './TrainedFlightPolicy';

const state = (birdY: number, birdVelocityY: number) => ({
  birdY, birdVelocityY, pipeX: 250, pipeWidth: 72, gapTop: 200,
  gapBottom: 410, gapCenterY: 305, distanceToPipe: 138
});

describe('trainedFlapRequest', () => {
  it('never flaps above the gap even with a saturated learned output', () => {
    expect(trainedFlapRequest(state(250, 100), 1)).toBe(false);
  });
  it('never double-flaps during a fast climb', () => {
    expect(trainedFlapRequest(state(340, -200), 1)).toBe(false);
  });
  it('recovers when below the target and no longer climbing fast', () => {
    expect(trainedFlapRequest(state(340, 20), 0)).toBe(true);
  });
});

