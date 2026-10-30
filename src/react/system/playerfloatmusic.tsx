// src/react/system/playerfloatmusic.tsx
import React from 'react';
import { Play, Pause, Volume2, Music } from 'lucide-react';
import { useAudio } from '@hook/useaudio';
import { motion, AnimatePresence } from 'framer-motion';

// path PlayerFloatMusic: floating music player di dashboard
const PlayerFloatMusic: React.FC = () => {
  const { 
    isPlaying, 
    setIsPlaying, 
    selectedGenre, 
    volume, 
    isStopped 
  } = useAudio();

  return (
    <AnimatePresence>
      {(!isStopped && selectedGenre) && (
        <motion.div 
          className={`dashboard-floating-player ${isPlaying ? 'is-playing' : ''}`}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="player-icon-box">
            <div className={`music-spin-layer ${isPlaying ? 'spinning beating' : ''}`}>
              <div className="music-icon-static">
                <Music size={22} strokeWidth={3} />
              </div>
            </div>
            {isPlaying && <div className="beat-ripple"></div>}
          </div>
          
          <div className="player-text-group">
            <span className="player-genre-display">
              {selectedGenre}
            </span>
            
            <div className="player-volume-info">
              <Volume2 size={11} strokeWidth={2.5} />
              <span>{volume}% VOLUME</span>
            </div>
          </div>

          <button 
            className="player-action-btn" 
            onClick={(e) => {
              e.stopPropagation();
              setIsPlaying(!isPlaying);
            }}
            aria-label={isPlaying ? "Pause music" : "Play music"}
          >
            {isPlaying ? (
              <Pause size={20} fill="currentColor" strokeWidth={2.5} />
            ) : (
              <Play 
                size={20} 
                fill="currentColor" 
                strokeWidth={2.5} 
                style={{ transform: 'translateX(1px)' }} 
              />
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PlayerFloatMusic;