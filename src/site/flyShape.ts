// Point-cloud fly. Each body part is a cloud of points; the specimen puts one real neuron
// on each point of the nervous-system parts, and draws the wings as plain (non-neuron) dots.
import { REGIONS } from '../shared/display';

type Vec = [number, number, number];

/** Seeded RNG so the fly looks the same for every viewer. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function gauss(r: () => number) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

function inEllipsoid(r: () => number, c: Vec, rad: Vec, shell: number): Vec {
  let x = gauss(r), y = gauss(r), z = gauss(r); const d = Math.hypot(x, y, z) || 1;
  const k = shell > 0 ? 1 - shell * r() : Math.cbrt(r());
  x = (x / d) * k; y = (y / d) * k; z = (z / d) * k;
  return [c[0] + x * rad[0], c[1] + y * rad[1], c[2] + z * rad[2]];
}

/** x: tail → head, y: down → up, z: right → left. Units ≈ body length. */
export function regionPoint(region: number, r: () => number): Vec {
  switch (REGIONS[region]) {
    case 'eyeL': return inEllipsoid(r, [0.48, 0.06, 0.15], [0.1, 0.13, 0.09], 0.2);
    case 'eyeR': return inEllipsoid(r, [0.48, 0.06, -0.15], [0.1, 0.13, 0.09], 0.2);
    case 'head': return inEllipsoid(r, [0.43, 0.02, 0], [0.15, 0.16, 0.13], 0.5);
    case 'neck': { const t = r(); return [0.27 - t * 0.07, 0.02 + gauss(r) * 0.025, gauss(r) * 0.03]; }
    case 'thorax': return inEllipsoid(r, [0.1, 0.03, 0], [0.22, 0.2, 0.18], 0.45);
    case 'abdomen': { const p = inEllipsoid(r, [-0.37, 0, 0], [0.36, 0.19, 0.18], 0.35); p[1] -= (p[0] + 0.37) ** 2 * 0.25; return p; }
    default: { // legs: three per side, hanging down and back from the thorax
      const leg = Math.floor(r() * 6), side = leg < 3 ? 1 : -1, root = 0.2 - (leg % 3) * 0.13, t = r();
      const knee = t < 0.45 ? t / 0.45 : 1, foot = t < 0.45 ? 0 : (t - 0.45) / 0.55;
      return [root - knee * 0.06 - foot * 0.14 * (leg % 3 === 2 ? 1.6 : 1), -0.1 - knee * 0.2 - foot * 0.2, side * (0.12 + knee * 0.12 + foot * 0.06) + gauss(r) * 0.008];
    }
  }
}

/** Wing membrane points; `side` 1 = left wing. Returned in the resting (folded back) pose. */
export function wingPoint(side: 1 | -1, r: () => number): Vec {
  const t = Math.sqrt(r()), w = 0.3 * Math.sin(Math.PI * Math.min(1, t * 0.98)), a = r() - 0.5;
  return [0.06 - t * 0.74, 0.21 + t * 0.05, side * (0.07 + t * 0.26 + a * w)];
}

export interface Projection { x: number; y: number; depth: number }

/** Rotate about the vertical axis (sway) and tilt, then project with a light perspective. */
export function project(p: Vec, yaw: number, pitch: number, out: Projection) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = p[0] * cy - p[2] * sy, z1 = p[0] * sy + p[2] * cy;
  const y2 = p[1] * cp - z1 * sp, z2 = p[1] * sp + z1 * cp;
  const f = 1 / (1 - z2 * 0.25);
  out.x = x1 * f; out.y = y2 * f; out.depth = z2;
  return out;
}
