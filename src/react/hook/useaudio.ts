// src/react/hook/useaudio.ts
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../redux/store';
import { 
  setAiMode, 
  setSelectedGenre, 
  setIsPlaying, 
  setIsStopped, 
  setVolume, 
  setIsTutorialActive,
  incrementShuffleKey
} from '../redux/audiodata';
import { musicDatabase } from '../redux/audiodata';
import { useCallback, useMemo, useRef, useEffect } from 'react';

type AiMode = 'off' | 'auto' | 'manual';

export const useAudio = () => {
  const dispatch = useDispatch();
  
  const aiMode = useSelector((state: RootState) => state.audio.aiMode) as AiMode;
  const selectedGenre = useSelector((state: RootState) => state.audio.selectedGenre);
  const isPlaying = useSelector((state: RootState) => state.audio.isPlaying);
  const isStopped = useSelector((state: RootState) => state.audio.isStopped);
  const volume = useSelector((state: RootState) => state.audio.volume);
  const isTutorialActive = useSelector((state: RootState) => state.audio.isTutorialActive);
  const shuffleKey = useSelector((state: RootState) => state.audio.shuffleKey);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sendCommand = useCallback((func: string, args: any[] = []) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: "command", func, args }), "*");
    }
  }, []);

  useEffect(() => {
    sendCommand("setVolume", [volume]);
  }, [volume, sendCommand]);

  useEffect(() => {
    sendCommand(isPlaying ? "playVideo" : "pauseVideo");
  }, [isPlaying, sendCommand]);

  useEffect(() => {
    if (isStopped) {
      sendCommand("stopVideo");
    }
  }, [isStopped, sendCommand]);

  useEffect(() => {
    localStorage.setItem("aiMode", aiMode);
  }, [aiMode]);

  useEffect(() => {
    localStorage.setItem("userGenre", selectedGenre);
  }, [selectedGenre]);

  useEffect(() => {
    localStorage.setItem("isMusicStopped", String(isStopped));
  }, [isStopped]);

  useEffect(() => {
    localStorage.setItem("userVolume", String(volume));
  }, [volume]);

  const currentShuffle = useMemo(() => {
    if (selectedGenre === "Default") {
      return { firstTrack: "lCKU-tI-upI", playlist: "" };
    }

    let rawTracks: string[] = [];
    if (selectedGenre === "Random") {
      rawTracks = Object.values(musicDatabase).flat();
    } else {
      rawTracks = musicDatabase[selectedGenre] || ["lCKU-tI-upI"];
    }

    const shuffled = [...rawTracks].sort(() => Math.random() - 0.5);
    
    return {
      firstTrack: shuffled[0] || "lCKU-tI-upI",
      playlist: shuffled.slice(1).join(",")
    };
  }, [selectedGenre, shuffleKey]);

  const reshuffle = useCallback(() => {
    dispatch(incrementShuffleKey());
  }, [dispatch]);

  return {
    aiMode,
    selectedGenre,
    isPlaying,
    isStopped,
    volume,
    isTutorialActive,
    currentShuffle,
    iframeRef,
    
    setAiMode: (mode: AiMode) => dispatch(setAiMode(mode)),
    setSelectedGenre: (genre: string) => dispatch(setSelectedGenre(genre)),
    setIsPlaying: (val: boolean) => dispatch(setIsPlaying(val)),
    setIsStopped: (val: boolean) => dispatch(setIsStopped(val)),
    setVolume: (val: number) => dispatch(setVolume(val)),
    setIsTutorialActive: (val: boolean) => dispatch(setIsTutorialActive(val)),
    reshuffle,
    sendCommand,
  };
};