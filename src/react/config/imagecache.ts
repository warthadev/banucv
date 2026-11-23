// src/react/config/imagecache.ts

type CacheEntry = {
  url: string;
  timestamp: number;
};

const imageCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL_MS = 1000 * 60 * 30;

export const getGlobalImage = (key: string): string | null => {
  const entry = imageCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    imageCache.delete(key);
    URL.revokeObjectURL(entry.url);
    return null;
  }
  return entry.url;
};

export const setGlobalImage = (key: string, url: string) => {
  if (imageCache.has(key)) {
    const old = imageCache.get(key);
    if (old) URL.revokeObjectURL(old.url);
  }
  imageCache.set(key, { url, timestamp: Date.now() });
  if (imageCache.size > MAX_CACHE_SIZE) {
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey) {
      const old = imageCache.get(oldestKey);
      if (old) URL.revokeObjectURL(old.url);
      imageCache.delete(oldestKey);
    }
  }
};

export const fetchWithGlobalCache = async (
  url: string,
  token?: string
): Promise<string> => {
  const cached = getGlobalImage(url);
  if (cached) return cached;

  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
  const raw = await res.blob();
  const objectUrl = URL.createObjectURL(raw);
  setGlobalImage(url, objectUrl);
  return objectUrl;
};