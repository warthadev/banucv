// src/react/feature/cloudviewuithumb.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Music, Image, File, HardDrive, Mic, Sticker, Gift, Camera, Folder } from 'lucide-react';
import { getColor } from '@config/telegram';
import { getThumb, setThumb } from '@config/thumbnailstore';
import { fetchWithGlobalCache } from '@config/imagecache';
import { resolveHfSignedUrl } from '@system/mediarender';
import {
  CACHE_TTL, VIDEO_THUMB_TIMEOUT, VIDEO_METADATA_TIMEOUT, VIDEO_THUMB_FORMAT, VIDEO_THUMB_QUALITY,
  MIN_VALID_BLOB_BYTES, IMG_RENDER_TIMEOUT, FINGERPRINT_HEAD_BYTES, THUMB_CACHE_VERSION,
  VIDEO_THUMB_MAX_WIDTH, VIDEO_FRAME_SETTLE_TIMEOUT, VIDEO_BLANK_SAMPLE_SIZE, VIDEO_BLANK_MAX_LUMA,
  VIDEO_TRUNCATED_SAFETY, THUMB_MAX_AUTO_RETRIES, THUMB_RETRY_BASE_DELAY, VIDEO_CANDIDATE_PERCENTS,
  thumbnailCache, sanitizeText, getBaseName, isValidBlob, getResolutionTier, RES_TIER_COLORS,
  videoResKey, setVideoRes, subscribeVideoRes, getCachedVideoRes, acquireThumbSlot, releaseThumbSlot
} from '@config/cloudviewuiconfig';
import type { ResTier } from '@config/cloudviewuiconfig';

export const FileIcon: React.FC<{ type: string; size?: number; style?: React.CSSProperties }> = ({ type, size = 20, style }) => {
  const p = { size, style };
  switch (type) {
    case 'video': return <Video {...p} />;
    case 'audio': return <Music {...p} />;
    case 'image': return <Camera {...p} />;
    case 'archive': return <HardDrive {...p} />;
    case 'voice': return <Mic {...p} />;
    case 'sticker': return <Sticker {...p} />;
    case 'gif': return <Gift {...p} />;
    case 'folder': return <Folder {...p} />;
    default: return <File {...p} />;
  }
};

const computeFingerprint = async (
  url: string,
  fileSize: number,
  fileName: string,
  token: string | undefined,
  signal: AbortSignal
): Promise<string> => {
  const baseName = getBaseName(fileName);
  const head = `${fileSize}:${baseName}`;

  if (!url || url.startsWith('blob:')) {
    return `${head}:local`;
  }

  try {
    const headers: HeadersInit = { Range: `bytes=0-${FINGERPRINT_HEAD_BYTES - 1}` };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { headers, signal });
    if (!res.ok && res.status !== 206) {
      return `${head}:nohash`;
    }
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let h1 = 2166136261;
    let h2 = 2246822519;
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
      const b = bytes[i];
      h1 ^= b;
      h1 = (h1 * 16777619) >>> 0;
      h2 ^= b;
      h2 = (h2 * 2654435761) >>> 0;
    }
    const h1s = h1.toString(16).padStart(8, '0');
    const h2s = h2.toString(16).padStart(8, '0');
    return `${head}:${h1s}${h2s}`;
  } catch (err: any) {
    if (err && err.name === 'AbortError') throw err;
    return `${head}:err`;
  }
};

const readHead = async (res: Response, max: number): Promise<Blob> => {
  const fallbackType = res.headers.get('content-type') || 'video/mp4';
  if (!res.body) return res.blob();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  reader.cancel().catch(() => { void 0; });
  return new Blob(chunks as BlobPart[], { type: fallbackType });
};

interface CaptureOptions {
  availableBytes?: number;
  totalBytes?: number;
  onDimensions?: (width: number, height: number) => void;
}

