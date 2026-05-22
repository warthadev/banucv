// src/react/redux/themeslice.ts
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 
  | 'auto'
  | 'light'
  | 'dark'
  | 'sepia'
  | 'night'
  | 'forest'
  | 'ocean'
  | 'amoled'
  | 'dim'
  | 'solarized'
  | 'dracula';

export type ThemePalette = 
  | 'default' | 'emerald' | 'sapphire' | 'amethyst' | 'ruby' | 'topaz' | 'rose'
  | 'cyan' | 'lime' | 'indigo' | 'coral' | 'amber' | 'violet' | 'teal'
  | 'lavender' | 'peach' | 'mint' | 'navy' | 'salmon' | 'plum' | 'gold'
  | 'sky' | 'forest' | 'wine';

interface ThemeState {
  mode: ThemeMode;
  palette: ThemePalette;
}

// path loadThemeFromStorage: baca dari localStorage
const loadThemeFromStorage = (): ThemeState => {
  const storedMode = localStorage.getItem('themeMode') as ThemeMode | null;
  const storedPalette = localStorage.getItem('themePalette') as ThemePalette | null;
  
  const validModes: ThemeMode[] = ['auto', 'light', 'dark', 'sepia', 'night', 'forest', 'ocean', 'amoled', 'dim', 'solarized', 'dracula'];
  
  return {
    mode: storedMode && validModes.includes(storedMode) ? storedMode : 'auto',
    palette: storedPalette || 'default',
  };
};

const initialState: ThemeState = loadThemeFromStorage();

// path colorPalettes: hanya untuk primary color (accent)
export const colorPalettes: Record<ThemePalette, string> = {
  default: '#00a87f',
  emerald: '#10b981',
  sapphire: '#3b82f6',
  amethyst: '#8b5cf6',
  ruby: '#ef4444',
  topaz: '#f59e0b',
  rose: '#ec4899',
  cyan: '#06b6d4',
  lime: '#84cc16',
  indigo: '#6366f1',
  coral: '#ff7f50',
  amber: '#fbbf24',
  violet: '#a855f7',
  teal: '#14b8a6',
  lavender: '#a78bfa',
  peach: '#fdba74',
  mint: '#34d399',
  navy: '#1e40af',
  salmon: '#f97316',
  plum: '#d946ef',
  gold: '#facc15',
  sky: '#0ea5e9',
  forest: '#166534',
  wine: '#991b1b',
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setMode: (state, action: PayloadAction<ThemeMode>) => {
      state.mode = action.payload;
      localStorage.setItem('themeMode', action.payload);
    },
    setPalette: (state, action: PayloadAction<ThemePalette>) => {
      state.palette = action.payload;
      localStorage.setItem('themePalette', action.payload);
    },
  },
});

export const { setMode, setPalette } = themeSlice.actions;
export default themeSlice.reducer;