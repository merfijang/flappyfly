// Game → sensory neurons, and descending neurons → readout features.
// The stimulus wiring follows brain/flyBrain.worker.ts; its strength and the set of
// descending neurons the flap is read from are measured (see calibrate.ts), not hand-picked.
import type { FlappyState } from '../types';
import { cellsOf, type Connectome, type NeuronMeta } from './connectome';

/**
 * How hard the game drives the visual neurons. Measured: at 1 the descending neurons barely
 * answer (rate range ≈ 0.13), at 6+ they saturate into a yes/no signal; at 3 their rates
 * follow the gap offset smoothly.
 */
export const STIMULUS_GAIN = 3;

/** How much of the previous readout value is kept each 20 ms step. Lower = faster, noisier. */
export const TRACE_KEEP = 0.5;

/** Group sizes below this spike too erratically to read from. */
export const MIN_GROUP_CELLS = 5;

export interface SensoryGroups { lc4: Int32Array[]; lplc2: Int32Array[]; lc10L: Int32Array; lc10R: Int32Array }

export function buildGroups(meta: NeuronMeta): SensoryGroups {
  const both = (name: string) => [cellsOf(meta, name, 'L'), cellsOf(meta, name, 'R')];
  return { lc4: both('LC4'), lplc2: both('LPLC2'), lc10L: cellsOf(meta, 'LC10a', 'L'), lc10R: cellsOf(meta, 'LC10a', 'R') };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Inject the game into the visual neurons, one quantity per population: how far below or above
 * the gap the fly is (LC10a, small-target cells), how fast it is falling or rising (LPLC2), and
 * how close the pipe is (LC4, looming cells). Keeping the quantities on separate populations is
 * what makes them readable further into the brain — mixed into one channel they are not.
 */
export function sense(brain: Connectome, g: SensoryGroups, state: FlappyState, gain = STIMULUS_GAIN) {
  const offset = (state.birdY - state.gapCenterY) / 150, speed = state.birdVelocityY / 400;
  brain.stimulate(g.lc10L, clamp01(offset) * gain);
  brain.stimulate(g.lc10R, clamp01(-offset) * gain);
  brain.stimulate(g.lplc2[0], clamp01(speed) * gain);
  brain.stimulate(g.lplc2[1], clamp01(-speed) * gain);
  for (const ids of g.lc4) brain.stimulate(ids, clamp01(1 - state.distanceToPipe / 300) * gain * 0.5);
}

/** The populations we drive ourselves: reading them back would be reading our own signal. */
export const STIMULATED_TYPES = new Set(['LC4', 'LPLC2', 'LC10a']);

/**
 * Every cell type in the brain, split by side, except the ones the game drives. Groups smaller
 * than `minCells` are dropped: one or two cells spike too erratically to read a flap from.
 */
export function readableGroups(meta: NeuronMeta, minCells = 5) {
  const byName = new Map<string, number[]>();
  for (let i = 0; i < meta.n; i++) {
    const type = meta.types[meta.typeIdx[i]];
    if (STIMULATED_TYPES.has(type)) continue;
    const name = `${type} ${meta.side[i] === 2 ? 'R' : 'L'}`;
    (byName.get(name) ?? byName.set(name, []).get(name)!).push(i);
  }
  const names = [...byName.keys()].filter((n) => byName.get(n)!.length >= minCells).sort();
  return { names, ids: names.map((n) => Int32Array.from(byName.get(n)!)) };
}

/** Cells of the named descending groups, in the given order (missing names give empty groups). */
export function groupsByName(meta: NeuronMeta, names: readonly string[]) {
  const all = readableGroups(meta, 1), index = new Map(all.names.map((n, i) => [n, i]));
  return names.map((n) => (index.has(n) ? all.ids[index.get(n)!] : new Int32Array()));
}

export function readRates(brain: Connectome, ids: Int32Array[], out: Float32Array) {
  for (let i = 0; i < ids.length; i++) {
    const group = ids[i];
    let hits = 0;
    for (let k = 0; k < group.length; k++) hits += brain.spiked[group[k]];
    out[i] = group.length ? hits / group.length : 0;
  }
  return out;
}
