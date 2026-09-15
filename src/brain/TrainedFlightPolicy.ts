import type { FlappyState } from '../types';

/** The learned readout may tune timing, but may never override flight safety. */
export function trainedFlapRequest(state: FlappyState, learned: number) {
  const adaptiveMargin = (Math.max(0, Math.min(1, learned)) - 0.5) * 12;
  const belowTarget = state.birdY > state.gapCenterY + 8 - adaptiveMargin;
  const notClimbingFast = state.birdVelocityY > -70;
  return belowTarget && notClimbingFast;
}

