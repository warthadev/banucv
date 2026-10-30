// src/react/config/cloudviewuiconfig.ts

export const SIDEBAR_MIN_WIDTH = 160;
export const SIDEBAR_MAX_WIDTH = 500;
export const LONG_PRESS_DURATION = 500;
export const CACHE_TTL = 5 * 60 * 1000;
export const MAX_CONCURRENT_THUMBS = 4;
export const MAX_CACHE_SIZE = 100;
export const VIDEO_THUMB_PERCENT = 0.25;
export const VIDEO_THUMB_TIMEOUT = 20000;
export const VIDEO_METADATA_TIMEOUT = 5000;
export const VIDEO_THUMB_FORMAT = 'image/jpeg';
export const VIDEO_THUMB_QUALITY = 0.75;
export const MIN_VALID_BLOB_BYTES = 512;
export const IMG_RENDER_TIMEOUT = 3000;
export const FINGERPRINT_HEAD_BYTES = 64 * 1024;
export const THUMB_CACHE_VERSION = 'v2';
export const VIDEO_THUMB_MAX_WIDTH = 480;
export const VIDEO_FRAME_SETTLE_TIMEOUT = 500;
export const VIDEO_BLANK_SAMPLE_SIZE = 32;
export const VIDEO_BLANK_MAX_LUMA = 12;
export const VIDEO_TRUNCATED_SAFETY = 0.6;
export const THUMB_MAX_AUTO_RETRIES = 2;
export const THUMB_RETRY_BASE_DELAY = 1500;
export const VIDEO_CANDIDATE_PERCENTS = [VIDEO_THUMB_PERCENT, 0.1, 0.5, 0.02];
export const VRES_STORAGE_KEY = 'cloudview_vres_v1';
export const VRES_MAX_ENTRIES = 3000;
export const REPO_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;

export type ResTier = '4K' | '2K' | 'FHD' | 'HD' | 'SD';

export const RES_TIER_COLORS: Record<ResTier, string> = {
  '4K': '#a855f7',
  '2K': '#06b6d4',
  'FHD': '#22c55e',
  'HD': '#3b82f6',
  'SD': '#9ca3af',
};

export const thumbnailCache = new Map<string, { url: string; timestamp: number }>();
export const videoResCache = new Map<string, { w: number; h: number }>();
export const videoResListeners = new Map<string, Set<() => void>>();

export let videoResLoaded = false;
export let videoResPersistTimer: ReturnType<typeof setTimeout> | null = null;

export const setVideoResLoaded = (val: boolean) => { videoResLoaded = val; };
export const setVideoResPersistTimer = (val: ReturnType<typeof setTimeout> | null) => { videoResPersistTimer = val; };

export const cleanupCache = () => {
  const now = Date.now();
  for (const [key, value] of thumbnailCache) {
    if (now - value.timestamp > CACHE_TTL) {
      URL.revokeObjectURL(value.url);
      thumbnailCache.delete(key);
    }
  }
  if (thumbnailCache.size > MAX_CACHE_SIZE) {
    const entries = [...thumbnailCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    for (const [key, value] of toRemove) {
      URL.revokeObjectURL(value.url);
      thumbnailCache.delete(key);
    }
  }
};
setInterval(cleanupCache, CACHE_TTL);

let activeThumbFetches = 0;
const thumbQueue: (() => void)[] = [];

export const acquireThumbSlot = (): Promise<void> => {
  if (activeThumbFetches < MAX_CONCURRENT_THUMBS) {
    activeThumbFetches++;
    return Promise.resolve();
  }
  return new Promise(resolve => {
    thumbQueue.push(() => {
      activeThumbFetches++;
      resolve();
    });
  });
};

export const releaseThumbSlot = () => {
  activeThumbFetches--;
  const next = thumbQueue.shift();
  if (next) next();
};

export const sanitizeText = (text: string | undefined | null): string => {
  if (!text) return '';
  const element = document.createElement('div');
  element.textContent = text;
  return element.textContent || '';
};

export const getBaseName = (name: string): string => {
  if (!name) return '';
  const parts = name.split('/');
  return parts[parts.length - 1] || name;
};

export const isValidBlob = (blob: Blob | null): blob is Blob => {
  if (!blob) return false;
  if (blob.size < MIN_VALID_BLOB_BYTES) return false;
  return true;
};

export const formatDuration = (seconds?: number): string => {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatRelativeDate = (timestamp?: number): string => {
  if (!timestamp) return '';
  const diff = Math.floor((Date.now() - timestamp * 1000) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
};

export const getResolutionTier = (w: number, h: number): ResTier => {
  const longSide = Math.max(w, h);
  const shortSide = Math.min(w, h);
  if (longSide >= 3800 || shortSide >= 2100) return '4K';
  if (longSide >= 2500 || shortSide >= 1400) return '2K';
  if (longSide >= 1900 || shortSide >= 1060) return 'FHD';
  if (longSide >= 1260 || shortSide >= 700) return 'HD';
  return 'SD';
};

export const videoResKey = (url: string, size?: number): string => `${(url || '').split('?')[0]}|${size || 0}`;

export const loadVideoResCache = () => {
  if (videoResLoaded) return;
  videoResLoaded = true;
  try {
    const raw = localStorage.getItem(VRES_STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, [number, number]>;
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v) && v[0] > 0 && v[1] > 0) videoResCache.set(k, { w: v[0], h: v[1] });
    }
  } catch { void 0; }
};

export const getCachedVideoRes = (key: string): { w: number; h: number } | null => {
  loadVideoResCache();
  return videoResCache.get(key) || null;
};

export const subscribeVideoRes = (key: string, fn: () => void): (() => void) => {
  let set = videoResListeners.get(key);
  if (!set) {
    set = new Set();
    videoResListeners.set(key, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) videoResListeners.delete(key);
  };
};

export const setVideoRes = (key: string, w: number, h: number) => {
  if (!key || !w || !h) return;
  loadVideoResCache();
  const prev = videoResCache.get(key);
  if (prev && prev.w === w && prev.h === h) return;
  videoResCache.delete(key);
  videoResCache.set(key, { w, h });
  
  if (videoResPersistTimer) clearTimeout(videoResPersistTimer);
  videoResPersistTimer = setTimeout(() => {
    videoResPersistTimer = null;
    try {
      const entries = [...videoResCache.entries()].slice(-VRES_MAX_ENTRIES);
      const obj: Record<string, [number, number]> = {};
      for (const [k, v] of entries) obj[k] = [v.w, v.h];
      localStorage.setItem(VRES_STORAGE_KEY, JSON.stringify(obj));
    } catch { void 0; }
  }, 1000);
  
  const listeners = videoResListeners.get(key);
  if (listeners) listeners.forEach(fn => fn());
};