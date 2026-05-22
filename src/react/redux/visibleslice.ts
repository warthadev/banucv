// src/react/redux/visibleslice.ts
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface VisibleState {
  isQuickVisible: boolean;
}

// Load dari localStorage
const loadFromStorage = (): boolean => {
  const stored = localStorage.getItem('isQuickVisible');
  return stored !== null ? stored === 'true' : false; // Default: false (tersembunyi)
};

const initialState: VisibleState = {
  isQuickVisible: loadFromStorage(),
};

const visibleSlice = createSlice({
  name: 'visible',
  initialState,
  reducers: {
    setQuickVisible: (state, action: PayloadAction<boolean>) => {
      state.isQuickVisible = action.payload;
      localStorage.setItem('isQuickVisible', String(action.payload));
    },
    toggleQuickVisible: (state) => {
      state.isQuickVisible = !state.isQuickVisible;
      localStorage.setItem('isQuickVisible', String(state.isQuickVisible));
    },
  },
});

export const { setQuickVisible, toggleQuickVisible } = visibleSlice.actions;
export default visibleSlice.reducer;