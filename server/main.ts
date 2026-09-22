// Entry point: `npm run server`. Loads the connectome, restores learning state, starts fees + the 50 Hz loop.
import { buildGroups } from '../src/core/sensing';
import { calibrateReadout } from '../src/core/calibrate';
import { loadBrain } from './brainFiles';
import { Broadcaster } from './broadcast';
import { readConfig } from './config';
import { mockFees } from './fees/mockSource';
import { BalanceFeeWatcher } from './fees/balanceWatcher';
import { httpRpc, SolanaFeeWatcher, type FeeEvent } from './fees/solanaWatcher';
import { resolvePumpCoin } from './fees/pumpToken';
import { FlyServer, freshState, type PersistedState } from './flyServer';
import { loadState, saveState } from './stateStore';

const cfg = readConfig();
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

log('loading connectome from', cfg.brainDir);
const brain = loadBrain(cfg.brainDir), groups = buildGroups(brain.meta);
log(`connectome ready: ${brain.n.toLocaleString()} neurons`);

let state = loadState<PersistedState>(cfg.stateFile, () => ({ version: 2 }) as PersistedState);
if (!state.trainer || !state.readout) {
  log('first start: measuring which neurons to read the flap from (~1 min)');
  const readout = calibrateReadout(brain, groups, brain.meta, { keep: cfg.readoutSize });
  log(`readout: ${readout.names.length} groups, strongest ${readout.names.slice(0, 5).join(', ')}`);
  state = freshState(readout);
  saveState(cfg.stateFile, state);
}
log(`state: ${state.attempts} attempts, generation ${state.trainer.generation}, queue ${state.queue}`);

const rpc = httpRpc(cfg.rpcUrl);
// resolve the coin before the server is built, so its fee vaults are part of what the site shows
if (cfg.feeSource === 'solana' && cfg.feeToken) {
  const coin = await resolvePumpCoin(rpc, cfg.feeToken);
  cfg.feeWallets = coin.vaults;
  log(`coin ${coin.mint}: creator ${coin.creator}, ${coin.migrated ? 'trading on PumpSwap' : 'still on the bonding curve'}`);
  log(`fee vaults: ${coin.vaults.join(', ')}`);
}

let fly: FlyServer | undefined;
const out = new Broadcaster({ hello: () => fly!.hello(), stats: () => fly!.stats() }, cfg.corsOrigin);
state.watchers ??= {}; state.balances ??= {};
fly = new FlyServer({
  brain, groups, state, lamportsPerAttempt: cfg.lamportsPerAttempt, feeSource: cfg.feeSource, feeWallets: cfg.feeWallets,
  save: (s) => saveState(cfg.stateFile, s), out, course: cfg.course, gameSpeed: cfg.gameSpeed
});

let stopFees: () => void = () => undefined;
if (cfg.feeSource === 'mock') {
  stopFees = mockFees(cfg.mockFeeEveryMs, (e) => fly!.addFee(e), Math.random, cfg.mockTotalLamports);
  log(`fees: MOCK, one fake inflow every ${cfg.mockFeeEveryMs} ms${Number.isFinite(cfg.mockTotalLamports) ? `, ${cfg.mockTotalLamports / 1e9} SOL in total` : ''}`);
} else {
  const stops: (() => void)[] = [];
  stopFees = () => stops.forEach((stop) => stop());
  // one coin: walk that coin trades once and credit every vault it paid. Otherwise: one watcher per vault.
  const groups: string[][] = cfg.feeMint ? [cfg.feeWallets] : cfg.feeWallets.map((w) => [w]);
  for (const wallets of groups) {
    const wallet = cfg.feeMint ? `mint:${cfg.feeMint}` : wallets[0];
    const position = () => (watcher instanceof BalanceFeeWatcher ? { balance: watcher.lastBalance } : { cursor: watcher.cursor });
    const onFee = (e: FeeEvent) => { log('fee', e.lamports / 1e9, 'SOL into', wallet, e.signature); fly!.addFee(e, { wallet, ...position() }); };
    const watcher: BalanceFeeWatcher | SolanaFeeWatcher = cfg.feeMode === 'balance'
      ? new BalanceFeeWatcher(rpc, wallets[0], state.balances[wallet] ?? null, onFee)
      : new SolanaFeeWatcher(rpc, wallets, state.watchers[wallet] ?? null, onFee, { mint: cfg.feeMint });
    // the first poll may only record a baseline; persist that before watching
    void watcher.poll()
      .then(() => { fly!.setWatcher(wallet, position()); saveState(cfg.stateFile, fly!.snapshot()); })
      .catch((e) => log(`first fee poll of ${wallet} failed, retrying in the loop:`, e instanceof Error ? e.message : e))
      .finally(() => { stops.push(watcher.start(cfg.pollMs, (m) => log(m))); });
  }
  log(`fees: watching ${cfg.feeWallets.join(', ')} (${cfg.feeMode}, every ${cfg.pollMs} ms${cfg.feeMint ? `, only trades of ${cfg.feeMint}` : ''}) via ${cfg.rpcUrl}`);
}
log(`1 attempt = ${cfg.lamportsPerAttempt / 1e9} SOL`);

// fixed 50 Hz: catch up at most 5 steps, drop further lag rather than spiral
let next = performance.now(), running = true, tickMs = 0, ticks = 0;
// one health line a minute: how much of the 20 ms budget a tick uses, and who is watching
setInterval(() => { const s = fly!.stats(); log(`tick ${(tickMs / Math.max(1, ticks)).toFixed(1)} ms avg, ${ticks} ticks, ${out.viewers} viewers, attempts ${s.attempts}, queue ${s.queue}`); tickMs = 0; ticks = 0; }, 60_000).unref();
const loop = () => {
  if (!running) return;
  const now = performance.now();
  for (let n = 0; now >= next && n < 5; n++) { const t0 = performance.now(); fly!.tick(); tickMs += performance.now() - t0; ticks++; next += 20; }
  if (now - next > 200) next = now;
  setTimeout(loop, Math.max(0, next - performance.now()));
};
loop();

const port = await out.listen(cfg.port, cfg.host);
log(`listening on ${cfg.host}:${port} (ws /ws, GET /health, GET /stats)`);

const shutdown = async () => {
  running = false; stopFees();
  saveState(cfg.stateFile, fly!.snapshot());
  await out.close();
  log('state saved, bye');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
