// src/react/redux/cloudslice.ts
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { CloudSource, HFFile } from '@config/cloudsource';

type HfView = 'repos' | 'files';
type RepoType = 'dataset' | 'model' | 'space' | '';

interface CloudState {
  sources: CloudSource[];
  activeSourceId: string | null;
  currentView: 'root' | 'chats' | 'repos' | 'files' | 'player';
  files: HFFile[];
  loading: boolean;
  error: string | null;
  selectedChatId: string | null;
  selectedFileId: string | null;
  selectedRepo: string;
  selectedRepoType: RepoType;
  currentPath: string;
  hfView: HfView;
}

const CLOUD_STORAGE_KEYS = {
  ACTIVE_SOURCE_ID: 'cloud_active_source_id',
  CURRENT_VIEW: 'cloud_current_view',
  SELECTED_CHAT_ID: 'cloud_selected_chat_id',
  SELECTED_FILE_ID: 'cloud_selected_file_id',
  SELECTED_REPO: 'cloud_selected_repo',
  SELECTED_REPO_TYPE: 'cloud_selected_repo_type',
  CURRENT_PATH: 'cloud_current_path',
  HF_VIEW: 'cloud_hf_view',
} as const;

const getPersistedActiveSourceId = (): string | null => {
  try {
    return sessionStorage.getItem(CLOUD_STORAGE_KEYS.ACTIVE_SOURCE_ID) || null;
  } catch {
    return null;
  }
};

const getPersistedCurrentView = (): CloudState['currentView'] => {
  try {
    const saved = sessionStorage.getItem(CLOUD_STORAGE_KEYS.CURRENT_VIEW);
    if (saved === 'root' || saved === 'chats' || saved === 'repos' || saved === 'files' || saved === 'player') {
      return saved;
    }
  } catch {}
  return 'root';
};

const getPersistedSelectedChatId = (): string | null => {
  try {
    return sessionStorage.getItem(CLOUD_STORAGE_KEYS.SELECTED_CHAT_ID) || null;
  } catch {
    return null;
  }
};

const getPersistedSelectedFileId = (): string | null => {
  try {
    return sessionStorage.getItem(CLOUD_STORAGE_KEYS.SELECTED_FILE_ID) || null;
  } catch {
    return null;
  }
};

const persistSelectedFileId = (id: string | null) => {
  try {
    if (id) sessionStorage.setItem(CLOUD_STORAGE_KEYS.SELECTED_FILE_ID, id);
    else sessionStorage.removeItem(CLOUD_STORAGE_KEYS.SELECTED_FILE_ID);
  } catch {}
};

const getPersistedSelectedRepo = (): string => {
  try {
    return sessionStorage.getItem(CLOUD_STORAGE_KEYS.SELECTED_REPO) || '';
  } catch {
    return '';
  }
};

const getPersistedSelectedRepoType = (): RepoType => {
  try {
    const saved = sessionStorage.getItem(CLOUD_STORAGE_KEYS.SELECTED_REPO_TYPE);
    if (saved === 'dataset' || saved === 'model' || saved === 'space') return saved;
  } catch {}
  return '';
};

const getPersistedCurrentPath = (): string => {
  try {
    return sessionStorage.getItem(CLOUD_STORAGE_KEYS.CURRENT_PATH) || '';
  } catch {
    return '';
  }
};

const getPersistedHfView = (): HfView => {
  try {
    const saved = sessionStorage.getItem(CLOUD_STORAGE_KEYS.HF_VIEW);
    if (saved === 'repos' || saved === 'files') return saved;
  } catch {}
  return 'repos';
};

const persistActiveSourceId = (id: string | null) => {
  try {
    if (id) sessionStorage.setItem(CLOUD_STORAGE_KEYS.ACTIVE_SOURCE_ID, id);
    else sessionStorage.removeItem(CLOUD_STORAGE_KEYS.ACTIVE_SOURCE_ID);
  } catch {}
};

const persistCurrentView = (view: CloudState['currentView']) => {
  try {
    sessionStorage.setItem(CLOUD_STORAGE_KEYS.CURRENT_VIEW, view);
  } catch {}
};

const persistSelectedChatId = (id: string | null) => {
  try {
    if (id) sessionStorage.setItem(CLOUD_STORAGE_KEYS.SELECTED_CHAT_ID, id);
    else sessionStorage.removeItem(CLOUD_STORAGE_KEYS.SELECTED_CHAT_ID);
  } catch {}
};

const persistSelectedRepo = (repo: string) => {
  try {
    if (repo) sessionStorage.setItem(CLOUD_STORAGE_KEYS.SELECTED_REPO, repo);
    else sessionStorage.removeItem(CLOUD_STORAGE_KEYS.SELECTED_REPO);
  } catch {}
};

