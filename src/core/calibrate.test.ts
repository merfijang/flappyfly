import { describe, expect, it } from 'vitest';
import { calibrateReadout } from './calibrate';
import { buildGroups } from './sensing';
import { tinyBrain } from './testing';

describe('calibrateReadout', () => {
  it('picks readout groups with a scale for each, deterministically', () => {
    const brain = tinyBrain(), g = buildGroups(brain.meta);
    const a = calibrateReadout(brain, g, brain.meta, { steps: 600, keep: 4, minCells: 1 });
    const b = calibrateReadout(brain, g, brain.meta, { steps: 600, keep: 4, minCells: 1 });
    expect(a).toEqual(b);
    expect(a.names.length).toBe(a.mean.length);
    expect(a.names.length).toBe(a.std.length);
    expect(Math.min(...a.std, 1)).toBeGreaterThanOrEqual(0.02);
  });

  it('keeps the group whose firing follows the gap offset', () => {
    const brain = tinyBrain(), g = buildGroups(brain.meta);
    // wire the eyes straight onto a descending cell so its rate tracks the offset
    const dn = brain.meta.types.indexOf('DNp01');
    const cells = Array.from({ length: brain.n }, (_, i) => i).filter((i) => brain.meta.typeIdx[i] === dn && brain.meta.side[i] === 1);
    const r = calibrateReadout(brain, { ...g, lc10L: Int32Array.from(cells) }, brain.meta, { steps: 900, keep: 3, minCells: 1 });
    expect(r.names).toContain('DNp01 L');
  });
});
