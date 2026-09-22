import type { FeeEvent } from './solanaWatcher';

/** Fake fee inflows (0.005–0.03 SOL) for development and demos. Returns a stop function. */
export function mockFees(everyMs: number, onFee: (e: FeeEvent) => void, rand = Math.random) {
  let n = 0;
  const timer = setInterval(() => {
    n++;
    onFee({ signature: `mock-${Date.now()}-${n}`, lamports: Math.round((0.005 + rand() * 0.025) * 1e9), slot: 0, blockTime: Math.floor(Date.now() / 1000) });
  }, everyMs);
  return () => clearInterval(timer);
}
