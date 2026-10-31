// src/react/system/mediarender.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Download, SkipBack, SkipForward, Music, ExternalLink, AlertTriangle } from 'lucide-react';
import { formatDuration, formatBytes } from '@config/utils';
import Loading from '@control/loading';
import { fetchWithGlobalCache } from '@config/imagecache';
import {
  MediaRenderModal,
  resolveHfSignedUrl,
  HF_SIGNED_URL_MAX_AGE_MS,
  tryDirectHfDownload,
  downloadMediaWithName,
} from './mediarendermodal';

const HF_SIGNED_URL_REFRESH_MS = 5 * 60 * 1000;

export type VideoMediaType = 'video' | 'audio' | 'image' | 'gif';

export interface VideoMediaItem {
  id: string | number;
  type: VideoMediaType;
  url: string;
  name?: string;
  size?: number;
  duration?: number;
  width?: number;
  height?: number;
  caption?: string;
  thumbnail?: string;
  file?: File;
}

interface MediaRenderProps {
  item: VideoMediaItem;
  autoPlay?: boolean;
  showControls?: boolean;
  showMeta?: boolean;
  showDownload?: boolean;
  onDownload?: (item: VideoMediaItem) => void;
  onError?: (error: Error) => void;
  className?: string;
  token?: string;
}

type MediaErrorKind = 'codec' | 'network' | 'unknown';

const sanitizeText = (text: string | undefined | null): string => {
  if (!text) return '';
  const element = document.createElement('div');
  element.textContent = text;
  return element.textContent || '';
};

const MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mkv: 'video/x-matroska', ogv: 'video/ogg', gif: 'image/gif',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
  ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml',
};

const guessMime = (name: string | undefined, type: VideoMediaType, current: string): string => {
  if (current && current !== 'application/octet-stream' && current !== 'binary/octet-stream') {
    return current;
  }
  const ext = (name?.split('.').pop() || '').toLowerCase();
  if (MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  if (type === 'video' || type === 'gif') return 'video/mp4';
  if (type === 'audio') return 'audio/mpeg';
  return 'image/jpeg';
};

const classifyVideoError = (videoEl: HTMLVideoElement | null): MediaErrorKind => {
  const code = videoEl?.error?.code;
  if (code === 3 || code === 4) return 'codec';
  if (code === 2) return 'network';
  return 'unknown';
};

const isHfUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.hostname.endsWith('huggingface.co') || parsed.hostname.endsWith('hf.co');
  } catch {
    return false;
  }
};

