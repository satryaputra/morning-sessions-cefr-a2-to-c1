const CACHE_NAME = 'pagikata-tts-audio-v1';
const MAX_MEMORY_ENTRIES = 80;
const MAX_PERSISTENT_ENTRIES = 200;

const memoryCache = new Map<string, Blob>();

export interface AudioCacheKeyParams {
  modelId: string;
  voiceId: string;
  rate: number;
  text: string;
}

export function buildAudioCacheKey({ modelId, voiceId, rate, text }: AudioCacheKeyParams): string {
  const normalizedText = text.trim().replace(/\s+/g, ' ');
  return `${modelId}|${voiceId}|${rate.toFixed(2)}|${normalizedText}`;
}

function toCacheUrl(key: string): string {
  return `https://pagikata-tts-cache.local/${encodeURIComponent(key)}`;
}

function hasBrowserCacheApi(): boolean {
  return typeof window !== 'undefined' && 'caches' in window && typeof window.caches?.open === 'function';
}

function setMemoryEntry(key: string, blob: Blob): void {
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  }
  memoryCache.set(key, blob);
  if (memoryCache.size > MAX_MEMORY_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey !== undefined) {
      memoryCache.delete(oldestKey);
    }
  }
}

export async function getCachedAudio(key: string): Promise<Blob | null> {
  const fromMem = memoryCache.get(key);
  if (fromMem) {
    // Refresh LRU order
    setMemoryEntry(key, fromMem);
    return fromMem;
  }

  if (!hasBrowserCacheApi()) return null;

  try {
    const cache = await window.caches.open(CACHE_NAME);
    const response = await cache.match(toCacheUrl(key));
    if (!response) return null;
    const blob = await response.blob();
    setMemoryEntry(key, blob);
    return blob;
  } catch {
    return null;
  }
}

export async function putCachedAudio(key: string, blob: Blob): Promise<void> {
  setMemoryEntry(key, blob);

  if (!hasBrowserCacheApi()) return;

  try {
    const cache = await window.caches.open(CACHE_NAME);
    await cache.put(
      toCacheUrl(key),
      new Response(blob, {
        headers: {
          'Content-Type': blob.type || 'audio/mpeg',
        },
      })
    );

    const keys = await cache.keys();
    if (keys.length > MAX_PERSISTENT_ENTRIES) {
      const overflow = keys.length - MAX_PERSISTENT_ENTRIES;
      await Promise.all(keys.slice(0, overflow).map((req) => cache.delete(req)));
    }
  } catch {
    // Cache API quota or private browsing errors should never break playback
  }
}

export async function getCachedAudioCount(): Promise<number> {
  if (!hasBrowserCacheApi()) {
    return memoryCache.size;
  }
  try {
    const cache = await window.caches.open(CACHE_NAME);
    const keys = await cache.keys();
    return Math.max(keys.length, memoryCache.size);
  } catch {
    return memoryCache.size;
  }
}

export async function clearAudioCache(): Promise<void> {
  memoryCache.clear();
  if (!hasBrowserCacheApi()) return;
  try {
    await window.caches.delete(CACHE_NAME);
  } catch {
    // Ignore
  }
}
