import { cachedFetch } from './BrainCache'; import type { BrainManifest } from '../types';
export interface LoadProgress { value: number; label: string; cached: boolean; }
export async function loadManifest(report: (p: LoadProgress) => void): Promise<BrainManifest> {
  let network = false; report({value: .04, label: 'Locating connectome manifest…', cached: true});
  const raw = await (await cachedFetch('/brain/brain.json', () => network = true)).json() as Record<string, unknown>;
  const manifest = raw as unknown as BrainManifest;
  if (manifest.neurons !== 166700 || manifest.connections < 25_000_000 || !manifest.parts?.length) throw new Error(`Connectome integrity check failed: received ${manifest.neurons?.toLocaleString()} neurons / ${manifest.connections?.toLocaleString()} connections.`);
  report({value: .1, label: network ? 'Manifest verified…' : 'Waking up cached brain…', cached: !network}); return manifest;
}
