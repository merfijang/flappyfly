export interface FlappyState {
  birdY: number; birdVelocityY: number; pipeX: number; pipeWidth: number;
  gapTop: number; gapBottom: number; gapCenterY: number; distanceToPipe: number;
}
export interface NeuralStimulus {
  lc4: number; lplc2: number; lc10Left: number; lc10Right: number; upward: number; downward: number;
}
