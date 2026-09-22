// Which neurons the site draws, where, and what they do. Server and site both derive this
// from meta.bin, so the activity bitset needs no index list on the wire.
import type { NeuronMeta } from '../core/connectome';
import { buildGroups } from '../core/sensing';

/** Parts of the nervous system, in the order the site colours them. */
export const REGIONS = ['opticL', 'opticR', 'brain', 'neck', 'vnc', 'abdominal', 'motor'] as const;
export const REGION_QUOTA = [1800, 1800, 3000, 900, 4200, 900, 700];
const [OPTIC_L, OPTIC_R, BRAIN, NECK, VNC, ABDOMINAL, MOTOR] = REGIONS.map((_, i) => i);

/** What a displayed neuron does in this experiment. */
export const ROLE = { none: 0, input: 1, readout: 2 } as const;

/** Nervous-system region for a neuron's superclass. */
export function regionOf(superclass: string, side: number, index: number) {
  if (superclass.startsWith('ol_') || superclass.startsWith('visual_')) return side === 2 || (side === 0 && index & 1) ? OPTIC_R : OPTIC_L;
  if (superclass.startsWith('cb_')) return BRAIN;
  if (superclass.includes('descending') || superclass.includes('ascending')) return NECK;
  if (superclass === 'vnc_motor') return MOTOR;
  if (superclass === 'ENS' || superclass === 'vnc_endocrine') return ABDOMINAL;
  if (superclass.startsWith('vnc_')) return index % 5 === 0 ? ABDOMINAL : VNC; // abdominal neuromeres sit at the back of the VNC
  return BRAIN;
}

/**
 * Every game-input neuron (LC4, LPLC2, LC10a) and every readout neuron is always drawn;
 * the rest of each region is an even sample up to its quota.
 */
export function pickDisplayNeurons(meta: NeuronMeta) {
  const g = buildGroups(meta), role = new Uint8Array(meta.n);
  for (const ids of [...g.lc4, ...g.lplc2, g.lc10L, g.lc10R]) for (const id of ids) role[id] = ROLE.input;
  for (const ids of g.features) for (const id of ids) role[id] = ROLE.readout;

  const special: number[][] = REGIONS.map(() => []), rest: number[][] = REGIONS.map(() => []);
  for (let i = 0; i < meta.n; i++) (role[i] ? special : rest)[regionOf(meta.superclasses[meta.classIdx[i]], meta.side[i], i)].push(i);

  const ids: number[] = [], region: number[] = [], roles: number[] = [];
  REGIONS.forEach((_, r) => {
    for (const id of special[r]) { ids.push(id); region.push(r); roles.push(role[id]); }
    const cands = rest[r], q = Math.max(0, Math.min(REGION_QUOTA[r] - special[r].length, cands.length));
    for (let j = 0; j < q; j++) { ids.push(cands[Math.floor((j * cands.length) / q)]); region.push(r); roles.push(ROLE.none); }
  });
  return { ids: Int32Array.from(ids), region: Uint8Array.from(region), role: Uint8Array.from(roles) };
}
