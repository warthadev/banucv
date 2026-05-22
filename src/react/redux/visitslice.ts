// src/react/redux/visitslice.ts
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface VisitState {
  hasVisited: boolean;
}

// path loadVisitFromStorage: fungsi helper untuk baca dari localStorage
const loadVisitFromStorage = () => {
  const hasVisited = localStorage.getItem("hasVisitedBefore") === "true";
  return { hasVisited };
};

const initialState: VisitState = loadVisitFromStorage();

const visitSlice = createSlice({
  name: "visit",
  initialState,
  reducers: {
    setHasVisited: (state, action: PayloadAction<boolean>) => {
      state.hasVisited = action.payload;
      localStorage.setItem("hasVisitedBefore", String(action.payload));
    },
    completeVisit: (state) => {
      state.hasVisited = true;
      localStorage.setItem("hasVisitedBefore", "true");
    },
  },
});

export const { setHasVisited, completeVisit } = visitSlice.actions;
export default visitSlice.reducer;