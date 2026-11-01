// src/react/feature/cloudslideshow.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Pause, Play, Timer, Maximize, Info } from 'lucide-react';

const COMPRESS_MAX_SIZE = 1440;
const COMPRESS_QUALITY = 0.85;
const PREFETCH_AHEAD = 2;

const SPEED_OPTIONS = [
  { label: '1s', value: 1000 },
  { label: '2s', value: 2000 },
  { label: '3s', value: 3000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
];

export interface SlideItem {
  id: string;
  name: string;
  url: string;
  thumbUrl?: string;
  token?: string;
  size?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  date?: number;
  caption?: string;
}

interface CloudSlideshowProps {
  isOpen: boolean;
  items: SlideItem[];
  initialIndex?: number;
  onClose: () => void;
}

const sanitizeText = (text: string | undefined | null): string => {
  if (!text) return '';
  const element = document.createElement('div');
  element.textContent = text;
  return element.textContent || '';
};

const formatBytes = (bytes?: number): string => {
  if (!Number.isFinite(bytes) || !bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** unit)).toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
};

const formatDate = (timestamp?: number): string => {
  if (!timestamp) return '—';
  const value = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const fetchAsBlob = async (url: string, token?: string): Promise<Blob> => {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
};

const compressBlob = async (raw: Blob): Promise<string> => {
  const bitmap = await createImageBitmap(raw);

  const scale = Math.min(
    COMPRESS_MAX_SIZE / bitmap.width,
    COMPRESS_MAX_SIZE / bitmap.height,
    1
  );
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);

  try {
    bitmap.close();
  } catch {
    void 0;
  }

  const outBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', COMPRESS_QUALITY);
  });

  if (!outBlob) throw new Error('Compression failed');

  return URL.createObjectURL(outBlob);
};

const loadImage = async (item: SlideItem): Promise<string> => {
  if (item.url.includes('/telegram/stream/')) return item.url;

  if (item.thumbUrl && item.thumbUrl.length > 0) {
    try {
      const raw = await fetchAsBlob(item.thumbUrl, item.token);
      const objectUrl = URL.createObjectURL(raw);
      return objectUrl;
    } catch {
      void 0;
    }
  }

  const raw = await fetchAsBlob(item.url, item.token);
  return await compressBlob(raw);
};

