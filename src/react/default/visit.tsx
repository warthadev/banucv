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

// path Visit: komponen tutorial/welcome setup pertama kali
const Visit: React.FC<VisitProps> = ({ onComplete }) => {
  const audioHook = useAudio();
  
  const { 
    aiMode, setAiMode, 
    selectedGenre, setSelectedGenre, 
    setIsTutorialActive, setIsPlaying 
  } = audioHook;
  
  const [step, setStep] = useState(0);
  const [isArchenaPlaying, setIsArchenaPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filter genres agar "Default" dan "Random" muncul di urutan akhir tanpa duplikasi
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
      audio: "/audio/instruction/1.wav"
    },
    { 
      title: "AI Instruction Mode", 
      desc: "Choose how you want the AI voice instructions to guide you.",
      icon: "🎙️", 
      audio: "/audio/instruction/2.wav" 
    },
    { 
      title: "Background Music", 
      desc: "Pick a music genre to accompany you while exploring this CV dashboard.", 
      icon: "🎵", 
      audio: "/audio/instruction/3.wav" 
    },
    { 
      title: "Setup Almost Complete", 
      desc: "Don't worry, you can change your AI mode and music preferences anytime via the Settings menu located inside the Open CV Dashboard at the top right corner.", 
      icon: "⚙️", 
      audio: "/audio/instruction/4.wav" 
    },
    { 
      title: "Setup Complete", 
      desc: "Everything is ready. Click the button below to enter the main Dashboard.", 
      icon: "🚀", 
      audio: "/audio/instruction/5.wav" 
    }
  ];

  // path effect tutorial active: set isTutorialActive true saat mount
  useEffect(() => {
    setIsTutorialActive(true);
    return () => setIsTutorialActive(false);
  }, [setIsTutorialActive]);

  // path effect archena voice: play audio sesuai step dan aiMode
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = 1.0;
      setIsArchenaPlaying(false);
      const playAudio = async () => {
        if (aiMode === "auto") {
          try { 
            await audio.play(); 
            setIsArchenaPlaying(true); 
          } catch (err) { 
            console.warn("Autoplay blocked:", err); 
          }
        }
      };
      const timer = setTimeout(playAudio, 600);
      return () => { 
        clearTimeout(timer); 
        audio.pause(); 
        audio.currentTime = 0; 
      };
    }
  }, [step, aiMode]);

  // path effect auto play music: set genre Default dan play musik saat step 3 (index 2)
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

  const toggleManualAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { 
      audio.play().catch(() => {}); 
      setIsArchenaPlaying(true); 
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
                > 
                  {genre} 
                </button>
              ))}
            </div>
          )}

          {aiMode === "manual" && step !== 1 && (
            <div onClick={toggleManualAudio} className="audio-manual-trigger" style={{ cursor: 'pointer' }}>
              {isArchenaPlaying ? <HiVolumeUp /> : <HiVolumeOff />}
            </div>
          )}
          
          <button onClick={handleNext} className="next-button">
            {step === slides.length - 1 ? "Save & Finish" : "Next"}
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Visit;