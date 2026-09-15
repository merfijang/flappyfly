export interface ReadoutModel { weights: number[]; bias: number; threshold: number; features: string[]; mean?: number[]; scale?: number[]; trainingSamples?: number; trainingLoss?: number; }
export const DEFAULT_READOUT: ReadoutModel = {
  features: ['TARGET_DN L','TARGET_DN R','LOOM_DN L','LOOM_DN R','ESCAPE_DN L','ESCAPE_DN R','DNae002 L','DNae002 R','DNg111 L','DNg111 R','DNp01 L','DNp01 R'],
  weights: Array(12).fill(0), bias: -0.35, threshold: 0.42
};
export const inferReadout = (values: Float32Array, model: ReadoutModel) => {
  let z = model.bias;
  for (let i = 0; i < model.weights.length; i++) z += model.weights[i] * (((values[i] ?? 0) - (model.mean?.[i] ?? 0)) / (model.scale?.[i] ?? 1));
  return 1 / (1 + Math.exp(-z));
};
