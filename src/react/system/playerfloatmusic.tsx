// src/react/system/playerfloatmusic.tsx
import React from 'react';
import { Maximize2, Music, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
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
  const { isPlaying, setIsPlaying, selectedGenre, volume, isStopped } = useAudio();
  const playlistMode = !!playlist;
  const playing = playlist?.playing ?? isPlaying;
  const title = playlist?.title || selectedGenre;
  const visible = playlistMode || (!isStopped && !!selectedGenre);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`dashboard-floating-player ${playing ? 'is-playing' : ''} ${playlistMode ? 'playlist-floating-player' : ''}`}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
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

          {playlistMode ? (
            <div className="playlist-floating-actions">
              <button
                className={`player-action-btn ${playlist.shuffle ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); playlist.onToggleShuffle(); }}
                aria-label="Toggle shuffle"
              >
                <Shuffle size={16} />
              </button>
              <button
                className="player-action-btn"
                onClick={(e) => { e.stopPropagation(); playlist.onPrevious(); }}
                disabled={!playlist.canPrevious}
                aria-label="Previous track"
              >
                <SkipBack size={16} fill="currentColor" />
              </button>
              <button
                className="player-action-btn"
                onClick={(e) => { e.stopPropagation(); playlist.onTogglePlay(); }}
                aria-label={playing ? 'Pause track' : 'Play track'}
              >
                {playing ? <Pause size={18} fill="currentColor" strokeWidth={2.5} /> : <Play size={18} fill="currentColor" strokeWidth={2.5} />}
              </button>
              <button
                className="player-action-btn"
                onClick={(e) => { e.stopPropagation(); playlist.onNext(); }}
                disabled={!playlist.canNext}
                aria-label="Next track"
              >
                <SkipForward size={16} fill="currentColor" />
              </button>
              <button
                className={`player-action-btn ${playlist.repeat !== 'off' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); playlist.onCycleRepeat(); }}
                aria-label="Toggle repeat"
              >
                {playlist.repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
              </button>
              <button
                className="player-action-btn"
                onClick={(e) => { e.stopPropagation(); playlist.onClose(); }}
                aria-label="Close playlist"
              >
                <X size={17} />
              </button>
            </div>
          ) : (
            <button
              className="player-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaying(!isPlaying);
              }}
              aria-label={isPlaying ? 'Pause music' : 'Play music'}
            >
              {isPlaying ? <Pause size={20} fill="currentColor" strokeWidth={2.5} /> : <Play size={20} fill="currentColor" strokeWidth={2.5} style={{ transform: 'translateX(1px)' }} />}
            </button>
          )}

          {playlistMode && (
            <button
              className="player-action-btn"
              onClick={(e) => { e.stopPropagation(); playlist.onOpen(); }}
              aria-label="Open playlist"
            >
              <Maximize2 size={17} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PlayerFloatMusic;
