// src/react/system/playerfloatmusic.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Music, Pause, Play, Volume2 } from 'lucide-react';
import { useAudio } from '@hook/useaudio';
import { motion, AnimatePresence } from 'framer-motion';

export interface PlaylistFloatProps {
  title: string;
  currentTime: number;
  duration: number;
  playing: boolean;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  cover?: string;
  canPrevious: boolean;
  canNext: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onOpen: () => void;
  onClose: () => void;
}

interface PlayerFloatMusicProps {
  playlist?: PlaylistFloatProps;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const value = Math.floor(seconds % 60);
  return `${minutes}:${value.toString().padStart(2, '0')}`;
};

const RESTORE_HEIGHT = 58;
const RESTORE_Y_PADDING = 10;

const readRestoreY = (): number | null => {
  if (typeof window === 'undefined') return null;
  const saved = window.localStorage.getItem('floating_player_restore_y');
  if (!saved) return null;
  const parsed = Number(saved);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampRestoreY = (y: number): number => {
  if (typeof window === 'undefined') return y;
  const maxY = window.innerHeight - RESTORE_HEIGHT - RESTORE_Y_PADDING;
  return Math.max(RESTORE_Y_PADDING, Math.min(y, maxY));
};

const PlayerFloatMusic: React.FC<PlayerFloatMusicProps> = ({ playlist }) => {
  const location = useLocation();
  const { isPlaying, setIsPlaying, selectedGenre, volume, isStopped } = useAudio();
  const [mediaOverlays, setMediaOverlays] = useState(() => ({
    mediarender: typeof document !== 'undefined' && !!document.querySelector('.mediarender-container'),
    slideshow: typeof document !== 'undefined' && !!document.querySelector('.cloudslideshow-overlay'),
  }));
  const [isMinimized, setIsMinimized] = useState(() => !playlist && localStorage.getItem('floating_player_minimized') === 'true');
  const [restoreY, setRestoreY] = useState<number | null>(readRestoreY);
  const playlistMode = !!playlist;
  const playing = playlist?.playing ?? isPlaying;
  const title = playlist?.title || selectedGenre;
  const visible = location.pathname !== '/setting' && !mediaOverlays.mediarender && !mediaOverlays.slideshow && (playlistMode || (!isStopped && !!selectedGenre));
  // Dipakai untuk player penuh maupun tombol restore saat minimize, supaya bounds yang
  // dikirim ke Quick (lewat event 'floating:bounds') selalu mengikuti elemen yang sedang
  // tampil - sebelumnya ref hanya nempel di player penuh, jadi saat minimize bounds-nya
  // hilang dan Quick jadi bisa menjangkau area tombol restore.
  const boundsRef = useRef<HTMLDivElement | HTMLButtonElement | null>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);
  const suppressClickRef = useRef(false);
  const restoreDragStartXRef = useRef<number | null>(null);
  const restoreDragDistanceRef = useRef(0);
  const restoreDragStartYRef = useRef<number | null>(null);
  const restoreDragDistanceYRef = useRef(0);
  const restoreDragStartTopRef = useRef(0);
  const suppressRestoreClickRef = useRef(false);

  useEffect(() => {
    if (!playlistMode) localStorage.setItem('floating_player_minimized', String(isMinimized));
  }, [isMinimized, playlistMode]);

  useEffect(() => {
    const handleResize = () => {
      setRestoreY((current) => (current === null ? current : clampRestoreY(current)));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragStartXRef.current = event.clientX;
    dragDistanceRef.current = 0;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartXRef.current === null) return;
    dragDistanceRef.current = event.clientX - dragStartXRef.current;
  };

  const handlePointerUp = () => {
    if (dragStartXRef.current === null) return;
    if (dragDistanceRef.current > 80) {
      setIsMinimized(true);
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    dragStartXRef.current = null;
    dragDistanceRef.current = 0;
  };

  useEffect(() => {
    const handleOverlayState = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: 'mediarender' | 'slideshow'; active?: boolean }>).detail;
      const source = detail?.source;
      if (!source) return;
      setMediaOverlays((current) => ({ ...current, [source]: detail.active === true }));
    };
    window.addEventListener('media-overlay:state', handleOverlayState);
    return () => window.removeEventListener('media-overlay:state', handleOverlayState);
  }, []);

  useEffect(() => {
    const publishBounds = () => {
      const rect = boundsRef.current?.getBoundingClientRect();
      window.dispatchEvent(new CustomEvent('floating:bounds', {
        detail: rect && visible ? {
          active: true,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        } : { active: false },
      }));
    };
    publishBounds();
    window.addEventListener('resize', publishBounds);
    return () => {
      window.removeEventListener('resize', publishBounds);
      window.dispatchEvent(new CustomEvent('floating:bounds', { detail: { active: false } }));
    };
  }, [visible, title, playing, isMinimized, restoreY]);

  return (
    <AnimatePresence>
      {visible && !isMinimized && (
        <motion.div
          className="dashboard-floating-player-shell"
          initial={{ opacity: 0, x: 80, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 80, scale: 0.95 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div
            ref={boundsRef as React.RefObject<HTMLDivElement>}
            className={`dashboard-floating-player ${playing ? 'is-playing' : ''} ${playlistMode ? 'playlist-floating-player' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={(e) => {
              e.stopPropagation();
              if (suppressClickRef.current) return;
              playlist?.onOpen();
            }}
          >
            <div className="player-icon-box">
              <div className={`music-spin-layer ${playing ? 'spinning beating' : ''}`}>
                <div className="music-icon-static">
                  <Music size={22} strokeWidth={3} />
                </div>
              </div>
              {playing && <div className="beat-ripple" />}
            </div>

            <div className="player-text-group">
              <span className="player-genre-display">{title}</span>
              {playlistMode ? (
                <span className="player-volume-info">
                  {formatTime(playlist.currentTime)} / {formatTime(playlist.duration)}
                </span>
              ) : (
                <span className="player-volume-info">
                  <Volume2 size={11} strokeWidth={2.5} />
                  <span>{volume}% VOLUME</span>
                </span>
              )}
            </div>

            <button
              className="player-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (playlistMode) playlist.onTogglePlay();
                else setIsPlaying(!isPlaying);
              }}
              aria-label={playing ? 'Pause music' : 'Play music'}
            >
              {playing ? <Pause size={20} fill="currentColor" strokeWidth={2.5} /> : <Play size={20} fill="currentColor" strokeWidth={2.5} style={{ transform: 'translateX(1px)' }} />}
            </button>
          </div>
        </motion.div>
      )}
      {visible && isMinimized && (
        <motion.button
          ref={boundsRef as React.RefObject<HTMLButtonElement>}
          className={`floating-player-restore${playlist?.cover ? ' has-cover' : ''}`}
          type="button"
          initial={{ opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 48 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            ...(playlist?.cover ? { backgroundImage: `url(${playlist.cover})` } : {}),
            // Hanya posisi vertikal yang bisa digeser saat minimize; tombol tetap
            // menempel di tepi kanan (horizontal tidak bisa dipindah seperti Quick).
            ...(restoreY !== null ? { top: restoreY + 'px', bottom: 'auto' } : {}),
            touchAction: 'none',
          }}
          onPointerDown={(event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            restoreDragStartXRef.current = event.clientX;
            restoreDragDistanceRef.current = 0;
            restoreDragStartYRef.current = event.clientY;
            restoreDragDistanceYRef.current = 0;
            restoreDragStartTopRef.current = event.currentTarget.getBoundingClientRect().top;
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (restoreDragStartXRef.current !== null) {
              restoreDragDistanceRef.current = event.clientX - restoreDragStartXRef.current;
            }
            if (restoreDragStartYRef.current !== null) {
              const deltaY = event.clientY - restoreDragStartYRef.current;
              restoreDragDistanceYRef.current = deltaY;
              setRestoreY(clampRestoreY(restoreDragStartTopRef.current + deltaY));
            }
          }}
          onPointerUp={() => {
            const swipedOpen = restoreDragStartXRef.current !== null && restoreDragDistanceRef.current < -40;
            const draggedVertically = Math.abs(restoreDragDistanceYRef.current) > 5;
            if (swipedOpen) {
              setIsMinimized(false);
              suppressRestoreClickRef.current = true;
              window.setTimeout(() => { suppressRestoreClickRef.current = false; }, 0);
            } else if (draggedVertically) {
              // Baru dianggap "digeser", bukan diklik - simpan posisi vertikal barunya
              // dan jangan buka playernya.
              const finalTop = clampRestoreY(restoreDragStartTopRef.current + restoreDragDistanceYRef.current);
              localStorage.setItem('floating_player_restore_y', String(finalTop));
              suppressRestoreClickRef.current = true;
              window.setTimeout(() => { suppressRestoreClickRef.current = false; }, 0);
            }
            restoreDragStartXRef.current = null;
            restoreDragDistanceRef.current = 0;
            restoreDragStartYRef.current = null;
            restoreDragDistanceYRef.current = 0;
          }}
          onPointerCancel={() => {
            restoreDragStartXRef.current = null;
            restoreDragDistanceRef.current = 0;
            restoreDragStartYRef.current = null;
            restoreDragDistanceYRef.current = 0;
          }}
          onClick={() => {
            if (!suppressRestoreClickRef.current) setIsMinimized(false);
          }}
          aria-label="Show floating player"
        />
      )}
    </AnimatePresence>
  );
};

export default PlayerFloatMusic;
