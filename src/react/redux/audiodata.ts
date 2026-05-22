// src/react/redux/audiodata.ts
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export const musicDatabase: Record<string, string[]> = {
  "City Pop": ["kh0EBY2MYJk", "RO1BvdmJYBY", "7yvrsDDGWNQ", "IoUR5FKmBpg", "7GzoTLEUVO4", "Nr-WemEPw48", "BlvOAd10kJo"],
  "Jazz": ["pu3SfD4jpkU", "UWIIPX_5rbM", "0FHK9ggDOAc", "t4qR_Om1Gq4", "T30OETu-jd4"],
  "Hip-Hop": ["HvC96EaQDmU", "5EpyN_6dqyk", "Zzl20a6AmRE", "nXvpQjRnWw4", "U-l4ya3ejko", "_r-nPqWGG6c", "fCeiUX59_FM", "XkQ1pltpQnw", "qFLhGq0060w", "dRStIP49v48", "NyTkaQHdySM", "61ymOWwOwuk", "OWl9p3oFKgg", "zt6aRKpf9T4", "S4asq3SicN0", "UYwF-jdcVjY", "wXhTHyIgQ_U", "au2n7VVGv_c", "h3EJICKwITw", "pgN-vvVVxMA", "ApXoWvfEYVU", "KyAcMpQUY5s", "GX8Hg6kWQYI", "ox7RsX1Ee34", "tvTRZJ-4EyI", "lMDNDI8CHIs", "pxwm3sqAytE"],
  "Type Beat": ["eXRSSJ-t74A", "JrZiTR7MT0E", "HZvFCvQgIaY", "zjZlaXqiQbM", "88f5VXUuDnE", "fyXD9Cq9Qj8", "1VrVMkbXskY", "99H578iry8s", "qtpqosJJetI"],
  "Hits": ["FF8okFt4bGg", "1qmrq6I_jHI", "JQbjS0_ZfJ0", "rJWdfDPZ9Ck", "XoiOOiuH8iI", "adLGHcj_fmA", "HfWLgELllZs"],
  "Electro Dance": ["dbJ55eUlw3A", "mOKqNxN4jWM", "nntGTK2Fhb0", "9FqDJsY5DKc", "8x-M7AkTvrQ", "9Sc-ir2UwGU"],
  "Phonk House": ["r5qG1ERVUvM", "a0tU-3FEMYc", "nLR3jHDqF7c", "tKvEnZSoqas", "PTZgxW_3LIQ", "w-sQRS-Lc9k", "dvQJIgjlR3I", "Kii1mdfiX3Y", "G2Mey3it9Jg"],
  "Brazilian Phonk": ["BMgQ2kMr1I4", "BylPLfvm-nM", "AZwodco-qss", "ScMkywEH5JM", "6xPYo-38PbI", "P12jBX75B48", "H-WD9OQL8SI", "X62TZSgGIoA", "VJnROwo7MyY", "DgplwisyBpk", "XTPjw7LWhBg", "9ItRZnn1N_k", "yHKXRcZxpG8"],
  "Synthwave": ["8GW6sLrK40k", "f3DoKx_R1_s", "WIt91LCk5rQ", "qsD-nh0BJsQ", "IzTJQiFoNGE", "SV50T5vHMBg", "wL8DVHuWI7Y", "wvfCs3Oh5Kg", "sJl1utEpcEs", "eckZUoNt2Cw", "lCKU-tI-upI"],
  "Ambient": ["v23GA_5xYNU", "kV_Ls62DC20", "R-TnHRnrVZM", "8b-WwN4H7lE", "Gpd85y_iTxY", "DZ47H84Bc_Q", "4i0d6CPLSGo", "LlN8MPS7KQs", "Ts5ZiojkOe4", "zKz4-_Ax4fE", "lq1vZxM-Iic", "o3_InDEtpLA"],
  "Vaporwave": ["FdIe2JBWYRY", "9n7epI-RXFU", "RgI46BILuaY", "bAgmGZ9iQ2Y", "oNLPM-GlHOE"],
  "Lofi": ["Og6Yu54arDE", "D337f2qRLRw", "p2ZgMw616u0", "ew4Y22J_p8s", "LKhQsm6iYfg", "2oJ2cRYAiVo", "l0Nat5LK8yI", "YE3acuzuOAE", "wSgChEB7QIs", "vGcn-4Hm2hE", "taXYjBmZzsg", "W6hasdx4a1I"],
  "Future Funk": ["i7lqrS4FUgE", "qtVt57F3bno", "ch8lVdSWxFg", "G2-KMg_BlCg"],
  "Kawaii Future Bass": ["N8nGig78lNs", "4A4ZiZwPejY", "wYZIveARSG0", "fE_spqJTU6k", "D7us0mO6jDM"],
  "Progressive Bass": ["qwVMKUfs-eM", "VfuI4EjF4Qk", "feDpOXAiODo", "bv7xMhvXJjc", "ufPIoaqMhsM", "DvP2TN1WRnw", "A8EF9Syt9aM", "fbUZ6vxOaCY"],
  "Up Beat": ["P_7kL2GYXOU", "IBdeL-F6Kcs", "Yl49jbn8uz8", "qF5zqR072IE", "BQ1lwOeiVQM", "gmGHSiPfDKk", "dZgsGM6gsho"]
};

interface AudioState {
  aiMode: string;
  selectedGenre: string;
  isPlaying: boolean;
  isStopped: boolean;
  volume: number;
  isTutorialActive: boolean;
  shuffleKey: number;
}

const loadFromStorage = (key: string, defaultValue: any) => {
  const stored = localStorage.getItem(key);
  if (stored !== null) {
    if (key === "userVolume") return Number(stored);
    if (key === "isMusicStopped") return stored === "true";
    return stored;
  }
  return defaultValue;
};

const initialState: AudioState = {
  aiMode: loadFromStorage("aiMode", "auto"),
  selectedGenre: loadFromStorage("userGenre", "Default"),
  isPlaying: false,
  isStopped: loadFromStorage("isMusicStopped", false),
  volume: loadFromStorage("userVolume", 20),
  isTutorialActive: false,
  shuffleKey: 0,
};

const audioSlice = createSlice({
  name: "audio",
  initialState,
  reducers: {
    setAiMode: (state, action: PayloadAction<string>) => {
      state.aiMode = action.payload;
    },
    setSelectedGenre: (state, action: PayloadAction<string>) => {
      state.selectedGenre = action.payload;
      state.shuffleKey += 1;
    },
    setIsPlaying: (state, action: PayloadAction<boolean>) => {
      if (action.payload) {
        state.isStopped = false;
      }
      state.isPlaying = action.payload;
    },
    setIsStopped: (state, action: PayloadAction<boolean>) => {
      state.isStopped = action.payload;
      if (action.payload) {
        state.isPlaying = false;
      }
    },
    setVolume: (state, action: PayloadAction<number>) => {
      state.volume = action.payload;
    },
    setIsTutorialActive: (state, action: PayloadAction<boolean>) => {
      state.isTutorialActive = action.payload;
    },
    incrementShuffleKey: (state) => {
      state.shuffleKey += 1;
    },
  },
});

export const { 
  setAiMode, 
  setSelectedGenre, 
  setIsPlaying, 
  setIsStopped, 
  setVolume, 
  setIsTutorialActive,
  incrementShuffleKey
} = audioSlice.actions;

export default audioSlice.reducer;