// src/react/system/audioplayer.tsx
import React, { useEffect, useRef } from 'react';
import { useAudio } from '@hook/useaudio';

const AudioPlayer: React.FC = () => {
  const { 
    isStopped, 
    selectedGenre, 
    volume, 
    isPlaying,
    currentShuffle,
    sendCommand,
    iframeRef,
    reshuffle
  } = useAudio();

  const playerReadyRef = useRef(false);

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

  const handlePlayerStateChange = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.event === "onStateChange" && playerReadyRef.current) {
        const playerState = data.info;
        if (playerState === 0) {
          reshuffle();
        }
      }
    } catch (e) {
      // Ignore non-JSON messages
    }
  };

  useEffect(() => {
    window.addEventListener("message", handlePlayerStateChange);
    return () => {
      window.removeEventListener("message", handlePlayerStateChange);
    };
  }, [reshuffle]);

  if (isStopped || !selectedGenre) {
    return null;
  }

  const isDefaultGenre = selectedGenre === "Default";
  let finalFirstTrack = currentShuffle.firstTrack;
  let finalPlaylist = currentShuffle.playlist;

  if (isDefaultGenre) {
    finalPlaylist = currentShuffle.firstTrack;
  }

  const hasPlaylist = finalPlaylist && finalPlaylist.length > 0;

  return (
    <iframe
      ref={iframeRef}
      id="youtube-bg-player"
      key={`yt-player-${selectedGenre}-${currentShuffle.playlist}`}
      width="1"
      height="1"
      src={`https://www.youtube.com/embed/${finalFirstTrack}?enablejsapi=1&autoplay=1&mute=0&loop=1${hasPlaylist ? `&playlist=${finalPlaylist}` : ""}&origin=${window.location.origin}`}
      frameBorder="0"
      allow="autoplay; encrypted-media"
      style={{ position: "fixed", opacity: 0, pointerEvents: "none" }}
      title="YouTube Audio Player"
      onLoad={() => {
        playerReadyRef.current = true;
        sendCommand("setVolume", [volume]);
        if (isPlaying) {
          sendCommand("playVideo");
        } else {
          sendCommand("pauseVideo");
        }
      }}
    />
  );
};

export default AudioPlayer;