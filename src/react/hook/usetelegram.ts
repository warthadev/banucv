// src/react/hook/usetelegram.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@redux/store';
import { setSelectedChatId, setSelectedFileId } from '@redux/cloudslice';
import type { TelegramChat, TelegramFile, ViewMode, MobileView, SortField, SortDir, TelegramFileMetadata } from '@config/telegram';
import { STORAGE_KEYS } from '@config/telegram';
import { useScreenSize } from '@hook/usescreensize';
import { getActiveBase } from '@config/api';

export const useTelegram = (sessionString: string | null) => {
  const dispatch = useDispatch();
  const reduxSelectedChatId = useSelector((state: RootState) => state.cloud.selectedChatId);

  const [dialogs, setDialogs] = useState<TelegramChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<TelegramChat | null>(null);
  const reduxSelectedFileId = useSelector((state: RootState) => state.cloud.selectedFileId);
  const hasRestoredChatRef = useRef(false);
  const fileRestoreDoneRef = useRef(!reduxSelectedFileId);
  const [files, setFiles] = useState<TelegramFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<TelegramFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => (sessionStorage.getItem(STORAGE_KEYS.VIEW_MODE) as ViewMode) || 'list');
  const [sortField, setSortField] = useState<SortField>(() => (sessionStorage.getItem(STORAGE_KEYS.SORT_FIELD) as SortField) || 'date');
  const [sortDir, setSortDir] = useState<SortDir>(() => (sessionStorage.getItem(STORAGE_KEYS.SORT_DIR) as SortDir) || 'desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => sessionStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true');
  const [sidebarWidth, setSidebarWidthState] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEYS.SIDEBAR_WIDTH);
    return saved ? parseInt(saved, 10) : 220;
  });
  const [showDetail, setShowDetail] = useState(true);
  const screenSize = useScreenSize();
  const [mobileView, setMobileView] = useState<MobileView>('chats');
  const [totalSize, setTotalSize] = useState<number>(0);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [mediaLoading, setMediaLoading] = useState<Record<number, boolean>>({});
  const [fileMetadata, setFileMetadata] = useState<TelegramFileMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  const sortMenuRef = useRef<HTMLDivElement>(null);

  const sessionRef = useRef(sessionString);

  useEffect(() => {
    sessionRef.current = sessionString;
  }, [sessionString]);

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const session = sessionRef.current;
    if (!session) throw new Error("No Telegram session");
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Session': session,
        ...options.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.substring(0, 100)}`);
    }
    return res;
  }, []);

  const getStreamUrl = useCallback((chatId: number, msgId: number) => {
    const API_BASE = getActiveBase();
    let url = `${API_BASE}/telegram/stream/${chatId}/${msgId}`;
    const session = sessionRef.current;
    if (session) {
      url += `?tg_session=${encodeURIComponent(session)}`;
    }
    return url;
  }, []);

  const handleDownload = useCallback((chatId: number, msgId: number, filename: string) => {
    const session = sessionRef.current;
    if (!session) return;

    const API_BASE = getActiveBase();
    const backendUrl = `${API_BASE}/telegram/download/${chatId}/${msgId}`;
    const params = new URLSearchParams();
    params.set('url', backendUrl);
    if (filename) params.set('filename', filename);

    const proxyUrl = `${API_BASE}/proxy/download?${params.toString()}`;

    const a = document.createElement('a');
    a.href = proxyUrl;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const fetchFileMetadata = useCallback(async (chatId: number, msgId: number): Promise<TelegramFileMetadata | null> => {
    if (!sessionRef.current) return null;
    const API_BASE = getActiveBase();
    setIsLoadingMetadata(true);
    try {
      const res = await apiFetch(`${API_BASE}/telegram/chat/${chatId}/file/${msgId}/metadata`);
      const data = await res.json();
      if (data.success && data.metadata) {
        setFileMetadata(data.metadata);
        return data.metadata;
      }
      return null;
    } catch (err) {
      return null;
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!showSortMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSortMenu]);

  const setSidebarWidth = useCallback((width: number) => {
    setSidebarWidthState(width);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.SIDEBAR_WIDTH, sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => { sessionStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, sidebarCollapsed.toString()); }, [sidebarCollapsed]);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEYS.VIEW_MODE, viewMode); }, [viewMode]);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEYS.SORT_FIELD, sortField); }, [sortField]);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEYS.SORT_DIR, sortDir); }, [sortDir]);

  const fetchDialogs = useCallback(async () => {
    if (!sessionRef.current) return;
    const API_BASE = getActiveBase();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE}/telegram/dialogs`);
      const data = await res.json();
      
      const dialogs = (data.dialogs || []).map((d: any) => ({
        ...d,
        unread_count: d.unread_count ?? 0,
      }));
      
      setDialogs(dialogs);

      if (!hasRestoredChatRef.current) {
        hasRestoredChatRef.current = true;
        const idToRestore = reduxSelectedChatId;
        if (idToRestore) {
          const match = dialogs.find((d: TelegramChat) => String(d.id) === String(idToRestore));
          if (match) {
            setSelectedChat(match);
            if (screenSize === 'mobile') setMobileView('files');
          } else {
            dispatch(setSelectedChatId(null));
          }
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load dialogs');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, screenSize, reduxSelectedChatId, dispatch]);

  const fetchChatFiles = useCallback(async (chatId: number, silent = false) => {
    if (!sessionRef.current) return;
    const API_BASE = getActiveBase();
    if (!silent) setLoadingFiles(true);
    try {
      const res = await apiFetch(`${API_BASE}/telegram/chat/${chatId}/files`);
      const data = await res.json();
      const list = data.files || [];
      setFiles(list);
      setTotalSize(list.reduce((acc: number, f: TelegramFile) => acc + (f.size || 0), 0));
    } catch (e: any) {
      if (!silent) setError(e.message);
    } finally {
      if (!silent) setLoadingFiles(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (sessionString) fetchDialogs();
  }, [sessionString, fetchDialogs]);

  useEffect(() => {
    if (selectedChat && sessionString) fetchChatFiles(selectedChat.id, false);
  }, [selectedChat, sessionString, fetchChatFiles]);

  useEffect(() => {
    if (selectedChat) {
      dispatch(setSelectedChatId(String(selectedChat.id)));
    }
  }, [selectedChat, dispatch]);

  const refreshCurrentChatFiles = useCallback(async () => {
    if (!selectedChat || !sessionRef.current) return;
    const API_BASE = getActiveBase();
    setLoadingFiles(true);
    try {
      await apiFetch(`${API_BASE}/telegram/chat/${selectedChat.id}/refresh`, { method: 'POST' });
      await fetchChatFiles(selectedChat.id, false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingFiles(false);
    }
  }, [selectedChat, apiFetch, fetchChatFiles]);

  const handleChatClick = useCallback((chat: TelegramChat) => {
    setSelectedChat(chat);
    setSelectedFile(null);
    setFileMetadata(null);
    setSearchQuery('');
    if (screenSize === 'mobile') setMobileView('files');
  }, [screenSize]);

  const handleFileClick = useCallback((file: TelegramFile) => {
    setSelectedFile(file);
    setFileMetadata(null);
    if (selectedChat) {
      fetchFileMetadata(selectedChat.id, file.id);
    }
    if (screenSize === 'mobile') setMobileView('player');
  }, [screenSize, selectedChat, fetchFileMetadata]);

  const handleBackToRoot = useCallback(() => {
    setSelectedChat(null);
    setSelectedFile(null);
    setFileMetadata(null);
    setFiles([]);
    dispatch(setSelectedChatId(null));
    if (screenSize === 'mobile') setMobileView('chats');
  }, [screenSize, dispatch]);

  const handleBackToChats = useCallback(() => {
    setSelectedChat(null);
    setSelectedFile(null);
    setFileMetadata(null);
    setFiles([]);
    dispatch(setSelectedChatId(null));
    if (screenSize === 'mobile') setMobileView('chats');
  }, [screenSize, dispatch]);

  const handleBackToFiles = useCallback(() => {
    setSelectedFile(null);
    setFileMetadata(null);
    if (screenSize === 'mobile') setMobileView('files');
  }, [screenSize]);

  const handleFileGone = useCallback((fileId: number) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    if (selectedFile?.id === fileId) {
      setSelectedFile(null);
      setFileMetadata(null);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (!sessionString || fileRestoreDoneRef.current) return;
    if (!selectedChat || loadingFiles || files.length === 0) return;
    fileRestoreDoneRef.current = true;
    const match = files.find(f => String(f.id) === String(reduxSelectedFileId));
    if (match) {
      setSelectedFile(match);
      fetchFileMetadata(selectedChat.id, match.id);
      if (screenSize === 'mobile') setMobileView('player');
    } else {
      dispatch(setSelectedFileId(null));
    }
  }, [sessionString, selectedChat, loadingFiles, files, reduxSelectedFileId, fetchFileMetadata, screenSize, dispatch]);

  useEffect(() => {
    if (!sessionString || !fileRestoreDoneRef.current) return;
    dispatch(setSelectedFileId(selectedFile ? String(selectedFile.id) : null));
  }, [selectedFile, sessionString, dispatch]);

  const handleImageError = useCallback((fileId: number) => {
    setImageErrors(prev => ({ ...prev, [fileId]: true }));
  }, []);

  const handleMediaLoaded = useCallback((fileId: number) => {
    setMediaLoading(prev => ({ ...prev, [fileId]: false }));
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setShowSortMenu(false);
  }, [sortField]);

  const cycleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'list' ? 'grid' : prev === 'grid' ? 'thumbnail' : prev === 'thumbnail' ? 'poster' : 'list');
  }, []);

  const sortFiles = useCallback((arr: TelegramFile[]) => {
    return [...arr].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'date') {
        const dateA = a.date || 0;
        const dateB = b.date || 0;
        cmp = dateA - dateB;
      } else if (sortField === 'size') {
        cmp = (a.size || 0) - (b.size || 0);
      } else if (sortField === 'type') {
        cmp = a.media_type.localeCompare(b.media_type);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [sortField, sortDir]);

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const sortedFiles = sortFiles(filteredFiles);

  return {
    dialogs,
    selectedChat,
    files,
    selectedFile,
    loading,
    loadingFiles,
    searchQuery,
    viewMode,
    sortField,
    sortDir,
    showSortMenu,
    error,
    sidebarCollapsed,
    sidebarWidth,
    showDetail,
    screenSize,
    mobileView,
    totalSize,
    imageErrors,
    mediaLoading,
    fileMetadata,
    isLoadingMetadata,
    sortMenuRef,
    sessionString,
    setSearchQuery,
    setSidebarCollapsed,
    setSidebarWidth,
    setShowDetail,
    setMobileView,
    setImageErrors,
    setMediaLoading,
    setFileMetadata,
    fetchDialogs,
    refreshCurrentChatFiles,
    handleChatClick,
    handleFileClick,
    handleBackToRoot,
    handleBackToChats,
    handleBackToFiles,
    handleFileGone,
    handleImageError,
    handleMediaLoaded,
    getStreamUrl,
    handleDownload,
    fetchFileMetadata,
    toggleSort,
    cycleViewMode,
    setShowSortMenu,
    sortedFiles,
  };
};