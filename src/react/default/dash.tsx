// src/react/default/dash.tsx
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@redux/store";
import type { ThemeMode } from "@redux/themeslice";
import FrameScroll from "@system/framescroll";
import DashContent from "./dashcontent";

const ALL_THEME_MODES: ThemeMode[] = [
  "light",
  "dark",
  "sepia",
  "night",
  "forest",
  "ocean",
  "amoled",
  "dim",
  "solarized",
  "dracula",
];

const Dash: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const mode = useSelector((state: RootState) => state.theme.mode);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove(...ALL_THEME_MODES);
    root.classList.add("dark");

    let metaThemeColor = document.querySelector("meta[name='theme-color']");
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.setAttribute("name", "theme-color");
      document.head.appendChild(metaThemeColor);
    }
    const prevMetaContent = metaThemeColor.getAttribute("content");
    metaThemeColor.setAttribute("content", "#0a0a0a");

    return () => {
      root.classList.remove(...ALL_THEME_MODES);

      let appliedTheme: string;
      if (mode === "auto") {
        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        appliedTheme = isDark ? "dark" : "light";
      } else {
        appliedTheme = mode;
      }
      root.classList.add(appliedTheme);

      if (prevMetaContent !== null) {
        metaThemeColor.setAttribute("content", prevMetaContent);
      } else {
        metaThemeColor.setAttribute("content", "#ffffff");
      }
    };
  }, [mode]);

  return (
    <div className="home-container home-container--dash">
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