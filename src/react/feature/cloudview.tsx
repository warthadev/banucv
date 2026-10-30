// src/react/feature/cloudview.tsx
import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@redux/store';
import {
  setSelectedRepo as setSelectedRepoRedux,
  setSelectedRepoType as setSelectedRepoTypeRedux,
  setCurrentPath as setCurrentPathRedux,
  setHfView as setHfViewRedux,
  setSelectedFileId,
  setSelectedChatId,
  addSourceLocal,
} from '@redux/cloudslice';
import { useTelegram } from '@hook/usetelegram';
import { useScreenSize } from '@hook/usescreensize';
import { useCloudSource, generateUniqueName, clearAllHFSessions } from '@hook/usecloudsource';
import { useTelegramAuth } from '@hook/usetelegramauth';
import { useHFDataset, type HFRepo, type HFFolderStructure } from '@hook/usehfdataset';
import { CloudViewPack } from './cloudviewuipack';
import { MediaRenderModal } from '@system/mediarendermodal';
import { downloadMediaWithName } from '@system/mediarendermodal';
import { CloudModalTele } from './cloudmodaltele';
import CloudRoot from './cloudroot';
import CloudSlideshow, { type SlideItem } from './cloudslideshow';
import CloudPlaylist, { type PlaylistTrack } from './cloudplaylist';
import { useAudio } from '@hook/useaudio';
import { getAuth, getDb } from '@config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import Loading from '@control/loading';
import { SAME_ACCOUNT_ID } from './cloudmodalselection';
import type { TransferAccount, TransferRepo } from './cloudmodalselection';
import type { HFSearchRepo } from './cloudmodalhfsrch';
import type { HFBulkContext, NavSnapshot } from '@config/cloudviewtypes';
import {
  HF_SIDEBAR_WIDTH_KEY,
  HF_VIEW_MODE_KEY,
  HF_SORT_FIELD_KEY,
  HF_SORT_DIR_KEY,
  HF_SORT_FIELDS,
  HF_SIDEBAR_DEFAULT_WIDTH,
  HF_SIDEBAR_MIN_WIDTH,
  HF_SIDEBAR_MAX_WIDTH,
  THUMB_PREFIX,
  areSnapshotsEqual,
  safeDecodeFilename,
} from '@config/cloudviewhelper';
import {
  hfBackendMove,
  hfBackendMoveBulk,
  hfBackendRenameFolder,
  hfBackendDelete,
  hfBackendDeleteFolder,
  hfBackendListFolders,
  hfBackendCrossCopy,
  hfBackendRenameRepo,
  hfBackendDeleteRepo,
  hfBackendCreateRepo,
  hfBackendSquashHistory,
  hfBackendUpdateRepoVisibility,
} from '@config/cloudviewapi';

