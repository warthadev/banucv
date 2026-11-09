// src/react/default/visit.tsx
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { slideVariants } from "@/react/animation/tutorial";
import { HiVolumeUp, HiVolumeOff } from "react-icons/hi";
import { useAudio } from "@hook/useaudio";
import { musicDatabase } from "@redux/audiodata";

interface VisitProps {
  onComplete: () => void;
}

type AiMode = 'off' | 'auto' | 'manual';

const Visit: React.FC<VisitProps> = ({ onComplete }) => {
  const audioHook = useAudio();
  
  const { 
    aiMode, setAiMode, 
    selectedGenre, setSelectedGenre, 
    setIsTutorialActive, setIsPlaying 
  } = audioHook;
  
  const [step, setStep] = useState(0);
  const [isArchenaPlaying, setIsArchenaPlaying] = useState(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const genres = [
    ...Object.keys(musicDatabase).filter(g => g !== "Hits" && g !== "Default"), 
    "Hits", 
    "Default", 
    "Random"
  ];

  const slides = [
    { 
      title: "Welcome Setup", 
      desc: "Hi, welcome! I'm Archena, your AI assistant here to guide you through every detail of this CV. Developed by Herbanu Warthakusuma, I'm currently a static assistant to keep production costs efficient, meaning I can't engage in live conversations just yet. Please note that I currently only support Indonesian. If you understand, click the button below to proceed.",
      icon: "🛠️",
      audio: "/audio/instruction/1.wav?v=audio-fix-20261109"
    },
    { 
      title: "AI Instruction Mode", 
      desc: "Choose how you want the AI voice instructions to guide you.",
      icon: "🎙️", 
      audio: "/audio/instruction/2.wav?v=audio-fix-20261109"
    },
    { 
      title: "Background Music", 
      desc: "Pick a music genre to accompany you while exploring this CV dashboard.", 
      icon: "🎵", 
      audio: "/audio/instruction/3.wav?v=audio-fix-20261109"
    },
    { 
      title: "Setup Almost Complete", 
      desc: "Don't worry, you can change your AI mode and music preferences anytime via the Settings menu located inside the Open CV Dashboard at the top right corner.", 
      icon: "⚙️", 
      audio: "/audio/instruction/4.wav?v=audio-fix-20261109"
    },
    { 
      title: "Setup Complete", 
      desc: "Everything is ready. Click the button below to enter the main Dashboard.", 
      icon: "🚀", 
      audio: "/audio/instruction/5.wav?v=audio-fix-20261109"
    }
  ];

  useEffect(() => {
    setIsTutorialActive(true);
    return () => setIsTutorialActive(false);
  }, [setIsTutorialActive]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = 1.0;
      setIsArchenaPlaying(false);
      setIsAutoplayBlocked(false);
      let isCurrentStep = true;
      const playAudio = async () => {
        if (aiMode === "auto") {
          try { 
            await audio.play(); 
            if (isCurrentStep) setIsArchenaPlaying(true);
          } catch {
            if (isCurrentStep) setIsAutoplayBlocked(true);
          }
        }
      };
      const timer = setTimeout(playAudio, 600);
      return () => { 
        isCurrentStep = false;
        clearTimeout(timer); 
        audio.pause(); 
        audio.currentTime = 0; 
      };
    }
  }, [step, aiMode]);

  useEffect(() => {
    if (step === 2) {
      if (!selectedGenre || selectedGenre === "") {
        setSelectedGenre("Default");
        setTimeout(() => {
          setIsPlaying(true);
        }, 500);
      } else {
        setIsPlaying(true);
      }
    }
  }, [step, setSelectedGenre, setIsPlaying, selectedGenre]);

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const toggleManualAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { 
      try {
        await audio.play();
        if (audioRef.current === audio) {
          setIsArchenaPlaying(true);
          setIsAutoplayBlocked(false);
        }
      } catch {
        if (audioRef.current === audio) {
          setIsArchenaPlaying(false);
          setIsAutoplayBlocked(true);
        }
      }
    } else { 
      audio.pause(); 
      setIsArchenaPlaying(false); 
    }
  };

  return (
    <div className="setting-overlay">
      <audio 
        ref={audioRef} 
        key={slides[step].audio} 
        onEnded={() => setIsArchenaPlaying(false)} 
        preload="auto"
      >
        <source src={slides[step].audio} type="audio/wav" />
      </audio>

      <AnimatePresence mode="wait">
        <motion.div 
          key={step} 
          variants={slideVariants} 
          initial="initial" 
          animate="animate" 
          exit="exit" 
          className="barcode-card"
          role="dialog"
          aria-live="polite"
        >
          <div className="setting-icon">{slides[step].icon}</div>
          <h2 className="setting-title">{slides[step].title}</h2>
          <p className="setting-desc">{slides[step].desc}</p>

          {step === 1 && (
            <div className="ai-mode-container">
              {(['off', 'auto', 'manual'] as AiMode[]).map((mode) => (
                <button 
                  key={mode} 
                  onClick={() => setAiMode(mode)} 
                  className={`mode-button ${aiMode === mode ? 'active' : ''}`}
                  aria-pressed={aiMode === mode}
                > 
                  {mode === 'off' ? 'Disable AI' : mode === 'auto' ? 'Automatic AI' : 'Manual'} 
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="ai-mode-container scrollable-music-list">
              {genres.map((genre) => (
                <button 
                  key={genre} 
                  onClick={() => setSelectedGenre(genre)} 
                  className={`mode-button ${selectedGenre === genre ? 'active' : ''}`}
                  aria-pressed={selectedGenre === genre}
                > 
                  {genre} 
                </button>
              ))}
            </div>
          )}

          {((aiMode === "manual" && step !== 1) || (aiMode === "auto" && isAutoplayBlocked)) && (
            <div
              onClick={toggleManualAudio}
              className="audio-manual-trigger"
              style={{ cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              aria-label={isArchenaPlaying ? "Pause narration" : "Play narration"}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleManualAudio();
                }
              }}
            >
              {isArchenaPlaying ? <HiVolumeUp /> : <HiVolumeOff />}
            </div>
          )}
          
          <button
            onClick={handleNext}
            className="next-button"
            aria-label={
              step === slides.length - 1
                ? "Save preferences and finish setup"
                : `Go to step ${step + 2} of ${slides.length}`
            }
          >
            {step === slides.length - 1 ? "Save & Finish" : "Next"}
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Visit;
