import type { FlappyState, NeuralStimulus } from '../types';

export class FlyEncoder {
  static encode(state: FlappyState): NeuralStimulus {
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    const approach = clamp(1 - state.distanceToPipe / 300);
    const error = state.gapCenterY - state.birdY;
    const vertical = clamp(Math.abs(error) / 240);
    const velocity = clamp(Math.abs(state.birdVelocityY) / 520);
    return {
      lc4: approach,
      lplc2: clamp(approach * 0.9 + 0.04),
      lc10Left: error < 0 ? vertical : 0,
      lc10Right: error >= 0 ? vertical : 0,
      upward: state.birdVelocityY < 0 ? velocity : 0,
      downward: state.birdVelocityY >= 0 ? velocity : 0
    };
  }
}