const CloudView: React.FC = () => {
  const dispatch = useDispatch();
  const reduxSelectedRepo = useSelector((state: RootState) => state.cloud.selectedRepo);
  const reduxSelectedRepoType = useSelector((state: RootState) => state.cloud.selectedRepoType);
  const reduxCurrentPath = useSelector((state: RootState) => state.cloud.currentPath);
  const reduxHfView = useSelector((state: RootState) => state.cloud.hfView);
  const reduxSelectedFileId = useSelector((state: RootState) => state.cloud.selectedFileId);

  const { pauseBackgroundMusic, resumeBackgroundMusic } = useAudio();

  const {
    sources,
    activeSource,
    currentView,
    selectSource,
    goToRoot,
    addSource,
    removeSource,
    syncSourcesFromFirestore,
  } = useCloudSource();

  const { saveSession, clearAllTelegramSessions } = useTelegramAuth();
  const hfHook = useHFDataset();

  const [hfRepos, setHfRepos] = useState<HFRepo[]>([]);
  const [hfView, setHfViewState] = useState<'repos' | 'files'>(reduxHfView);
  const [selectedRepo, setSelectedRepoState] = useState<string>(reduxSelectedRepo);
  const [selectedRepoType, setSelectedRepoTypeState] = useState<'dataset' | 'model' | 'space' | ''>(
    reduxSelectedRepoType
  );
  const [currentPath, setCurrentPathState] = useState<string>(reduxCurrentPath);
  const [folderStructure, setFolderStructure] = useState<HFFolderStructure>({
    folders: [],
    files: [],
    totalSize: 0,
  });
  const [hfFolderDates, setHfFolderDates] = useState<Record<string, Record<string, number>>>({});
  const hfDatesFetchingRef = useRef<Set<string>>(new Set());
  const hfDatesVersionRef = useRef<Record<string, number>>({});
  const [hfLoading, setHfLoading] = useState(false);
  const [hfError, setHfError] = useState<string | null>(null);
  const [hfSelectedFile, setHfSelectedFile] = useState<any>(null);
  const [hfMobileView, setHfMobileView] = useState<'chats' | 'files' | 'player'>('chats');
  const [hfSearchQuery, setHfSearchQuery] = useState('');
  const [hfViewMode, setHfViewMode] = useState<'list' | 'grid' | 'thumbnail' | 'poster'>(() => {
    try {
      const saved = localStorage.getItem(HF_VIEW_MODE_KEY);
      return saved === 'grid' || saved === 'thumbnail' || saved === 'poster' ? saved : 'list';
    } catch {
      return 'list';
    }
  });
  const [hfSortField, setHfSortField] = useState<'name' | 'date' | 'size' | 'type'>(() => {
    try {
      const saved = localStorage.getItem(HF_SORT_FIELD_KEY);
      return (HF_SORT_FIELDS as readonly string[]).includes(saved || '')
        ? (saved as 'name' | 'date' | 'size' | 'type')
        : 'name';
    } catch {
      return 'name';
    }
  });
  const [hfSortDir, setHfSortDir] = useState<'asc' | 'desc'>(() => {
    try {
      return localStorage.getItem(HF_SORT_DIR_KEY) === 'desc' ? 'desc' : 'asc';
    } catch {
      return 'asc';
    }
  });
  const [hfShowSortMenu, setHfShowSortMenu] = useState(false);
  const [hfSidebarCollapsed, setHfSidebarCollapsed] = useState(false);
  const [hfSidebarWidth, setHfSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(HF_SIDEBAR_WIDTH_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= HF_SIDEBAR_MIN_WIDTH && parsed <= HF_SIDEBAR_MAX_WIDTH) {
          return parsed;
        }
      }
    } catch {}
    return HF_SIDEBAR_DEFAULT_WIDTH;
  });
  const [hfShowDetail, setHfShowDetail] = useState(true);
  const hfScreenSize = useScreenSize();
  const [hfTotalSize, setHfTotalSize] = useState(0);
  const [isHfInitialLoading, setIsHfInitialLoading] = useState(true);
  const [hfHasLoadedOnce, setHfHasLoadedOnce] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameTarget, setRenameTarget] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<any[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowItems, setSlideshowItems] = useState<SlideItem[]>([]);
  const [slideshowStartIndex, setSlideshowStartIndex] = useState(0);

  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([]);
  const [playlistStartIndex, setPlaylistStartIndex] = useState(0);

  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [createFolderValue, setCreateFolderValue] = useState('');

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<'move' | 'copy'>('move');
  const [transferTargets, setTransferTargets] = useState<any[]>([]);
  const [transferAccounts, setTransferAccounts] = useState<TransferAccount[]>([]);
  const [transferReposByAccount, setTransferReposByAccount] = useState<
    Record<string, TransferRepo[]>
  >({});
  const [transferReposLoading, setTransferReposLoading] = useState(false);
  const [transferReposError, setTransferReposError] = useState<string | null>(null);

  const [transferDestFoldersByRepo, setTransferDestFoldersByRepo] = useState<
    Record<string, { label: string; path: string }[]>
  >({});
  const [transferDestFoldersLoading, setTransferDestFoldersLoading] = useState(false);
  const [transferDestFoldersError, setTransferDestFoldersError] = useState<string | null>(null);

  const [repoSelectionMode, setRepoSelectionMode] = useState(false);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set());
  const [renameRepoModalOpen, setRenameRepoModalOpen] = useState(false);
  const [renameRepoValue, setRenameRepoValue] = useState('');
  const [renameRepoTarget, setRenameRepoTarget] = useState<HFRepo | null>(null);
  const [deleteRepoModalOpen, setDeleteRepoModalOpen] = useState(false);
  const [deleteRepoTargets, setDeleteRepoTargets] = useState<HFRepo[]>([]);
  const [addRepoModalOpen, setAddRepoModalOpen] = useState(false);
  const [squashRepoModalOpen, setSquashRepoModalOpen] = useState(false);
  const [squashRepoTargets, setSquashRepoTargets] = useState<HFRepo[]>([]);
  const [visibilityRepoModalOpen, setVisibilityRepoModalOpen] = useState(false);
  const [visibilityRepoTarget, setVisibilityRepoTarget] = useState<HFRepo | null>(null);

  const [isPublicView, setIsPublicView] = useState(false);
  const [publicRepo, setPublicRepo] = useState<HFSearchRepo | null>(null);

  const [watchExternalOpen, setWatchExternalOpen] = useState(false);
  const [watchExternalFile, setWatchExternalFile] = useState<{ url: string; name: string } | null>(
    null
  );

  const hfSortMenuRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef<string>('');
  const folderLoadedRef = useRef<string>('');
  const isFetchingRef = useRef<boolean>(false);
  const isFetchingReposRef = useRef<boolean>(false);
  const hfFileRestoreDoneRef = useRef<boolean>(!reduxSelectedFileId);
  const hfAdaptedItemsRef = useRef<any[]>([]);
  const transferReposCacheRef = useRef<Record<string, TransferRepo[]>>({});
  const transferDestFoldersCacheRef = useRef<Record<string, { label: string; path: string }[]>>({});

  const isNavigatingFromHistoryRef = useRef<boolean>(false);
  const pendingRestoreRef = useRef<NavSnapshot | null>(null);
  const lastHistorySnapshotRef = useRef<NavSnapshot | null>(null);
  const historyInitializedRef = useRef<boolean>(false);
  const historyDepthRef = useRef<number>(0);
  const telegramHookRef = useRef<any>(null);
  const overlayOpenRef = useRef<boolean>(false);

  const activeSourceId = activeSource?.id || null;
  const activeSourceType = activeSource?.type || null;
  const activeSourceSession = activeSource?.sessionString || null;
  const activeSourceDatasetId = activeSource?.datasetId || null;
  const activeSourceHfToken = activeSource?.hfToken || null;

  const telegramHook = useTelegram(activeSourceType === 'telegram' ? activeSourceSession : null);
  telegramHookRef.current = telegramHook;
  overlayOpenRef.current =
    selectionMode ||
    deleteModalOpen ||
    renameModalOpen ||
    createFolderModalOpen ||
    transferModalOpen ||
    repoSelectionMode ||
    deleteRepoModalOpen ||
    renameRepoModalOpen ||
    squashRepoModalOpen ||
    addRepoModalOpen ||
    visibilityRepoModalOpen ||
    slideshowOpen ||
    playlistOpen;

  useEffect(() => {
    if (hfSelectedFile || telegramHook.selectedFile || playlistOpen) {
      pauseBackgroundMusic();
    } else {
      resumeBackgroundMusic();
    }
  }, [
    hfSelectedFile,
    telegramHook.selectedFile,
    playlistOpen,
    pauseBackgroundMusic,
    resumeBackgroundMusic,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(HF_SIDEBAR_WIDTH_KEY, String(hfSidebarWidth));
    } catch {}
  }, [hfSidebarWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(HF_VIEW_MODE_KEY, hfViewMode);
    } catch {}
  }, [hfViewMode]);

  useEffect(() => {
    try {
      localStorage.setItem(HF_SORT_FIELD_KEY, hfSortField);
      localStorage.setItem(HF_SORT_DIR_KEY, hfSortDir);
    } catch {}
  }, [hfSortField, hfSortDir]);

  useEffect(() => {
    if (!selectionMode) {
      setSelectedIds(new Set());
    }
  }, [selectionMode]);

  useEffect(() => {
    if (!repoSelectionMode) {
      setSelectedRepoIds(new Set());
    }
  }, [repoSelectionMode]);

  useEffect(() => {
    if (activeSourceType === 'hf_dataset') {
      setSelectionMode(false);
      setRepoSelectionMode(false);
    }
  }, [activeSourceId, selectedRepo, currentPath, hfView, activeSourceType]);

  useEffect(() => {
    if (activeSourceType !== 'hf_dataset' || !selectionMode) return;
    const validIds = new Set(hfAdaptedItemsRef.current.map((i) => i.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [folderStructure, activeSourceType, selectionMode]);

  useEffect(() => {
    if (activeSourceType !== 'hf_dataset' || !repoSelectionMode) return;
    const validIds = new Set(hfRepos.map((r) => r.full_name));
    setSelectedRepoIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [hfRepos, activeSourceType, repoSelectionMode]);

  useEffect(() => {
    if (!bulkSuccess) return;
    const t = setTimeout(() => setBulkSuccess(null), 3500);
    return () => clearTimeout(t);
  }, [bulkSuccess]);

  useEffect(() => {
    if (!bulkError) return;
    const t = setTimeout(() => setBulkError(null), 5000);
    return () => clearTimeout(t);
  }, [bulkError]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectionMode) setSelectionMode(false);
        if (repoSelectionMode) setRepoSelectionMode(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectionMode, repoSelectionMode]);

  useEffect(() => {
    setHfViewState(reduxHfView);
  }, [reduxHfView]);

  useEffect(() => {
    setSelectedRepoState(reduxSelectedRepo);
  }, [reduxSelectedRepo]);

  useEffect(() => {
    setSelectedRepoTypeState(reduxSelectedRepoType);
  }, [reduxSelectedRepoType]);

  useEffect(() => {
    setCurrentPathState(reduxCurrentPath);
  }, [reduxCurrentPath]);

  const setHfView = useCallback(
    (view: 'repos' | 'files') => {
      setHfViewState(view);
      dispatch(setHfViewRedux(view));
    },
    [dispatch]
  );

  const setSelectedRepo = useCallback(
    (repo: string) => {
      setSelectedRepoState(repo);
      dispatch(setSelectedRepoRedux(repo));
    },
    [dispatch]
  );

  const setSelectedRepoType = useCallback(
    (type: 'dataset' | 'model' | 'space' | '') => {
      setSelectedRepoTypeState(type);
      dispatch(setSelectedRepoTypeRedux(type));
    },
    [dispatch]
  );

  const setCurrentPath = useCallback(
    (path: string) => {
      setCurrentPathState(path);
      dispatch(setCurrentPathRedux(path));
    },
    [dispatch]
  );

  const buildSnapshot = useCallback(
    (overrides: Partial<NavSnapshot> = {}): NavSnapshot => {
      return {
        sourceId: activeSourceId,
        sourceType: activeSourceType as 'telegram' | 'hf_dataset' | null,
        hfView: hfView,
        repo: selectedRepo,
        repoType: selectedRepoType,
        path: currentPath,
        fileId: hfSelectedFile
          ? hfSelectedFile.id
          : telegramHook.selectedFile
            ? String(telegramHook.selectedFile.id)
            : null,
        chatId: telegramHook.selectedChat ? String(telegramHook.selectedChat.id) : null,
        mobileView: hfMobileView,
        isPublic: isPublicView,
        ...overrides,
      };
    },
    [
      activeSourceId,
      activeSourceType,
      hfView,
      selectedRepo,
      selectedRepoType,
      currentPath,
      hfSelectedFile,
      telegramHook.selectedFile,
      telegramHook.selectedChat,
      hfMobileView,
      isPublicView,
    ]
  );

  const restoreSnapshot = useCallback(
    (snapshot: NavSnapshot) => {
      pendingRestoreRef.current = snapshot;
      isNavigatingFromHistoryRef.current = true;

      const sourceChanged = snapshot.sourceId !== activeSourceId;

      if (sourceChanged) {
        hasLoadedRef.current = '';
        isFetchingReposRef.current = false;
        folderLoadedRef.current = '';
        isFetchingRef.current = false;
        hfAdaptedItemsRef.current = [];
        transferReposCacheRef.current = {};
        transferDestFoldersCacheRef.current = {};
        setIsHfInitialLoading(true);
        setHfHasLoadedOnce(false);
        setSelectionMode(false);
        setRepoSelectionMode(false);

        if (snapshot.sourceId) {
          selectSource(snapshot.sourceId);
        } else {
          goToRoot();
        }
      }

      if (snapshot.sourceType === 'hf_dataset') {
        folderLoadedRef.current = '';
        isFetchingRef.current = false;
        hfFileRestoreDoneRef.current = !snapshot.fileId;

        setSelectedRepo(snapshot.repo || '');
        setSelectedRepoType(snapshot.repoType || '');
        setCurrentPath(snapshot.path || '');
        setHfView(snapshot.hfView || 'repos');

        if (snapshot.fileId && snapshot.hfView === 'files') {
          setHfSelectedFile(null);
          dispatch(setSelectedFileId(snapshot.fileId));
        } else {
          setHfSelectedFile(null);
          dispatch(setSelectedFileId(null));
        }

        setHfMobileView(snapshot.mobileView || 'chats');
        setSelectionMode(false);
        return;
      }

      if (snapshot.sourceType === 'telegram') {
        const tg = telegramHookRef.current;
        const curFileId = tg?.selectedFile ? String(tg.selectedFile.id) : null;
        const curChatId = tg?.selectedChat ? String(tg.selectedChat.id) : null;

        if (curFileId && snapshot.fileId !== curFileId) {
          tg?.handleBackToFiles?.();
        }
        if (curChatId && snapshot.chatId !== curChatId && !snapshot.chatId) {
          tg?.handleBackToChats?.();
        } else if (!curChatId && snapshot.chatId) {
          const dialog = tg?.dialogs?.find((d: any) => String(d.id) === snapshot.chatId);
          if (dialog) tg?.handleChatClick?.(dialog);
        }

        dispatch(setSelectedChatId(snapshot.chatId || null));
        dispatch(setSelectedFileId(snapshot.fileId || null));

        pendingRestoreRef.current = null;
        isNavigatingFromHistoryRef.current = false;
        lastHistorySnapshotRef.current = snapshot;
        return;
      }

      if (!snapshot.sourceId) {
        setSelectedRepo('');
        setSelectedRepoType('');
        setCurrentPath('');
        setHfView('repos');
        setHfSelectedFile(null);
        setHfMobileView('chats');
        setSelectionMode(false);
        setRepoSelectionMode(false);
        dispatch(setSelectedFileId(null));
        dispatch(setSelectedChatId(null));
      }
    },
    [
      activeSourceId,
      selectSource,
      goToRoot,
      setSelectedRepo,
      setSelectedRepoType,
      setCurrentPath,
      setHfView,
      dispatch,
    ]
  );

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const snapshot = event.state as NavSnapshot | null;
      historyDepthRef.current = Math.max(0, historyDepthRef.current - 1);

      if (overlayOpenRef.current) {
        setSelectionMode(false);
        setDeleteModalOpen(false);
        setRenameModalOpen(false);
        setCreateFolderModalOpen(false);
        setTransferModalOpen(false);
        setRepoSelectionMode(false);
        setDeleteRepoModalOpen(false);
        setRenameRepoModalOpen(false);
        setVisibilityRepoModalOpen(false);
        setSquashRepoModalOpen(false);
        setAddRepoModalOpen(false);
        setSlideshowOpen(false);
        setPlaylistOpen(false);
        try {
          window.history.pushState(lastHistorySnapshotRef.current, '');
          historyDepthRef.current += 1;
        } catch {
          void 0;
        }
        return;
      }

      if (!snapshot) {
        if (historyInitializedRef.current) {
          pendingRestoreRef.current = null;
          isNavigatingFromHistoryRef.current = false;
          handleBackToRootInternal();
        }
        return;
      }

      if (areSnapshotsEqual(snapshot, buildSnapshot())) {
        isNavigatingFromHistoryRef.current = false;
        pendingRestoreRef.current = null;
        return;
      }

      restoreSnapshot(snapshot);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [restoreSnapshot, buildSnapshot]);

  useEffect(() => {
    if (historyInitializedRef.current) return;
    historyInitializedRef.current = true;
    const initial = buildSnapshot();
    lastHistorySnapshotRef.current = initial;
    try {
      window.history.replaceState(initial, '');
    } catch {
      void 0;
    }
  }, [buildSnapshot]);

  useEffect(() => {
    if (!historyInitializedRef.current) return;

    const snapshot = buildSnapshot();
    const last = lastHistorySnapshotRef.current;

    if (areSnapshotsEqual(snapshot, last)) {
      return;
    }

    if (isNavigatingFromHistoryRef.current) {
      if (pendingRestoreRef.current && areSnapshotsEqual(snapshot, pendingRestoreRef.current)) {
        lastHistorySnapshotRef.current = snapshot;
        try {
          window.history.replaceState(snapshot, '');
        } catch {
          void 0;
        }
      }
      return;
    }

    lastHistorySnapshotRef.current = snapshot;
    try {
      window.history.pushState(snapshot, '');
      historyDepthRef.current += 1;
    } catch {
      void 0;
    }
  }, [
    activeSourceId,
    activeSourceType,
    hfView,
    selectedRepo,
    selectedRepoType,
    currentPath,
    hfSelectedFile,
    telegramHook.selectedFile,
    telegramHook.selectedChat,
    hfMobileView,
    isPublicView,
    buildSnapshot,
  ]);

  useEffect(() => {
    if (!isNavigatingFromHistoryRef.current) return;
    if (!pendingRestoreRef.current) {
      isNavigatingFromHistoryRef.current = false;
      return;
    }
    const current = buildSnapshot();
    if (areSnapshotsEqual(current, pendingRestoreRef.current)) {
      pendingRestoreRef.current = null;
      isNavigatingFromHistoryRef.current = false;
      lastHistorySnapshotRef.current = current;
      try {
        window.history.replaceState(current, '');
      } catch {
        void 0;
      }
    }
  }, [
    buildSnapshot,
    activeSourceId,
    activeSourceType,
    hfView,
    selectedRepo,
    selectedRepoType,
    currentPath,
    hfSelectedFile,
    telegramHook.selectedFile,
    telegramHook.selectedChat,
    hfMobileView,
    isPublicView,
  ]);

  const handleBackToRootInternal = useCallback(() => {
    sources.forEach((s) => {
      if (s.id.startsWith('public_')) {
        removeSource(s.id);
      }
    });
    hasLoadedRef.current = '';
    isFetchingReposRef.current = false;
    folderLoadedRef.current = '';
    isFetchingRef.current = false;
    hfAdaptedItemsRef.current = [];
    transferReposCacheRef.current = {};
    transferDestFoldersCacheRef.current = {};
    setIsHfInitialLoading(true);
    setHfHasLoadedOnce(false);
    setSelectionMode(false);
    setRepoSelectionMode(false);
    setSelectedRepo('');
    setSelectedRepoType('');
    setCurrentPath('');
    setHfView('repos');
    setHfSelectedFile(null);
    setHfMobileView('chats');
    setIsPublicView(false);
    setPublicRepo(null);
    dispatch(setSelectedFileId(null));
    dispatch(setSelectedChatId(null));
    goToRoot();
  }, [
    sources,
    removeSource,
    dispatch,
    goToRoot,
    setSelectedRepo,
    setSelectedRepoType,
    setCurrentPath,
    setHfView,
  ]);

  const getHFTokenFromFirestore = useCallback(async (): Promise<string | null> => {
    try {
      const auth = await getAuth();
      const user = auth.currentUser;
      if (!user) return null;

      const db = await getDb();
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const hfTokens = data.hfTokens || [];
        return hfTokens.length > 0 ? hfTokens[0] : null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }, []);

  const loadAllHFAccounts = useCallback(async (): Promise<TransferAccount[]> => {
    try {
      const auth = await getAuth();
      const user = auth.currentUser;
      if (!user) return [];

      const db = await getDb();
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return [];

      const data = userSnap.data();
      const hfUsernames: string[] = data.hfUsernames || [];
      const hfTokens: string[] = data.hfTokens || [];

      const accounts: TransferAccount[] = [];
      for (let i = 0; i < hfUsernames.length; i++) {
        const username = hfUsernames[i];
        const token = hfTokens[i];
        if (username && token) {
          accounts.push({
            id: username,
            label: username,
            username,
            token,
          });
        }
      }
      return accounts;
    } catch (error) {
      return [];
    }
  }, []);

  const fetchHfFiles = useCallback(async () => {
    if (!selectedRepo || !selectedRepoType) {
      return;
    }
    if (!isPublicView && !activeSourceDatasetId) {
      return;
    }

    const key = `${selectedRepo}-${currentPath}`;
    if (folderLoadedRef.current === key || isFetchingRef.current) {
      return;
    }

    const token = isPublicView
      ? ''
      : activeSourceHfToken || (await getHFTokenFromFirestore()) || '';
    isFetchingRef.current = true;
    setHfLoading(true);
    setHfError(null);

    try {
      const structure = await hfHook.getFolderStructure(
        selectedRepo,
        selectedRepoType,
        currentPath,
        token
      );
      setFolderStructure(structure);
      const dateKey = `${selectedRepo}:${currentPath}`;
      hfDatesVersionRef.current[dateKey] = (hfDatesVersionRef.current[dateKey] || 0) + 1;
      setHfFolderDates((prev) => {
        if (!(dateKey in prev)) return prev;
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
      setHfTotalSize(structure.totalSize);
      setHfSelectedFile(null);
      if (hfScreenSize === 'mobile') setHfMobileView('files');
      folderLoadedRef.current = key;
    } catch (err: any) {
      setHfError(err.message || 'Failed to load folder structure');
    } finally {
      setHfLoading(false);
      isFetchingRef.current = false;
    }
  }, [
    selectedRepo,
    selectedRepoType,
    currentPath,
    activeSourceDatasetId,
    activeSourceHfToken,
    hfHook,
    hfScreenSize,
    getHFTokenFromFirestore,
    isPublicView,
  ]);

  useEffect(() => {
    if (activeSourceType !== 'hf_dataset' || !selectedRepo || !selectedRepoType) return;
    if (hfSortField !== 'date' && hfScreenSize === 'mobile') return;
    if (folderStructure.folders.length + folderStructure.files.length === 0) return;
    const key = `${selectedRepo}:${currentPath}`;
    if (hfFolderDates[key] || hfDatesFetchingRef.current.has(key)) return;
    hfDatesFetchingRef.current.add(key);
    const version = hfDatesVersionRef.current[key] || 0;
    (async () => {
      let stale = false;
      try {
        const token = isPublicView
          ? ''
          : activeSourceHfToken || (await getHFTokenFromFirestore()) || '';
        const dates = await hfHook.getFolderDates(
          selectedRepo,
          selectedRepoType,
          currentPath,
          token
        );
        if ((hfDatesVersionRef.current[key] || 0) !== version) stale = true;
        else setHfFolderDates((prev) => ({ ...prev, [key]: dates }));
      } catch {
      } finally {
        hfDatesFetchingRef.current.delete(key);
        if (stale) setHfFolderDates((prev) => ({ ...prev }));
      }
    })();
  }, [
    activeSourceType,
    selectedRepo,
    selectedRepoType,
    currentPath,
    folderStructure,
    hfSortField,
    hfScreenSize,
    hfFolderDates,
    isPublicView,
    activeSourceHfToken,
    getHFTokenFromFirestore,
    hfHook,
  ]);

  const loadHfRepositories = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!isPublicView && !activeSourceDatasetId) return;

      const sourceId = activeSourceId || '';
      if (!forceRefresh && (hasLoadedRef.current === sourceId || isFetchingReposRef.current)) {
        return;
      }

      const token = isPublicView
        ? ''
        : activeSourceHfToken || (await getHFTokenFromFirestore()) || '';
      isFetchingReposRef.current = true;
      setIsHfInitialLoading(true);
      setHfLoading(true);
      setHfError(null);

      try {
        const username =
          isPublicView && publicRepo ? publicRepo.full_name.split('/')[0] : activeSourceDatasetId;
        if (!username) {
          setHfError('No account');
          return;
        }
        const repos = await hfHook.listRepositories(username, token);
        setHfRepos(repos);
        hasLoadedRef.current = sourceId;
        setHfHasLoadedOnce(true);

        if (!forceRefresh && reduxSelectedRepo && reduxSelectedRepoType) {
          const repoMissing =
            repos.length > 0 && !repos.find((r: HFRepo) => r.full_name === reduxSelectedRepo);
          if (!repoMissing) {
            setHfView('files');
            if (hfScreenSize === 'mobile') setHfMobileView('files');
          } else {
            setHfView('repos');
            setSelectedRepo('');
            setSelectedRepoType('');
            setCurrentPath('');
            setFolderStructure({ folders: [], files: [], totalSize: 0 });
            setHfSelectedFile(null);
            setHfMobileView('chats');
          }
        } else if (!forceRefresh) {
          setHfView('repos');
          setHfSelectedFile(null);
          setHfMobileView('chats');
        }
      } catch (err: any) {
        setHfError(err.message || 'Failed to load repositories');
      } finally {
        setHfLoading(false);
        setIsHfInitialLoading(false);
        isFetchingReposRef.current = false;
      }
    },
    [
      activeSourceId,
      activeSourceDatasetId,
      activeSourceHfToken,
      hfHook,
      getHFTokenFromFirestore,
      reduxSelectedRepo,
      reduxSelectedRepoType,
      hfScreenSize,
      setHfView,
      setSelectedRepo,
      setSelectedRepoType,
      setCurrentPath,
      isPublicView,
      publicRepo,
    ]
  );

  useEffect(() => {
    if (activeSourceType === 'hf_dataset' && (activeSourceDatasetId || isPublicView)) {
      loadHfRepositories();
    }
  }, [activeSourceType, activeSourceDatasetId, loadHfRepositories, isPublicView]);

  useEffect(() => {
    if (
      hfView === 'files' &&
      selectedRepo &&
      selectedRepoType &&
      (activeSourceDatasetId || isPublicView)
    ) {
      fetchHfFiles();
    }
  }, [
    hfView,
    selectedRepo,
    selectedRepoType,
    currentPath,
    activeSourceDatasetId,
    fetchHfFiles,
    isPublicView,
  ]);

  const refreshHFFilesNow = useCallback(() => {
    folderLoadedRef.current = '';
    isFetchingRef.current = false;
    hfAdaptedItemsRef.current = [];
    setTimeout(() => fetchHfFiles(), 700);
  }, [fetchHfFiles]);

  const handleSelectSource = (sourceId: string) => {
    hasLoadedRef.current = '';
    isFetchingReposRef.current = false;
    folderLoadedRef.current = '';
    isFetchingRef.current = false;
    hfAdaptedItemsRef.current = [];
    transferReposCacheRef.current = {};
    transferDestFoldersCacheRef.current = {};
    setIsHfInitialLoading(true);
    setHfHasLoadedOnce(false);
    setSelectionMode(false);
    setRepoSelectionMode(false);
    setIsPublicView(false);
    setPublicRepo(null);
    selectSource(sourceId);
  };

  const navBack = useCallback((fallback: () => void) => {
    if (historyDepthRef.current > 0) {
      window.history.back();
    } else {
      fallback();
    }
  }, []);

  const handleBackToRoot = () => {
    handleBackToRootInternal();
  };

  const handleOpenPublicRepo = useCallback(
    async (repo: HFSearchRepo) => {
      hasLoadedRef.current = '';
      isFetchingReposRef.current = false;
      folderLoadedRef.current = '';
      isFetchingRef.current = false;
      hfAdaptedItemsRef.current = [];
      transferReposCacheRef.current = {};
      transferDestFoldersCacheRef.current = {};
      setIsHfInitialLoading(true);
      setHfHasLoadedOnce(false);
      setSelectionMode(false);
      setRepoSelectionMode(false);
      setIsPublicView(true);
      setPublicRepo(repo);

      const username = repo.full_name.split('/')[0];
      const syntheticId = `public_${username}`;

      const existing = sources.find((s) => s.id === syntheticId);
      if (existing) {
        removeSource(syntheticId);
      }

      dispatch(
        addSourceLocal({
          id: syntheticId,
          type: 'hf_dataset',
          name: username,
          platform: 'Hugging Face Public',
          icon: '📁',
          status: 'online',
          datasetId: username,
          hfToken: '',
        })
      );

      selectSource(syntheticId);

      folderLoadedRef.current = '';
      isFetchingRef.current = false;
      hfAdaptedItemsRef.current = [];
      setSelectedRepo(repo.full_name);
      setSelectedRepoType(repo.type);
      setCurrentPath('');
      setHfView('files');
      setFolderStructure({ folders: [], files: [], totalSize: 0 });
      setHfSelectedFile(null);
      setHfSearchQuery('');
      setHfMobileView('files');
    },
    [
      sources,
      removeSource,
      dispatch,
      selectSource,
      setSelectedRepo,
      setSelectedRepoType,
      setCurrentPath,
      setHfView,
    ]
  );

  const handleAuthSuccess = useCallback(
    async (sessionString: string, phoneNumber: string, platform: string) => {
      const baseName = phoneNumber || 'Telegram Account';

      const uniqueName = generateUniqueName(baseName, 'telegram', sources);

      try {
        await saveSession(sessionString, uniqueName);
        await addSource(
          'telegram',
          uniqueName,
          sessionString,
          phoneNumber,
          undefined,
          undefined,
          platform
        );
        await syncSourcesFromFirestore();
      } catch (error) {}
    },
    [addSource, saveSession, syncSourcesFromFirestore, sources]
  );

  const handleClearAllSessions = useCallback(async () => {
    await clearAllTelegramSessions();
    await clearAllHFSessions();
    sources.forEach((s) => removeSource(s.id));
    hasLoadedRef.current = '';
    isFetchingReposRef.current = false;
    folderLoadedRef.current = '';
    isFetchingRef.current = false;
    hfAdaptedItemsRef.current = [];
    transferReposCacheRef.current = {};
    transferDestFoldersCacheRef.current = {};
    setSelectionMode(false);
    setRepoSelectionMode(false);
    setSelectedRepo('');
    setSelectedRepoType('');
    setCurrentPath('');
    setHfView('repos');
    setIsPublicView(false);
    setPublicRepo(null);
    goToRoot();
  }, [
    sources,
    removeSource,
    clearAllTelegramSessions,
    clearAllHFSessions,
    goToRoot,
    setSelectedRepo,
    setSelectedRepoType,
    setCurrentPath,
    setHfView,
  ]);

  const handleClearSingleSession = useCallback(async () => {
    if (!activeSource) {
      goToRoot();
      return;
    }

    const sourceId = activeSource.id;
    const sourceType = activeSource.type;
    const sessionToRemove = activeSource.sessionString;
    const datasetIdToRemove = activeSource.datasetId;

    if (!isPublicView) {
      try {
        const auth = await getAuth();
        const user = auth.currentUser;
        if (user) {
          const db = await getDb();
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const data = userSnap.data();

            if (sourceType === 'telegram' && sessionToRemove) {
              const sessions = [...(data.telegramSessions || [])];
              const accountNames = [...(data.telegramAccountNames || [])];
              const indexToRemove = sessions.indexOf(sessionToRemove);

              if (indexToRemove !== -1) {
                sessions.splice(indexToRemove, 1);
                if (accountNames[indexToRemove]) {
                  accountNames.splice(indexToRemove, 1);
                }
                await updateDoc(userRef, {
                  telegramSessions: sessions,
                  telegramAccountNames: accountNames,
                });
              }
            } else if (sourceType === 'hf_dataset' && datasetIdToRemove) {
              const hfUsernames = [...(data.hfUsernames || [])];
              const hfTokens = [...(data.hfTokens || [])];
              const indexToRemove = hfUsernames.indexOf(datasetIdToRemove);

              if (indexToRemove !== -1) {
                hfUsernames.splice(indexToRemove, 1);
                if (hfTokens[indexToRemove]) {
                  hfTokens.splice(indexToRemove, 1);
                }
                await updateDoc(userRef, {
                  hfUsernames: hfUsernames,
                  hfTokens: hfTokens,
                });
              }
            }
          }
        }
      } catch (error) {}
    }

    removeSource(sourceId);

    hasLoadedRef.current = '';
    isFetchingReposRef.current = false;
    folderLoadedRef.current = '';
    isFetchingRef.current = false;
    hfAdaptedItemsRef.current = [];
    transferReposCacheRef.current = {};
    transferDestFoldersCacheRef.current = {};
    setSelectionMode(false);
    setRepoSelectionMode(false);

    setSelectedRepo('');
    setSelectedRepoType('');
    setCurrentPath('');
    setHfView('repos');
    setIsPublicView(false);
    setPublicRepo(null);

    goToRoot();
  }, [
    activeSource,
    removeSource,
    goToRoot,
    setSelectedRepo,
    setSelectedRepoType,
    setCurrentPath,
    setHfView,
    isPublicView,
  ]);

  const handleRepoClick = (repo: HFRepo) => {
    if (repoSelectionMode) {
      toggleRepoSelection(repo);
      return;
    }

    const isSameRepo =
      hfView === 'files' && selectedRepo === repo.full_name && selectedRepoType === repo.type;

    if (isSameRepo) {
      setHfSelectedFile(null);
      setSelectionMode(false);
      setHfSearchQuery('');
      if (hfScreenSize === 'mobile') setHfMobileView('files');
      if (currentPath) {
        folderLoadedRef.current = '';
        isFetchingRef.current = false;
        hfAdaptedItemsRef.current = [];
        setCurrentPath('');
      }
      return;
    }

    folderLoadedRef.current = '';
    isFetchingRef.current = false;
    hfAdaptedItemsRef.current = [];
    setSelectedRepo(repo.full_name);
    setSelectedRepoType(repo.type);
    setCurrentPath('');
    setHfView('files');
    setFolderStructure({ folders: [], files: [], totalSize: 0 });
    setHfSelectedFile(null);
    setHfSearchQuery('');
    setSelectionMode(false);
    setHfLoading(true);
    if (hfScreenSize === 'mobile') setHfMobileView('files');
  };

  const handleBackToRepos = () => {
    folderLoadedRef.current = '';
    isFetchingRef.current = false;
    hfAdaptedItemsRef.current = [];
    setHfView('repos');
    setSelectedRepo('');
    setSelectedRepoType('');
    setCurrentPath('');
    setFolderStructure({ folders: [], files: [], totalSize: 0 });
    setHfSelectedFile(null);
    setHfMobileView('chats');
    setSelectionMode(false);
  };

  const handleBackToRepoRoot = () => {
    folderLoadedRef.current = '';
    isFetchingRef.current = false;
    hfAdaptedItemsRef.current = [];
    setCurrentPath('');
    setHfSelectedFile(null);
    setHfView('files');
    setSelectionMode(false);
    setTimeout(() => fetchHfFiles(), 50);
  };

  const handleBackToHfFiles = () => {
    setHfSelectedFile(null);
    if (hfScreenSize === 'mobile') setHfMobileView('files');
  };

  const handleGoBack = () => {
    if (hfSelectedFile) {
      handleBackToHfFiles();
      return;
    }

    if (currentPath) {
      const parts = currentPath.split('/');
      parts.pop();
      const newPath = parts.join('/');
      folderLoadedRef.current = '';
      isFetchingRef.current = false;
      hfAdaptedItemsRef.current = [];
      setCurrentPath(newPath);
      setHfSelectedFile(null);
      setTimeout(() => fetchHfFiles(), 50);
    } else {
      handleBackToRepos();
    }
  };

  const handleHfFileClick = (file: any) => {
    if (file._isFolder) {
      handleHfNavigateToFolder(file._folderName);
      return;
    }
    setHfSelectedFile(file);
    if (hfScreenSize === 'mobile') {
      setHfMobileView('player');
    }
  };

  const handleRefreshHF = () => {
    if (isFetchingRef.current) return;

    if (hfView === 'repos') {
      if (activeSourceDatasetId || isPublicView) {
        loadHfRepositories(true);
      }
    } else {
      fetchHfFiles();
    }
  };

  const handleHfNavigateToFolder = (folder: string) => {
    const newPath = currentPath ? `${currentPath}/${folder}` : folder;
    folderLoadedRef.current = '';
    isFetchingRef.current = false;
    hfAdaptedItemsRef.current = [];
    setCurrentPath(newPath);
    setHfSelectedFile(null);
    setSelectionMode(false);
    setTimeout(() => fetchHfFiles(), 50);
  };

  const handleHfNavigateToPath = (path: string) => {
    const cleanPath = path.replace(/^\/+/, '');
    folderLoadedRef.current = '';
    isFetchingRef.current = false;
    hfAdaptedItemsRef.current = [];
    setCurrentPath(cleanPath);
    setHfSelectedFile(null);
    setSelectionMode(false);
    setTimeout(() => fetchHfFiles(), 50);
  };

  const getHfMediaCategory = useCallback((ext: string): string => {
    const e = (ext || '').toLowerCase();
    if (['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', '3gp', 'ogv'].includes(e)) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus', 'wma'].includes(e)) return 'audio';
    if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'svg', 'heic', 'avif'].includes(e)) return 'image';
    if (e === 'gif') return 'gif';
    return 'document';
  }, []);

  const hfAdaptedItems = useMemo(() => {
    const items: any[] = [];
    const repoType = selectedRepoType || 'dataset';
    let repoTypePrefix = '';
    if (repoType === 'dataset') repoTypePrefix = 'datasets';
    else if (repoType === 'model') repoTypePrefix = 'models';
    else if (repoType === 'space') repoTypePrefix = 'spaces';
    else repoTypePrefix = 'models';

    const repoFullName = selectedRepo;

    const repoInfo = hfRepos.find((r) => r.full_name === selectedRepo);
    const repoLastModified = repoInfo?.last_modified;
    const fallbackDate = repoLastModified
      ? Math.floor(new Date(repoLastModified).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    const commitDates = hfFolderDates[`${selectedRepo}:${currentPath}`] || {};

    folderStructure.folders.forEach((folder) => {
      const folderFullPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
      items.push({
        id: `folder-${folderFullPath}`,
        name: folder.name,
        size: folder.size,
        file_id: `folder-${folderFullPath}`,
        media_type: 'folder',
        mime_type: '',
        caption: '',
        date: commitDates[folder.name] ?? fallbackDate,
        _isFolder: true,
        _folderName: folder.name,
        _fullPath: folderFullPath,
        _streamUrl: '',
        _folderSize: folder.size,
        _coverThumbUrl: folder.coverPath
          ? `https://huggingface.co/${repoTypePrefix}/${repoFullName}/resolve/main/${`${THUMB_PREFIX}${folder.coverPath.replace(/\.[^./\\]+$/, '')}`.split('/').map(encodeURIComponent).join('/')}.jpg`
          : undefined,
        _coverType: folder.coverPath
          ? getHfMediaCategory(folder.coverPath.split('.').pop() || '')
          : undefined,
        _coverSize: folder.coverSize || 0,
        _coverName: folder.coverPath ? folder.coverPath.split('/').pop() : undefined,
        _coverStreamUrl: folder.coverPath
          ? `https://huggingface.co/${repoTypePrefix}/${repoFullName}/resolve/main/${folder.coverPath.split('/').map(encodeURIComponent).join('/')}`
          : undefined,
      });
    });

    folderStructure.files.forEach((file) => {
      const mediaCategory = getHfMediaCategory(file.type || '');

      const rawPath = file.path || file.name;
      const encodedPath = rawPath.split('/').map(encodeURIComponent).join('/');

      const streamUrl = `https://huggingface.co/${repoTypePrefix}/${repoFullName}/resolve/main/${encodedPath}`;

      const relNoExt = rawPath.replace(/\.[^./\\]+$/, '');
      const encodedThumbPath = `${THUMB_PREFIX}${relNoExt}`
        .split('/')
        .map(encodeURIComponent)
        .join('/');
      const thumbUrl = `https://huggingface.co/${repoTypePrefix}/${repoFullName}/resolve/main/${encodedThumbPath}.jpg`;

      let fileDate: number;
      if (commitDates[file.name] !== undefined) {
        fileDate = commitDates[file.name];
      } else if (file.createdAt) {
        fileDate = Math.floor(file.createdAt.getTime() / 1000);
      } else if (repoLastModified) {
        fileDate = Math.floor(new Date(repoLastModified).getTime() / 1000);
      } else {
        fileDate = Math.floor(Date.now() / 1000);
      }

      const fileFullPath = file.path || file.name;

      items.push({
        id: `file-${repoFullName}-${fileFullPath}`,
        name: file.name,
        size: file.size || 0,
        file_id: file.id,
        media_type: mediaCategory,
        mime_type: '',
        caption: '',
        date: fileDate,
        _isFolder: false,
        _path: file.path,
        _url: file.url,
        _streamUrl: streamUrl,
        _thumbUrl: thumbUrl,
      });
    });

    hfAdaptedItemsRef.current = items;
    return items;
  }, [
    folderStructure,
    selectedRepo,
    selectedRepoType,
    hfRepos,
    getHfMediaCategory,
    currentPath,
    hfFolderDates,
  ]);

  const filteredHfItems = useMemo(
    () =>
      hfAdaptedItems.filter((item) =>
        item.name.toLowerCase().includes(hfSearchQuery.toLowerCase())
      ),
    [hfAdaptedItems, hfSearchQuery]
  );

  useEffect(() => {
    if (activeSourceType !== 'hf_dataset' || hfFileRestoreDoneRef.current) return;
    if (hfView !== 'files' || !selectedRepo || hfLoading) return;
    if (folderLoadedRef.current !== `${selectedRepo}-${currentPath}`) return;
    hfFileRestoreDoneRef.current = true;
    const file = hfAdaptedItems.find((i) => !i._isFolder && i.id === reduxSelectedFileId);
    if (file) {
      setHfSelectedFile(file);
      if (hfScreenSize === 'mobile') setHfMobileView('player');
    } else {
      dispatch(setSelectedFileId(null));
    }
  }, [
    activeSourceType,
    hfView,
    selectedRepo,
    currentPath,
    hfLoading,
    hfAdaptedItems,
    reduxSelectedFileId,
    hfScreenSize,
    dispatch,
  ]);

  useEffect(() => {
    if (activeSourceType !== 'hf_dataset' || !hfFileRestoreDoneRef.current) return;
    dispatch(setSelectedFileId(hfSelectedFile ? hfSelectedFile.id : null));
  }, [hfSelectedFile, activeSourceType, dispatch]);

  const sortedHfItems = useMemo(() => {
    return [...filteredHfItems].sort((a, b) => {
      if (a._isFolder && !b._isFolder) return -1;
      if (!a._isFolder && b._isFolder) return 1;
      let cmp = 0;
      if (hfSortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (hfSortField === 'size') cmp = (a.size || 0) - (b.size || 0);
      else if (hfSortField === 'type') cmp = (a.media_type || '').localeCompare(b.media_type || '');
      else if (hfSortField === 'date') cmp = (a.date || 0) - (b.date || 0);
      return hfSortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredHfItems, hfSortField, hfSortDir]);

  const toggleHfSort = (field: 'name' | 'date' | 'size' | 'type') => {
    if (hfSortField === field) {
      setHfSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setHfSortField(field);
      setHfSortDir('asc');
    }
    setHfShowSortMenu(false);
  };

  const cycleHfViewMode = () => {
    setHfViewMode((prev) =>
      prev === 'list'
        ? 'grid'
        : prev === 'grid'
          ? 'thumbnail'
          : prev === 'thumbnail'
            ? 'poster'
            : 'list'
    );
  };

  const getHfStreamUrl = useCallback((_chatId: number, msgId: number) => {
    const file = hfAdaptedItemsRef.current.find((f) => f.id === String(msgId));
    if (file && file._streamUrl && file._streamUrl.length > 0) {
      return file._streamUrl;
    }
    return '';
  }, []);

  const handleHfDownload = useCallback(
    async (_chatId: number, msgId: number, filename: string) => {
      const file = hfAdaptedItemsRef.current.find((f) => f.id === String(msgId));
      if (!file || !file._streamUrl) return;

      const token = isPublicView ? '' : activeSourceHfToken || '';
      const cleanName = safeDecodeFilename(filename || file.name || '');

      try {
        await downloadMediaWithName({ name: cleanName, url: file._streamUrl }, token || undefined);
      } catch (err) {
        console.error('Download failed:', err);
      }
    },
    [activeSourceHfToken, isPublicView]
  );

  const enterSelectionMode = useCallback((item: any) => {
    setSelectionMode(true);
    setSelectedIds(new Set([item.id]));
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = useCallback((item: any) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, []);

  const selectAllHF = useCallback(() => {
    const allIds = sortedHfItems.map((i) => i.id);
    setSelectedIds(new Set(allIds));
  }, [sortedHfItems]);

  const deselectAllHF = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedItems = useMemo(() => {
    return hfAdaptedItems.filter((item) => selectedIds.has(item.id));
  }, [hfAdaptedItems, selectedIds]);

  const moveDisabledPaths = useMemo(() => {
    return selectedItems
      .filter((i) => i._isFolder)
      .map((i) => (i._fullPath || i.name).replace(/^\/+|\/+$/g, ''))
      .filter(Boolean);
  }, [selectedItems]);

  const transferDisabledPaths = moveDisabledPaths;

  const canRename = useMemo(() => {
    if (selectedItems.length !== 1) return false;
    return true;
  }, [selectedItems]);

  const canMove = useMemo(() => {
    if (selectedItems.length === 0) return false;
    if (isPublicView) return true;
    if (!activeSourceHfToken) return false;
    if (!selectedRepo) return false;
    if (!selectedRepoType) return false;
    return true;
  }, [selectedItems, activeSourceHfToken, selectedRepo, selectedRepoType, isPublicView]);

  const canDelete = selectedItems.length >= 1;

  const canWatchExternal = useMemo(() => {
    if (selectedItems.length !== 1) return false;
    const item = selectedItems[0];
    if (item._isFolder) return false;
    return ['video', 'audio'].includes(item.media_type);
  }, [selectedItems]);

  const slideshowKind = useMemo<'image' | 'audio'>(() => {
    if (
      selectedItems.length > 0 &&
      selectedItems.every((i) => !i._isFolder && i.media_type === 'audio')
    ) {
      return 'audio';
    }
    return 'image';
  }, [selectedItems]);

  const canSlideshow = useMemo(() => {
    if (selectedItems.length === 0) return false;
    if (selectedItems.some((i) => i._isFolder)) return false;
    if (slideshowKind === 'audio') return selectedItems.length >= 2;
    return selectedItems.every((i) => i.media_type === 'image');
  }, [selectedItems, slideshowKind]);

  const handleSlideshow = useCallback(() => {
    if (selectedItems.length === 0) return;
    const sortOrder = new Map<string, number>(sortedHfItems.map((it, idx) => [it.id, idx]));
    const orderOf = (id: string) => sortOrder.get(id) ?? Number.MAX_SAFE_INTEGER;

    if (slideshowKind === 'audio') {
      const songs = selectedItems
        .filter((i) => !i._isFolder && i.media_type === 'audio' && i._streamUrl)
        .sort((a, b) => orderOf(a.id) - orderOf(b.id));
      if (songs.length === 0) return;

      const tokenForTracks = isPublicView ? undefined : activeSourceHfToken || undefined;
      const tracks: PlaylistTrack[] = songs.map((i) => ({
        id: i.id,
        name: i.name,
        url: i._streamUrl,
        thumbUrl: i._thumbUrl,
        token: tokenForTracks,
      }));

      setPlaylistTracks(tracks);
      setPlaylistStartIndex(0);
      setPlaylistOpen(true);
      return;
    }

    const imgs = selectedItems
      .filter((i) => !i._isFolder && i.media_type === 'image')
      .sort((a, b) => orderOf(a.id) - orderOf(b.id));
    if (imgs.length === 0) return;

    const tokenForSlides = isPublicView ? undefined : activeSourceHfToken || undefined;

    const items: SlideItem[] = imgs.map((i) => ({
      id: i.id,
      name: i.name,
      url: i._streamUrl,
      thumbUrl: i._thumbUrl,
      token: tokenForSlides,
    }));

    setSlideshowItems(items);
    setSlideshowStartIndex(0);
    setSlideshowOpen(true);
  }, [selectedItems, slideshowKind, sortedHfItems, activeSourceHfToken, isPublicView]);

  const handleWatchExternal = useCallback(() => {
    if (selectedItems.length !== 1) return;
    const item = selectedItems[0];
    if (item._isFolder) return;
    if (!['video', 'audio'].includes(item.media_type)) return;
    if (!item._streamUrl) return;
    setWatchExternalFile({ url: item._streamUrl, name: item.name });
    setWatchExternalOpen(true);
  }, [selectedItems]);

  const enterRepoSelectionMode = useCallback((repo: HFRepo) => {
    setRepoSelectionMode(true);
    setSelectedRepoIds(new Set([repo.full_name]));
  }, []);

  const exitRepoSelectionMode = useCallback(() => {
    setRepoSelectionMode(false);
    setSelectedRepoIds(new Set());
  }, []);

  const toggleRepoSelection = useCallback((repo: HFRepo) => {
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      if (next.has(repo.full_name)) {
        next.delete(repo.full_name);
      } else {
        next.add(repo.full_name);
      }
      return next;
    });
  }, []);

  const selectAllRepos = useCallback(() => {
    const allIds = hfRepos.map((r) => r.full_name);
    setSelectedRepoIds(new Set(allIds));
  }, [hfRepos]);

  const deselectAllRepos = useCallback(() => {
    setSelectedRepoIds(new Set());
  }, []);

  const selectedRepos = useMemo(() => {
    return hfRepos.filter((r) => selectedRepoIds.has(r.full_name));
  }, [hfRepos, selectedRepoIds]);

  const canRenameRepo = useMemo(() => {
    return selectedRepos.length === 1;
  }, [selectedRepos]);

  const canDeleteRepo = useMemo(() => {
    return selectedRepos.length >= 1;
  }, [selectedRepos]);

  const canSquashRepo = useMemo(() => {
    return selectedRepos.length >= 1;
  }, [selectedRepos]);

  const canUpdateVisibilityRepo = useMemo(() => {
    return selectedRepos.length === 1;
  }, [selectedRepos]);

  const selectedRepoPrivate = useMemo(() => {
    return selectedRepos.length === 1 ? !!selectedRepos[0].private : null;
  }, [selectedRepos]);

  const openRenameModal = useCallback(() => {
    if (selectedItems.length !== 1) return;
    const item = selectedItems[0];
    setRenameTarget(item);
    setRenameValue(item.name);
    setRenameModalOpen(true);
  }, [selectedItems]);

  const closeRenameModal = useCallback(() => {
    setRenameModalOpen(false);
    setRenameTarget(null);
    setRenameValue('');
  }, []);

  const openTransferFlow = useCallback(
    async (mode: 'move' | 'copy') => {
      if (selectedItems.length === 0) return;
      const accounts = await loadAllHFAccounts();
      if (isPublicView && accounts.length === 0) {
        setBulkError('No Hugging Face account connected. Add one in Cloud Manager first.');
        return;
      }
      setTransferMode(mode);
      setTransferAccounts(accounts);
      setTransferReposByAccount({});
      setTransferReposError(null);
      setTransferDestFoldersByRepo({});
      setTransferDestFoldersError(null);
      transferReposCacheRef.current = {};
      transferDestFoldersCacheRef.current = {};
      setTransferTargets(selectedItems);
      setTransferModalOpen(true);
    },
    [selectedItems, loadAllHFAccounts, isPublicView]
  );

  const openMoveModal = useCallback(() => {
    void openTransferFlow('move');
  }, [openTransferFlow]);

  const openCopyModal = useCallback(() => {
    void openTransferFlow('copy');
  }, [openTransferFlow]);

  const openDeleteModal = useCallback(() => {
    if (selectedItems.length === 0) return;
    setDeleteTargets(selectedItems);
    setDeleteModalOpen(true);
  }, [selectedItems]);

  const closeDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
    setDeleteTargets([]);
  }, []);

  const openCreateFolderModal = useCallback(() => {
    setCreateFolderValue('');
    setCreateFolderModalOpen(true);
  }, []);

  const closeCreateFolderModal = useCallback(() => {
    setCreateFolderModalOpen(false);
    setCreateFolderValue('');
  }, []);

  const openRenameRepoModal = useCallback(() => {
    if (selectedRepos.length !== 1) return;
    const repo = selectedRepos[0];
    setRenameRepoTarget(repo);
    setRenameRepoValue(repo.name);
    setRenameRepoModalOpen(true);
  }, [selectedRepos]);

  const closeRenameRepoModal = useCallback(() => {
    setRenameRepoModalOpen(false);
    setRenameRepoTarget(null);
    setRenameRepoValue('');
  }, []);

  const openDeleteRepoModal = useCallback(() => {
    if (selectedRepos.length === 0) return;
    setDeleteRepoTargets(selectedRepos);
    setDeleteRepoModalOpen(true);
  }, [selectedRepos]);

  const closeDeleteRepoModal = useCallback(() => {
    setDeleteRepoModalOpen(false);
    setDeleteRepoTargets([]);
  }, []);

  const openAddRepoModal = useCallback(() => {
    setAddRepoModalOpen(true);
  }, []);

  const closeAddRepoModal = useCallback(() => {
    setAddRepoModalOpen(false);
  }, []);

  const openSquashRepoModal = useCallback(() => {
    if (selectedRepos.length === 0) return;
    setSquashRepoTargets(selectedRepos);
    setSquashRepoModalOpen(true);
  }, [selectedRepos]);

  const closeSquashRepoModal = useCallback(() => {
    setSquashRepoModalOpen(false);
    setSquashRepoTargets([]);
  }, []);

  const openVisibilityRepoModal = useCallback(() => {
    if (selectedRepos.length !== 1) return;
    setVisibilityRepoTarget(selectedRepos[0]);
    setVisibilityRepoModalOpen(true);
  }, [selectedRepos]);

  const closeVisibilityRepoModal = useCallback(() => {
    setVisibilityRepoModalOpen(false);
    setVisibilityRepoTarget(null);
  }, []);

  const getBulkContext = useCallback(async (): Promise<HFBulkContext | null> => {
    if (!selectedRepo || !selectedRepoType) return null;
    if (isPublicView) {
      return {
        repoId: selectedRepo,
        repoType: selectedRepoType as 'dataset' | 'model' | 'space',
        token: '',
      };
    }
    const token = activeSourceHfToken || (await getHFTokenFromFirestore()) || '';
    if (!token) return null;
    return {
      repoId: selectedRepo,
      repoType: selectedRepoType as 'dataset' | 'model' | 'space',
      token,
    };
  }, [selectedRepo, selectedRepoType, activeSourceHfToken, getHFTokenFromFirestore, isPublicView]);

  const executeCreateFolder = useCallback(async () => {
    if (!createFolderValue.trim()) {
      closeCreateFolderModal();
      return;
    }
    if (!selectedRepo || !selectedRepoType) {
      setBulkError('No repository selected');
      closeCreateFolderModal();
      return;
    }

    const token = activeSourceHfToken || (await getHFTokenFromFirestore()) || '';
    if (!token) {
      setBulkError('No Hugging Face token available');
      closeCreateFolderModal();
      return;
    }

    const folderName = createFolderValue.trim().replace(/^\/+|\/+$/g, '');
    if (!folderName) {
      closeCreateFolderModal();
      return;
    }

    const fullPath = currentPath ? `${currentPath}/${folderName}` : folderName;

    setBulkActionLoading(true);

    try {
      const result = await hfHook.createFolder(selectedRepo, selectedRepoType, fullPath, token);

      if (result.ok) {
        setBulkSuccess(`Folder "${folderName}" created`);
        closeCreateFolderModal();
        refreshHFFilesNow();
      } else {
        setBulkError(result.error || 'Failed to create folder');
      }
    } catch (err: any) {
      setBulkError(err.message || 'Failed to create folder');
    } finally {
      setBulkActionLoading(false);
    }
  }, [
    createFolderValue,
    selectedRepo,
    selectedRepoType,
    currentPath,
    activeSourceHfToken,
    getHFTokenFromFirestore,
    hfHook,
    closeCreateFolderModal,
    refreshHFFilesNow,
  ]);

  const closeTransferModal = useCallback(() => {
    setTransferModalOpen(false);
    setTransferTargets([]);
    setTransferReposByAccount({});
    setTransferReposError(null);
    setTransferDestFoldersByRepo({});
    setTransferDestFoldersError(null);
    transferReposCacheRef.current = {};
    transferDestFoldersCacheRef.current = {};
  }, []);

  const fetchReposForAccount = useCallback(
    async (accountId: string) => {
      const cached = transferReposCacheRef.current[accountId];
      if (cached) {
        setTransferReposByAccount((prev) => ({ ...prev, [accountId]: cached }));
        return;
      }

      let accountUsername: string;
      let accountToken: string;

      if (accountId === SAME_ACCOUNT_ID) {
        if (!activeSourceDatasetId || !activeSourceHfToken) {
          setTransferReposError('Source account not available');
          return;
        }
        accountUsername = activeSourceDatasetId;
        accountToken = activeSourceHfToken;
      } else {
        const account = transferAccounts.find((a) => a.id === accountId);
        if (!account) {
          setTransferReposError('Account not found');
          return;
        }
        accountUsername = account.username;
        accountToken = account.token;
      }

      setTransferReposLoading(true);
      setTransferReposError(null);

      try {
        const res = await fetch(
          `https://huggingface.co/api/datasets?author=${encodeURIComponent(accountUsername)}&limit=100`,
          {
            headers: { Authorization: `Bearer ${accountToken}` },
          }
        );

        const datasets: any[] = res.ok ? await res.json() : [];

        const modelsRes = await fetch(
          `https://huggingface.co/api/models?author=${encodeURIComponent(accountUsername)}&limit=100`,
          {
            headers: { Authorization: `Bearer ${accountToken}` },
          }
        );
        const models: any[] = modelsRes.ok ? await modelsRes.json() : [];

        const spacesRes = await fetch(
          `https://huggingface.co/api/spaces?author=${encodeURIComponent(accountUsername)}&limit=100`,
          {
            headers: { Authorization: `Bearer ${accountToken}` },
          }
        );
        const spaces: any[] = spacesRes.ok ? await spacesRes.json() : [];

        const repos: TransferRepo[] = [];

        if (Array.isArray(datasets)) {
          for (const ds of datasets) {
            repos.push({
              id: ds.id,
              label: `${ds.id} (dataset)`,
              type: 'dataset',
            });
          }
        }
        if (Array.isArray(models)) {
          for (const model of models) {
            repos.push({
              id: model.id,
              label: `${model.id} (model)`,
              type: 'model',
            });
          }
        }
        if (Array.isArray(spaces)) {
          for (const space of spaces) {
            repos.push({
              id: space.id,
              label: `${space.id} (space)`,
              type: 'space',
            });
          }
        }

        transferReposCacheRef.current[accountId] = repos;
        setTransferReposByAccount((prev) => ({ ...prev, [accountId]: repos }));
      } catch (err: any) {
        setTransferReposError(err?.message || 'Failed to load repositories');
      } finally {
        setTransferReposLoading(false);
      }
    },
    [transferAccounts, activeSourceDatasetId, activeSourceHfToken]
  );

  const fetchDestFoldersForTransfer = useCallback(
    async (accountId: string, repoId: string) => {
      const cacheKey = `${accountId}:${repoId}`;
      const cached = transferDestFoldersCacheRef.current[cacheKey];
      if (cached) {
        setTransferDestFoldersByRepo((prev) => ({ ...prev, [cacheKey]: cached }));
        return;
      }

      let accountToken: string;
      let repoType: 'dataset' | 'model' | 'space';

      if (accountId === SAME_ACCOUNT_ID) {
        if (!activeSourceHfToken) {
          setTransferDestFoldersError('Source token not available');
          return;
        }
        accountToken = activeSourceHfToken;
        const repo = (transferReposByAccount[SAME_ACCOUNT_ID] || []).find((r) => r.id === repoId);
        repoType =
          repo?.type ||
          (repoId === selectedRepo
            ? (selectedRepoType as 'dataset' | 'model' | 'space')
            : 'dataset');
      } else {
        const account = transferAccounts.find((a) => a.id === accountId);
        if (!account) {
          setTransferDestFoldersError('Account not found');
          return;
        }
        accountToken = account.token;
        const repo = (transferReposByAccount[accountId] || []).find((r) => r.id === repoId);
        repoType = repo?.type || 'dataset';
      }

      setTransferDestFoldersLoading(true);
      setTransferDestFoldersError(null);

      try {
        const result = await hfBackendListFolders(repoId, repoType, accountToken);
        if (result.ok) {
          const folders: string[] = result.data?.folders || [];
          const options: { label: string; path: string }[] = [{ label: 'Root (/)', path: '' }];
          folders.forEach((folder) => {
            const clean = folder.replace(/^\/+/, '');
            const lower = clean.toLowerCase();
            if (lower === 'thumbs' || lower.startsWith('thumbs/')) return;
            if (clean && !options.some((o) => o.path === clean)) {
              options.push({ label: `/${clean}`, path: clean });
            }
          });
          transferDestFoldersCacheRef.current[cacheKey] = options;
          setTransferDestFoldersByRepo((prev) => ({ ...prev, [cacheKey]: options }));
        } else {
          setTransferDestFoldersError(result.error || 'Failed to load folders');
          const fallback = [{ label: 'Root (/)', path: '' }];
          transferDestFoldersCacheRef.current[cacheKey] = fallback;
          setTransferDestFoldersByRepo((prev) => ({ ...prev, [cacheKey]: fallback }));
        }
      } catch (err: any) {
        setTransferDestFoldersError(err?.message || 'Failed to load folders');
        const fallback = [{ label: 'Root (/)', path: '' }];
        transferDestFoldersCacheRef.current[cacheKey] = fallback;
        setTransferDestFoldersByRepo((prev) => ({ ...prev, [cacheKey]: fallback }));
      } finally {
        setTransferDestFoldersLoading(false);
      }
    },
    [transferAccounts, transferReposByAccount, activeSourceHfToken, selectedRepo, selectedRepoType]
  );

  const executeRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) {
      closeRenameModal();
      return;
    }
    const newName = renameValue.trim();
    if (newName === renameTarget.name) {
      closeRenameModal();
      return;
    }
    const ctx = await getBulkContext();
    if (!ctx) {
      setBulkError('No token available for rename');
      closeRenameModal();
      return;
    }
    setBulkActionLoading(true);
    try {
      const isFolder = renameTarget._isFolder === true;

      if (isFolder) {
        const oldFolderPath = renameTarget._fullPath || renameTarget.name;
        const parentPath = currentPath || '';
        const newFolderPath = parentPath ? `${parentPath}/${newName}` : newName;

        const result = await hfBackendRenameFolder(
          ctx.repoId,
          ctx.repoType,
          oldFolderPath,
          newFolderPath,
          ctx.token
        );

        if (result.ok) {
          const thumbRes = await hfBackendRenameFolder(
            ctx.repoId,
            ctx.repoType,
            `${THUMB_PREFIX}${oldFolderPath}`,
            `${THUMB_PREFIX}${newFolderPath}`,
            ctx.token
          );
          if (!thumbRes.ok) console.warn('[thumb-mirror] rename folder failed', thumbRes.error);

          setBulkSuccess(
            thumbRes.ok
              ? `Renamed folder to "${newName}"`
              : `Renamed folder to "${newName}" (thumbs: ${String(thumbRes.error || 'failed').slice(0, 120)})`
          );
          closeRenameModal();
          exitSelectionMode();
          refreshHFFilesNow();
        } else {
          setBulkError(result.error || `Failed to rename folder "${renameTarget.name}"`);
        }
      } else {
        const oldPath = renameTarget._path || renameTarget.name;
        const parts = oldPath.split('/');
        parts[parts.length - 1] = newName;
        const newPath = parts.join('/');
        const result = await hfBackendMove(ctx.repoId, ctx.repoType, oldPath, newPath, ctx.token);

        if (result.ok) {
          const relNoExtOld = oldPath.replace(/\.[^./\\]+$/, '');
          const relNoExtNew = newPath.replace(/\.[^./\\]+$/, '');
          const thumbRes = await hfBackendMove(
            ctx.repoId,
            ctx.repoType,
            `${THUMB_PREFIX}${relNoExtOld}.jpg`,
            `${THUMB_PREFIX}${relNoExtNew}.jpg`,
            ctx.token
          );
          if (!thumbRes.ok) console.warn('[thumb-mirror] rename file failed', thumbRes.error);

          setBulkSuccess(
            thumbRes.ok
              ? `Renamed to "${newName}"`
              : `Renamed to "${newName}" (thumb: ${String(thumbRes.error || 'failed').slice(0, 120)})`
          );
          closeRenameModal();
          exitSelectionMode();
          refreshHFFilesNow();
        } else {
          setBulkError(result.error || `Failed to rename "${renameTarget.name}"`);
        }
      }
    } catch (err: any) {
      setBulkError(err.message || 'Rename failed');
    } finally {
      setBulkActionLoading(false);
    }
  }, [
    renameTarget,
    renameValue,
    getBulkContext,
    closeRenameModal,
    exitSelectionMode,
    refreshHFFilesNow,
    currentPath,
  ]);

  const executeDelete = useCallback(async () => {
    if (deleteTargets.length === 0) {
      closeDeleteModal();
      return;
    }
    const ctx = await getBulkContext();
    if (!ctx) {
      setBulkError('No token available for delete');
      closeDeleteModal();
      return;
    }
    setBulkActionLoading(true);
    try {
      const folders = deleteTargets.filter((t) => t._isFolder);
      const files = deleteTargets.filter((t) => !t._isFolder);
      let successCount = 0;
      let failCount = 0;
      let lastError: string | undefined;

      const pathsToDelete = files.map((t) => t._path || t.name);
      const thumbPathsToDelete = files.map((t) => {
        const rawPath = t._path || t.name;
        const relNoExt = rawPath.replace(/\.[^./\\]+$/, '');
        return `${THUMB_PREFIX}${relNoExt}.jpg`;
      });

      if (files.length > 0) {
        const result = await hfBackendDelete(ctx.repoId, ctx.repoType, pathsToDelete, ctx.token);
        if (result.ok) {
          successCount += pathsToDelete.length;
          if (thumbPathsToDelete.length > 0) {
            await hfBackendDelete(
              ctx.repoId,
              ctx.repoType,
              thumbPathsToDelete,
              ctx.token,
              true
            ).catch(() => {});
          }
        } else {
          failCount += pathsToDelete.length;
          lastError = result.error;
        }
      }

      for (const folder of folders) {
        const folderPath = folder._fullPath || folder.name;
        const result = await hfBackendDeleteFolder(ctx.repoId, ctx.repoType, folderPath, ctx.token);
        if (result.ok) {
          successCount += 1;
          await hfBackendDeleteFolder(
            ctx.repoId,
            ctx.repoType,
            `${THUMB_PREFIX}${folderPath}`,
            ctx.token
          ).catch(() => {});
        } else {
          failCount += 1;
          lastError = result.error;
        }
      }

      if (failCount === 0 && successCount > 0) {
        setBulkSuccess(`Deleted ${successCount} item${successCount > 1 ? 's' : ''}`);
        closeDeleteModal();
        exitSelectionMode();
        refreshHFFilesNow();
      } else if (successCount > 0 && failCount > 0) {
        setBulkError(`Deleted ${successCount}, failed ${failCount}`);
        closeDeleteModal();
        exitSelectionMode();
        refreshHFFilesNow();
      } else {
        setBulkError(lastError || 'Delete failed');
      }
    } catch (err: any) {
      setBulkError(err.message || 'Delete failed');
    } finally {
      setBulkActionLoading(false);
    }
  }, [deleteTargets, getBulkContext, closeDeleteModal, exitSelectionMode, refreshHFFilesNow]);

  const executeTransfer = useCallback(
    async (params: {
      dstAccountId: string;
      dstRepoId: string;
      dstRepoType: 'dataset' | 'model' | 'space';
      dstPathPrefix: string;
    }) => {
      if (transferTargets.length === 0) {
        closeTransferModal();
        return;
      }

      if (!selectedRepo || !selectedRepoType) {
        setBulkError('No source repository selected');
        closeTransferModal();
        return;
      }

      let dstToken: string;
      if (params.dstAccountId === SAME_ACCOUNT_ID) {
        dstToken = activeSourceHfToken || '';
      } else {
        const dstAccount = transferAccounts.find((a) => a.id === params.dstAccountId);
        if (!dstAccount) {
          setBulkError('Destination account not found');
          closeTransferModal();
          return;
        }
        dstToken = dstAccount.token;
      }

      if (!dstToken) {
        setBulkError('No destination token available');
        closeTransferModal();
        return;
      }

      const srcTokenForTransfer = isPublicView ? '' : activeSourceHfToken || '';

      setBulkActionLoading(true);

      try {
        const srcPaths = transferTargets
          .map((t) => {
            if (t._isFolder) return t._fullPath || t.name;
            return t._path || t.name;
          })
          .filter(Boolean);

        const srcThumbPaths = transferTargets
          .map((t) => {
            if (t._isFolder) {
              return `${THUMB_PREFIX}${t._fullPath || t.name}`;
            }
            const rawPath = t._path || t.name;
            const relNoExt = rawPath.replace(/\.[^./\\]+$/, '');
            return `${THUMB_PREFIX}${relNoExt}.jpg`;
          })
          .filter(Boolean) as string[];

        if (srcPaths.length === 0) {
          setBulkError('No source paths to transfer');
          closeTransferModal();
          setBulkActionLoading(false);
          return;
        }

        const dstAccount =
          params.dstAccountId === SAME_ACCOUNT_ID
            ? null
            : transferAccounts.find((a) => a.id === params.dstAccountId);
        const isSameAccount =
          params.dstAccountId === SAME_ACCOUNT_ID ||
          (!!dstAccount && !!activeSourceHfToken && dstAccount.token === activeSourceHfToken);
        const isCopyMode = transferMode === 'copy';
        const isSameRepo =
          !isCopyMode &&
          isSameAccount &&
          !isPublicView &&
          params.dstRepoId === selectedRepo &&
          params.dstRepoType === selectedRepoType;

        if (isSameRepo) {
          const moveResult = await hfBackendMoveBulk(
            selectedRepo,
            selectedRepoType as 'dataset' | 'model' | 'space',
            srcPaths,
            params.dstPathPrefix || '',
            currentPath || '',
            srcTokenForTransfer || ''
          );

          if (moveResult.ok && srcThumbPaths.length > 0) {
            await hfBackendMoveBulk(
              selectedRepo,
              selectedRepoType as 'dataset' | 'model' | 'space',
              srcThumbPaths,
              params.dstPathPrefix ? `${THUMB_PREFIX}${params.dstPathPrefix}` : THUMB_PREFIX,
              currentPath ? `${THUMB_PREFIX}${currentPath}` : THUMB_PREFIX,
              srcTokenForTransfer || ''
            );
          }

          if (moveResult.ok) {
            const countMoved = moveResult.data?.count ?? srcPaths.length;
            if (countMoved === 0) {
              setBulkSuccess('Nothing to move');
            } else {
              setBulkSuccess(
                `Moved ${countMoved} item${countMoved > 1 ? 's' : ''} to "${params.dstPathPrefix || '/'}"`
              );
            }
            closeTransferModal();
            exitSelectionMode();
            refreshHFFilesNow();
          } else {
            setBulkError(moveResult.error || 'Move failed');
          }
          return;
        }

        const result = await hfBackendCrossCopy({
          src_repo_id: selectedRepo,
          src_repo_type: selectedRepoType as 'dataset' | 'model' | 'space',
          src_paths: srcPaths,
          dst_repo_id: params.dstRepoId,
          dst_repo_type: params.dstRepoType,
          dst_path_prefix: params.dstPathPrefix || '',
          src_base_path: currentPath || '',
          src_token: srcTokenForTransfer || '',
          dst_token: dstToken,
          delete_source: !isCopyMode && !isPublicView,
        });

        if (result.ok && srcThumbPaths.length > 0) {
          await hfBackendCrossCopy({
            src_repo_id: selectedRepo,
            src_repo_type: selectedRepoType as 'dataset' | 'model' | 'space',
            src_paths: srcThumbPaths,
            dst_repo_id: params.dstRepoId,
            dst_repo_type: params.dstRepoType,
            dst_path_prefix: params.dstPathPrefix
              ? `${THUMB_PREFIX}${params.dstPathPrefix}`
              : THUMB_PREFIX,
            src_base_path: currentPath ? `${THUMB_PREFIX}${currentPath}` : THUMB_PREFIX,
            src_token: srcTokenForTransfer || '',
            dst_token: dstToken,
            delete_source: !isCopyMode && !isPublicView,
          });
        }

        if (result.ok) {
          const countCopied = result.data?.count_copied ?? 0;
          const countFailedDelete = result.data?.count_failed_delete_src || 0;

          if (countCopied === 0) {
            setBulkSuccess(isCopyMode ? 'Nothing to copy' : 'Nothing to move');
          } else if (isCopyMode) {
            setBulkSuccess(`Copied ${countCopied} item(s) to ${params.dstRepoId}`);
          } else if (countFailedDelete > 0) {
            setBulkError(
              `Copied ${countCopied} item(s), but failed to delete ${countFailedDelete} from source.`
            );
          } else {
            setBulkSuccess(`Moved ${countCopied} item(s) to ${params.dstRepoId}`);
          }

          closeTransferModal();
          exitSelectionMode();
          refreshHFFilesNow();
        } else {
          setBulkError(result.error || (isCopyMode ? 'Copy failed' : 'Move failed'));
        }
      } catch (err: any) {
        setBulkError(err.message || (transferMode === 'copy' ? 'Copy failed' : 'Move failed'));
      } finally {
        setBulkActionLoading(false);
      }
    },
    [
      transferTargets,
      activeSourceHfToken,
      selectedRepo,
      selectedRepoType,
      transferAccounts,
      closeTransferModal,
      exitSelectionMode,
      refreshHFFilesNow,
      currentPath,
      transferMode,
      isPublicView,
    ]
  );

  const executeRenameRepo = useCallback(async () => {
    if (!renameRepoTarget || !renameRepoValue.trim()) {
      closeRenameRepoModal();
      return;
    }
    const newName = renameRepoValue.trim();
    if (newName === renameRepoTarget.name) {
      closeRenameRepoModal();
      return;
    }
    const token = activeSourceHfToken || (await getHFTokenFromFirestore()) || '';
    if (!token) {
      setBulkError('No token available for rename');
      closeRenameRepoModal();
      return;
    }
    setBulkActionLoading(true);
    try {
      const result = await hfBackendRenameRepo(
        renameRepoTarget.full_name,
        renameRepoTarget.type,
        newName,
        token
      );
      if (result.ok) {
        setBulkSuccess(`Renamed repository to "${newName}"`);
        closeRenameRepoModal();
        exitRepoSelectionMode();
        await loadHfRepositories(true);
      } else {
        setBulkError(result.error || `Failed to rename "${renameRepoTarget.name}"`);
      }
    } catch (err: any) {
      setBulkError(err.message || 'Rename failed');
    } finally {
      setBulkActionLoading(false);
    }
  }, [
    renameRepoTarget,
    renameRepoValue,
    activeSourceHfToken,
    getHFTokenFromFirestore,
    closeRenameRepoModal,
    exitRepoSelectionMode,
    loadHfRepositories,
  ]);

  const executeDeleteRepo = useCallback(async () => {
    if (deleteRepoTargets.length === 0) {
      closeDeleteRepoModal();
      return;
    }
    const token = activeSourceHfToken || (await getHFTokenFromFirestore()) || '';
    if (!token) {
      setBulkError('No token available for delete');
      closeDeleteRepoModal();
      return;
    }
    setBulkActionLoading(true);
    let successCount = 0;
    let failCount = 0;
    let lastError: string | undefined;
    try {
      for (const repo of deleteRepoTargets) {
        const result = await hfBackendDeleteRepo(repo.full_name, repo.type, token);
        if (result.ok) {
          successCount += 1;
        } else {
          failCount += 1;
          lastError = result.error;
        }
      }
      if (failCount === 0 && successCount > 0) {
        setBulkSuccess(`Deleted ${successCount} repositor${successCount > 1 ? 'ies' : 'y'}`);
        closeDeleteRepoModal();
        exitRepoSelectionMode();
        await loadHfRepositories(true);
      } else if (successCount > 0 && failCount > 0) {
        setBulkError(`Deleted ${successCount}, failed ${failCount}`);
        closeDeleteRepoModal();
        exitRepoSelectionMode();
        await loadHfRepositories(true);
      } else {
        setBulkError(lastError || 'Delete failed');
      }
    } catch (err: any) {
      setBulkError(err.message || 'Delete failed');
    } finally {
      setBulkActionLoading(false);
    }
  }, [
    deleteRepoTargets,
    activeSourceHfToken,
    getHFTokenFromFirestore,
    closeDeleteRepoModal,
    exitRepoSelectionMode,
    loadHfRepositories,
  ]);

  const executeAddRepo = useCallback(
    async (params: { name: string; type: 'dataset' | 'model' | 'space'; isPrivate: boolean }) => {
      const token = activeSourceHfToken || (await getHFTokenFromFirestore()) || '';
      if (!token) {
        setBulkError('No token available to create repository');
        closeAddRepoModal();
        return;
      }
      setBulkActionLoading(true);
      try {
        const result = await hfBackendCreateRepo(params.name, params.type, params.isPrivate, token);
        if (result.ok) {
          setBulkSuccess(`Repository "${params.name}" created`);
          closeAddRepoModal();
          await loadHfRepositories(true);
        } else {
          setBulkError(result.error || 'Failed to create repository');
        }
      } catch (err: any) {
        setBulkError(err.message || 'Failed to create repository');
      } finally {
        setBulkActionLoading(false);
      }
    },
    [activeSourceHfToken, getHFTokenFromFirestore, closeAddRepoModal, loadHfRepositories]
  );

  const executeSquashRepo = useCallback(async () => {
    if (squashRepoTargets.length === 0) {
      closeSquashRepoModal();
      return;
    }
    const token = activeSourceHfToken || (await getHFTokenFromFirestore()) || '';
    if (!token) {
      setBulkError('No token available for squash');
      closeSquashRepoModal();
      return;
    }
    setBulkActionLoading(true);
    let successCount = 0;
    let failCount = 0;
    let lastError: string | undefined;
    try {
      for (const repo of squashRepoTargets) {
        const result = await hfBackendSquashHistory(repo.full_name, repo.type, token);
        if (result.ok) {
          successCount += 1;
        } else {
          failCount += 1;
          lastError = result.error;
        }
      }
      if (failCount === 0 && successCount > 0) {
        setBulkSuccess(
          `Squashed history of ${successCount} repositor${successCount > 1 ? 'ies' : 'y'}`
        );
        closeSquashRepoModal();
        exitRepoSelectionMode();
        await loadHfRepositories(true);
      } else if (successCount > 0 && failCount > 0) {
        setBulkError(
          `Squashed ${successCount}, failed ${failCount}: ${lastError || 'unknown error'}`
        );
        closeSquashRepoModal();
        exitRepoSelectionMode();
        await loadHfRepositories(true);
      } else {
        setBulkError(lastError || 'Squash failed');
      }
    } catch (err: any) {
      setBulkError(err.message || 'Squash failed');
    } finally {
      setBulkActionLoading(false);
    }
  }, [
    squashRepoTargets,
    activeSourceHfToken,
    getHFTokenFromFirestore,
    closeSquashRepoModal,
    exitRepoSelectionMode,
    loadHfRepositories,
  ]);

  const executeUpdateRepoVisibility = useCallback(
    async (isPrivate: boolean) => {
      if (!visibilityRepoTarget) {
        closeVisibilityRepoModal();
        return;
      }
      const token = activeSourceHfToken || (await getHFTokenFromFirestore()) || '';
      if (!token) {
        setBulkError('No token available for visibility update');
        closeVisibilityRepoModal();
        return;
      }
      setBulkActionLoading(true);
      try {
        const result = await hfBackendUpdateRepoVisibility(
          visibilityRepoTarget.full_name,
          visibilityRepoTarget.type,
          isPrivate,
          token
        );
        if (result.ok) {
          setBulkSuccess(
            `Repository "${visibilityRepoTarget.name}" is now ${isPrivate ? 'Private' : 'Public'}`
          );
          closeVisibilityRepoModal();
          exitRepoSelectionMode();
          await loadHfRepositories(true);
        } else {
          setBulkError(result.error || 'Failed to update visibility');
        }
      } catch (err: any) {
        setBulkError(err.message || 'Visibility update failed');
      } finally {
        setBulkActionLoading(false);
      }
    },
    [
      visibilityRepoTarget,
      activeSourceHfToken,
      getHFTokenFromFirestore,
      closeVisibilityRepoModal,
      exitRepoSelectionMode,
      loadHfRepositories,
    ]
  );

  if (!activeSource || currentView === 'root') {
    return <CloudRoot onSelectSource={handleSelectSource} clearSession={handleClearAllSessions} />;
  }

  if (activeSourceType === 'telegram') {
    if (!activeSourceSession) {
      return <CloudModalTele isOpen={true} onSave={handleAuthSuccess} onClose={() => {}} />;
    }

    return (
      <CloudViewPack
        {...telegramHook}
        clearSession={handleClearSingleSession}
        sessionString={activeSourceSession}
        tgSession={activeSourceSession}
        onBackToRoot={handleBackToRoot}
        handleBackToRoot={handleBackToRoot}
        onClosePreview={() => navBack(telegramHook.handleBackToFiles)}
        handleBackToFiles={() => navBack(telegramHook.handleBackToFiles)}
        handleBackToChats={() => navBack(telegramHook.handleBackToChats)}
        sourceName={activeSource.name}
        showBackButton={true}
        sourceType="telegram"
        hfSelectedRepo=""
        hfToken=""
        onBackToRepos={() => {}}
        onBackToRepoRoot={() => {}}
        currentPath=""
        onNavigateToPath={() => {}}
        onGoBack={() => {}}
        selectionMode={false}
        selectedIds={new Set()}
        onEnterSelection={() => {}}
        onToggleSelection={() => {}}
        onExitSelection={() => {}}
        onSelectAll={() => {}}
        onDeselectAll={() => {}}
        allSelected={false}
        selectedItemsCount={0}
        onBulkRename={() => {}}
        onBulkMove={() => {}}
        onBulkDelete={() => {}}
        canBulkRename={false}
        canBulkMove={false}
        canBulkDelete={false}
        onCopy={() => {}}
        canCopy={false}
        showCopy={false}
        onWatchExternal={() => {}}
        canWatchExternal={false}
        onSlideshow={() => {}}
        canSlideshow={false}
        onCreateFolder={() => {}}
        deleteModalOpen={false}
        deleteTargets={[]}
        onDeleteConfirm={() => {}}
        onDeleteClose={() => {}}
        bulkActionLoading={false}
        bulkError={null}
        bulkSuccess={null}
        repoSelectionMode={false}
        selectedRepoIds={new Set()}
        onEnterRepoSelection={() => {}}
        onToggleRepoSelection={() => {}}
        onExitRepoSelection={() => {}}
        onSelectAllRepos={() => {}}
        onDeselectAllRepos={() => {}}
        allReposSelected={false}
        selectedReposCount={0}
        onRenameRepo={() => {}}
        onDeleteRepo={() => {}}
        onUpdateRepoVisibility={() => {}}
        canRenameRepo={false}
        canDeleteRepo={false}
        canUpdateRepoVisibility={false}
        renameRepoModalOpen={false}
        renameRepoValue=""
        renameRepoTarget={null}
        setRenameRepoValue={() => {}}
        onRenameRepoConfirm={() => {}}
        onRenameRepoClose={() => {}}
        deleteRepoModalOpen={false}
        deleteRepoTargets={[]}
        onDeleteRepoConfirm={() => {}}
        onDeleteRepoClose={() => {}}
        visibilityRepoModalOpen={false}
        visibilityRepoTarget={null}
        onVisibilityRepoConfirm={() => {}}
        onVisibilityRepoClose={() => {}}
      />
    );
  }

  if (activeSourceType === 'hf_dataset') {
    if (!hfHasLoadedOnce && isHfInitialLoading) {
      return (
        <CloudViewPack
          dialogs={[]}
          selectedChat={null}
          files={[]}
          sortedFiles={[]}
          selectedFile={null}
          loading={true}
          loadingFiles={true}
          searchQuery={hfSearchQuery}
          viewMode={hfViewMode}
          sortField={hfSortField}
          sortDir={hfSortDir}
          showSortMenu={hfShowSortMenu}
          error={null}
          sidebarCollapsed={hfSidebarCollapsed}
          sidebarWidth={hfSidebarWidth}
          setSidebarWidth={setHfSidebarWidth}
          showDetail={hfShowDetail}
          screenSize={hfScreenSize}
          mobileView={hfMobileView}
          totalSize={0}
          fileMetadata={null}
          sortMenuRef={hfSortMenuRef}
          sourceName={activeSource.name}
          showBackButton={true}
          sourceType="hf_dataset"
          onBackToRoot={handleBackToRoot}
          onClosePreview={handleBackToHfFiles}
          setSearchQuery={setHfSearchQuery}
          setSidebarCollapsed={setHfSidebarCollapsed}
          setShowDetail={setHfShowDetail}
          setMobileView={setHfMobileView}
          fetchDialogs={() => {}}
          refreshCurrentChatFiles={handleRefreshHF}
          handleChatClick={() => {}}
          handleFileClick={() => {}}
          handleBackToRoot={handleBackToRoot}
          handleBackToFiles={handleBackToHfFiles}
          handleBackToChats={() => {}}
          handleFileGone={() => {}}
          handleImageError={() => {}}
          handleMediaLoaded={() => {}}
          getStreamUrl={getHfStreamUrl}
          handleDownload={handleHfDownload}
          hfToken={isPublicView ? '' : activeSourceHfToken || ''}
          toggleSort={toggleHfSort}
          cycleViewMode={cycleHfViewMode}
          setShowSortMenu={setHfShowSortMenu}
          clearSession={handleClearSingleSession}
          hfRepos={[]}
          hfSelectedRepo=""
          onRepoClick={() => {}}
          onBackToRepos={handleBackToRepos}
          onBackToRepoRoot={handleBackToRepoRoot}
          hfRepoName=""
          currentPath=""
          onNavigateToPath={() => {}}
          onGoBack={() => {}}
          selectionMode={false}
          selectedIds={new Set()}
          onEnterSelection={() => {}}
          onToggleSelection={() => {}}
          onExitSelection={() => {}}
          onSelectAll={() => {}}
          onDeselectAll={() => {}}
          allSelected={false}
          selectedItemsCount={0}
          onBulkRename={() => {}}
          onBulkMove={() => {}}
          onBulkDelete={() => {}}
          canBulkRename={false}
          canBulkMove={false}
          canBulkDelete={false}
          onCopy={() => {}}
          canCopy={false}
          showCopy={false}
          onWatchExternal={() => {}}
          canWatchExternal={false}
          onSlideshow={() => {}}
          canSlideshow={false}
          onCreateFolder={() => {}}
          repoSelectionMode={false}
          selectedRepoIds={new Set()}
          onEnterRepoSelection={() => {}}
          onToggleRepoSelection={() => {}}
          onExitRepoSelection={() => {}}
          onSelectAllRepos={() => {}}
          onDeselectAllRepos={() => {}}
          allReposSelected={false}
          selectedReposCount={0}
          onRenameRepo={() => {}}
          onDeleteRepo={() => {}}
          onUpdateRepoVisibility={() => {}}
          canRenameRepo={false}
          canDeleteRepo={false}
          canUpdateRepoVisibility={false}
          onOpenPublicRepo={handleOpenPublicRepo}
          isPublicView={isPublicView}
        />
      );
    }

    if (hfError && hfRepos.length === 0) {
      return (
        <div
          className="cloudview-container"
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg)',
          }}
        >
          <div
            className="cloudview-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '0 20px',
              height: '60px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg)',
              flexShrink: 0,
            }}
          >
            <button
              onClick={handleBackToRoot}
              className="cloudview-back-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: 'var(--text-sub)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                padding: '8px 12px',
                borderRadius: '10px',
              }}
            >
              Back
            </button>
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text)',
                margin: 0,
                flex: 1,
              }}
            >
              {activeSource.name}
            </h2>
          </div>
          <div
            className="cloudview-error"
            style={{
              padding: '20px',
              textAlign: 'center',
              color: '#ef4444',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p>{hfError}</p>
            <button
              onClick={handleRefreshHF}
              style={{
                marginTop: '10px',
                padding: '8px 20px',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        <CloudViewPack
          dialogs={[]}
          selectedChat={null}
          files={sortedHfItems}
          sortedFiles={sortedHfItems}
          selectedFile={hfSelectedFile}
          loading={false}
          loadingFiles={hfLoading}
          searchQuery={hfSearchQuery}
          viewMode={hfViewMode}
          sortField={hfSortField}
          sortDir={hfSortDir}
          showSortMenu={hfShowSortMenu}
          error={hfError}
          sidebarCollapsed={hfSidebarCollapsed}
          sidebarWidth={hfSidebarWidth}
          setSidebarWidth={setHfSidebarWidth}
          showDetail={hfShowDetail}
          screenSize={hfScreenSize}
          mobileView={hfMobileView}
          totalSize={hfTotalSize}
          fileMetadata={null}
          sortMenuRef={hfSortMenuRef}
          sourceName={activeSource.name}
          showBackButton={true}
          sourceType="hf_dataset"
          onBackToRoot={handleBackToRoot}
          onClosePreview={handleBackToHfFiles}
          setSearchQuery={setHfSearchQuery}
          setSidebarCollapsed={setHfSidebarCollapsed}
          setShowDetail={setHfShowDetail}
          setMobileView={setHfMobileView}
          fetchDialogs={() => {}}
          refreshCurrentChatFiles={handleRefreshHF}
          handleChatClick={() => {}}
          handleFileClick={handleHfFileClick}
          handleBackToRoot={handleBackToRoot}
          handleBackToFiles={handleBackToHfFiles}
          handleBackToChats={() => {}}
          handleFileGone={() => {}}
          handleImageError={() => {}}
          handleMediaLoaded={() => {}}
          getStreamUrl={getHfStreamUrl}
          handleDownload={handleHfDownload}
          hfToken={isPublicView ? '' : activeSourceHfToken || ''}
          toggleSort={toggleHfSort}
          cycleViewMode={cycleHfViewMode}
          setShowSortMenu={setHfShowSortMenu}
          clearSession={handleClearSingleSession}
          hfRepos={hfRepos}
          hfSelectedRepo={selectedRepo}
          onRepoClick={handleRepoClick}
          onBackToRepos={handleBackToRepos}
          onBackToRepoRoot={handleBackToRepoRoot}
          hfRepoName={selectedRepo.split('/').pop()}
          currentPath={currentPath}
          onNavigateToPath={handleHfNavigateToPath}
          onGoBack={handleGoBack}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onEnterSelection={enterSelectionMode}
          onToggleSelection={toggleSelection}
          onExitSelection={exitSelectionMode}
          onSelectAll={selectAllHF}
          onDeselectAll={deselectAllHF}
          allSelected={sortedHfItems.length > 0 && selectedItems.length === sortedHfItems.length}
          selectedItemsCount={selectedItems.length}
          onBulkRename={isPublicView ? () => {} : openRenameModal}
          onBulkMove={isPublicView ? () => {} : openMoveModal}
          onBulkDelete={isPublicView ? () => {} : openDeleteModal}
          canBulkRename={!isPublicView && canRename}
          canBulkMove={!isPublicView && canMove}
          canBulkDelete={!isPublicView && canDelete}
          onCopy={openCopyModal}
          canCopy={canMove}
          showCopy={true}
          onWatchExternal={handleWatchExternal}
          canWatchExternal={canWatchExternal}
          onSlideshow={handleSlideshow}
          canSlideshow={canSlideshow}
          slideshowKind={slideshowKind}
          onCreateFolder={isPublicView ? () => {} : openCreateFolderModal}
          renameModalOpen={renameModalOpen}
          renameValue={renameValue}
          renameTarget={renameTarget}
          setRenameValue={setRenameValue}
          onRenameConfirm={executeRename}
          onRenameClose={closeRenameModal}
          deleteModalOpen={deleteModalOpen}
          deleteTargets={deleteTargets}
          onDeleteConfirm={executeDelete}
          onDeleteClose={closeDeleteModal}
          bulkActionLoading={bulkActionLoading}
          bulkError={bulkError}
          bulkSuccess={bulkSuccess}
          createFolderModalOpen={createFolderModalOpen}
          createFolderValue={createFolderValue}
          setCreateFolderValue={setCreateFolderValue}
          onCreateFolderConfirm={executeCreateFolder}
          onCreateFolderClose={closeCreateFolderModal}
          transferModalOpen={transferModalOpen}
          transferTargets={transferTargets}
          transferSourceAccountId={activeSourceDatasetId}
          transferSourceAccountLabel={activeSourceDatasetId || ''}
          transferSourceRepoId={selectedRepo}
          transferSourceRepoType={(selectedRepoType || 'dataset') as 'dataset' | 'model' | 'space'}
          transferAccounts={transferAccounts}
          transferReposByAccount={transferReposByAccount}
          transferReposLoading={transferReposLoading}
          transferReposError={transferReposError}
          onTransferFetchRepos={fetchReposForAccount}
          transferDestFoldersByRepo={transferDestFoldersByRepo}
          transferDestFoldersLoading={transferDestFoldersLoading}
          transferDestFoldersError={transferDestFoldersError}
          onTransferFetchDestFolders={fetchDestFoldersForTransfer}
          transferDisabledPaths={transferDisabledPaths}
          onTransferConfirm={executeTransfer}
          onTransferClose={closeTransferModal}
          transferMode={transferMode}
          transferIsPublicSource={isPublicView}
          repoSelectionMode={isPublicView ? false : repoSelectionMode}
          selectedRepoIds={isPublicView ? new Set() : selectedRepoIds}
          onEnterRepoSelection={isPublicView ? () => {} : enterRepoSelectionMode}
          onToggleRepoSelection={isPublicView ? () => {} : toggleRepoSelection}
          onExitRepoSelection={isPublicView ? () => {} : exitRepoSelectionMode}
          onSelectAllRepos={isPublicView ? () => {} : selectAllRepos}
          onDeselectAllRepos={isPublicView ? () => {} : deselectAllRepos}
          allReposSelected={
            !isPublicView && hfRepos.length > 0 && selectedRepos.length === hfRepos.length
          }
          selectedReposCount={isPublicView ? 0 : selectedRepos.length}
          onRenameRepo={isPublicView ? () => {} : openRenameRepoModal}
          onDeleteRepo={isPublicView ? () => {} : openDeleteRepoModal}
          onUpdateRepoVisibility={isPublicView ? () => {} : openVisibilityRepoModal}
          onSquashRepo={isPublicView ? () => {} : openSquashRepoModal}
          onAddRepo={isPublicView ? () => {} : openAddRepoModal}
          addRepoModalOpen={addRepoModalOpen}
          onAddRepoConfirm={executeAddRepo}
          onAddRepoClose={closeAddRepoModal}
          canSquashRepo={!isPublicView && canSquashRepo}
          squashRepoModalOpen={squashRepoModalOpen}
          squashRepoTargets={squashRepoTargets}
          onSquashRepoConfirm={executeSquashRepo}
          onSquashRepoClose={closeSquashRepoModal}
          canRenameRepo={!isPublicView && canRenameRepo}
          canDeleteRepo={!isPublicView && canDeleteRepo}
          canUpdateRepoVisibility={!isPublicView && canUpdateVisibilityRepo}
          selectedRepoPrivate={selectedRepoPrivate}
          renameRepoModalOpen={renameRepoModalOpen}
          renameRepoValue={renameRepoValue}
          renameRepoTarget={renameRepoTarget}
          setRenameRepoValue={setRenameRepoValue}
          onRenameRepoConfirm={executeRenameRepo}
          onRenameRepoClose={closeRenameRepoModal}
          deleteRepoModalOpen={deleteRepoModalOpen}
          deleteRepoTargets={deleteRepoTargets}
          onDeleteRepoConfirm={executeDeleteRepo}
          onDeleteRepoClose={closeDeleteRepoModal}
          visibilityRepoModalOpen={visibilityRepoModalOpen}
          visibilityRepoTarget={visibilityRepoTarget}
          onVisibilityRepoConfirm={executeUpdateRepoVisibility}
          onVisibilityRepoClose={closeVisibilityRepoModal}
          onOpenPublicRepo={handleOpenPublicRepo}
          isPublicView={isPublicView}
        />
        <MediaRenderModal
          isOpen={watchExternalOpen}
          url={watchExternalFile?.url || ''}
          name={watchExternalFile?.name}
          token={isPublicView ? '' : activeSourceHfToken || ''}
          onClose={() => {
            setWatchExternalOpen(false);
            setWatchExternalFile(null);
          }}
        />
        <CloudSlideshow
          isOpen={slideshowOpen}
          items={slideshowItems}
          initialIndex={slideshowStartIndex}
          onClose={() => {
            setSlideshowOpen(false);
            setSlideshowItems([]);
            setSlideshowStartIndex(0);
          }}
        />
        <CloudPlaylist
          isOpen={playlistOpen}
          tracks={playlistTracks}
          initialIndex={playlistStartIndex}
          onClose={() => {
            setPlaylistOpen(false);
            setPlaylistTracks([]);
            setPlaylistStartIndex(0);
          }}
        />
      </>
    );
  }

  return <Loading />;
};

export default CloudView;