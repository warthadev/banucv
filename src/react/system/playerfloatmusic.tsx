// src/react/system/playerfloatmusic.tsx
import React, { useEffect, useRef } from 'react';
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
  const playlistMode = !!playlist;
  const playing = playlist?.playing ?? isPlaying;
  const title = playlist?.title || selectedGenre;
  const visible = location.pathname !== '/setting' && (playlistMode ? playing : (playing && !isStopped && !!selectedGenre));
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const publishBounds = () => {
      const rect = playerRef.current?.getBoundingClientRect();
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
  }, [visible, title, playing]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="dashboard-floating-player-shell"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div
            ref={playerRef}
            className={`dashboard-floating-player ${playing ? 'is-playing' : ''} ${playlistMode ? 'playlist-floating-player' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
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
    </AnimatePresence>
  );
};

export default PlayerFloatMusic;
