// src/react/hook/usecloudsource.ts
import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { onAuthStateChanged } from 'firebase/auth';
import type { RootState } from '@redux/store';
import {
  addSourceLocal,
  updateSourceLocal,
  removeSourceLocal,
  setActiveSource,
  setCurrentView,
  setFiles,
  setLoading,
  setError,
  clearFiles,
  setSources,
} from '@redux/cloudslice';
import type { CloudSource, CloudSourceType, HFFile } from '@config/cloudsource';
import { generateSourceId, getSourceIcon, getPlatformLabel } from '@config/cloudsource';
import { auth, db } from '@config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getActiveBase } from '@config/api';

const hashToId = (prefix: string, value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return `${prefix}_${Math.abs(hash)}`;
};

const loadSourcesFromFirestore = async (): Promise<CloudSource[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const sources: CloudSource[] = [];

      const sessions = data.telegramSessions || [];
      const accountNames = data.telegramAccountNames || [];

      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        if (session && session.length > 0) {
          const accountName = accountNames[i] || session.substring(0, 15) || 'Telegram Account';
          sources.push({
            id: hashToId('telegram', session),
            type: 'telegram',
            name: accountName,
            platform: 'Telegram',
            icon: '☁️',
            status: 'online',
            sessionString: session,
          });
        }
      }

      const hfUsernames = data.hfUsernames || [];
      const hfTokens = data.hfTokens || [];

      for (let i = 0; i < hfUsernames.length; i++) {
        const username = hfUsernames[i];
        const token = hfTokens[i];
        if (username && token) {
          sources.push({
            id: hashToId('hf', username),
            type: 'hf_dataset',
            name: username,
            platform: 'Hugging Face',
            icon: '📁',
            status: 'online',
            datasetId: username,
            hfToken: token,
          });
        }
      }

      return sources;
    }
  } catch (error) {
    void 0;
  }
  return [];
};

export const clearAllHFSessions = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    return;
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      hfUsernames: null,
      hfTokens: null,
    });
  } catch (error) {
    void 0;
  }
};

export const generateUniqueName = (
  baseName: string,
  type: 'telegram' | 'hf_dataset',
  existingSources: CloudSource[]
): string => {
  if (!baseName || baseName.trim() === '') {
    baseName = type === 'telegram' ? 'Telegram Account' : 'Hugging Face Account';
  }

  const trimmedBase = baseName.trim();

  const sameTypeSources = existingSources.filter(s => s.type === type);

  const sameNames = sameTypeSources.filter(s => s.name === trimmedBase);

  if (sameNames.length === 0) {
    return trimmedBase;
  }

  let index = 1;
  let newName = `${trimmedBase} (${index})`;
  while (sameTypeSources.some(s => s.name === newName)) {
    index++;
    newName = `${trimmedBase} (${index})`;
  }

  return newName;
};