const buildCandidateTimes = (duration: number, opts: CaptureOptions): number[] => {
  let limit = duration;
  if (opts.availableBytes && opts.totalBytes && opts.totalBytes > opts.availableBytes) {
    limit = Math.max(0.5, duration * (opts.availableBytes / opts.totalBytes) * VIDEO_TRUNCATED_SAFETY);
  }
  const maxT = Math.max(duration - 0.1, 0.1);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const percent of VIDEO_CANDIDATE_PERCENTS) {
    const t = Math.min(Math.max(duration * percent, 0.1), limit, maxT);
    const key = Math.round(t * 10);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
};

const seekVideo = (video: HTMLVideoElement, time: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const onSeeked = () => { detach(); resolve(); };
    const onError = () => { detach(); reject(new Error('Seek error')); };
    const detach = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    try { video.currentTime = time; } catch { detach(); reject(new Error('Seek error')); }
  });
};

const waitForFrame = (video: HTMLVideoElement): Promise<void> => {
  return new Promise((resolve) => {
    let done = false;
    let fallbackId: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (fallbackId) clearTimeout(fallbackId);
      resolve();
    };
    fallbackId = setTimeout(finish, VIDEO_FRAME_SETTLE_TIMEOUT);

    const afterReady = () => {
      const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
      if (typeof v.requestVideoFrameCallback === 'function') {
        v.requestVideoFrameCallback(() => finish());
      } else {
        requestAnimationFrame(() => requestAnimationFrame(finish));
      }
    };

    if (video.readyState >= 2) { afterReady(); }
    else { video.addEventListener('loadeddata', afterReady, { once: true }); }
  });
};

const isBlankFrame = (source: HTMLCanvasElement): boolean => {
  const sw = VIDEO_BLANK_SAMPLE_SIZE;
  const sh = Math.max(1, Math.round((sw * source.height) / source.width));
  const probe = document.createElement('canvas');
  probe.width = sw;
  probe.height = sh;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  if (!pctx) return false;
  pctx.drawImage(source, 0, 0, sw, sh);
  const { data } = pctx.getImageData(0, 0, sw, sh);
  let maxLuma = 0;
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (luma > maxLuma) maxLuma = luma;
  }
  return maxLuma < VIDEO_BLANK_MAX_LUMA;
};

const captureVideoFrame = (url: string, opts: CaptureOptions = {}): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';

    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let metadataTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (metadataTimeoutId) clearTimeout(metadataTimeoutId);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.src = '';
      video.load();
    };

    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(reason));
    };

    const succeed = (blob: Blob) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    };

    timeoutId = setTimeout(() => fail('Timeout'), VIDEO_THUMB_TIMEOUT);
    metadataTimeoutId = setTimeout(() => fail('Metadata timeout'), VIDEO_METADATA_TIMEOUT);

    video.onerror = () => fail('Video load error');

    const grabFrame = (): HTMLCanvasElement | null => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;
      const scale = Math.min(1, VIDEO_THUMB_MAX_WIDTH / vw);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(vw * scale));
      canvas.height = Math.max(1, Math.round(vh * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas;
    };

    const run = async (duration: number) => {
      const times = buildCandidateTimes(duration, opts);
      for (const t of times) {
        if (settled) return;
        await seekVideo(video, t);
        if (settled) return;
        await waitForFrame(video);
        if (settled) return;

        const canvas = grabFrame();
        if (!canvas) { fail('Capture error'); return; }
        if (isBlankFrame(canvas)) continue;

        canvas.toBlob((blob) => {
          if (!isValidBlob(blob)) { fail('Empty blob'); return; }
          succeed(blob);
        }, VIDEO_THUMB_FORMAT, VIDEO_THUMB_QUALITY);
        return;
      }
      fail('Blank frame');
    };

    video.onloadedmetadata = () => {
      if (metadataTimeoutId) { clearTimeout(metadataTimeoutId); metadataTimeoutId = null; }
      if (video.videoWidth === 0 || video.videoHeight === 0) { fail('Unsupported codec'); return; }
      if (opts.onDimensions) { try { opts.onDimensions(video.videoWidth, video.videoHeight); } catch { void 0; } }
      if (!isFinite(video.duration) || video.duration <= 0) { fail('Invalid duration'); return; }
      run(video.duration).catch(() => fail('Capture error'));
    };

    video.src = url;
  });
};

