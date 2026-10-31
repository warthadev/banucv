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

const PlayerFloatMusic: React.FC<PlayerFloatMusicProps> = ({ playlist }) => {
  const location = useLocation();
  const { isPlaying, setIsPlaying, selectedGenre, volume, isStopped } = useAudio();
  const [mediaOverlays, setMediaOverlays] = useState({ mediarender: false, slideshow: false });
  const [isMinimized, setIsMinimized] = useState(false);
  const playlistMode = !!playlist;
  const playing = playlist?.playing ?? isPlaying;
  const title = playlist?.title || selectedGenre;
  const visible = location.pathname !== '/setting' && !mediaOverlays.mediarender && !mediaOverlays.slideshow && (playlistMode || (!isStopped && !!selectedGenre));
  const playerRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);
  const suppressClickRef = useRef(false);
  const restoreDragStartXRef = useRef<number | null>(null);
  const restoreDragDistanceRef = useRef(0);
  const suppressRestoreClickRef = useRef(false);

  useEffect(() => {
    if (!visible) setIsMinimized(false);
  }, [visible]);

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
      if (!detail?.source) return;
      setMediaOverlays((current) => ({ ...current, [detail.source]: detail.active === true }));
    };
    window.addEventListener('media-overlay:state', handleOverlayState);
    setMediaOverlays({
      mediarender: !!document.querySelector('.mediarender-container'),
      slideshow: !!document.querySelector('.cloudslideshow-overlay'),
    });
    return () => window.removeEventListener('media-overlay:state', handleOverlayState);
  }, []);

  useEffect(() => {
    const publishBounds = () => {
      const rect = playerRef.current?.getBoundingClientRect();
      window.dispatchEvent(new CustomEvent('floating:bounds', {
        detail: rect && visible && !isMinimized ? {
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
  }, [visible, title, playing, isMinimized]);

  return (
    <AnimatePresence>
      {visible && !isMinimized && (
        <motion.div
          className="dashboard-floating-player-shell"
          initial={{ opacity: 0, y: 80, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.95 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div
            ref={playerRef}
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
          className={`floating-player-restore${playlist?.cover ? ' has-cover' : ''}`}
          type="button"
          initial={{ opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 48 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={playlist?.cover ? { backgroundImage: `url(${playlist.cover})` } : undefined}
          onPointerDown={(event) => {
            restoreDragStartXRef.current = event.clientX;
            restoreDragDistanceRef.current = 0;
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (restoreDragStartXRef.current !== null) {
              restoreDragDistanceRef.current = event.clientX - restoreDragStartXRef.current;
            }
          }}
          onPointerUp={() => {
            if (restoreDragStartXRef.current === null) return;
            if (restoreDragDistanceRef.current < -40) {
              setIsMinimized(false);
              suppressRestoreClickRef.current = true;
              window.setTimeout(() => { suppressRestoreClickRef.current = false; }, 0);
            }
            restoreDragStartXRef.current = null;
            restoreDragDistanceRef.current = 0;
          }}
          onPointerCancel={() => {
            restoreDragStartXRef.current = null;
            restoreDragDistanceRef.current = 0;
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
