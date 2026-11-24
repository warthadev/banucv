// src/react/hook/useframescroll.ts
import { useEffect, useRef, useState, useCallback } from "react";

interface UseFrameScrollOptions {
  basePath: string;
  prefix?: string;
  extension?: string;
  padLength?: number;
  scanLimit?: number;
}

interface UseFrameScrollReturn {
  loaded: boolean;
  firstFrameLoaded: boolean;
  loadedCount: number;
  totalFrames: number;
  progress: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const MAX_CONCURRENT_LOADS = 4;
const FRAME_CACHE_RADIUS = 5;
const FRAME_ASSET_VERSION = "18137a57086fc283";

const loadImage = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      img.onload = null;
      img.onerror = null;
      resolve(img);
    };
    img.onerror = () => {
      img.onload = null;
      img.onerror = null;
      resolve(null);
    };
    img.src = url;
  });

const checkFrameExists = async (url: string): Promise<boolean> => {
  const img = await loadImage(url);
  return img !== null;
};

export const useFrameScroll = ({
  basePath,
  prefix = "frame_",
  extension = ".webp",
  padLength = 4,
  scanLimit = 2000,
}: UseFrameScrollOptions): UseFrameScrollReturn => {
  const [loaded, setLoaded] = useState(false);
  const [firstFrameLoaded, setFirstFrameLoaded] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [progress, setProgress] = useState(0);

  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadingRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const pendingRef = useRef<Set<number>>(new Set());
  const activeLoadsRef = useRef(0);
  const totalFramesRef = useRef(0);
  const targetFrameIndexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrameIndexRef = useRef<number>(-1);
  const rafRef = useRef<number | null>(null);
  const updateScrollRef = useRef<(() => void) | null>(null);
  const requestFrameRef = useRef<((index: number) => void) | null>(null);
  const mountedRef = useRef<boolean>(true);

  const buildUrl = useCallback(
    (num: number) => {
      const padded = String(num).padStart(padLength, "0");
      return `${basePath}/${prefix}${padded}${extension}?v=${FRAME_ASSET_VERSION}`;
    },
    [basePath, prefix, extension, padLength]
  );

  const renderFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const img = imagesRef.current.get(index);
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return false;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return false;

    if (
      canvas.width !== img.naturalWidth ||
      canvas.height !== img.naturalHeight
    ) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    lastFrameIndexRef.current = index;
    return true;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const images = new Map<number, HTMLImageElement>();
    const loading = new Map<number, HTMLImageElement>();
    const pending = new Set<number>();
    imagesRef.current = images;
    loadingRef.current = loading;
    pendingRef.current = pending;
    activeLoadsRef.current = 0;
    totalFramesRef.current = 0;
    targetFrameIndexRef.current = 0;
    lastFrameIndexRef.current = -1;

    const releaseImage = (img: HTMLImageElement) => {
      img.onload = null;
      img.onerror = null;
      img.removeAttribute("src");
    };

    const findFirstFrame = async (): Promise<{ number: number; image: HTMLImageElement } | null> => {
      for (let n = 1; n <= scanLimit; n++) {
        const image = await loadImage(buildUrl(n));
        if (cancelled || !mountedRef.current) return null;
        if (image) return { number: n, image };
      }
      return null;
    };

    const findLastFrame = async (startNum: number): Promise<number> => {
      const maxNum = startNum + scanLimit;
      let lastExisting = startNum;
      let probe = Math.min(startNum + 1, maxNum);
      let firstMissing: number | null = null;

      while (probe <= maxNum) {
        const exists = await checkFrameExists(buildUrl(probe));
        if (cancelled || !mountedRef.current) return lastExisting;
        if (!exists) {
          firstMissing = probe;
          break;
        }
        lastExisting = probe;
        const distance = probe - startNum;
        if (distance >= scanLimit) return lastExisting;
        probe = Math.min(startNum + distance * 2, maxNum);
      }

      if (firstMissing === null) return lastExisting;

      let low = lastExisting + 1;
      let high = firstMissing - 1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const exists = await checkFrameExists(buildUrl(middle));
        if (cancelled || !mountedRef.current) return lastExisting;
        if (exists) {
          lastExisting = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      return lastExisting;
    };

    let pumpQueue = () => {};

    const loadFrame = (index: number, startNum: number) => {
      if (images.has(index) || loading.has(index)) return;
      const img = new Image();
      img.decoding = "async";
      loading.set(index, img);
      activeLoadsRef.current += 1;

      const finish = (success: boolean) => {
        if (loading.get(index) !== img) return;
        loading.delete(index);
        activeLoadsRef.current = Math.max(0, activeLoadsRef.current - 1);
        if (cancelled || !mountedRef.current) {
          releaseImage(img);
          return;
        }

        const center = targetFrameIndexRef.current;
        const minKeep = Math.max(0, center - FRAME_CACHE_RADIUS);
        const maxKeep = Math.min(totalFramesRef.current - 1, center + FRAME_CACHE_RADIUS);
        if (success && index >= minKeep && index <= maxKeep) {
          images.set(index, img);
          const isCloser = lastFrameIndexRef.current === -1 ||
            Math.abs(index - center) < Math.abs(lastFrameIndexRef.current - center);
          const rendered = (index === center || isCloser) && renderFrame(index);
          if (rendered) {
            setFirstFrameLoaded(true);
            setLoaded(true);
          }
        } else {
          releaseImage(img);
        }
        setLoadedCount(images.size);
        pumpQueue();
      };

      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.src = buildUrl(startNum + index);
    };

    pumpQueue = () => {
      if (cancelled || !mountedRef.current) return;
      while (activeLoadsRef.current < MAX_CONCURRENT_LOADS && pending.size > 0) {
        let nextIndex: number | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const index of pending) {
          const distance = Math.abs(index - targetFrameIndexRef.current);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nextIndex = index;
          }
        }
        if (nextIndex === null) return;
        pending.delete(nextIndex);
        loadFrame(nextIndex, startFrameNumber);
      }
    };

    let startFrameNumber = 1;

    const requestFrames = (requestedIndex: number) => {
      const count = totalFramesRef.current;
      if (count === 0) return;
      const center = Math.max(0, Math.min(count - 1, requestedIndex));
      targetFrameIndexRef.current = center;
      const minKeep = Math.max(0, center - FRAME_CACHE_RADIUS);
      const maxKeep = Math.min(count - 1, center + FRAME_CACHE_RADIUS);

      for (const [index, img] of images) {
        if (index < minKeep || index > maxKeep) {
          images.delete(index);
          releaseImage(img);
        }
      }
      for (const index of pending) {
        if (index < minKeep || index > maxKeep) pending.delete(index);
      }
      for (const [index, img] of loading) {
        if (index < minKeep || index > maxKeep) {
          loading.delete(index);
          activeLoadsRef.current = Math.max(0, activeLoadsRef.current - 1);
          releaseImage(img);
        }
      }

      for (let index = minKeep; index <= maxKeep; index++) {
        if (!images.has(index) && !loading.has(index)) pending.add(index);
      }

      if (!images.has(center)) {
        let nearestIndex: number | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const index of images.keys()) {
          const distance = Math.abs(index - center);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        }
        if (nearestIndex !== null && nearestIndex !== lastFrameIndexRef.current) {
          renderFrame(nearestIndex);
        }
      } else if (center !== lastFrameIndexRef.current) {
        renderFrame(center);
      }

      setLoadedCount(images.size);
      pumpQueue();
    };

    requestFrameRef.current = requestFrames;

    const run = async () => {
      const firstFrame = await findFirstFrame();
      if (cancelled || !mountedRef.current) return;
      if (!firstFrame) {
        totalFramesRef.current = 0;
        setTotalFrames(0);
        return;
      }

      startFrameNumber = firstFrame.number;
      images.set(0, firstFrame.image);
      setLoadedCount(images.size);
      if (renderFrame(0)) {
        setFirstFrameLoaded(true);
        setLoaded(true);
      }

      const lastFrameNumber = await findLastFrame(startFrameNumber);
      if (cancelled || !mountedRef.current) return;
      const count = lastFrameNumber - startFrameNumber + 1;
      totalFramesRef.current = count;
      setTotalFrames(count);
      requestFrames(0);
      updateScrollRef.current?.();
    };

    void run();

    return () => {
      cancelled = true;
      requestFrameRef.current = null;
      for (const img of images.values()) releaseImage(img);
      for (const img of loading.values()) releaseImage(img);
      images.clear();
      loading.clear();
      pending.clear();
      activeLoadsRef.current = 0;
      totalFramesRef.current = 0;
      lastFrameIndexRef.current = -1;
    };
  }, [buildUrl, renderFrame, scanLimit]);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        const count = totalFramesRef.current;
        if (count === 0) return;

        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const containerHeight = rect.height;
        const viewportHeight = window.innerHeight;
        if (containerHeight <= viewportHeight) return;

        const progressValue = Math.max(
          0,
          Math.min(1, -rect.top / (containerHeight - viewportHeight))
        );
        setProgress(progressValue);

        const frameIndex = Math.min(
          count - 1,
          Math.max(0, Math.floor(progressValue * (count - 1)))
        );
        requestFrameRef.current?.(frameIndex);
      });
    };

    updateScrollRef.current = handleScroll;
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      updateScrollRef.current = null;
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return {
    loaded,
    firstFrameLoaded,
    loadedCount,
    totalFrames,
    progress,
    containerRef,
    canvasRef,
  };
};