const readVideoDimensions = (src: string, signal?: AbortSignal): Promise<{ w: number; h: number } | null> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    let done = false;
    const finish = (r: { w: number; h: number } | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.src = '';
      video.load();
      resolve(r);
    };
    const timer = setTimeout(() => finish(null), VIDEO_METADATA_TIMEOUT * 2);
    video.onloadedmetadata = () => finish(video.videoWidth > 0 && video.videoHeight > 0 ? { w: video.videoWidth, h: video.videoHeight } : null);
    video.onerror = () => finish(null);
    signal?.addEventListener('abort', () => finish(null), { once: true });
    video.src = src;
  });
};

const probeVideoResolution = async (url: string, token: string | undefined, signal?: AbortSignal): Promise<{ w: number; h: number } | null> => {
  if (!token) return readVideoDimensions(url, signal);
  try {
    const signed = await resolveHfSignedUrl(url, token, signal);
    if (signed) {
      const r = await readVideoDimensions(signed, signal);
      if (r) return r;
    }
  } catch { void 0; }

  try {
    const res = await fetch(url, { signal, headers: { Authorization: `Bearer ${token}`, Range: 'bytes=0-4194303' } });
    if (res.ok || res.status === 206) {
      const head = await readHead(res, 4 * 1024 * 1024);
      const tmp = URL.createObjectURL(head);
      try { return await readVideoDimensions(tmp, signal); } finally { URL.revokeObjectURL(tmp); }
    }
  } catch { void 0; }
  return null;
};

