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

const checkFrameExists = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
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

  const imagesRef = useRef<HTMLImageElement[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrameIndexRef = useRef<number>(-1);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);

  const buildUrl = useCallback(
    (num: number) => {
      const padded = String(num).padStart(padLength, "0");
      return `${basePath}/${prefix}${padded}${extension}`;
    },
    [basePath, prefix, extension, padLength]
  );

  const renderFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const img = imagesRef.current[index];
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

    const findFirstFrame = async (): Promise<number> => {
      for (let n = 1; n <= scanLimit; n++) {
        const url = buildUrl(n);
        const exists = await checkFrameExists(url);
        if (cancelled || !mountedRef.current) return -1;
        if (exists) return n;
      }
      return -1;
    };

    const findLastFrame = async (startNum: number): Promise<number> => {
      let endNum = startNum;
      for (let n = startNum + 1; n <= startNum + scanLimit; n++) {
        const url = buildUrl(n);
        const exists = await checkFrameExists(url);
        if (cancelled || !mountedRef.current) return endNum;
        if (!exists) return endNum;
        endNum = n;
      }
      return endNum;
    };

    const run = async () => {
      const startNum = await findFirstFrame();
      if (cancelled || !mountedRef.current) return;
      if (startNum === -1) {
        setTotalFrames(0);
        return;
      }

      const endNum = await findLastFrame(startNum);
      if (cancelled || !mountedRef.current) return;

      const count = endNum - startNum + 1;
      setTotalFrames(count);

      if (count === 0) return;

      const images: HTMLImageElement[] = new Array(count);
      imagesRef.current = images;

      let loadedSoFar = 0;

      for (let i = 0; i < count; i++) {
        const num = startNum + i;
        const url = buildUrl(num);
        const img = new Image();
        img.decoding = "async";
        img.src = url;

        img.onload = () => {
          if (cancelled || !mountedRef.current) return;
          images[i] = img;
          loadedSoFar++;
          setLoadedCount(loadedSoFar);
          if (i === 0) {
            setFirstFrameLoaded(true);
          }
          if (loadedSoFar === count) {
            setLoaded(true);
          }
        };

        img.onerror = () => {
          if (cancelled || !mountedRef.current) return;
          images[i] = img;
          loadedSoFar++;
          setLoadedCount(loadedSoFar);
          if (i === 0) {
            setFirstFrameLoaded(true);
          }
          if (loadedSoFar === count) {
            setLoaded(true);
          }
        };

        images[i] = img;
      }
    };

    run();

    return () => {
      cancelled = true;
      imagesRef.current = [];
      lastFrameIndexRef.current = -1;
    };
  }, [buildUrl, scanLimit]);

  useEffect(() => {
    if (!firstFrameLoaded) return;

    let attempts = 0;
    const maxAttempts = 50;

    const poll = () => {
      if (!mountedRef.current) return;
      if (attempts >= maxAttempts) return;

      const success = renderFrame(0);
      if (success) return;

      attempts++;
      setTimeout(poll, 50);
    };

    poll();
  }, [firstFrameLoaded, renderFrame]);

  useEffect(() => {
    let frameRafId: number | null = null;

    const loop = () => {
      if (!mountedRef.current) {
        frameRafId = null;
        return;
      }

      const canvas = canvasRef.current;
      if (canvas && lastFrameIndexRef.current === -1) {
        renderFrame(0);
      }

      frameRafId = requestAnimationFrame(loop);
    };

    frameRafId = requestAnimationFrame(loop);

    return () => {
      if (frameRafId !== null) {
        cancelAnimationFrame(frameRafId);
        frameRafId = null;
      }
    };
  }, [renderFrame]);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        const count = imagesRef.current.length;
        if (count === 0) return;

        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const containerHeight = rect.height;
        const viewportHeight = window.innerHeight;

        if (containerHeight <= viewportHeight) return;

        let p = -rect.top / (containerHeight - viewportHeight);
        if (p < 0) p = 0;
        if (p > 1) p = 1;

        setProgress(p);

        const frameIndex = Math.min(
          count - 1,
          Math.max(0, Math.floor(p * (count - 1)))
        );

        if (frameIndex !== lastFrameIndexRef.current) {
          renderFrame(frameIndex);
        }
      });
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [renderFrame]);

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