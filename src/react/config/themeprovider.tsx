// src/react/config/themeprovider.tsx
import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../redux/store";
import { setMode, colorPalettes } from "../redux/themeslice";
import type { ThemeMode } from "../redux/themeslice";

// path ThemeProvider: komponen untuk mengaplikasikan tema ke root element
const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const { mode, palette } = useSelector((state: RootState) => state.theme);

  // path effect: update class html, meta theme-color, dan primary color
  useEffect(() => {
    // 1. Hapus semua class tema yang mungkin ada
    const allThemeModes: ThemeMode[] = ['light', 'dark', 'sepia', 'night', 'forest', 'ocean', 'amoled', 'dim', 'solarized', 'dracula'];
    document.documentElement.classList.remove(...allThemeModes);
    
    // 2. Tentukan tema berdasarkan mode
    let appliedTheme: string;
    if (mode === 'auto') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      appliedTheme = isDark ? 'dark' : 'light';
    } else {
      appliedTheme = mode;
    }
    document.documentElement.classList.add(appliedTheme);
    
    // 3. Hapus semua class palette sebelumnya
    const allPalettes = Object.keys(colorPalettes);
    document.documentElement.classList.remove(...allPalettes.map(p => `palette-${p}`));
    
    // 4. Tambah class palette baru
    document.documentElement.classList.add(`palette-${palette}`);
    
    // 5. Update meta theme-color untuk status bar
    let metaThemeColor = document.querySelector("meta[name='theme-color']");
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.setAttribute("name", "theme-color");
      document.head.appendChild(metaThemeColor);
    }
    
    // Warna status bar berdasarkan tema yang diaplikasikan
    let statusBarColor = '#ffffff';
    if (appliedTheme === 'dark') statusBarColor = '#0a0a0a';
    else if (appliedTheme === 'sepia') statusBarColor = '#f4ecd8';
    else if (appliedTheme === 'night') statusBarColor = '#0f172a';
    else if (appliedTheme === 'forest') statusBarColor = '#0d2818';
    else if (appliedTheme === 'ocean') statusBarColor = '#0a2a3a';
    else if (appliedTheme === 'amoled') statusBarColor = '#000000';
    else if (appliedTheme === 'dim') statusBarColor = '#1a1a1a';
    else if (appliedTheme === 'solarized') statusBarColor = '#fdf6e3';
    else if (appliedTheme === 'dracula') statusBarColor = '#282a36';
    else statusBarColor = '#ffffff';
    
    metaThemeColor.setAttribute("content", statusBarColor);
  }, [mode, palette]);

  // path effect: listen perubahan sistem (prefers-color-scheme) untuk mode auto
  useEffect(() => {
    if (mode !== 'auto') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? 'dark' : 'light';
      const allThemeModes: ThemeMode[] = ['light', 'dark', 'sepia', 'night', 'forest', 'ocean', 'amoled', 'dim', 'solarized', 'dracula'];
      document.documentElement.classList.remove(...allThemeModes);
      document.documentElement.classList.add(newTheme);
      
      let metaThemeColor = document.querySelector("meta[name='theme-color']");
      if (metaThemeColor) {
        const color = newTheme === 'dark' ? '#0a0a0a' : '#ffffff';
        metaThemeColor.setAttribute("content", color);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [mode]);

  return <>{children}</>;
};

export default ThemeProvider;