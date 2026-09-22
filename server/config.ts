import { join } from 'node:path';

export interface Config {
  port: number; host: string; gameSpeed: number; course: { gap: number; spawnEvery: number; speed: number }; readoutSize: number; feeMode: 'balance' | 'transactions'; feeSource: 'mock' | 'solana'; rpcUrl: string; feeWallets: string[]; lamportsPerAttempt: number;
  mockFeeEveryMs: number; mockTotalLamports: number; pollMs: number; stateFile: string; brainDir: string; corsOrigin: string;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const feeSource = (env.FEE_SOURCE ?? 'mock') as Config['feeSource'];
  if (feeSource !== 'mock' && feeSource !== 'solana') throw new Error(`FEE_SOURCE must be mock or solana, got ${feeSource}`);
  // comma-separated: e.g. the pump.fun bonding-curve creator vault and the PumpSwap creator vault
  const feeWallets = (env.FEE_WALLET ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (feeSource === 'solana' && !feeWallets.length) throw new Error('FEE_SOURCE=solana needs FEE_WALLET (the address or addresses that receive the fees)');
  // balance: 1 getBalance per poll (cheap, default). transactions: per-trade exact, needs a paid RPC under load.
  const feeMode = (env.FEE_MODE ?? 'balance') as Config['feeMode'];
  if (feeMode !== 'balance' && feeMode !== 'transactions') throw new Error(`FEE_MODE must be balance or transactions, got ${feeMode}`);
  const sol = Number(env.SOL_PER_ATTEMPT ?? 0.05);
  if (!(sol > 0)) throw new Error('SOL_PER_ATTEMPT must be a positive number');
  return {
    port: Number(env.PORT ?? 8787), host: env.HOST ?? '0.0.0.0',
    gameSpeed: Number(env.GAME_SPEED ?? 0.5),
    course: { gap: Number(env.COURSE_GAP ?? 210), spawnEvery: Number(env.COURSE_SPAWN ?? 2.1), speed: Number(env.COURSE_PIPE_SPEED ?? 132) },
    readoutSize: Number(env.READOUT_SIZE ?? 64), feeMode, feeSource, feeWallets, lamportsPerAttempt: Math.round(sol * 1e9),
    rpcUrl: env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
    mockFeeEveryMs: Number(env.MOCK_FEE_EVERY_MS ?? 4000), mockTotalLamports: env.MOCK_TOTAL_SOL ? Math.round(Number(env.MOCK_TOTAL_SOL) * 1e9) : Infinity, pollMs: Number(env.POLL_MS ?? (feeMode === 'balance' ? 5000 : 10000)),
    stateFile: env.STATE_FILE ?? join(process.cwd(), 'data', 'state.json'),
    brainDir: env.BRAIN_DIR ?? join(process.cwd(), 'brain'),
    corsOrigin: env.CORS_ORIGIN ?? '*'
  };
}
