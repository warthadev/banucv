// src/react/feature/cloudplaylist.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minimize2, Maximize2, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ListMusic, Music, Download } from 'lucide-react';
import { parseBlob } from 'music-metadata';
import { fetchWithGlobalCache } from '@config/imagecache';
import { getCover, setCover } from '@config/thumbnailstore';
import { resolveHfSignedUrl, HF_SIGNED_URL_MAX_AGE_MS, downloadMediaWithName } from '@system/mediarendermodal';
import { usePlaylist } from '@hook/useplaylist';

export interface PlaylistTrack {
  id: string;
  name: string;
  url: string;
  thumbUrl?: string;
  token?: string;
}

interface CloudPlaylistProps {
  isOpen: boolean;
  tracks: PlaylistTrack[];
  initialIndex?: number;
  onClose: () => void;
}

type Status = 'loading' | 'ready' | 'error';
type Resolved = { url: string; objectUrl?: string };
type SignedCache = Map<string, { url: string; at: number }>;

const SIGNED_FRESH_MS = HF_SIGNED_URL_MAX_AGE_MS - 5 * 60 * 1000;
const RESTART_THRESHOLD_S = 3;
const SKIP_BROKEN_DELAY_MS = 900;

const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
  ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac',
};

const guessAudioMime = (name: string, current: string): string => {
  if (current && current !== 'application/octet-stream' && current !== 'binary/octet-stream') return current;
  const ext = (name.split('.').pop() || '').toLowerCase();
  return AUDIO_MIME[ext] || 'audio/mpeg';
};

const isHfUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const host = new URL(url, window.location.href).hostname;
    return host.endsWith('huggingface.co') || host.endsWith('hf.co');
  } catch {
    return false;
  }
};

const displayName = (name: string): string => name.replace(/\.[^./\\]+$/, '');

const formatTime = (s: number): string => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const needsResolve = (t: PlaylistTrack): boolean => !!t.token || isHfUrl(t.url);

const resolveTrackSrc = async (
  track: PlaylistTrack,
  signal: AbortSignal | undefined,
  cache: SignedCache,
  bypassCache = false
): Promise<Resolved> => {
  if (!needsResolve(track)) return { url: track.url };

  if (!bypassCache) {
    const hit = cache.get(track.id);
    if (hit && Date.now() - hit.at < SIGNED_FRESH_MS) return { url: hit.url };
  }

  const signed = await resolveHfSignedUrl(track.url, track.token, signal);
  if (signed) {
    cache.set(track.id, { url: signed, at: Date.now() });
    return { url: signed };
  }
  if (!track.token) return { url: track.url };

  const res = await fetch(track.url, {
    headers: { Authorization: `Bearer ${track.token}` },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.blob();
  const mime = guessAudioMime(track.name, raw.type);
  const blob = raw.type === mime ? raw : new Blob([raw], { type: mime });
  const objectUrl = URL.createObjectURL(blob);
  return { url: objectUrl, objectUrl };
};

const coverMemCache = new Map<string, string>();
const coverInflight = new Map<string, Promise<string>>();

const buildCoverUrlFromBlob = (blob: Blob): string => URL.createObjectURL(blob);

const extractEmbeddedCover = async (url: string, token?: string): Promise<Blob | null> => {
  try {
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const blob = await res.blob();
    const metadata = await parseBlob(blob);
    const picture = metadata.common.picture?.[0];
    if (!picture) return null;
    return new Blob([picture.data], { type: picture.format });
  } catch {
    return null;
  }
};

const loadCover = async (track: PlaylistTrack): Promise<string> => {
  const key = track.id;
  if (!key) return '';

  const memHit = coverMemCache.get(key);
  if (memHit) return memHit;

  const inflight = coverInflight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const stored = await getCover(key);
      if (stored) {
        const url = buildCoverUrlFromBlob(stored);
        coverMemCache.set(key, url);
        return url;
      }

      let resolvedUrl = track.url;
      if (track.token || isHfUrl(track.url)) {
        try {
          const signed = await resolveHfSignedUrl(track.url, track.token);
          if (signed) resolvedUrl = signed;
        } catch {
          void 0;
        }
      }

      const blob = await extractEmbeddedCover(resolvedUrl, track.token);
      if (blob) {
        setCover(key, blob).catch(() => {});
        const url = buildCoverUrlFromBlob(blob);
        coverMemCache.set(key, url);
        return url;
      }

      if (track.thumbUrl) {
        try {
          const fallback = await fetchWithGlobalCache(track.thumbUrl, track.token);
          coverMemCache.set(key, fallback);
          return fallback;
        } catch {
          void 0;
        }
      }

      return '';
    } finally {
      coverInflight.delete(key);
    }
  })();

  coverInflight.set(key, promise);
  return promise;
};