export const useCloudSource = () => {
  const dispatch = useDispatch();

  const sources = useSelector((state: RootState) => state.cloud.sources);
  const activeSourceId = useSelector((state: RootState) => state.cloud.activeSourceId);
  const currentView = useSelector((state: RootState) => state.cloud.currentView);
  const files = useSelector((state: RootState) => state.cloud.files);
  const loading = useSelector((state: RootState) => state.cloud.loading);
  const error = useSelector((state: RootState) => state.cloud.error);

  const activeSource = sources.find(s => s.id === activeSourceId) || null;
  const hasLoadedRef = useRef(false);
  const sourcesRef = useRef(sources);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  const syncSourcesFromFirestore = useCallback(async (): Promise<CloudSource[]> => {
    const firestoreSources = await loadSourcesFromFirestore();

    const currentSources = sourcesRef.current;

    const existingSessions = new Set(
      currentSources
        .filter(s => s.type === 'telegram' && s.sessionString)
        .map(s => s.sessionString)
    );

    const existingHF = new Set(
      currentSources
        .filter(s => s.type === 'hf_dataset' && s.datasetId)
        .map(s => s.datasetId)
    );

    const newSources = firestoreSources.filter(s => {
      if (s.type === 'telegram' && s.sessionString) {
        return !existingSessions.has(s.sessionString);
      }
      if (s.type === 'hf_dataset' && s.datasetId) {
        return !existingHF.has(s.datasetId);
      }
      return true;
    });

    const merged = [...currentSources, ...newSources];

    if (newSources.length > 0 || merged.length !== currentSources.length) {
      dispatch(setSources(merged));
    }

    const savedActiveId = sessionStorage.getItem('cloud_active_source_id');
    const savedView = sessionStorage.getItem('cloud_current_view');

    if (savedActiveId) {
      const match = merged.find(s => s.id === savedActiveId);
      if (!match) {
        dispatch(setActiveSource(null));
        dispatch(setCurrentView('root'));
        dispatch(clearFiles());
      } else {
        if (savedView === 'chats' || savedView === 'repos' || savedView === 'files' || savedView === 'player') {
          if (match.type === 'telegram' && savedView === 'chats') {
            dispatch(setCurrentView('chats'));
          } else if (match.type === 'hf_dataset' && savedView === 'repos') {
            dispatch(setCurrentView('repos'));
          }
        }
      }
    }

    return merged;
  }, [dispatch]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        hasLoadedRef.current = false;
        dispatch(setLoading(false));
        return;
      }

      if (hasLoadedRef.current) return;
      hasLoadedRef.current = true;

      dispatch(setLoading(true));
      syncSourcesFromFirestore()
        .catch((err) => {
          console.error('[CloudSource] Sync failed:', err);
        })
        .finally(() => {
          dispatch(setLoading(false));
        });
    });

    return () => unsubscribe();
  }, [syncSourcesFromFirestore, dispatch]);

  const addSource = useCallback(async (
    type: CloudSourceType,
    name: string,
    sessionString?: string,
    phoneNumber?: string,
    datasetId?: string,
    datasetPath?: string,
    platform?: string,
    hfToken?: string
  ): Promise<CloudSource> => {
    const newSource: CloudSource = {
      id: generateSourceId(),
      type,
      name,
      platform: platform || getPlatformLabel(type),
      icon: getSourceIcon(type),
      status: 'loading',
      sessionString,
      phoneNumber,
      datasetId,
      datasetPath,
      hfToken,
      fileCount: 0,
      totalSize: 0,
    };

    dispatch(addSourceLocal(newSource));

    const API_BASE = getActiveBase();

    if (type === 'telegram' && sessionString) {
      try {
        const res = await fetch(`${API_BASE}/telegram/validate_session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_string: sessionString }),
        });
        const data = await res.json();
        if (data.valid) {
          dispatch(updateSourceLocal({
            id: newSource.id,
            updates: { status: 'online' }
          }));
          const updatedSource = { ...newSource, status: 'online' as const };
          return updatedSource;
        } else {
          dispatch(updateSourceLocal({
            id: newSource.id,
            updates: { status: 'offline' }
          }));
          return { ...newSource, status: 'offline' as const };
        }
      } catch (err) {
        dispatch(updateSourceLocal({
          id: newSource.id,
          updates: { status: 'offline' }
        }));
        return { ...newSource, status: 'offline' as const };
      }
    }

    if (type === 'hf_dataset' && datasetId) {
      try {
        const headers: HeadersInit = {};
        if (hfToken) {
          headers.Authorization = `Bearer ${hfToken}`;
        }
        
        const res = await fetch(`https://huggingface.co/api/datasets/${datasetId}`, { headers });
        
        if (res.ok) {
          const data = await res.json();
          dispatch(updateSourceLocal({
            id: newSource.id,
            updates: {
              status: 'online',
              fileCount: data.siblings?.filter((s: any) => s.rfilename).length || 0,
              totalSize: data.size || 0,
            }
          }));
          return {
            ...newSource,
            status: 'online' as const,
            fileCount: data.siblings?.filter((s: any) => s.rfilename).length || 0,
            totalSize: data.size || 0,
          };
        } else {
          dispatch(updateSourceLocal({
            id: newSource.id,
            updates: { status: 'offline' }
          }));
          return { ...newSource, status: 'offline' as const };
        }
      } catch (err) {
        dispatch(updateSourceLocal({
          id: newSource.id,
          updates: { status: 'offline' }
        }));
        return { ...newSource, status: 'offline' as const };
      }
    }

    dispatch(updateSourceLocal({
      id: newSource.id,
      updates: { status: 'online' }
    }));
    return { ...newSource, status: 'online' as const };
  }, [dispatch]);

  const updateSource = useCallback((id: string, updates: Partial<CloudSource>) => {
    dispatch(updateSourceLocal({ id, updates }));
  }, [dispatch]);

  const removeSource = useCallback((id: string) => {
    dispatch(removeSourceLocal(id));
    if (activeSourceId === id) {
      dispatch(setActiveSource(null));
      dispatch(setCurrentView('root'));
      dispatch(clearFiles());
    }
  }, [dispatch, activeSourceId]);

  const selectSource = useCallback((id: string) => {
    const source = sources.find(s => s.id === id);
    if (!source) return;

    dispatch(setActiveSource(id));

    if (source.type === 'telegram') {
      dispatch(setCurrentView('chats'));
    } else if (source.type === 'hf_dataset') {
      dispatch(setCurrentView('repos'));
    }
  }, [dispatch, sources]);

  const goToRoot = useCallback(() => {
    dispatch(setActiveSource(null));
    dispatch(setCurrentView('root'));
    dispatch(clearFiles());
  }, [dispatch]);

  const goToFiles = useCallback(() => {
    dispatch(setCurrentView('files'));
  }, [dispatch]);

  const goToPlayer = useCallback(() => {
    dispatch(setCurrentView('player'));
  }, [dispatch]);

  const goToRepos = useCallback(() => {
    dispatch(setCurrentView('repos'));
  }, [dispatch]);

  const getSource = useCallback((id: string) => {
    return sources.find(s => s.id === id) || null;
  }, [sources]);

  const getTelegramSources = useCallback(() => {
    return sources.filter(s => s.type === 'telegram');
  }, [sources]);

  const getHFSources = useCallback(() => {
    return sources.filter(s => s.type === 'hf_dataset');
  }, [sources]);

  const refreshSources = useCallback(async () => {
    const API_BASE = getActiveBase();
    for (const source of sources) {
      if (source.type === 'telegram' && source.sessionString) {
        try {
          const res = await fetch(`${API_BASE}/telegram/validate_session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_string: source.sessionString }),
          });
          const data = await res.json();
          if (data.valid) {
            dispatch(updateSourceLocal({ id: source.id, updates: { status: 'online' } }));
          } else {
            dispatch(updateSourceLocal({ id: source.id, updates: { status: 'offline' } }));
          }
        } catch (err) {
          dispatch(updateSourceLocal({ id: source.id, updates: { status: 'offline' } }));
        }
      }
    }
  }, [sources, dispatch]);

  return {
    sources,
    activeSource,
    activeSourceId,
    currentView,
    files,
    loading,
    error,
    addSource,
    updateSource,
    removeSource,
    selectSource,
    goToRoot,
    goToFiles,
    goToPlayer,
    goToRepos,
    getSource,
    getTelegramSources,
    getHFSources,
    refreshSources,
    syncSourcesFromFirestore,
    setFiles: (files: HFFile[]) => dispatch(setFiles(files)),
    setLoading: (loading: boolean) => dispatch(setLoading(loading)),
    setError: (error: string | null) => dispatch(setError(error)),
  };
};