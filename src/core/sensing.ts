// Game → sensory neurons, and descending neurons → readout features.
// The stimulus wiring and feature groups are the ones used by brain/flyBrain.worker.ts.
import { FlyEncoder } from '../brain/FlyEncoder';
import type { FlappyState } from '../types';
import { cellsOf, type Connectome, type NeuronMeta } from './connectome';

export const FEATURES = ['TARGET_DN L', 'TARGET_DN R', 'LOOM_DN L', 'LOOM_DN R', 'ESCAPE_DN L', 'ESCAPE_DN R', 'DNae002 L', 'DNae002 R', 'DNg111 L', 'DNg111 R', 'DNp01 L', 'DNp01 R'] as const;

const DN_SETS: Record<string, string[]> = {
  TARGET_DN: ['DNae002', 'DNae001', 'DNg111', 'DNge109', 'DNb01', 'DNg13', 'DNge103', 'DNp54'],
  LOOM_DN: ['DNa07', 'DNae004', 'DNg40', 'DNp04', 'DNp06', 'DNp103', 'DNp34', 'DNp35', 'DNp71', 'DNpe025', 'DNpe045', 'DNpe056'],
  ESCAPE_DN: ['DNp01', 'DNp04', 'DNg40', 'DNp71']
};

function featureCells(meta: NeuronMeta, feature: string) {
  const [, group, side] = feature.match(/^(.*) ([LR])$/)!;
  const names = DN_SETS[group] ?? [group];
  return Int32Array.from(new Set(names.flatMap((name) => [...cellsOf(meta, name, side as 'L' | 'R')])));
}

export interface SensoryGroups { lc4: Int32Array[]; lplc2: Int32Array[]; lc10L: Int32Array; lc10R: Int32Array; features: Int32Array[] }

export function buildGroups(meta: NeuronMeta): SensoryGroups {
  const both = (name: string) => [cellsOf(meta, name, 'L'), cellsOf(meta, name, 'R')];
  return {
    lc4: both('LC4'), lplc2: both('LPLC2'), lc10L: cellsOf(meta, 'LC10a', 'L'), lc10R: cellsOf(meta, 'LC10a', 'R'),
    features: FEATURES.map((f) => featureCells(meta, f))
  };
}

/** Inject the encoded game state into the visual neurons (before the next brain step). */
export function sense(brain: Connectome, g: SensoryGroups, state: FlappyState) {
  const s = FlyEncoder.encode(state);
  for (const ids of g.lc4) brain.stimulate(ids, s.lc4);
  for (const ids of g.lplc2) brain.stimulate(ids, s.lplc2);
  brain.stimulate(g.lc10L, s.lc10Left + s.upward * 0.35);
  brain.stimulate(g.lc10R, s.lc10Right + s.downward * 0.35);
}

export function readFeatures(brain: Connectome, g: SensoryGroups, out: Float32Array) {
  for (let i = 0; i < g.features.length; i++) out[i] = brain.rate(g.features[i]);
  return out;
}
