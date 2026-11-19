// src/react/system/framescroll.tsx
import React, { useEffect } from "react";
import { useFrameScroll } from "@hook/useframescroll";
import Loading from "@control/loading";

interface FrameScrollProps {
  basePath?: string;
  prefix?: string;
  extension?: string;
  padLength?: number;
  children?: React.ReactNode;
  onLoaded?: () => void;
}

const FrameScroll: React.FC<FrameScrollProps> = ({
  basePath = "/image/motion",
  prefix = "frame_",
  extension = ".webp",
  padLength = 4,
  children,
  onLoaded,
}) => {
  const { firstFrameLoaded, containerRef, canvasRef } = useFrameScroll({
    basePath,
    prefix,
    extension,
    padLength,
  });
  const [loadingFallback, setLoadingFallback] = React.useState(false);
  const onLoadedRef = React.useRef(onLoaded);
  const loadNotifiedRef = React.useRef(false);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    if (firstFrameLoaded) {
      if (!loadNotifiedRef.current) {
        loadNotifiedRef.current = true;
        onLoadedRef.current?.();
      }
      return;
    }

    const timeout = window.setTimeout(() => {
      setLoadingFallback(true);
      if (!loadNotifiedRef.current) {
        loadNotifiedRef.current = true;
        onLoadedRef.current?.();
      }
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [firstFrameLoaded]);

  return (
    <>
      {!firstFrameLoaded && !loadingFallback && <Loading />}
      <canvas
        ref={canvasRef}
        className={`dash-framescroll-canvas${firstFrameLoaded ? " is-loaded" : ""}`}
      />
      <div ref={containerRef} className="dash-framescroll-wrapper">
        {children}
      </div>
    </>
  );
};

export default FrameScroll;