const persistSelectedRepoType = (type: RepoType) => {
  try {
    if (type) sessionStorage.setItem(CLOUD_STORAGE_KEYS.SELECTED_REPO_TYPE, type);
    else sessionStorage.removeItem(CLOUD_STORAGE_KEYS.SELECTED_REPO_TYPE);
  } catch {}
};

const persistCurrentPath = (path: string) => {
  try {
    if (path) sessionStorage.setItem(CLOUD_STORAGE_KEYS.CURRENT_PATH, path);
    else sessionStorage.removeItem(CLOUD_STORAGE_KEYS.CURRENT_PATH);
  } catch {}
};

const persistHfView = (view: HfView) => {
  try {
    sessionStorage.setItem(CLOUD_STORAGE_KEYS.HF_VIEW, view);
  } catch {}
};

const initialState: CloudState = {
  sources: [],
  activeSourceId: getPersistedActiveSourceId(),
  currentView: getPersistedCurrentView(),
  files: [],
  loading: true,
  error: null,
  selectedChatId: getPersistedSelectedChatId(),
  selectedFileId: getPersistedSelectedFileId(),
  selectedRepo: getPersistedSelectedRepo(),
  selectedRepoType: getPersistedSelectedRepoType(),
  currentPath: getPersistedCurrentPath(),
  hfView: getPersistedHfView(),
};

const cloudSlice = createSlice({
  name: 'cloud',
  initialState,
  reducers: {
    setSources: (state, action: PayloadAction<CloudSource[]>) => {
      state.sources = action.payload;
    },
    setActiveSource: (state, action: PayloadAction<string | null>) => {
      state.activeSourceId = action.payload;
      persistActiveSourceId(action.payload);
    },
    setCurrentView: (state, action: PayloadAction<'root' | 'chats' | 'repos' | 'files' | 'player'>) => {
      state.currentView = action.payload;
      persistCurrentView(action.payload);
    },
    setFiles: (state, action: PayloadAction<HFFile[]>) => {
      state.files = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setSelectedChatId: (state, action: PayloadAction<string | null>) => {
      state.selectedChatId = action.payload;
      persistSelectedChatId(action.payload);
    },
    setSelectedFileId: (state, action: PayloadAction<string | null>) => {
      state.selectedFileId = action.payload;
      persistSelectedFileId(action.payload);
    },
    setSelectedRepo: (state, action: PayloadAction<string>) => {
      state.selectedRepo = action.payload;
      persistSelectedRepo(action.payload);
    },
    setSelectedRepoType: (state, action: PayloadAction<RepoType>) => {
      state.selectedRepoType = action.payload;
      persistSelectedRepoType(action.payload);
    },
    setCurrentPath: (state, action: PayloadAction<string>) => {
      state.currentPath = action.payload;
      persistCurrentPath(action.payload);
    },
    setHfView: (state, action: PayloadAction<HfView>) => {
      state.hfView = action.payload;
      persistHfView(action.payload);
    },
    addSourceLocal: (state, action: PayloadAction<CloudSource>) => {
      state.sources.push(action.payload);
    },
    updateSourceLocal: (state, action: PayloadAction<{ id: string; updates: Partial<CloudSource> }>) => {
      const { id, updates } = action.payload;
      const index = state.sources.findIndex(s => s.id === id);
      if (index !== -1) {
        state.sources[index] = { ...state.sources[index], ...updates };
      }
    },
    removeSourceLocal: (state, action: PayloadAction<string>) => {
      state.sources = state.sources.filter(s => s.id !== action.payload);
      if (state.activeSourceId === action.payload) {
        state.activeSourceId = null;
        persistActiveSourceId(null);
      }
    },
    clearFiles: (state) => {
      state.files = [];
    },
    resetCloud: (state) => {
      state.sources = [];
      state.activeSourceId = null;
      state.currentView = 'root';
      state.files = [];
      state.loading = false;
      state.error = null;
      state.selectedChatId = null;
      state.selectedFileId = null;
      state.selectedRepo = '';
      state.selectedRepoType = '';
      state.currentPath = '';
      state.hfView = 'repos';
      persistActiveSourceId(null);
      persistCurrentView('root');
      persistSelectedChatId(null);
      persistSelectedFileId(null);
      persistSelectedRepo('');
      persistSelectedRepoType('');
      persistCurrentPath('');
      persistHfView('repos');
    },
  },
});

export const {
  setSources,
  setActiveSource,
  setCurrentView,
  setFiles,
  setLoading,
  setError,
  setSelectedChatId,
  setSelectedFileId,
  setSelectedRepo,
  setSelectedRepoType,
  setCurrentPath,
  setHfView,
  addSourceLocal,
  updateSourceLocal,
  removeSourceLocal,
  clearFiles,
  resetCloud,
} = cloudSlice.actions;

export default cloudSlice.reducer;