const useTrackCover = (track: PlaylistTrack | undefined, enabled: boolean) => {
  const [thumb, setThumb] = useState('');
  useEffect(() => {
    if (!enabled || !track) {
      setThumb('');
      return;
    }
    const cached = coverMemCache.get(track.id);
    if (cached) {
      setThumb(cached);
      return;
    }
    setThumb('');
    let cancelled = false;
    loadCover(track).then((url) => {
      if (!cancelled && url) setThumb(url);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [track, enabled]);
  return thumb;
};

interface QueueRowProps {
  track: PlaylistTrack;
  number: number;
  active: boolean;
  playing: boolean;
  onSelect: () => void;
}

const QueueRow: React.FC<QueueRowProps> = React.memo(({ track, number, active, playing, onSelect }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '120px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'center' });
  }, [active]);

  const thumb = useTrackCover(track, visible);

  return (
    <button
      ref={ref}
      className={`cloudplaylist-qrow ${active ? 'cloudplaylist-qrow--active' : ''}`}
      onClick={onSelect}
    >
      <span className="cloudplaylist-qnum">{number}</span>
      <span className="cloudplaylist-qthumb">
        <AnimatePresence mode="wait">
          {thumb ? (
            <motion.img
              key={thumb}
              src={thumb}
              alt=""
              draggable={false}
              initial={{ opacity: 0, filter: 'blur(8px)', scale: 1.1 }}
              animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, filter: 'blur(8px)' }}
              transition={{ duration: 0.3 }}
            />
          ) : (
            <motion.div
              key="icon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Music size={18} strokeWidth={1.75} />
            </motion.div>
          )}
        </AnimatePresence>
        {active && (
          <span className="cloudplaylist-qbadge">
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </span>
        )}
      </span>
      <span className="cloudplaylist-qname">{displayName(track.name)}</span>
    </button>
  );
});
QueueRow.displayName = 'QueueRow';

