// src/react/default/settingaudio.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Volume2, Play, Pause, Square, Music, Cpu, LayoutGrid } from 'lucide-react';
import { useAudio } from '@hook/useaudio';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@redux/store';
import { toggleQuickVisible } from '@redux/visibleslice';

type AiMode = 'off' | 'auto' | 'manual';

const SettingAudio: React.FC = () => {
  const {
    aiMode,
    setAiMode,
    selectedGenre,
    setSelectedGenre,
    isPlaying,
    setIsPlaying,
    isStopped,
    setIsStopped,
    volume,
    setVolume,
  } = useAudio();

  const dispatch = useDispatch();
  const isQuickVisible = useSelector((state: RootState) => state.visible.isQuickVisible);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    if (isStopped) setIsStopped(false);
  };

  const handleStop = () => {
    setIsStopped(true);
    setIsPlaying(false);
  };

  const handleGenreSelect = (genre: string) => {
    setSelectedGenre(genre);
    setIsPlaying(true);
    setIsStopped(false);
  };

  const genres = [
    'City Pop', 'Jazz', 'Hip-Hop', 'Type Beat',
    'Hits', 'Electro Dance', 'Phonk House', 
    'Brazilian Phonk', 'Synthwave', 'Ambient', 
    'Vaporwave', 'Lofi', 'Future Funk', 
    'Kawaii Future Bass', 'Progressive Bass', 
    'Up Beat', 'Default', 'Random'
  ];

  return (
    <>
      <section className="stack-item">
        <div className="section-header">
          <Volume2 size={18} />
          <span className="section-label"><span>Music Output</span></span>
          <span className="section-value" translate="no">{volume}%</span>
        </div>
        <input
          type="range"
          className="volume-slider"
          min="0" max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          style={{ '--vol-percent': `${volume}%` } as React.CSSProperties}
          aria-label="Volume control"
        />
      </section>

      <section className="stack-item">
        <div className="section-header">
          <Play size={18} />
          <span className="section-label"><span>Playback BGM</span></span>
        </div>
        <div className="playback-controls">
          <button
            type="button"
            className={`playback-btn ${isPlaying ? 'active' : ''}`}
            onClick={handlePlayPause}
            aria-label={isPlaying ? "Pause music" : "Play music"}
          >
            {isPlaying ? <><Pause size={16} /> <span>Pause</span></> : <><Play size={16} /> <span>Play</span></>}
          </button>
          <button
            type="button"
            className={`playback-btn ${isStopped ? 'active' : ''}`}
            onClick={handleStop}
            aria-label="Stop music"
          >
            <Square size={14} /> <span>Stop</span>
          </button>
        </div>
      </section>

      <section className="stack-item">
        <div className="section-header">
          <Cpu size={18} />
          <span className="section-label"><span>AI Intelligence</span></span>
          <span className="section-value" translate="no">{(aiMode as AiMode).toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', backgroundColor: 'var(--card-bg)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '8px' }}>
          {(['off', 'auto', 'manual'] as AiMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setAiMode(m)}
              style={{ 
                flex: 1, padding: '8px', borderRadius: '8px', position: 'relative', 
                cursor: 'pointer', border: 'none', background: 'none', 
                color: aiMode === m ? '#fff' : 'var(--text-sub)',
                transition: 'color 0.2s'
              }}
              aria-label={`Set AI mode to ${m}`}
            >
              {aiMode === m && (
                <motion.div 
                  layoutId="activeAiTab" 
                  style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--primary)', borderRadius: '8px', zIndex: 0 }} 
                />
              )}
              <span style={{ position: 'relative', zIndex: 1, fontSize: '12px', fontWeight: 600 }}>{m.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="stack-item">
        <div className="section-header">
          <Music size={18} />
          <span className="section-label"><span>Music Palette</span></span>
          <span className="section-value" translate="no">
            {selectedGenre || 'Default'}
          </span>
        </div>
        <div className="genre-list hide-scrollbar">
          {genres.map((genre) => (
            <button
              key={genre}
              type="button"
              className={`genre-chip ${selectedGenre === genre ? 'active' : ''}`}
              onClick={() => handleGenreSelect(genre)}
              aria-label={`Select genre ${genre}`}
            >
              <span>{genre}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="stack-item">
        <div className="section-header">
          <LayoutGrid size={18} />
          <span className="section-label"><span>Quick Menu Access</span></span>
          <span className="section-value" translate="no">{isQuickVisible ? 'ON' : 'OFF'}</span>
        </div>
        <div style={{ display: 'flex', backgroundColor: 'var(--card-bg)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => dispatch(toggleQuickVisible())}
            style={{ 
              flex: 1, padding: '8px', borderRadius: '8px', position: 'relative', 
              cursor: 'pointer', border: 'none', background: 'none', 
              color: isQuickVisible ? '#fff' : 'var(--text-sub)',
              transition: 'color 0.2s'
            }}
            aria-label="Toggle Quick Menu"
          >
            {isQuickVisible && (
              <motion.div 
                layoutId="activeQuickTab" 
                style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--primary)', borderRadius: '8px', zIndex: 0 }} 
              />
            )}
            <span style={{ position: 'relative', zIndex: 1, fontSize: '12px', fontWeight: 600 }}>SHOW QUICK MENU</span>
          </button>
        </div>
      </section>
    </>
  );
};

export default SettingAudio;