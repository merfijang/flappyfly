// Server → site messages. JSON for everything except neural activity, which is a binary
// bitset over the display neurons (see display.ts), sent ~10 times a second.

export interface AttemptRecord { n: number; generation: number; score: number; fitness: number; seconds: number; cause: string; at: number }

export interface Stats {
  attempts: number; generation: number; queue: number; bestScore: number; bestFitness: number;
  totalFeeLamports: number; pendingLamports: number; lamportsPerAttempt: number;
  feeSource: 'mock' | 'solana'; feeWallets: string[]; flying: boolean;
}

export interface AttemptStart { type: 'attempt_start'; n: number; generation: number; sample: number; pop: number; seed: number }

export interface Frame { type: 'frame'; t: number; y: number; vy: number; pipes: [number, number, number][]; score: number; p: number; flap: boolean }

export type ServerMessage =
  | { type: 'hello'; stats: Stats; history: AttemptRecord[]; current: AttemptStart | null; theta: number[]; displayCount: number; readoutGroups: string[] }
  | Frame
  | AttemptStart
  | { type: 'attempt_end'; record: AttemptRecord; theta: number[] }
  | { type: 'fee'; lamports: number; signature: string; attemptsAdded: number }
  | { type: 'stats'; stats: Stats };

/** Pack one byte-per-neuron hit flags into a bitset. */
export function encodeBits(hits: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.ceil(hits.length / 8));
  for (let i = 0; i < hits.length; i++) if (hits[i]) out[i >> 3] |= 1 << (i & 7);
  return out;
}

export function decodeBits(bytes: Uint8Array, count: number, out = new Uint8Array(count)): Uint8Array {
  for (let i = 0; i < count; i++) out[i] = (bytes[i >> 3] >> (i & 7)) & 1;
  return out;
}
