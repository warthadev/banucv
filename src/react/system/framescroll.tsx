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

  useEffect(() => {
    if (firstFrameLoaded && onLoaded) {
      onLoaded();
    }
  }, [firstFrameLoaded, onLoaded]);

  return (
    <>
      {!firstFrameLoaded && <Loading />}
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