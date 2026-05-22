// src/react/redux/store.ts
import { configureStore } from '@reduxjs/toolkit';
import audioReducer from './audiodata';
import authReducer from './authslice';
import visitReducer from './visitslice';
import themeReducer from './themeslice';
import visibleReducer from './visibleslice';

export const store = configureStore({
  reducer: {
    audio: audioReducer,
    auth: authReducer,
    visit: visitReducer,
    theme: themeReducer,
    visible: visibleReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;