// src/react/redux/authslice.ts
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  token: string | null;
  isLoggedIn: boolean;
  user: any | null;
}

// path loadAuthFromStorage: fungsi helper untuk baca dari localStorage
const loadAuthFromStorage = () => {
  const token = localStorage.getItem("token");
  return {
    token: token,
    isLoggedIn: !!token,
    user: null,
  };
};

const initialState: AuthState = loadAuthFromStorage();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken: (state, action: PayloadAction<string | null>) => {
      state.token = action.payload;
      state.isLoggedIn = !!action.payload;
      if (action.payload) {
        localStorage.setItem("token", action.payload);
      } else {
        localStorage.removeItem("token");
      }
    },
    setUser: (state, action: PayloadAction<any | null>) => {
      state.user = action.payload;
    },
    logout: (state) => {
      state.token = null;
      state.isLoggedIn = false;
      state.user = null;
      localStorage.removeItem("token");
    },
  },
});

export const { setToken, setUser, logout } = authSlice.actions;
export default authSlice.reducer;