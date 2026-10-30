// src/react/hook/usescreensize.ts
import { useState, useEffect, useRef, useCallback } from 'react';

export type ScreenSize = 'mobile' | 'tablet' | 'desktop';

const getBreakpoint = (width: number): ScreenSize => {
  if (width < 600) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

const isCurrentlyFullscreen = () =>
  !!document.fullscreenElement || !!(document as any).webkitFullscreenElement;

/**
 * Hook breakpoint layar tunggal, dipakai bareng oleh source Telegram & HF
 * (dan komponen manapun yang butuh tau mobile/tablet/desktop).
 *
 * Sengaja skip re-evaluate breakpoint selagi document lagi fullscreen, karena
 * rotate ke landscape bikin window.innerWidth melebar dan bisa kebaca sebagai
 * tablet/desktop — yang tanpa guard ini bakal maksa layout switch & unmount
 * panel mobile (video ke-tendang keluar dari fullscreen). Lihat bug fullscreen
 * HF di area hf-media-playback.md.
 */
export const useScreenSize = (): ScreenSize => {
  const [screenSize, setScreenSize] = useState<ScreenSize>(() =>
    getBreakpoint(typeof window !== 'undefined' ? window.innerWidth : 1024)
  );
  const screenSizeRef = useRef(screenSize);

  useEffect(() => {
    screenSizeRef.current = screenSize;
  }, [screenSize]);

  const updateScreenSize = useCallback(() => {
    if (isCurrentlyFullscreen()) return;
    const next = getBreakpoint(window.innerWidth);
    if (screenSizeRef.current !== next) setScreenSize(next);
  }, []);

  useEffect(() => {
    updateScreenSize();

    const handleResize = () => updateScreenSize();
    const handleFullscreenChange = () => setTimeout(updateScreenSize, 350);
    const handleOrientationChange = () => setTimeout(updateScreenSize, 400);

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [updateScreenSize]);

  return screenSize;
};

export default useScreenSize;
