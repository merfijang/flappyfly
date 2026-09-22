import { describe, expect, it } from 'vitest';
import { calibrate } from './calibrate';
import { buildGroups, FEATURES } from './sensing';
import { tinyBrain } from './testing';

describe('calibrate', () => {
  it('returns a mean and a floored std per feature, deterministically', () => {
    const brain = tinyBrain(), g = buildGroups(brain.meta);
    const a = calibrate(brain, g, 600), b = calibrate(brain, g, 600);
    expect(a).toEqual(b);
    expect(a.mean).toHaveLength(FEATURES.length);
    expect(a.std).toHaveLength(FEATURES.length);
    expect(Math.min(...a.std)).toBeGreaterThanOrEqual(0.02);
  });
  it('measures real variation when visual neurons feed a feature', () => {
    const brain = tinyBrain(), g = buildGroups(brain.meta);
    g.features[0] = g.lc10L;
    const n = calibrate(brain, g, 1500);
    expect(n.mean[0]).toBeGreaterThan(0.05);
    expect(n.std[0]).toBeGreaterThan(0.05);
  });
});
