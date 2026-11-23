// src/react/hook/usedltorrent.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveBase } from '@config/api';
import { getKaggleAuthHeaders } from '@config/kagglecredentials';

const SESSION_STORAGE_KEY = 'wartha_kaggle_session_id';
const SESSION_MAGNET_KEY = 'wartha_kaggle_session_magnet';
const POLL_MAX_FAILS = 15;

type LogType = 'system' | 'critical' | 'success';

export interface TorrentFile {
  index: number;
  path: string;
  name: string;
  size: number;
}

interface TorrentStartResponse {
  ok: boolean;
  info_hash?: string;
  torrent_name?: string;
  files?: TorrentFile[];
  total_size?: number;
  total_size_human?: string;
  detail?: string;
}

interface TorrentKaggleStartResponse {
  ok?: boolean;
  session_id?: string;
  files_count?: number;
  appended?: boolean;
  reused_worker?: boolean;
  runner?: string;
  runner_error?: string | null;
  detail?: string;
}

export interface TorrentSaveTarget {
  repoId: string;
  repoType: string;
  folder: string;
  token: string;
}

interface TorrentProgressResponse {
  ok: boolean;
  session_id?: string;
  status?: string;
  phase?: string | null;
  percent?: number;
  current_human?: string;
  total_human?: string;
  speed_human?: string;
  elapsed?: number;
  eta_seconds?: number | null;
  file_name?: string;
  current_file_index?: number;
  total_files?: number;
  completed_files?: number;
  failed_files?: number;
  finished?: boolean;
  error?: string | null;
  save_status?: string | null;
  save_error?: string | null;
  save_url?: string | null;
  expires_at?: number;
  seconds_left?: number;
  ttl_seconds?: number;
  total_size_bytes?: number;
  total_speed_bps?: number;
  total_elapsed_seconds?: number;
}

interface KaggleSessionResponse {
  ok: boolean;
  session_id?: string;
  expires_at?: number;
  seconds_left?: number;
  ttl_seconds?: number;
  status?: string;
  file_indexes?: number[];
  files_count?: number;
}

export interface KaggleSessionInfo {
  sessionId: string;
  expiresAt: number;
  secondsLeft: number;
  ttlSeconds: number;
}

interface UseDlTorrentOptions {
  onLog: (msg: string, type?: LogType) => void;
  onProgressLog: (msg: string) => void;
  onReplaceProgress: (finalMsg: string, type?: LogType) => void;
  onResetLogs?: () => void;
  saveTarget?: TorrentSaveTarget;
}

export const isMagnetLink = (value: string): boolean => {
  return value.trim().toLowerCase().startsWith('magnet:?xt=urn:btih:');
};

const extractMagnetInfoHash = (magnet: string): string => {
  if (!magnet) return '';
  const m = magnet.match(/urn:btih:([A-Za-z0-9]+)/i);
  if (!m) return '';
  return m[1].toLowerCase();
};

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  const fixed = i <= 1 ? value.toFixed(0) : value.toFixed(1);
  return `${fixed} ${sizes[i]}`;
};

const buildProgressEntry = (
  tag: 'kaggle' | 'upload',
  filePrefix: string,
  fileName: string,
  percent: number,
  currentHuman: string,
  totalHuman: string,
  speedHuman: string,
  etaSeconds: number | null | undefined,
  phase: 'download' | 'upload',
  elapsedSeconds?: number
): string => {
  const safePercent = Math.min(Math.max(percent, 0), 100);
  const barWidth = 20;
  const filled = Math.round((safePercent / 100) * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

  const headerTag = filePrefix ? `[${tag}] ${filePrefix}` : `[${tag}]`;

  let footer: string;
  if (phase === 'upload') {
    footer = `${currentHuman}/${totalHuman} · uploading… ${elapsedSeconds ?? 0}s`;
  } else {
    let eta = '--';
    if (typeof etaSeconds === 'number' && etaSeconds >= 0 && isFinite(etaSeconds)) {
      if (etaSeconds < 60) eta = `${Math.round(etaSeconds)}s`;
      else if (etaSeconds < 3600) eta = `${(etaSeconds / 60).toFixed(1)}m`;
      else eta = `${(etaSeconds / 3600).toFixed(1)}h`;
    }
    footer = `${currentHuman}/${totalHuman} · ${speedHuman} · ETA ${eta}`;
  }

  return `${headerTag}\n${fileName}\n${bar}  ${safePercent.toFixed(1)}%\n${footer}`;
};


const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 25000,
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
};

