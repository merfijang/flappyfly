import type { FlappyState } from '../types';

/** Online learning supplies a confidence threshold; Fast Model passes zero after training. */
export function trainedFlapRequest(state: FlappyState, learned: number, threshold: number) {
  const adaptiveMargin = (Math.max(0, Math.min(1, learned)) - 0.5) * 12;
  const belowTarget = state.birdY > state.gapCenterY + 8 - adaptiveMargin;
  const notClimbingFast = state.birdVelocityY > -70;
  return learned >= threshold && belowTarget && notClimbingFast;
}

/** Ordinary training starts cautious and reaches the fitted-model threshold after ~1,000 samples. */
export function onlineLearningThreshold(samples: number, trainedThreshold: number) {
  const progress = Math.max(0, Math.min(1, samples / 1000));
  return 0.68 + (trainedThreshold - 0.68) * progress;
}
