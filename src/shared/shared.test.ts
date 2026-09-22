import { describe, expect, it } from 'vitest';
import { pickDisplayNeurons, REGION_QUOTA, REGIONS, regionOf } from './display';
import { decodeBits, encodeBits } from './protocol';

describe('activity bitset', () => {
  it('round-trips counts that are not a multiple of 8', () => {
    const hits = Uint8Array.from({ length: 13 }, (_, i) => (i % 3 === 0 ? 1 : 0));
    const bytes = encodeBits(hits);
    expect(bytes.length).toBe(2);
    expect(decodeBits(bytes, 13)).toEqual(hits);
  });
});

describe('display neurons', () => {
  const classes = ['ol_intrinsic', 'cb_intrinsic', 'descending_neuron', 'vnc_intrinsic', 'vnc_motor', 'ENS'];
  const n = 60000;
  const meta = { n, superclasses: classes, classIdx: Uint8Array.from({ length: n }, (_, i) => i % classes.length), side: Uint8Array.from({ length: n }, (_, i) => 1 + (i % 2)) };

  it('maps superclasses to body regions', () => {
    expect(REGIONS[regionOf('ol_intrinsic', 1, 0)]).toBe('eyeL');
    expect(REGIONS[regionOf('visual_projection', 2, 0)]).toBe('eyeR');
    expect(REGIONS[regionOf('cb_intrinsic', 1, 0)]).toBe('head');
    expect(REGIONS[regionOf('ascending_neuron', 1, 0)]).toBe('neck');
    expect(REGIONS[regionOf('vnc_motor', 1, 0)]).toBe('legs');
    expect(REGIONS[regionOf('ENS', 0, 0)]).toBe('abdomen');
  });

  it('samples deterministically, within quotas, without duplicates', () => {
    const a = pickDisplayNeurons(meta), b = pickDisplayNeurons(meta);
    expect(a.ids).toEqual(b.ids);
    expect(new Set(a.ids).size).toBe(a.ids.length);
    REGIONS.forEach((_, r) => expect(a.region.filter((x) => x === r).length).toBeLessThanOrEqual(REGION_QUOTA[r]));
    a.ids.forEach((id, k) => expect(regionOf(classes[meta.classIdx[id]], meta.side[id], id)).toBe(a.region[k]));
  });
});
