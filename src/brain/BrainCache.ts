const CACHE = 'fly-connectome-v1';
export async function cachedFetch(url: string, onNetwork?: () => void) {
  const cache = await caches.open(CACHE); const hit = await cache.match(url);
  if (hit) return hit;
  onNetwork?.(); const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  await cache.put(url, response.clone()); return response;
}
export async function clearBrainCache() { await caches.delete(CACHE); }
