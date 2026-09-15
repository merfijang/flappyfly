export type Mode = 'pure' | 'trained';
export type Decision = 'FLAP' | 'WAIT';
export type AppState = 'BOOT' | 'LOADING_CONNECTOME' | 'READY' | 'RUNNING' | 'DEAD' | 'ERROR';

export interface FlappyState {
  birdY: number; birdVelocityY: number; pipeX: number; pipeWidth: number;
  gapTop: number; gapBottom: number; gapCenterY: number; distanceToPipe: number;
}
export interface NeuralStimulus {
  lc4: number; lplc2: number; lc10Left: number; lc10Right: number; upward: number; downward: number;
}
export interface BrainActivity {
  lc4: number; lplc2: number; lc10Left: number; lc10Right: number; upward: number; downward: number; dnp01: number;
}
export interface BrainResult {
  timestamp: number; decision: Decision; flapProbability?: number; activity: BrainActivity;
  totalSpikes: number; stepTime: number; activityFrame: ArrayBuffer; activityFrameLength: number;
  trainingSamples?: number; trainingLoss?: number; readoutModel?: { weights: number[]; bias: number; threshold: number; features: string[]; mean?: number[]; scale?: number[]; trainingSamples?: number; trainingLoss?: number };
}
export interface BrainManifest {
  neurons: number; connections: number; ln_min: number; weights_mb: number;
  parts: string[]; meta_mb: number; weight_error_mean: number; weight_error_max: number;
}
export interface ExperimentRecord { flyId: number; mode: Mode; score: number; lifetime: number; totalSpikes: number; at: number; }
