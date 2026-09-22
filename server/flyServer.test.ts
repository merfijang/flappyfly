import { describe, expect, it } from 'vitest';
import { buildGroups, FEATURES } from '../src/core/sensing';
import { tinyBrain } from '../src/core/testing';
import type { ServerMessage } from '../src/shared/protocol';
import { FlyServer, freshState, type PersistedState } from './flyServer';

const norm = { mean: FEATURES.map(() => 0), std: FEATURES.map(() => 1) };

function setup(extra: Partial<ConstructorParameters<typeof FlyServer>[0]> = {}) {
  const brain = tinyBrain(), msgs: ServerMessage[] = [], bins: Uint8Array[] = [], saves: PersistedState[] = [];
  let r = 5; const rand = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296;
  const fly = new FlyServer({
    brain, groups: buildGroups(brain.meta), state: freshState(norm), lamportsPerAttempt: 100, feeSource: 'mock', feeWallets: [],
    save: (s) => saves.push(structuredClone(s)), out: { json: (m) => msgs.push(m), binary: (b) => bins.push(b) }, rand, ...extra
  });
  const of = <T extends ServerMessage['type']>(t: T) => msgs.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === t);
  return { fly, msgs, bins, saves, of };
}
const fee = (lamports: number) => ({ signature: `s${lamports}`, lamports, slot: 0, blockTime: null });

describe('FlyServer', () => {
  it('turns fees into queued attempts and persists them', () => {
    const { fly, saves, of } = setup();
    fly.addFee(fee(250));
    expect(fly.stats()).toMatchObject({ queue: 2, pendingLamports: 50, totalFeeLamports: 250 });
    expect(saves.at(-1)).toMatchObject({ queue: 2, pendingLamports: 50 });
    expect(of('fee')[0]).toMatchObject({ attemptsAdded: 2 });
  });

  it('idles without fees, then flies one paid attempt, learns from it and pauses', () => {
    const { fly, of } = setup({ pauseTicks: 3 });
    for (let i = 0; i < 10; i++) fly.tick();
    expect(of('attempt_start')).toHaveLength(0);
    fly.addFee(fee(100));
    fly.tick();
    expect(of('attempt_start')[0]).toMatchObject({ n: 1, generation: 0, sample: 0, pop: 10 });
    for (let i = 0; i < 500 && !of('attempt_end').length; i++) fly.tick();
    const end = of('attempt_end')[0];
    expect(end.record).toMatchObject({ n: 1, score: 0 });
    expect(end.record.seconds).toBeGreaterThan(0);
    expect(of('frame').length).toBeGreaterThan(10);
    expect(fly.stats()).toMatchObject({ attempts: 1, queue: 0, flying: false });
    fly.tick(); fly.tick(); fly.tick();
    expect(of('attempt_start')).toHaveLength(1); // queue empty → stays idle
  });

  it('persists the cursor of each watched wallet together with its fee', () => {
    const { fly, saves } = setup();
    fly.addFee(fee(100), { wallet: 'VaultA', cursor: { initialized: true, lastSignature: 'sigA' } });
    fly.addFee(fee(100), { wallet: 'VaultB', cursor: { initialized: true, lastSignature: 'sigB' } });
    expect(saves.at(-1)!.watchers).toEqual({ VaultA: { initialized: true, lastSignature: 'sigA' }, VaultB: { initialized: true, lastSignature: 'sigB' } });
  });

  it('counts an attempt in flight as still queued when saving', () => {
    const { fly } = setup();
    fly.addFee(fee(200));
    fly.tick();
    expect(fly.stats().queue).toBe(1);
    expect(fly.snapshot().queue).toBe(2);
  });

  it('ends an attempt at the time cap', () => {
    const { fly, of } = setup({ capSeconds: 0.1 });
    fly.addFee(fee(100));
    for (let i = 0; i < 10; i++) fly.tick();
    expect(of('attempt_end')[0].record).toMatchObject({ seconds: 0.1, cause: 'SURVIVED THE TIME LIMIT.' });
  });

  it('streams an activity bitset every 5 ticks', () => {
    const { fly, bins } = setup();
    for (let i = 0; i < 10; i++) fly.tick();
    expect(bins).toHaveLength(2);
    expect(bins[0].length).toBe(Math.ceil(fly.displayCount / 8));
  });

  it('keeps only the most recent history', () => {
    const { fly, saves } = setup({ capSeconds: 0.02, pauseTicks: 1, historyLimit: 3 });
    fly.addFee(fee(500));
    for (let i = 0; i < 40; i++) fly.tick();
    expect(saves.at(-1)!.history.map((h) => h.n)).toEqual([3, 4, 5]);
  });
});
