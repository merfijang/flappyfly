// Entry point: `npm run server`. Loads the connectome, restores learning state, starts fees + the 50 Hz loop.
import { buildGroups } from '../src/core/sensing';
import { calibrate } from '../src/core/calibrate';
import { loadBrain } from './brainFiles';
import { Broadcaster } from './broadcast';
import { readConfig } from './config';
import { mockFees } from './fees/mockSource';
import { httpRpc, SolanaFeeWatcher } from './fees/solanaWatcher';
import { FlyServer, freshState, type PersistedState } from './flyServer';
import { loadState, saveState } from './stateStore';

const cfg = readConfig();
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

log('loading connectome from', cfg.brainDir);
const brain = loadBrain(cfg.brainDir), groups = buildGroups(brain.meta);
log(`connectome ready: ${brain.n.toLocaleString()} neurons`);

let state = loadState<PersistedState>(cfg.stateFile, () => ({ version: 1 }) as PersistedState);
if (!state.trainer) {
  log('first start: calibrating readout normalisation (~30 s)');
  state = freshState(calibrate(brain, groups));
  saveState(cfg.stateFile, state);
}
log(`state: ${state.attempts} attempts, generation ${state.trainer.generation}, queue ${state.queue}`);

let fly: FlyServer | undefined;
const out = new Broadcaster({ hello: () => fly!.hello(), stats: () => fly!.stats() }, cfg.corsOrigin);
state.watchers ??= {};
fly = new FlyServer({
  brain, groups, state, lamportsPerAttempt: cfg.lamportsPerAttempt, feeSource: cfg.feeSource, feeWallets: cfg.feeWallets,
  save: (s) => saveState(cfg.stateFile, s), out
});

let stopFees: () => void = () => undefined;
if (cfg.feeSource === 'mock') {
  stopFees = mockFees(cfg.mockFeeEveryMs, (e) => fly!.addFee(e));
  log(`fees: MOCK, one fake inflow every ${cfg.mockFeeEveryMs} ms`);
} else {
  const rpc = httpRpc(cfg.rpcUrl), stops: (() => void)[] = [];
  stopFees = () => stops.forEach((stop) => stop());
  for (const wallet of cfg.feeWallets) {
    const watcher: SolanaFeeWatcher = new SolanaFeeWatcher(rpc, wallet, state.watchers[wallet] ?? null, (e) => {
      log('fee', e.lamports / 1e9, 'SOL into', wallet, e.signature);
      fly!.addFee(e, { wallet, cursor: watcher.cursor });
    });
    // the first poll may only record where the wallet history starts; persist that before watching
    void watcher.poll()
      .then(() => { fly!.setWatcherCursor(wallet, watcher.cursor); saveState(cfg.stateFile, fly!.snapshot()); })
      .catch((e) => log(`first fee poll of ${wallet} failed, retrying in the loop:`, e instanceof Error ? e.message : e))
      .finally(() => { stops.push(watcher.start(cfg.pollMs, (m) => log(m))); });
  }
  log(`fees: watching ${cfg.feeWallets.join(', ')} via ${cfg.rpcUrl}`);
}
log(`1 attempt = ${cfg.lamportsPerAttempt / 1e9} SOL`);

// fixed 50 Hz: catch up at most 5 steps, drop further lag rather than spiral
let next = performance.now(), running = true;
const loop = () => {
  if (!running) return;
  const now = performance.now();
  for (let n = 0; now >= next && n < 5; n++) { fly!.tick(); next += 20; }
  if (now - next > 200) next = now;
  setTimeout(loop, Math.max(0, next - performance.now()));
};
loop();

const port = await out.listen(cfg.port);
log(`listening on :${port} (ws /ws, GET /health, GET /stats)`);

const shutdown = async () => {
  running = false; stopFees();
  saveState(cfg.stateFile, fly!.snapshot());
  await out.close();
  log('state saved, bye');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