const readStoredSessionId = (): string | null => {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
};

const readStoredSessionMagnet = (): string | null => {
  try {
    return sessionStorage.getItem(SESSION_MAGNET_KEY);
  } catch {
    return null;
  }
};

const writeStoredSessionId = (sid: string | null) => {
  try {
    if (sid) sessionStorage.setItem(SESSION_STORAGE_KEY, sid);
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    void 0;
  }
};

const writeStoredSessionMagnet = (magnet: string | null) => {
  try {
    if (magnet) sessionStorage.setItem(SESSION_MAGNET_KEY, magnet);
    else sessionStorage.removeItem(SESSION_MAGNET_KEY);
  } catch {
    void 0;
  }
};

export const useDlTorrent = ({
  onLog,
  onProgressLog,
  onReplaceProgress,
  onResetLogs,
  saveTarget,
}: UseDlTorrentOptions) => {
  const [torrentInfoHash, setTorrentInfoHash] = useState<string | null>(null);
  const [torrentFiles, setTorrentFiles] = useState<TorrentFile[]>([]);
  const [torrentStarting, setTorrentStarting] = useState(false);
  const [kaggleSession, setKaggleSession] = useState<KaggleSessionInfo | null>(null);
  const [kaggleFileIndexes, setKaggleFileIndexes] = useState<Set<number>>(new Set());
  const [kaggleBusy, setKaggleBusy] = useState(false);

  const progressPollRef = useRef<number | null>(null);
  const sessionCountdownRef = useRef<number | null>(null);
  const inputUrlRef = useRef<string>('');
  const saveTargetRef = useRef<TorrentSaveTarget | undefined>(saveTarget);
  useEffect(() => {
    saveTargetRef.current = saveTarget;
  }, [saveTarget]);

  const doneHandledRef = useRef<boolean>(false);
  const lastStatusRef = useRef<string>('');
  const lastPhaseRef = useRef<string>('');
  const lastFileIndexRef = useRef<number>(0);
  const lastSaveStatusRef = useRef<string>('');
  const firstProgressSeenRef = useRef<boolean>(false);
  const pollFailRef = useRef<number>(0);

  const submittedFilesRef = useRef<TorrentFile[]>([]);
  const currentSubmittedIdxRef = useRef<number>(0);

  const kaggleSessionIdRef = useRef<string | null>(readStoredSessionId());
  const kaggleSessionMagnetRef = useRef<string | null>(readStoredSessionMagnet());

  useEffect(() => {
    return () => {
      if (progressPollRef.current !== null) {
        window.clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
      if (sessionCountdownRef.current !== null) {
        window.clearInterval(sessionCountdownRef.current);
        sessionCountdownRef.current = null;
      }
    };
  }, []);

  const stopSessionCountdown = useCallback(() => {
    if (sessionCountdownRef.current !== null) {
      window.clearInterval(sessionCountdownRef.current);
      sessionCountdownRef.current = null;
    }
  }, []);

  const startSessionCountdown = useCallback(() => {
    stopSessionCountdown();
    sessionCountdownRef.current = window.setInterval(() => {
      setKaggleSession(prev => {
        if (!prev) return prev;
        const next = Math.max(0, Math.floor(prev.expiresAt - Date.now() / 1000));
        if (next <= 0) {
          return { ...prev, secondsLeft: 0 };
        }
        return { ...prev, secondsLeft: next };
      });
    }, 1000);
  }, [stopSessionCountdown]);

  const fetchRemoteSessionInfo = useCallback(async (sid: string): Promise<{ info: KaggleSessionInfo; fileIndexes: number[] } | null> => {
    const API_BASE = getActiveBase();
    try {
      const res = await fetchWithTimeout(`${API_BASE}/torrent/kaggle-session?session_id=${encodeURIComponent(sid)}`, {
        headers: await getKaggleAuthHeaders(),
      }, 12000);
      if (!res.ok) return null;
      const json: KaggleSessionResponse = await res.json();
      if (!json.ok || !json.session_id || typeof json.expires_at !== 'number') return null;
      return {
        info: {
          sessionId: json.session_id,
          expiresAt: json.expires_at,
          secondsLeft: json.seconds_left ?? Math.max(0, Math.floor(json.expires_at - Date.now() / 1000)),
          ttlSeconds: json.ttl_seconds ?? 0,
        },
        fileIndexes: Array.isArray(json.file_indexes) ? json.file_indexes : [],
      };
    } catch {
      return null;
    }
  }, []);

  const clearRemoteSession = useCallback(() => {
    kaggleSessionIdRef.current = null;
    kaggleSessionMagnetRef.current = null;
    writeStoredSessionId(null);
    writeStoredSessionMagnet(null);
    setKaggleSession(null);
    setKaggleFileIndexes(new Set());
    setKaggleBusy(false);
    stopSessionCountdown();
  }, [stopSessionCountdown]);

  const refreshRemoteSession = useCallback(async () => {
    const sid = kaggleSessionIdRef.current;
    if (!sid) {
      setKaggleSession(null);
      setKaggleFileIndexes(new Set());
      stopSessionCountdown();
      return;
    }
    const result = await fetchRemoteSessionInfo(sid);
    if (!result) {
      clearRemoteSession();
      return;
    }
    setKaggleSession(result.info);
    setKaggleFileIndexes(new Set(result.fileIndexes));
    startSessionCountdown();
  }, [fetchRemoteSessionInfo, startSessionCountdown, stopSessionCountdown, clearRemoteSession]);

  useEffect(() => {
    void refreshRemoteSession();
  }, [refreshRemoteSession]);


  const resetTorrent = useCallback(() => {
    setTorrentInfoHash(null);
    setTorrentFiles([]);
    if (progressPollRef.current !== null) {
      window.clearInterval(progressPollRef.current);
      progressPollRef.current = null;
    }
    setKaggleBusy(false);
    doneHandledRef.current = false;
    lastStatusRef.current = '';
    lastPhaseRef.current = '';
    lastFileIndexRef.current = 0;
    lastSaveStatusRef.current = '';
    firstProgressSeenRef.current = false;
    pollFailRef.current = 0;
    submittedFilesRef.current = [];
    currentSubmittedIdxRef.current = 0;
  }, []);

  const pollRemoteProgress = useCallback((sessionId: string, fallbackFileName: string) => {
    if (progressPollRef.current !== null) {
      window.clearInterval(progressPollRef.current);
      progressPollRef.current = null;
    }

    doneHandledRef.current = false;
    lastStatusRef.current = '';
    lastPhaseRef.current = '';
    lastFileIndexRef.current = 0;
    lastSaveStatusRef.current = '';
    firstProgressSeenRef.current = false;
    pollFailRef.current = 0;
    currentSubmittedIdxRef.current = 0;

    const cleanup = () => {
      if (progressPollRef.current !== null) {
        window.clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
    };

    const finishAll = () => {
      doneHandledRef.current = true;
      cleanup();
      setKaggleBusy(false);
    };

    const tick = async () => {
      if (doneHandledRef.current) return;

      const API_BASE = getActiveBase();

      try {
        const res = await fetchWithTimeout(`${API_BASE}/torrent/kaggle-session?session_id=${sessionId}`, {
          headers: await getKaggleAuthHeaders(),
        }, 15000);
        const json: TorrentProgressResponse = await res
          .json()
          .catch(() => ({} as TorrentProgressResponse));
        if (!res.ok || !json.ok) {
          pollFailRef.current += 1;
          if (pollFailRef.current < POLL_MAX_FAILS) return;
          finishAll();
          if (res.status === 410) clearRemoteSession();
          const hint = res.status === 410 ? ' - session not found on server (restarted/expired), run Extract again' : '';
          onReplaceProgress(`Kaggle worker progress polling failed for ${fallbackFileName} (HTTP ${res.status})${hint}`, 'critical');
          return;
        }
        pollFailRef.current = 0;

        if (doneHandledRef.current) return;

        if (typeof json.expires_at === 'number') {
          setKaggleSession(prev => {
            if (!prev || prev.sessionId !== sessionId) return prev;
            const nextLeft = typeof json.seconds_left === 'number'
              ? json.seconds_left
              : Math.max(0, Math.floor(json.expires_at! - Date.now() / 1000));
            return {
              ...prev,
              expiresAt: json.expires_at!,
              secondsLeft: nextLeft,
              ttlSeconds: json.ttl_seconds ?? prev.ttlSeconds,
            };
          });
        }

        const phase = json.phase || '';
        const saveStatus = json.save_status || '';
        const backendFileIndex = typeof json.current_file_index === 'number' ? json.current_file_index : 0;
        const totalFiles = typeof json.total_files === 'number' ? json.total_files : 0;
        const completedFiles = typeof json.completed_files === 'number' ? json.completed_files : 0;
        const failedFiles = typeof json.failed_files === 'number' ? json.failed_files : 0;
        const currentFileName = json.file_name || fallbackFileName;

        const submitted = submittedFilesRef.current;
        const submittedTotal = submitted.length || totalFiles;

        let localIdx = backendFileIndex;
        if (currentFileName && submitted.length > 0) {
          const found = submitted.findIndex(f => f.name === currentFileName);
          if (found !== -1) {
            localIdx = found + 1;
          }
        }

        const filePrefix = submittedTotal > 1 && localIdx > 0
          ? `[${localIdx}/${submittedTotal}]`
          : '';

        const phaseChanged = phase !== lastPhaseRef.current;
        const fileChanged = localIdx !== lastFileIndexRef.current;
        const saveStatusChanged = saveStatus !== lastSaveStatusRef.current;

        if (phaseChanged || fileChanged) {
          if (onResetLogs) onResetLogs();
        }

        if (phaseChanged) {
          lastPhaseRef.current = phase;
          if (phase === 'download') {
            onLog(`[kaggle]${filePrefix ? ' ' + filePrefix : ''}\nDownload started\n${currentFileName}`, 'system');
          } else if (phase === 'upload') {
            onLog(`[upload]${filePrefix ? ' ' + filePrefix : ''}\nUpload started\n${currentFileName}`, 'system');
          }
        }

        if (fileChanged) {
          if (lastFileIndexRef.current > 0 && localIdx > lastFileIndexRef.current) {
            onLog(
              `[kaggle]\nFile ${lastFileIndexRef.current} done · ${completedFiles} ok, ${failedFiles} failed`,
              failedFiles > 0 ? 'system' : 'success'
            );
            void refreshRemoteSession();
          }
          lastFileIndexRef.current = localIdx;
          firstProgressSeenRef.current = false;
        }

        if (saveStatusChanged) {
          lastSaveStatusRef.current = saveStatus;
          if (saveStatus === 'done') {
            onLog(`[upload]${filePrefix ? ' ' + filePrefix : ''}\nFile saved\n${currentFileName}`, 'success');
          }
        }

        if (json.save_status === 'done' && json.finished) {
          finishAll();
          clearRemoteSession();
          const totalBytes = typeof json.total_size_bytes === 'number' ? json.total_size_bytes : 0;
          const avgSpeed = typeof json.total_speed_bps === 'number' ? json.total_speed_bps : 0;
          const totalElapsed = typeof json.total_elapsed_seconds === 'number' ? json.total_elapsed_seconds : 0;

          const totalLine = totalBytes > 0
            ? `Total: ${formatBytes(totalBytes)} · avg ${formatBytes(avgSpeed)}/s · ${totalElapsed.toFixed(1)}s`
            : '';

          const summary = `All done: ${completedFiles} saved, ${failedFiles} failed`;

          if (onResetLogs) onResetLogs();
          onLog([
            summary,
            totalLine,
          ].filter(Boolean).join('\n'), failedFiles > 0 ? 'critical' : 'success');
          return;
        }

        if (json.status === 'error' && json.finished) {
          finishAll();
          clearRemoteSession();
          const summary = submittedTotal > 1
            ? `Failed: ${completedFiles} saved, ${failedFiles} failed`
            : `${currentFileName} failed: ${json.save_error || json.error || 'unknown error'}`;
          if (onResetLogs) onResetLogs();
          onLog(summary, 'critical');
          return;
        }

        if (json.status === 'error' && !json.finished) {
          const errMsg = json.save_error || json.error || 'unknown error';
          const tag = phase === 'upload' ? '[upload]' : '[kaggle]';
          onLog(`${tag}${filePrefix ? ' ' + filePrefix : ''}\nError: ${errMsg}\n${currentFileName}`, 'critical');
          return;
        }

        const percent = typeof json.percent === 'number' ? json.percent : 0;
        const currentHuman = json.current_human || '0 B';
        const totalHuman = json.total_human || '0 B';
        const speedHuman = json.speed_human || '0 B/s';
        const eta = json.eta_seconds;
        const elapsed = json.elapsed;

        if (phase === 'upload') {
          const entry = buildProgressEntry(
            'upload',
            filePrefix,
            currentFileName,
            percent,
            currentHuman,
            totalHuman,
            speedHuman,
            eta,
            'upload',
            elapsed
          );
          onProgressLog(entry);
          return;
        }

        if (phase === 'download') {
          const hasProgress = percent > 0 || currentHuman !== '0 B';
          if (!hasProgress) return;

          if (!firstProgressSeenRef.current) {
            firstProgressSeenRef.current = true;
          }

          const entry = buildProgressEntry(
            'kaggle',
            filePrefix,
            currentFileName,
            percent,
            currentHuman,
            totalHuman,
            speedHuman,
            eta,
            'download'
          );
          onProgressLog(entry);
          return;
        }
      } catch (e: unknown) {
        pollFailRef.current += 1;
        if (pollFailRef.current < POLL_MAX_FAILS) return;
        finishAll();
        const errMsg = e instanceof Error ? e.message : 'unknown';
        onLog(`${fallbackFileName} Kaggle progress error: ${errMsg}`, 'critical');
      }
    };

    progressPollRef.current = window.setInterval(tick, 1000);
    void tick();
  }, [onLog, onProgressLog, onReplaceProgress, onResetLogs, refreshRemoteSession, clearRemoteSession]);

  const handleTorrentStart = useCallback(async (magnet: string) => {
    setTorrentStarting(true);
    setTorrentInfoHash(null);
    setTorrentFiles([]);
    inputUrlRef.current = magnet;

    const newInfoHash = extractMagnetInfoHash(magnet);
    const prevMagnet = kaggleSessionMagnetRef.current;
    const prevInfoHash = prevMagnet ? extractMagnetInfoHash(prevMagnet) : '';

    if (kaggleSessionIdRef.current && newInfoHash && prevInfoHash && newInfoHash !== prevInfoHash) {
      onLog('Different magnet detected. Clearing previous worker session.', 'system');
      clearRemoteSession();
    }

    onLog('Magnet link detected.', 'system');
    onLog('Contacting tracker and fetching metadata...', 'system');
    try {
      const API_BASE = getActiveBase();
      const qs = new URLSearchParams({ magnet }).toString();
      const res = await fetchWithTimeout(`${API_BASE}/torrent/start?${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnet }),
      }, 180000);
      const json: TorrentStartResponse = await res.json().catch(() => ({} as TorrentStartResponse));
      if (!res.ok || !json.ok) {
        onLog(`Torrent start failed: ${json.detail || `HTTP ${res.status}`}`, 'critical');
        return;
      }
      const files = json.files || [];
      setTorrentInfoHash(json.info_hash || null);
      setTorrentFiles(files);
      onLog(`Info hash: ${json.info_hash || 'unknown'}`, 'success');
      onLog(`Files found: ${files.length} · ${json.total_size_human || ''}`.trim(), 'success');
      void refreshRemoteSession();
    } catch (e: unknown) {
      onLog(`Torrent start failed: ${getErrorMessage(e, 'unknown error')}`, 'critical');
    } finally {
      setTorrentStarting(false);
    }
  }, [onLog, refreshRemoteSession, clearRemoteSession]);

  const handleTorrentRemoteStart = useCallback(async (files: TorrentFile[]) => {
    if (!torrentInfoHash) return;
    if (kaggleBusy) return;
    if (!files.length) return;

    const st = saveTargetRef.current;
    if (!st || !st.token || !st.repoId) {
      onLog('Select a Hugging Face account and repository first.', 'critical');
      return;
    }

    if (onResetLogs) onResetLogs();

    submittedFilesRef.current = files;
    currentSubmittedIdxRef.current = 0;

    const firstFile = files[0];
    // Every submission gets a fresh session. The backend reuses the Kaggle worker
    // through its queue; old session IDs are never reopened or overwritten.
    onLog(`Submitting a fresh torrent session for ${files.length} file${files.length > 1 ? 's' : ''}.`, 'system');
    onLog('Requesting the reusable Kaggle worker queue...', 'system');

    const payloadFiles = files.map(f => ({ index: f.index, name: f.name, size: f.size }));

    setKaggleBusy(true);

    try {
      const API_BASE = getActiveBase();
      const body: Record<string, unknown> = {
        magnet: inputUrlRef.current,
        token: st.token,
        repo_id: st.repoId,
        repo_type: st.repoType,
        folder: st.folder,
        files: payloadFiles,
        runner: 'kaggle',
      };
      const res = await fetchWithTimeout(`${API_BASE}/torrent/kaggle-start`, {
        method: 'POST',
        headers: { ...(await getKaggleAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, 30000);
      const json: TorrentKaggleStartResponse = await res
        .json()
        .catch(() => ({} as TorrentKaggleStartResponse));
      if (!res.ok || !json.ok || !json.session_id) {
        throw new Error(json.detail || `HTTP ${res.status}`);
      }
      if (json.runner !== 'kaggle') throw new Error(json.runner_error || 'Kaggle worker was not started. Check the backend configuration.');

      kaggleSessionIdRef.current = json.session_id;
      kaggleSessionMagnetRef.current = inputUrlRef.current;
      writeStoredSessionId(json.session_id);
      writeStoredSessionMagnet(inputUrlRef.current);
      await refreshRemoteSession();

      onLog(`Session ID: ${json.session_id}`, 'system');
      onLog(`Files in session: ${json.files_count || files.length}`, 'system');
<<<<<<< HEAD
      if (isAppending) {
        onLog('Kaggle worker resumed automatically.', 'success');
      } else if (json.reused_worker) {
=======
      if (json.reused_worker) {
>>>>>>> b71a9cf (update src)
        onLog('Active Kaggle worker reused. Session queued...', 'success');
      } else {
        onLog('Kaggle worker started automatically.', 'success');
      }
      onLog('Waiting for Kaggle to process the selected files...', 'system');

      pollRemoteProgress(json.session_id, firstFile.name);
    } catch (e: unknown) {
      setKaggleBusy(false);
      const errMsg = e instanceof Error ? e.message : 'unknown error';
      onLog(`Failed to start Kaggle worker: ${errMsg}`, 'critical');
    }
<<<<<<< HEAD
  }, [torrentInfoHash, kaggleBusy, onLog, pollRemoteProgress, refreshRemoteSession, onResetLogs, ensureLiveSession]);
=======
  }, [torrentInfoHash, kaggleBusy, onLog, pollRemoteProgress, refreshRemoteSession, onResetLogs]);
>>>>>>> b71a9cf (update src)

  const resetRemoteSession = useCallback(() => {
    clearRemoteSession();
    onLog('Kaggle worker session cleared. The next run will start a new worker.', 'system');
  }, [clearRemoteSession, onLog]);

  const hasTorrentPanel = torrentInfoHash !== null && torrentFiles.length > 0;

  return {
    torrentInfoHash,
    torrentFiles,
    torrentStarting,
    hasTorrentPanel,
    kaggleSession,
    kaggleFileIndexes,
    kaggleBusy,
    handleTorrentStart,
    handleTorrentRemoteStart,
    resetTorrent,
    resetRemoteSession,
    refreshRemoteSession,
  };
};