const CloudSlideshow: React.FC<CloudSlideshowProps> = ({
  isOpen,
  items,
  initialIndex = 0,
  onClose,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [playing, setPlaying] = useState(true);
  const [loaded, setLoaded] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<Record<number, boolean>>({});
  
  const [speed, setSpeed] = useState(3000);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showProperties, setShowProperties] = useState(false);

  // State Full Cover
  const [isCover, setIsCover] = useState(false);
  
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  const urlsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const total = items.length;

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      setShowSpeedMenu(false);
    }, 3000);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    
    e.stopPropagation();
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      lastTapRef.current = 0; 
    } else {
      if (controlsVisible) {
        setControlsVisible(false);
        setShowSpeedMenu(false);
        if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
      } else {
        showControlsTemporarily();
      }
      lastTapRef.current = now;
    }
  }, [controlsVisible, showControlsTemporarily]);

  const handleActivity = useCallback(() => {
    if (controlsVisible) resetControlsTimeout();
  }, [controlsVisible, resetControlsTimeout]);

  useEffect(() => {
    if (isOpen) {
      setIndex(initialIndex);
      setPlaying(true);
      setLoaded({});
      setLoading({});
      setError({});
      setControlsVisible(true);
      setShowSpeedMenu(false);
      setIsCover(false);
      setShowProperties(false);
      resetControlsTimeout();

      urlsRef.current.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch { void 0; }
      });
      urlsRef.current.clear();

      setTimeout(() => {
        if (stageRef.current && !document.fullscreenElement) {
          stageRef.current.requestFullscreen().catch((err) => {
            console.warn("Gagal masuk fullscreen:", err);
          });
        }
      }, 100);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    }
  }, [isOpen, initialIndex, resetControlsTimeout]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch { void 0; }
      });
      urlsRef.current.clear();
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const loadOne = useCallback(
    async (i: number) => {
      if (i < 0 || i >= total) return;
      if (loaded[i] || loading[i] || error[i]) return;

      setLoading((prev) => ({ ...prev, [i]: true }));

      try {
        const item = items[i];
        const objectUrl = await loadImage(item);
        urlsRef.current.add(objectUrl);
        setLoaded((prev) => ({ ...prev, [i]: objectUrl }));
      } catch {
        setError((prev) => ({ ...prev, [i]: true }));
      } finally {
        setLoading((prev) => {
          const next = { ...prev };
          delete next[i];
          return next;
        });
      }
    },
    [items, total, loaded, loading, error]
  );

  useEffect(() => {
    if (!isOpen) return;

    void loadOne(index);
    for (let k = 1; k <= PREFETCH_AHEAD; k++) {
      void loadOne((index + k) % total);
    }
    for (let k = 1; k <= PREFETCH_AHEAD; k++) {
      void loadOne((index - k + total) % total);
    }
  }, [isOpen, index, total, loadOne]);

  const next = useCallback(() => {
    setIndex((prev) => (prev + 1) % total);
    setShowProperties(false);
    showControlsTemporarily();
  }, [total, showControlsTemporarily]);

  const prev = useCallback(() => {
    setIndex((prev) => (prev - 1 + total) % total);
    setShowProperties(false);
    showControlsTemporarily();
  }, [total, showControlsTemporarily]);

  const currentIsLoading = !!loading[index];
  const currentHasLoaded = !!loaded[index];

  useEffect(() => {
    if (!isOpen || !playing || total <= 1) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (currentIsLoading || !currentHasLoaded) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % total);
    }, speed);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen, playing, total, currentIsLoading, currentHasLoaded, speed]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        next();
      } else if (e.key === 'ArrowLeft') {
        prev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
        showControlsTemporarily();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, next, prev, showControlsTemporarily]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('media-overlay:state', {
      detail: { source: 'slideshow', active: isOpen },
    }));
    return () => {
      window.dispatchEvent(new CustomEvent('media-overlay:state', {
        detail: { source: 'slideshow', active: false },
      }));
    };
  }, [isOpen]);

  const currentItem = useMemo(() => items[index], [items, index]);
  const currentSrc = loaded[index];
  const currentError = !!error[index];

  if (!isOpen || total === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="cloudslideshow-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        <motion.div
          ref={stageRef}
          className="cloudslideshow-stage"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className={`cloudslideshow-media ${isCover ? 'cover' : ''}`}
            onPointerDown={handlePointerDown}
            onMouseMove={handleActivity}
            onTouchMove={handleActivity}
          >
            {currentIsLoading && !currentSrc && (
              <div className="cloudslideshow-status">
                <div className="cloudslideshow-spinner" />
              </div>
            )}
            {currentError && !currentSrc && (
              <div className="cloudslideshow-status cloudslideshow-status--error">
                <span>Gagal memuat gambar</span>
              </div>
            )}
            
            <AnimatePresence mode="popLayout">
              {currentSrc && (
                <motion.img
                  key={currentItem?.id || index}
                  src={currentSrc}
                  alt={sanitizeText(currentItem?.name) || 'Slide'}
                  className="cloudslideshow-img"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{
                    scale: isCover ? 1.05 : 1,
                    transition: 'scale 0.4s ease-in-out, opacity 0.5s ease-in-out'
                  }}
                />
              )}
            </AnimatePresence>

          </div>

          {total > 1 && (
            <>
              <button
                className={`cloudslideshow-nav cloudslideshow-nav--prev ${controlsVisible ? 'visible' : 'hidden'}`}
                onClick={prev}
                title="Previous"
              >
                <ChevronLeft size={40} strokeWidth={3} color="#ffffff" />
              </button>
              <button
                className={`cloudslideshow-nav cloudslideshow-nav--next ${controlsVisible ? 'visible' : 'hidden'}`}
                onClick={next}
                title="Next"
              >
                <ChevronRight size={40} strokeWidth={3} color="#ffffff" />
              </button>
            </>
          )}

          <div className={`cloudslideshow-bar ${controlsVisible ? 'visible' : 'hidden'}`}>
            <div className="cloudslideshow-meta">
              <span className="cloudslideshow-counter">
                {index + 1} / {total}
              </span>
              <span className="cloudslideshow-name">
                {sanitizeText(currentItem?.name)}
              </span>
            </div>
            <div className="cloudslideshow-actions">
              <button
                className="cloudslideshow-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProperties((value) => !value);
                  showControlsTemporarily();
                }}
                title="Properties"
                aria-label="Properties"
              >
                <Info size={24} strokeWidth={2.5} color="#ffffff" />
              </button>
              
              <button
                className="cloudslideshow-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCover(prev => !prev);
                  showControlsTemporarily();
                }}
                title="Toggle Full Cover"
              >
                <Maximize size={24} strokeWidth={2.5} color="#ffffff" />
              </button>

              <div className="cloudslideshow-speed-wrapper">
                <button
                  className="cloudslideshow-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSpeedMenu(prev => !prev);
                    showControlsTemporarily();
                  }}
                  title="Playback Speed"
                >
                  <Timer size={24} strokeWidth={2.5} color="#ffffff" />
                </button>
                <AnimatePresence>
                  {showSpeedMenu && (
                    <motion.div
                      className="cloudslideshow-speed-menu"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                    >
                      {SPEED_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          className={`cloudslideshow-speed-item ${speed === opt.value ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSpeed(opt.value);
                            setShowSpeedMenu(false);
                            showControlsTemporarily();
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {total > 1 && (
                <button
                  className="cloudslideshow-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlaying((p) => !p);
                    showControlsTemporarily();
                  }}
                  title={playing ? 'Pause' : 'Play'}
                >
                  {playing ? <Pause size={28} strokeWidth={3} color="#ffffff" /> : <Play size={28} strokeWidth={3} color="#ffffff" />}
                </button>
              )}
              <button
                className="cloudslideshow-btn-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                title="Close"
              >
                <X size={32} strokeWidth={3} color="#ffffff" />
              </button>
            </div>
          </div>
          <AnimatePresence>
            {showProperties && currentItem && (
              <motion.div
                className="cloudslideshow-properties"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="cloudslideshow-properties-head">
                  <span>Properties</span>
                  <button
                    className="cloudslideshow-properties-close"
                    onClick={() => setShowProperties(false)}
                    aria-label="Close properties"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="cloudslideshow-properties-list">
                  <div><span>Name</span><strong>{sanitizeText(currentItem.name) || '—'}</strong></div>
                  <div><span>Type</span><strong>{sanitizeText(currentItem.mimeType) || 'Image'}</strong></div>
                  <div><span>Size</span><strong>{formatBytes(currentItem.size)}</strong></div>
                  <div><span>Resolution</span><strong>{currentItem.width && currentItem.height ? `${currentItem.width} × ${currentItem.height}` : '—'}</strong></div>
                  <div><span>Date</span><strong>{formatDate(currentItem.date)}</strong></div>
                  {currentItem.caption && <div><span>Caption</span><strong>{sanitizeText(currentItem.caption)}</strong></div>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CloudSlideshow;