export const MediaRender: React.FC<MediaRenderProps> = ({
  item,
  autoPlay = false,
  showControls = true,
  showMeta = true,
  showDownload = true,
  onDownload,
  onError,
  className = '',
  token,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimeRef = useRef<number>(0);
  const [videoOrientation, setVideoOrientation] = useState<'landscape' | 'portrait' | null>(null);

  const isVideo = item.type === 'video' || item.type === 'gif';
  const isAudio = item.type === 'audio';
  const isImage = item.type === 'image';

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('media-overlay:state', {
      detail: { source: 'mediarender', active: true },
    }));
    return () => {
      window.dispatchEvent(new CustomEvent('media-overlay:state', {
        detail: { source: 'mediarender', active: false },
      }));
    };
  }, [item.url, item.type]);

  const needsAuthFetch = !!token;
  const isHfSource = isHfUrl(item.url);
  const [mediaSrc, setMediaSrc] = useState<string>(needsAuthFetch || isHfSource ? '' : item.url);
  const [imageSrc, setImageSrc] = useState<string>('');
  
  const [srcTick, setSrcTick] = useState(0);
  const retriedRef = useRef(false);
  const resumeTimeRef = useRef(0);
  const playingIntentRef = useRef<boolean>(false);
  const autoRefreshInFlightRef = useRef<boolean>(false);
  const signedAtRef = useRef<number>(0);

  useEffect(() => {
    if (mediaSrc) signedAtRef.current = Date.now();
  }, [mediaSrc]);

  const [codecIssue, setCodecIssue] = useState(false);
  const [videoErrorKind, setVideoErrorKind] = useState<MediaErrorKind | null>(null);

  const [extOpen, setExtOpen] = useState(false);

  useEffect(() => {
    retriedRef.current = false;
    resumeTimeRef.current = 0;
    playingIntentRef.current = false;
    autoRefreshInFlightRef.current = false;
    setCodecIssue(false);
    setVideoErrorKind(null);
    setExtOpen(false);
  }, [item.url]);

  useEffect(() => {
    if (!isImage || !item.thumbnail) {
      setImageSrc(item.thumbnail || mediaSrc);
      return;
    }
    
    let cancelled = false;
    setIsLoading(true);
    
    fetchWithGlobalCache(item.thumbnail, token)
      .then((url) => {
        if (!cancelled) {
          setImageSrc(url);
        }
      })
      .catch(() => {
        if (cancelled) return;
        fetchWithGlobalCache(item.url, token)
          .then((u) => { if (!cancelled) setImageSrc(u); })
          .catch(() => { if (!cancelled) setImageSrc(mediaSrc || item.url); });
      });
      
    return () => { cancelled = true; };
  }, [isImage, item.thumbnail, item.url, token, mediaSrc]);

  useEffect(() => {
    if (isImage) return;

    if (!needsAuthFetch && !isHfSource) {
      setMediaSrc(item.url);
      return;
    }

    let cancelled = false;
    let objectUrl = '';
    const controller = new AbortController();

    setMediaSrc('');
    setError(null);
    setIsLoading(true);

    (async () => {
      try {
        if (item.type === 'video' || item.type === 'gif' || item.type === 'audio') {
          const signed = await resolveHfSignedUrl(item.url, token, controller.signal);
          if (cancelled) return;
          if (signed) {
            setMediaSrc(signed);
            return;
          }
          if (!token) {
            setMediaSrc(item.url);
            return;
          }
        }

        if (!token) {
          setMediaSrc(item.url);
          return;
        }

        const res = await fetch(item.url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = await res.blob();
        if (cancelled) return;

        const mime = guessMime(item.name, item.type, raw.type);
        const blob = raw.type === mime ? raw : new Blob([raw], { type: mime });

        objectUrl = URL.createObjectURL(blob);
        setMediaSrc(objectUrl);
      } catch (err: any) {
        if (cancelled || err?.name === 'AbortError') return;
        console.warn('[MediaRender] fetch media gagal:', err);
        setError(`Failed to load ${item.type}`);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.url, item.name, item.type, token, needsAuthFetch, isHfSource, srcTick, isImage]);

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
    };
  }, []);

  const refreshSigned = useCallback(async (force = false) => {
    if (!isHfSource) return;
    if (item.type !== 'video' && item.type !== 'audio') return;
    if (!mediaSrc || codecIssue) return;
    if (autoRefreshInFlightRef.current) return;
    if (!force && Date.now() - signedAtRef.current < HF_SIGNED_URL_MAX_AGE_MS) return;

    const element = isVideo ? videoRef.current : audioRef.current;
    if (!element) return;

    autoRefreshInFlightRef.current = true;
    try {
      const savedTime = element.currentTime;
      const wasPlaying = playingIntentRef.current || !element.paused;

      const signed = await resolveHfSignedUrl(item.url, token);
      if (!signed || signed === mediaSrc) return;

      resumeTimeRef.current = savedTime;
      playingIntentRef.current = wasPlaying;
      retriedRef.current = false;
      setMediaSrc(signed);
    } catch {
      void 0;
    } finally {
      autoRefreshInFlightRef.current = false;
    }
  }, [isHfSource, item.url, item.type, token, isVideo, mediaSrc, codecIssue]);

  useEffect(() => {
    if (!isHfSource) return;
    if (item.type !== 'video' && item.type !== 'audio') return;
    if (!mediaSrc) return;

    const interval = setInterval(() => {
      const element = isVideo ? videoRef.current : audioRef.current;
      if (document.hidden && (!element || element.paused)) return;
      void refreshSigned(false);
    }, HF_SIGNED_URL_REFRESH_MS);

    const onVisible = () => {
      if (!document.hidden) void refreshSigned(false);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isHfSource, item.type, mediaSrc, isVideo, refreshSigned]);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const toggleControls = useCallback(() => {
    if (controlsVisible) {
      setControlsVisible(false);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      showControlsTemporarily();
    }
  }, [controlsVisible, showControlsTemporarily]);

  const handleVideoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('.mediarender-control-btn') || target.closest('.mediarender-progress-slider')) return;
    if (isVideo) toggleControls();
  };

  const handleFullscreenBtn = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      try {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen();

          const vw = videoRef.current?.videoWidth || 0;
          const vh = videoRef.current?.videoHeight || 0;
          const isLandscape = vw > 0 && vh > 0 ? vw >= vh : videoOrientation === 'landscape';

          if (screen.orientation?.lock && isLandscape) {
            try {
              await screen.orientation.lock('landscape');
            } catch (lockErr) {
              console.warn('[MediaRender] screen.orientation.lock gagal:', lockErr);
            }
          }
        }
      } catch (err) {
        console.warn('[MediaRender] requestFullscreen gagal:', err);
      }
    } else {
      await document.exitFullscreen();
      if (screen.orientation?.unlock) screen.orientation.unlock();
    }
  }, [videoOrientation]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      if (!isNowFullscreen && videoRef.current) savedTimeRef.current = videoRef.current.currentTime;
      setIsFullscreen(isNowFullscreen);
      showControlsTemporarily();
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [showControlsTemporarily]);

  const handleLoadedMetadata = useCallback(() => {
    const element = isVideo ? videoRef.current : audioRef.current;
    if (element) {
      if (isVideo && videoRef.current) {
        const { videoWidth, videoHeight } = videoRef.current;
        setVideoOrientation(videoWidth >= videoHeight ? 'landscape' : 'portrait');
        if (videoWidth === 0 && videoHeight === 0 && isFinite(videoRef.current.duration)) {
          setCodecIssue(true);
        }
      }
      if (isFinite(element.duration)) {
        setDuration(element.duration);
      }
      if (resumeTimeRef.current > 0) {
        try {
          element.currentTime = resumeTimeRef.current;
        } catch {
          void 0;
        }
        resumeTimeRef.current = 0;
      }
      setIsLoading(false);
      showControlsTemporarily();

      if (playingIntentRef.current) {
        element.play().catch(() => {
          setIsPlaying(false);
        });
      }
    }
  }, [isVideo, showControlsTemporarily]);

  const handleDurationChange = useCallback(() => {
    const element = isVideo ? videoRef.current : audioRef.current;
    if (element && isFinite(element.duration)) {
      setDuration(element.duration);
    }
  }, [isVideo]);

  const handlePlayPause = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const element = isVideo ? videoRef.current : audioRef.current;
    if (!element) return;
    if (isPlaying) {
      element.pause();
      playingIntentRef.current = false;
    } else {
      element.play();
      playingIntentRef.current = true;
    }
    setIsPlaying(!isPlaying);
    showControlsTemporarily();
  }, [isPlaying, isVideo, showControlsTemporarily]);

  const handleSeek = useCallback((value: number) => {
    const element = isVideo ? videoRef.current : audioRef.current;
    if (!element || !duration) return;
    const newTime = (value / 100) * duration;
    element.currentTime = newTime;
    setCurrentTime(newTime);
    setDragValue(value);
  }, [duration, isVideo]);

  const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const value = parseFloat(e.target.value);
    setDragValue(value);
    handleSeek(value);
  }, [handleSeek]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleProgressMouseUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isVideo) return;
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) videoRef.current.volume = newVolume;
  }, [isVideo]);

  const handleToggleMute = useCallback((e: React.MouseEvent) => {
    if (!isVideo) return;
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.volume = volume;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
    showControlsTemporarily();
  }, [isMuted, volume, isVideo, showControlsTemporarily]);

  const handleDownloadBtn = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload(item);
      return;
    }

    try {
      await downloadMediaWithName(item, token);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [item, onDownload, token]);

  const handleTimeUpdate = useCallback(() => {
    if (isDragging) return;
    const element = isVideo ? videoRef.current : audioRef.current;
    if (element) {
      const time = element.currentTime;
      savedTimeRef.current = time;
      setCurrentTime(time);
      if (duration > 0) setDragValue((time / duration) * 100);
    }
  }, [isVideo, isDragging, duration]);

  useEffect(() => {
    if (!isVideo || !isPlaying || codecIssue) return;
    const timer = setTimeout(() => {
      const v = videoRef.current;
      if (!v || v.paused || v.currentTime < 0.5) return;
      const quality = v.getVideoPlaybackQuality?.();
      const decoded = quality ? quality.totalVideoFrames : (v as any).webkitDecodedFrameCount;
      if (typeof decoded === 'number' && decoded === 0) setCodecIssue(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, [isVideo, isPlaying, codecIssue, mediaSrc]);

  useEffect(() => {
    if (!codecIssue) return;
    videoRef.current?.pause();
    setIsPlaying(false);
    setIsLoading(false);
    setVideoErrorKind('codec');
  }, [codecIssue]);

  const openExternalMenu = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExtOpen(true);
  }, []);

  const handleCanPlay = useCallback(() => {
    retriedRef.current = false;
    setIsLoading(false);
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const handleError = useCallback(() => {
    const videoEl = videoRef.current;

    if (isVideo || isAudio) {
      let kind: MediaErrorKind = 'unknown';

      if (videoEl) {
        kind = classifyVideoError(videoEl);
      }

      if (
        kind === 'unknown' &&
        isVideo &&
        videoEl &&
        isFinite(videoEl.duration) &&
        videoEl.duration > 0 &&
        videoEl.videoWidth === 0
      ) {
        kind = 'codec';
      }

      if (kind === 'unknown') {
        kind = 'codec';
      }

      setVideoErrorKind(kind);

      const looksExpired =
        isHfSource &&
        signedAtRef.current > 0 &&
        Date.now() - signedAtRef.current > HF_SIGNED_URL_MAX_AGE_MS;

      if (kind === 'codec' && !looksExpired) {
        setCodecIssue(true);
        setError(null);
        setIsLoading(false);
        return;
      }

      const canRetrySigned = (token || isHfSource) && !isImage && !retriedRef.current && mediaSrc.startsWith('http');
      if (canRetrySigned) {
        retriedRef.current = true;
        resumeTimeRef.current = savedTimeRef.current;
        playingIntentRef.current = !videoEl?.paused;
        setSrcTick(t => t + 1);
        return;
      }
    }

    setError(`Failed to load ${item.type}`);
    onError?.(new Error(`Failed to load ${item.type}`));
    setIsLoading(false);
  }, [item.type, onError, token, isImage, isVideo, isAudio, mediaSrc, isHfSource]);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    playingIntentRef.current = false;
    setCurrentTime(0);
    setDragValue(0);
    if (videoRef.current) videoRef.current.currentTime = 0;
    if (audioRef.current) audioRef.current.currentTime = 0;
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const handleVideoPause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleVideoPlay = useCallback(() => {
    if (codecIssue || videoErrorKind === 'codec') {
      videoRef.current?.pause();
      return;
    }
    setIsPlaying(true);
    playingIntentRef.current = true;
  }, [codecIssue, videoErrorKind]);

  useEffect(() => {
    if (isVideo && videoRef.current) videoRef.current.volume = volume;
  }, [volume, isVideo]);

  useEffect(() => {
    if (autoPlay && (isVideo || isAudio)) {
      const element = isVideo ? videoRef.current : audioRef.current;
      playingIntentRef.current = true;
      element?.play().catch(() => {
        setIsPlaying(false);
        playingIntentRef.current = false;
        setIsLoading(false);
      });
    }
  }, [autoPlay, isVideo, isAudio]);

  useEffect(() => {
    resetControlsTimeout();
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [resetControlsTimeout]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (isImage) {
    const sanitizedName = sanitizeText(item.name);
    const sanitizedCaption = sanitizeText(item.caption);

    return (
      <div ref={containerRef} className={`mediarender-container ${className}`}>
        <div className="mediarender-image-wrap" style={{ position: 'relative' }}>
          <img 
            src={imageSrc || undefined} 
            alt={sanitizedName || 'Image'} 
            className="mediarender-image" 
            onLoad={() => setIsLoading(false)} 
            onError={handleError} 
          />
          
          {showDownload && !isLoading && !error && (
            <button 
              onClick={handleDownloadBtn}
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                background: 'var(--primary)',
                color: 'var(--btn-text)',
                border: 'none',
                borderRadius: '50%',
                width: '46px',
                height: '46px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                zIndex: 10
              }}
              title="Download"
            >
              <Download size={22} />
            </button>
          )}

          {isLoading && <Loading />}
        </div>
        {showMeta && (item.name || item.size) && (
          <div className="mediarender-meta">
            {item.name && <p className="mediarender-title">{sanitizedName}</p>}
            <div className="mediarender-info">
              {item.size && <span>{formatBytes(item.size)}</span>}
              {item.width && item.height && <span>{item.width}×{item.height}</span>}
            </div>
            {item.caption && <p className="mediarender-caption">{sanitizedCaption}</p>}
          </div>
        )}
      </div>
    );
  }

  if (isAudio) {
    const sanitizedName = sanitizeText(item.name);
    const sanitizedCaption = sanitizeText(item.caption);
    const audioUrl = mediaSrc;
    return (
      <div ref={containerRef} className={`mediarender-container ${className}`}>
        <div className="mediarender-audio-wrap">
          <div className="mediarender-audio-art">
            <div className="mediarender-audio-art-inner">
              <Music size={56} strokeWidth={1.5} />
            </div>
          </div>

          {isLoading && <Loading />}

          <div className="mediarender-audio-meta">
            <h3 className="mediarender-audio-name">{sanitizedName || 'Unknown Track'}</h3>
            <span className="mediarender-audio-sub">
              Audio • {item.duration ? formatDuration(item.duration) : (duration && isFinite(duration) ? formatDuration(duration) : '—')}
            </span>
          </div>

          <div className="mediarender-audio-progress-area">
            <input
              type="range"
              className="mediarender-audio-progress"
              min="0"
              max="100"
              step="0.01"
              value={dragValue}
              onChange={handleProgressChange}
              onMouseDown={handleProgressMouseDown}
              onMouseUp={handleProgressMouseUp}
              onTouchStart={handleProgressMouseDown}
              onTouchEnd={handleProgressMouseUp}
              style={{ '--progress-percent': `${progressPercent}%` } as React.CSSProperties}
            />
            <div className="mediarender-audio-time">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="mediarender-audio-controls">
            <button className="mediarender-control-btn" onClick={() => { const a = audioRef.current; if (a) a.currentTime = Math.max(0, a.currentTime - 10); }} title="Rewind 10s">
              <SkipBack size={20} />
            </button>
            <button className="mediarender-play-btn" onClick={handlePlayPause}>
              {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
            </button>
            <button className="mediarender-control-btn" onClick={() => { const a = audioRef.current; if (a && duration) a.currentTime = Math.min(duration, a.currentTime + 10); }} title="Forward 10s">
              <SkipForward size={20} />
            </button>
            {showDownload && (
              <button className="mediarender-control-btn" onClick={handleDownloadBtn}>
                <Download size={20} />
              </button>
            )}
          </div>

          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onDurationChange={handleDurationChange}
            onCanPlay={handleCanPlay}
            onSeeking={() => void refreshSigned(false)}
            onError={handleError}
            onEnded={handleVideoEnded}
            onPause={handleVideoPause}
            onPlay={handleVideoPlay}
          />
        </div>

        {showMeta && (item.name || item.size || item.duration) && !error && (
          <div className="mediarender-meta">
            {item.name && <p className="mediarender-title">{sanitizedName}</p>}
            <div className="mediarender-info">
              {item.size && <span>{formatBytes(item.size)}</span>}
              {item.duration && <span>{formatDuration(item.duration)}</span>}
              {item.width && item.height && <span>{item.width}×{item.height}</span>}
            </div>
            {item.caption && <p className="mediarender-caption">{sanitizedCaption}</p>}
          </div>
        )}
        {error && (
          <div className="mediarender-error">
            <span>{error}</span>
            <div className="mediarender-error-actions">
              <button className="mediarender-error-secondary" onClick={openExternalMenu}>Watch in another app</button>
              {showDownload && <button className="mediarender-error-secondary" onClick={handleDownloadBtn}>Download</button>}
            </div>
          </div>
        )}

        <MediaRenderModal
          isOpen={extOpen}
          url={item.url}
          name={item.name}
          token={token}
          onClose={() => setExtOpen(false)}
        />
      </div>
    );
  }

  const sanitizedName = sanitizeText(item.name);
  const sanitizedCaption = sanitizeText(item.caption);
  const videoUrl = mediaSrc;

  return (
    <div ref={containerRef} className={`mediarender-container ${className} ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <div
        className={`mediarender-video-wrap ${codecIssue || (error && (isVideo || isAudio)) ? 'has-codec-issue' : ''}`}
        onClick={handleVideoClick}
      >
        <video
          ref={videoRef}
          src={videoUrl || undefined}
          className="mediarender-video"
          playsInline
          autoPlay={autoPlay && !codecIssue}
          loop={item.type === 'gif'}
          preload="metadata"
          disableRemotePlayback
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onDurationChange={handleDurationChange}
          onCanPlay={handleCanPlay}
          onSeeking={() => void refreshSigned(false)}
          onError={handleError}
          onEnded={handleVideoEnded}
          onPause={handleVideoPause}
          onPlay={handleVideoPlay}
        />

        {!codecIssue && !error && (
          <div className={`mediarender-top-overlay ${controlsVisible ? 'visible' : ''}`}>
            <div className="mediarender-top-right">
              <button className="mediarender-control-btn mediarender-btn-transparent" onClick={openExternalMenu} title="Watch in another app" aria-label="Watch in another app"><ExternalLink size={20} /></button>
              {showDownload && <button className="mediarender-control-btn mediarender-btn-transparent" onClick={handleDownloadBtn} title="Download" aria-label="Download"><Download size={20} /></button>}
            </div>
          </div>
        )}

        {(codecIssue || (error && (isVideo || isAudio))) && (
          <div className="mediarender-codec-notice" onClick={(e) => e.stopPropagation()}>
            <div className="mediarender-codec-inner">
              <AlertTriangle size={30} />
              <strong>Video can't be displayed</strong>
              <p>
                This file's video codec (e.g. HEVC/H.265 in MKV, or other unsupported codecs) isn't supported by your browser. Download it or watch it in another app.
              </p>
              <div className="mediarender-codec-actions">
                {showDownload && (
                  <button onClick={handleDownloadBtn}><Download size={16} /> Download</button>
                )}
                <button onClick={openExternalMenu}><ExternalLink size={16} /> Watch in another app</button>
              </div>
            </div>
          </div>
        )}

        {isLoading && !codecIssue && !error && <Loading />}

        <button className={`mediarender-center-play ${controlsVisible && !isLoading && !codecIssue && !error ? 'visible' : ''}`} onClick={handlePlayPause}>
          {isPlaying ? <Pause size={44} /> : <Play size={44} />}
        </button>

        {showControls && !error && !codecIssue && (
          <div className={`mediarender-video-controls ${controlsVisible ? 'visible' : ''}`}>
            <input
              type="range"
              className="mediarender-progress-slider"
              min="0"
              max="100"
              step="0.01"
              value={dragValue}
              onChange={handleProgressChange}
              onMouseDown={handleProgressMouseDown}
              onMouseUp={handleProgressMouseUp}
              onTouchStart={handleProgressMouseDown}
              onTouchEnd={handleProgressMouseUp}
              style={{ '--progress-percent': `${progressPercent}%` } as React.CSSProperties}
            />
            <div className="mediarender-controls-row">
              <span className="mediarender-time">{formatTime(currentTime)}</span>
              <span className="mediarender-time-sep">/</span>
              <span className="mediarender-time">{formatTime(duration)}</span>

              <div className="mediarender-controls-right">
                <button className="mediarender-control-btn mediarender-btn-transparent" onClick={handleToggleMute}>
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <button className="mediarender-control-btn mediarender-btn-transparent" onClick={handleFullscreenBtn}>
                  <Maximize2 size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showMeta && (item.name || item.size || item.duration) && !error && !isFullscreen && (
        <div className="mediarender-meta">
          {item.name && <p className="mediarender-title">{sanitizedName}</p>}
          <div className="mediarender-info">
            {item.size && <span>{formatBytes(item.size)}</span>}
            {item.duration && <span>{formatDuration(item.duration)}</span>}
            {item.width && item.height && <span>{item.width}×{item.height}</span>}
          </div>
          {item.caption && <p className="mediarender-caption">{sanitizedCaption}</p>}
        </div>
      )}

      <MediaRenderModal
        isOpen={extOpen}
        url={item.url}
        name={item.name}
        token={token}
        onClose={() => setExtOpen(false)}
      />
    </div>
  );
};

export default MediaRender;

export { resolveHfSignedUrl, tryDirectHfDownload, downloadMediaWithName };
export type { VideoMediaType as VideoMediaTypeExport };
