// src/react/default/dash.tsx
import React, { useState } from "react";
import FrameScroll from "@system/framescroll";
import DashContent from "./dashcontent";

const Dash: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [ready, setReady] = useState(false);

  return (
    <div className="home-container home-container--dash">
      <img
        className="dash-framescroll-fallback"
        src="/image/motion/frame_0001.webp"
        alt=""
        aria-hidden="true"
      />
      <FrameScroll
        basePath="/image/motion"
        onLoaded={() => setReady(true)}
      >
        <main className="home-hero">
          <DashContent ready={ready} />
        </main>
      </FrameScroll>

      <footer className="home-footer" style={{ position: "relative", zIndex: 1 }}>
        <p>© {currentYear} WarthaDev • Engineering with Passion</p>
      </footer>
    </div>
  );
};

export default Dash;