const CloudPlaylist: React.FC<CloudPlaylistProps> = ({ isOpen, tracks, initialIndex = 0, onClose }) => {
  const total = tracks.length;
  const { index, order, shuffle, repeat, hasNext, nextIndex, reset, goNext, goPrev, jumpTo, toggleShuffle, cycleRepeat } = usePlaylist(total, initialIndex);

  const audioRef = useRef<HTMLAudioElement>(null);
  const signedCache = useRef<SignedCache>(new Map());
  const retriedRef = useRef(false);
  const resumeAtRef = useRef(0);
  const errStreakRef = useRef(0);
  const switchingRef = useRef(true);
  const skipTimerRef = useRef<number | null>(null);
  const playingRef = useRef(true);

  const [src, setSrc] = useState('');
  const [status, setStatus] = useState<Status>('loading');
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [metadataReady, setMetadataReady] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const track: PlaylistTrack | undefined = tracks[index];
  const ready = isOpen && total > 0 && order.length === total && !!track;

  const setPlayIntent = useCallback((v: boolean) => {
    playingRef.current = v;
    setPlaying(v);
  }, []);

  useEffect(() => {
    if (isOpen && total > 0) {
      reset(total, Math.min(Math.max(initialIndex, 0), total - 1));
      setPlayIntent(true);
      setQueueOpen(false);
      setMinimized(false);
      errStreakRef.current = 0;
    } else {
      reset(0, 0);
      setSrc('');
    }
  }, [isOpen, total, initialIndex, reset, setPlayIntent]);

  const failRef = useRef<() => void>(() => {});
  const actionsRef = useRef({
    prev: () => {}, next: () => {}, toggle: () => {}, close: () => {}, closeQueue: () => {}, queueOpen: false,
  });

  const failTrack = useCallback(() => {
    setStatus('error');
    errStreakRef.current += 1;
    if (playingRef.current && hasNext && errStreakRef.current < total) {
      skipTimerRef.current = window.setTimeout(() => { goNext(); }, SKIP_BROKEN_DELAY_MS);
    } else {
      setPlayIntent(false);
    }
  }, [hasNext, total, goNext, setPlayIntent]);

  useEffect(() => {
    if (!ready || !track) return;
    let cancelled = false;
    let objectUrl = '';
    const ctrl = new AbortController();

    switchingRef.current = true;
    audioRef.current?.pause();
    retriedRef.current = false;
    resumeAtRef.current = 0;
    setStatus('loading');
    setSrc('');
    setCurrentTime(0);
    setDuration(0);
    setSeeking(false);
    setMetadataReady(false);

    (async () => {
      try {
        const r = await resolveTrackSrc(track, ctrl.signal, signedCache.current);
        if (cancelled) {
          if (r.objectUrl) URL.revokeObjectURL(r.objectUrl);
          return;
        }
        objectUrl = r.objectUrl || '';
        if (cancelled) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return;
        }
        setMetadataReady(true);
        setSrc(r.url);
      } catch (err) {
        if (cancelled || (err as { name?: string })?.name === 'AbortError') return;
        failRef.current();
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (skipTimerRef.current !== null) {
        window.clearTimeout(skipTimerRef.current);
        skipTimerRef.current = null;
      }
    };
  }, [ready, track?.id]);

  useEffect(() => {
    const a = audioRef.current;
    if (!src || !a || !playingRef.current || !metadataReady) return;
    a.play().catch((err: { name?: string }) => {
      if (err?.name !== 'AbortError') setPlayIntent(false);
    });
  }, [src, setPlayIntent, metadataReady]);

  useEffect(() => {
    if (status !== 'ready' || nextIndex === null) return;
    const nt = tracks[nextIndex];
    if (!nt || !needsResolve(nt)) return;
    const hit = signedCache.current.get(nt.id);
    if (hit && Date.now() - hit.at < SIGNED_FRESH_MS) return;
    const ctrl = new AbortController();
    resolveHfSignedUrl(nt.url, nt.token, ctrl.signal)
      .then((u) => { if (u) signedCache.current.set(nt.id, { url: u, at: Date.now() }); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [status, nextIndex, tracks]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || status === 'error') return;
    if (a.paused) {
      setPlayIntent(true);
      a.play().catch((err: { name?: string }) => {
        if (err?.name !== 'AbortError') setPlayIntent(false);
      });
    } else {
      setPlayIntent(false);
      a.pause();
    }
  }, [status, setPlayIntent]);

  const handlePrev = useCallback(() => {
    const a = audioRef.current;
    if (a && a.currentTime > RESTART_THRESHOLD_S) {
      a.currentTime = 0;
      return;
    }
    if (!goPrev() && a) a.currentTime = 0;
  }, [goPrev]);

  const handleNext = useCallback(() => { goNext(); }, [goNext]);

  const handleEnded = useCallback(() => {
    if (!goNext()) {
      const a = audioRef.current;
      if (a) a.currentTime = 0;
      setCurrentTime(0);
      setPlayIntent(false);
    }
  }, [goNext, setPlayIntent]);

  const handleAudioError = useCallback(() => {
    const a = audioRef.current;
    if (!src || !track) return;

    if (!retriedRef.current && needsResolve(track) && !src.startsWith('blob:')) {
      retriedRef.current = true;
      resumeAtRef.current = a?.currentTime || 0;
      signedCache.current.delete(track.id);
      resolveTrackSrc(track, undefined, signedCache.current, true)
        .then((r) => setSrc(r.url))
        .catch(() => failRef.current());
      return;
    }
    failTrack();
  }, [src, track, failTrack]);

  const commitSeek = useCallback(() => {
    if (!seeking) return;
    const a = audioRef.current;
    const t = (seekValue / 100) * duration;
    if (a && duration > 0) a.currentTime = t;
    setCurrentTime(t);
    setSeeking(false);
  }, [seeking, seekValue, duration]);

  useEffect(() => {
    failRef.current = failTrack;
    actionsRef.current = { prev: handlePrev, next: handleNext, toggle: togglePlay, close: onClose, closeQueue: () => setQueueOpen(false), queueOpen };
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const onRange = tag === 'INPUT' && (t as HTMLInputElement).type === 'range';
      const act = actionsRef.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (act.queueOpen) act.closeQueue(); else act.close();
      } else if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'INPUT') {
        e.preventDefault(); act.toggle();
      } else if (e.key === 'ArrowRight' && !onRange) {
        e.preventDefault(); act.next();
      } else if (e.key === 'ArrowLeft' && !onRange) {
        e.preventDefault(); act.prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || minimized) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [isOpen, minimized]);

  const artSrc = useTrackCover(track, ready);

  useEffect(() => {
    if (!ready || !track || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: displayName(track.name),
        album: 'Playlist',
        artwork: artSrc ? [{ src: artSrc }] : [],
      });
    } catch { void 0; }
  }, [ready, track, artSrc]);

  useEffect(() => {
    if (!ready || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { ms.setActionHandler(action, handler); } catch { void 0; }
    };
    set('play', () => { audioRef.current?.play().catch(() => {}); });
    set('pause', () => { audioRef.current?.pause(); });
    set('previoustrack', () => actionsRef.current.prev());
    set('nexttrack', () => actionsRef.current.next());
    set('seekto', (d) => {
      const a = audioRef.current;
      if (a && d.seekTime != null) a.currentTime = d.seekTime;
    });
    return () => {
      (['play', 'pause', 'previoustrack', 'nexttrack', 'seekto'] as MediaSessionAction[]).forEach((a) => set(a, null));
    };
  }, [ready]);

  const handleDownload = async () => {
    if (!track || downloading) return;
    setDownloading(true);
    try {
      await downloadMediaWithName({ name: track.name, url: track.url }, track.token);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen || total === 0 || !track) return null;

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const shownPercent = seeking ? seekValue : percent;
  const shownTime = seeking ? (seekValue / 100) * duration : currentTime;
  const loopNative = repeat === 'one' || (repeat === 'all' && total === 1);
  const repeatTitle = repeat === 'off' ? 'Repeat: off' : repeat === 'all' ? 'Repeat all' : 'Repeat one';

  return (
    <AnimatePresence>
      <motion.div
        className="cloudplaylist-overlay"
        style={minimized ? {
          background: 'transparent',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          pointerEvents: 'none',
        } : undefined}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        <motion.div
          className="cloudplaylist-stage"
          style={minimized ? {
            width: 'min(360px, calc(100vw - 32px))',
            height: 'auto',
            maxHeight: 'none',
            pointerEvents: 'auto',
          } : undefined}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          <div className="cloudplaylist-header">
            <span className="cloudplaylist-title">Playlist</span>
            <div className="cloudplaylist-header-actions">
              <button
                className="cloudplaylist-btn"
                onClick={(e) => { e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); handleDownload(); }}
                title="Download current track"
                disabled={downloading}
                style={{ opacity: downloading ? 0.5 : 1 }}
              >
                {downloading ? <div className="cloudplaylist-download-spinner" /> : <Download size={22} />}
              </button>
              <button
                className={`cloudplaylist-btn ${queueOpen ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); setQueueOpen((o) => !o); }}
                title="Queue"
              >
                <ListMusic size={24} />
              </button>
              <button
                className="cloudplaylist-btn"
                onClick={(e) => { e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); setMinimized((value) => !value); setQueueOpen(false); }}
                title={minimized ? 'Restore' : 'Minimize'}
              >
                {minimized ? <Maximize2 size={22} /> : <Minimize2 size={22} />}
              </button>
              <button
                className="cloudplaylist-btn"
                onClick={(e) => { e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); onClose(); }}
                title="Close"
              >
                <X size={28} />
              </button>
            </div>
          </div>

          <div className="cloudplaylist-body" style={{ display: minimized ? 'none' : undefined }}>
            <div className="cloudplaylist-art">
              <AnimatePresence mode="wait">
                {status === 'loading' && !artSrc ? (
                  <motion.div
                    key="spinner"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', inset: 0 }}
                  >
                    <div className="cloudplaylist-spinner" />
                  </motion.div>
                ) : artSrc ? (
                  <motion.img
                    key={artSrc} src={artSrc} alt="" draggable={false}
                    initial={{ opacity: 0, filter: 'blur(16px)', scale: 1.05 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                    exit={{ opacity: 0, filter: 'blur(16px)' }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                  />
                ) : (
                  <motion.div
                    key="placeholder"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', inset: 0 }}
                  >
                    <Music size={64} strokeWidth={1.5} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="cloudplaylist-info">
              <h3 className="cloudplaylist-name">{displayName(track.name)}</h3>
              <span className={`cloudplaylist-sub ${status === 'error' ? 'cloudplaylist-sub--error' : ''}`}>
                {status === 'error' ? 'Failed to load' : `Track ${index + 1} of ${total}`}
              </span>
            </div>

            <div className="cloudplaylist-progress">
              <input
                type="range" className="cloudplaylist-seek" min="0" max="100" step="0.1" value={shownPercent}
                onChange={(e) => { setSeeking(true); setSeekValue(parseFloat(e.target.value)); }}
                onPointerUp={commitSeek} onPointerCancel={commitSeek} onKeyUp={commitSeek}
                style={{ '--progress-percent': `${shownPercent}%` } as React.CSSProperties}
              />
              <div className="cloudplaylist-times">
                <span>{formatTime(shownTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="cloudplaylist-controls">
              <button className={`cloudplaylist-ctrl ${shuffle ? 'active' : ''}`} onClick={toggleShuffle} aria-pressed={shuffle} title={shuffle ? 'Shuffle: on' : 'Shuffle: off'}>
                <Shuffle size={22} />
              </button>
              <button className="cloudplaylist-ctrl" onClick={handlePrev} title="Previous">
                <SkipBack size={26} fill="currentColor" />
              </button>
              <button className="cloudplaylist-play" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" />}
              </button>
              <button className="cloudplaylist-ctrl" onClick={handleNext} disabled={!hasNext} title="Next">
                <SkipForward size={26} fill="currentColor" />
              </button>
              <button className={`cloudplaylist-ctrl ${repeat !== 'off' ? 'active' : ''}`} onClick={cycleRepeat} title={repeatTitle}>
                {repeat === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
              </button>
            </div>
          </div>

          {minimized && (
            <div
              className="cloudplaylist-body"
              style={{ flex: 'none', flexDirection: 'row', gap: 6, padding: '8px 12px 10px', cursor: 'pointer' }}
              onClick={() => setMinimized(false)}
            >
              <div className="cloudplaylist-info" style={{ textAlign: 'left' }}>
                <h3 className="cloudplaylist-name">{displayName(track.name)}</h3>
                <span className={`cloudplaylist-sub ${status === 'error' ? 'cloudplaylist-sub--error' : ''}`}>
                  {status === 'error' ? 'Failed to load' : `${formatTime(currentTime)} / ${formatTime(duration)}`}
                </span>
              </div>
              <button
                className={`cloudplaylist-ctrl ${shuffle ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleShuffle(); }}
                aria-pressed={shuffle}
                title={shuffle ? 'Shuffle: on' : 'Shuffle: off'}
              >
                <Shuffle size={17} />
              </button>
              <button
                className="cloudplaylist-ctrl"
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                title="Previous"
              >
                <SkipBack size={19} fill="currentColor" />
              </button>
              <button className="cloudplaylist-play" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
              </button>
              <button
                className="cloudplaylist-ctrl"
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                disabled={!hasNext}
                title="Next"
              >
                <SkipForward size={19} fill="currentColor" />
              </button>
              <button
                className={`cloudplaylist-ctrl ${repeat !== 'off' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); cycleRepeat(); }}
                title={repeatTitle}
              >
                {repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
              </button>
            </div>
          )}

          <AnimatePresence initial={false}>
            {!minimized && queueOpen && (
              <motion.div
                key="queue"
                className="cloudplaylist-queue"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="cloudplaylist-queue-inner">
                  <div className="cloudplaylist-queue-head">
                    <span>{total} tracks</span>
                    <button
                      className="cloudplaylist-btn"
                      onClick={(e) => { e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); setQueueOpen(false); }}
                      title="Close queue"
                    >
                      <X size={22} />
                    </button>
                  </div>
                  <div className="cloudplaylist-queue-list">
                    {tracks.map((t, i) => (
                      <QueueRow
                        key={t.id}
                        track={t}
                        number={i + 1}
                        active={i === index}
                        playing={playing}
                        onSelect={() => { setPlayIntent(true); jumpTo(i); }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <audio
            ref={audioRef}
            src={src || undefined}
            preload="auto"
            loop={loopNative}
            onTimeUpdate={() => { if (!seeking && audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
            onLoadedMetadata={() => {
              const a = audioRef.current;
              if (!a) return;
              switchingRef.current = false;
              setDuration(a.duration);
              if (resumeAtRef.current > 0) {
                try { a.currentTime = resumeAtRef.current; } catch { void 0; }
                resumeAtRef.current = 0;
              }
            }}
            onDurationChange={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
            onCanPlay={() => { setStatus('ready'); errStreakRef.current = 0; }}
            onWaiting={() => setStatus('loading')}
            onPlaying={() => setStatus('ready')}
            onPlay={() => setPlayIntent(true)}
            onPause={() => {
              const a = audioRef.current;
              if (a && !a.ended && !switchingRef.current) setPlayIntent(false);
            }}
            onEnded={handleEnded}
            onError={handleAudioError}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CloudPlaylist;