const useVideoResolution = (url: string, token: string | undefined, fileSize: number, enabled: boolean) => {
  const key = enabled && url ? videoResKey(url, fileSize) : '';
  const [res, setRes] = useState<{ w: number; h: number } | null>(() => (key ? getCachedVideoRes(key) : null));
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!key) { setRes(null); return; }
    setRes(getCachedVideoRes(key));
    return subscribeVideoRes(key, () => setRes(getCachedVideoRes(key)));
  }, [key]);

  useEffect(() => {
    if (!key || res || visible) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [key, res, visible]);

  useEffect(() => {
    if (!key || res || !visible) return;
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      await acquireThumbSlot();
      try {
        if (cancelled || getCachedVideoRes(key)) return;
        const r = await probeVideoResolution(url, token, controller.signal);
        if (!cancelled && r) setVideoRes(key, r.w, r.h);
      } finally { releaseThumbSlot(); }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [key, res, visible, url, token]);

  return { res, ref };
};

export const VideoResBadge: React.FC<{
  url: string;
  token?: string;
  fileSize?: number;
  enabled: boolean;
  style?: React.CSSProperties;
}> = ({ url, token, fileSize = 0, enabled, style }) => {
  const { res, ref } = useVideoResolution(url, token, fileSize, enabled);
  if (!enabled) return null;
  if (!res) return <span ref={ref} className="cloudview-res-badge cloudview-res-badge--pending" aria-hidden="true" />;
  const tier = getResolutionTier(res.w, res.h);
  return (
    <span className="cloudview-res-badge" style={{ ['--res-color' as any]: RES_TIER_COLORS[tier], ...style }} title={`${res.w}×${res.h}`}>
      {tier}
    </span>
  );
};

interface ThumbnailImageProps {
  url: string;
  alt: string;
  type: string;
  token?: string;
  fileSize?: number;
  fileName?: string;
  fallbackUrl?: string;
  /** Ikon/warna placeholder saat loading atau gagal (default: sama dengan type). */
  iconType?: string;
}

export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({ url, alt, type, token, fileSize = 0, fileName = '', fallbackUrl, iconType }) => {
  const visualType = iconType || type;
  const [fallbackFor, setFallbackFor] = useState<string | null>(null);
  const useFallback = !!fallbackUrl && fallbackFor === url;
  const activeUrl = useFallback ? (fallbackUrl as string) : url;
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAttemptsRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
      });
    }, { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { blobUrlRef.current = imgSrc; }, [imgSrc]);

  const clearRenderTimeout = useCallback(() => {
    if (renderTimeoutRef.current) { clearTimeout(renderTimeoutRef.current); renderTimeoutRef.current = null; }
  }, []);

  const handleRetryOnce = useCallback(() => {
    setRetryCount(prev => {
      if (prev >= 1) { setError(true); setLoading(false); return prev; }
      return prev + 1;
    });
    setRenderKey(prev => prev + 1);
  }, []);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    clearRenderTimeout();
    const img = e.currentTarget;
    if (img.naturalWidth === 0 || img.naturalHeight === 0) { handleRetryOnce(); return; }
    setLoading(false);
    setError(false);
  }, [clearRenderTimeout, handleRetryOnce]);

  const handleImageError = useCallback(() => { clearRenderTimeout(); handleRetryOnce(); }, [clearRenderTimeout, handleRetryOnce]);

  useEffect(() => {
    if (!isVisible) return;
    if ((type !== 'image' && type !== 'video') || !activeUrl || activeUrl.length === 0) {
      setLoading(false); setError(true); return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const failOrRetry = () => {
      if (cancelled) return;
      if (fetchAttemptsRef.current < THUMB_MAX_AUTO_RETRIES) {
        const delay = THUMB_RETRY_BASE_DELAY * 2 ** fetchAttemptsRef.current;
        fetchAttemptsRef.current += 1;
        retryTimerRef.current = setTimeout(() => setRenderKey(k => k + 1), delay);
        return;
      }
      setError(true); setLoading(false);
    };

    const runFetch = async () => {
      await acquireThumbSlot();
      if (cancelled) { releaseThumbSlot(); return; }
      try {
        try {
          // Untuk video asli (bukan thumb jpg) jangan di-fetch penuh lewat cache global.
          if (useFallback && type === 'video') throw new Error('skip-global-for-video');
          const globalUrl = await fetchWithGlobalCache(activeUrl, token);
          if (cancelled) return;
          thumbnailCache.set(activeUrl, { url: globalUrl, timestamp: Date.now() });
          setImgSrc(globalUrl); setLoading(false); return;
        } catch (err) {
          // Thumb belum ada / 404 -> langsung pakai file asli.
          if (fallbackUrl && !useFallback) { if (!cancelled) setFallbackFor(url); return; }
          console.warn('Global cache failed, falling back to manual fetch', err);
        }

        let fingerprint = '';
        try { fingerprint = await computeFingerprint(activeUrl, fileSize, fileName, token, controller.signal); }
        catch (err: any) {
          if (err && err.name === 'AbortError') return;
          fingerprint = `${fileSize}:${getBaseName(fileName)}:err`;
        }
        fingerprint = `${THUMB_CACHE_VERSION}:${fingerprint}`;

        if (cancelled) return;

        const memCached = thumbnailCache.get(fingerprint);
        if (memCached && Date.now() - memCached.timestamp < CACHE_TTL) {
          setImgSrc(memCached.url); setLoading(false); return;
        }

        const storedBlob = await getThumb(fingerprint);
        if (cancelled) return;

        if (isValidBlob(storedBlob)) {
          const cachedBlobUrl = URL.createObjectURL(storedBlob);
          thumbnailCache.set(fingerprint, { url: cachedBlobUrl, timestamp: Date.now() });
          setImgSrc(cachedBlobUrl); setLoading(false); return;
        }

        if (storedBlob) { try { await setThumb(fingerprint, new Blob([])); } catch { void 0; } }

        if (type === 'video') {
          let blob: Blob | null = null;
          const reportDimensions = (w: number, h: number) => setVideoRes(videoResKey(activeUrl, fileSize), w, h);
          if (token) {
            try {
              const signed = await resolveHfSignedUrl(activeUrl, token, controller.signal);
              if (signed) blob = await captureVideoFrame(signed, { onDimensions: reportDimensions });
            } catch { blob = null; }
          }
          if (!blob) {
            let frameSrc = activeUrl; let tempUrl = ''; let headBytes = 0;
            if (token) {
              const res = await fetch(activeUrl, { signal: controller.signal, headers: { Authorization: `Bearer ${token}`, Range: 'bytes=0-8388607' } });
              if (!res.ok) throw new Error('Failed to fetch');
              const head = await readHead(res, 8 * 1024 * 1024);
              headBytes = head.size; tempUrl = URL.createObjectURL(head); frameSrc = tempUrl;
            }
            try {
              blob = await captureVideoFrame(frameSrc, headBytes > 0 ? { availableBytes: headBytes, totalBytes: fileSize, onDimensions: reportDimensions } : { onDimensions: reportDimensions });
            } catch (err) {
              if (tempUrl) URL.revokeObjectURL(tempUrl);
              failOrRetry(); return;
            }
            if (tempUrl) URL.revokeObjectURL(tempUrl);
          }
          if (cancelled) return;
          if (!isValidBlob(blob)) { failOrRetry(); return; }
          const blobUrl = URL.createObjectURL(blob);
          thumbnailCache.set(fingerprint, { url: blobUrl, timestamp: Date.now() });
          setImgSrc(blobUrl); setLoading(false);
          setThumb(fingerprint, blob).catch(() => { void 0; });
        } else {
          const headers: HeadersInit = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const res = await fetch(activeUrl, { signal: controller.signal, headers });
          if (!res.ok) throw new Error('Failed to fetch');
          const blob = await res.blob();
          if (cancelled) return;
          if (!isValidBlob(blob)) { failOrRetry(); return; }
          const blobUrl = URL.createObjectURL(blob);
          thumbnailCache.set(fingerprint, { url: blobUrl, timestamp: Date.now() });
          setImgSrc(blobUrl); setLoading(false);
          setThumb(fingerprint, blob).catch(() => { void 0; });
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        failOrRetry();
      } finally { releaseThumbSlot(); }
    };

    runFetch();

    return () => {
      cancelled = true;
      controller.abort();
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    };
  }, [activeUrl, type, token, isVisible, fileSize, fileName, renderKey]);

  useEffect(() => { fetchAttemptsRef.current = 0; }, [activeUrl, fileSize, fileName]);

  useEffect(() => {
    if (!imgSrc) return;
    if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    renderTimeoutRef.current = setTimeout(() => {
      // Gambar bisa selesai load sebelum timer ini dipasang (onLoad sudah lewat),
      // jadi cek langsung ke elemen: kalau sudah tampil, jangan di-retry.
      const el = imgRef.current;
      if (el && el.complete && el.naturalWidth > 0) return;
      handleRetryOnce();
    }, IMG_RENDER_TIMEOUT);
    return () => { clearRenderTimeout(); };
  }, [imgSrc, renderKey, clearRenderTimeout, handleRetryOnce]);

  if (loading) return (
    <div ref={containerRef} className="cloudview-thumb-fallback" style={{ background: getColor(visualType) + '18', color: getColor(visualType) }}>
      <div className="cloudview-loading-spinner" />
    </div>
  );

  if (error || !imgSrc) return (
    <div ref={containerRef} className="cloudview-thumb-fallback" style={{ background: getColor(visualType) + '18', color: getColor(visualType) }}>
      <FileIcon type={visualType} size={32} />
    </div>
  );

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <img key={renderKey} ref={imgRef} src={imgSrc} alt={sanitizeText(alt) || 'Thumbnail'} className="cloudview-thumb-img" loading="lazy" onLoad={handleImageLoad} onError={handleImageError} />
    </div>
  );
};