// Which neurons the site draws, and where on the body. Server and site both derive this
// from meta.bin, so the activity bitset needs no index list on the wire.
import type { NeuronMeta } from '../core/connectome';

export const REGIONS = ['eyeL', 'eyeR', 'head', 'neck', 'thorax', 'abdomen', 'legs'] as const;
export const REGION_QUOTA = [1400, 1400, 2400, 900, 4000, 3600, 900];
const [EYE_L, EYE_R, HEAD, NECK, THORAX, ABDOMEN, LEGS] = REGIONS.map((_, i) => i);

/** Body region for a neuron's superclass. Schematic: the CNS drawn onto a fly silhouette. */
export function regionOf(superclass: string, side: number, index: number) {
  if (superclass.startsWith('ol_') || superclass.startsWith('visual_')) return side === 2 || (side === 0 && index & 1) ? EYE_R : EYE_L;
  if (superclass.startsWith('cb_')) return HEAD;
  if (superclass.includes('descending') || superclass.includes('ascending')) return NECK;
  if (superclass === 'vnc_motor') return LEGS;
  if (superclass === 'ENS' || superclass === 'vnc_endocrine') return ABDOMEN;
  if (superclass.startsWith('vnc_')) return index % 3 === 0 ? ABDOMEN : THORAX; // abdominal neuromeres live in the VNC
  return HEAD;
}

export function pickDisplayNeurons(meta: Pick<NeuronMeta, 'n' | 'superclasses' | 'classIdx' | 'side'>) {
  const byRegion: number[][] = REGIONS.map(() => []);
  for (let i = 0; i < meta.n; i++) byRegion[regionOf(meta.superclasses[meta.classIdx[i]], meta.side[i], i)].push(i);
  const ids: number[] = [], region: number[] = [];
  byRegion.forEach((cands, r) => {
    const q = Math.min(REGION_QUOTA[r], cands.length);
    for (let j = 0; j < q; j++) { ids.push(cands[Math.floor((j * cands.length) / q)]); region.push(r); }
  });
  return { ids: Int32Array.from(ids), region: Uint8Array.from(region) };
}
