// src/react/hook/usedluniversal.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveBase } from '@config/api';
import { getKaggleAuthHeaders } from '@config/kagglecredentials';
import { getSiteLabel, normalizeSiteLabel } from '@config/sitelabel';

const SESSION_STORAGE_KEY = 'wartha_universal_session_id';
const POLL_MAX_FAILS = 15;

type LogType = 'system' | 'critical' | 'success';

interface UniversalStartResponse {
  ok?: boolean;
  session_id?: string;
  detail?: string;
  runner?: string;
  runner_error?: string | null;
  reused?: boolean;
  reused_worker?: boolean;
}

interface UniversalResolveResponse {
  ok?: boolean;
  formats?: UniversalFormat[];
  title?: string;
  thumbnail?: string;
  uploader?: string;
  duration?: number;
  reason?: unknown;
  site?: string | null;
}

export interface UniversalSaveTarget {
  repoId: string;
  repoType: string;
  folder: string;
  token: string;
}

export interface UniversalFormat {
  index: number;
  name: string;
  size: number;
  format_id: string;
  label?: string;
}

export interface UniversalMeta {
  title: string;
  thumbnail: string | null;
  uploader: string | null;
  duration: number | null;
}

export interface UniversalResolved {
  source: 'server' | 'worker';
  formats: UniversalFormat[];
  meta: UniversalMeta | null;
}

const normalizeMeta = (raw: unknown): UniversalMeta | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title : '';
  const thumbnail = typeof record.thumbnail === 'string' && record.thumbnail.startsWith('https://') ? record.thumbnail : null;
  if (!title && !thumbnail) return null;
  return {
    title,
    thumbnail,
    uploader: typeof record.uploader === 'string' ? record.uploader : null,
    duration: typeof record.duration === 'number' ? record.duration : null,
  };
};

interface UniversalProgressResponse {
  ok: boolean;
  session_id?: string;
  status?: string;
  phase?: string | null;
  percent?: number;
  current_human?: string;
  total_human?: string;
  speed_human?: string;
  eta_seconds?: number | null;
  file_name?: string;
  finished?: boolean;
  error?: string | null;
  save_status?: string | null;
  save_error?: string | null;
  save_url?: string | null;
  expires_at?: number;
  seconds_left?: number;
  ttl_seconds?: number;
  formats?: UniversalFormat[];
  meta?: unknown;
}

interface UniversalSessionResponse {
  ok: boolean;
  session_id?: string;
  expires_at?: number;
  seconds_left?: number;
  ttl_seconds?: number;
  status?: string;
  formats?: UniversalFormat[];
}

export interface UniversalKaggleSessionInfo {
  sessionId: string;
  expiresAt: number;
  secondsLeft: number;
  ttlSeconds: number;
  formats?: UniversalFormat[];
}

interface UseDlUniversalOptions {
  onLog: (msg: string, type?: LogType) => void;
  onProgressLog: (msg: string) => void;
  onReplaceProgress: (finalMsg: string, type?: LogType) => void;
  onResetLogs?: () => void;
  saveTarget?: UniversalSaveTarget;
}

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
  try { return sessionStorage.getItem(SESSION_STORAGE_KEY); } catch { return null; }
};

const writeStoredSessionId = (sid: string | null) => {
  try {
    if (sid) sessionStorage.setItem(SESSION_STORAGE_KEY, sid);
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch { void 0; }
};

const buildProgressEntry = (
  fileName: string, percent: number, currentHuman: string, totalHuman: string,
  speedHuman: string, etaSeconds: number | null | undefined, phase: 'download' | 'upload'
): string => {
  const safePercent = Math.min(Math.max(percent, 0), 100);
  const barWidth = 20;
  const filled = Math.round((safePercent / 100) * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);

  let footer: string;
  if (phase === 'upload') {
    footer = `${currentHuman}/${totalHuman} \u00B7 uploading...`;
  } else {
    let eta = '--';
    if (typeof etaSeconds === 'number' && etaSeconds >= 0 && isFinite(etaSeconds)) {
      if (etaSeconds < 60) eta = `${Math.round(etaSeconds)}s`;
      else if (etaSeconds < 3600) eta = `${(etaSeconds / 60).toFixed(1)}m`;
      else eta = `${(etaSeconds / 3600).toFixed(1)}h`;
    }
    footer = `${currentHuman}/${totalHuman} \u00B7 ${speedHuman} \u00B7 ETA ${eta}`;
  }

  const tag = phase === 'upload' ? '[upload]' : '[download]';
  return `${tag}\n${fileName || 'unknown'}\n${bar}  ${safePercent.toFixed(1)}%\n${footer}`;
};

const pickSiteLabel = (known: { url: string; label: string } | null, url: string): string => {
  const key = url.trim();
  return known && known.url === key ? known.label : getSiteLabel(key);
};

export const useDlUniversal = ({
  onLog, onProgressLog, onReplaceProgress, onResetLogs, saveTarget,
}: UseDlUniversalOptions) => {
  const [kaggleSession, setKaggleSession] = useState<UniversalKaggleSessionInfo | null>(null);
  const [kaggleBusy, setKaggleBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [resolved, setResolved] = useState<UniversalResolved | null>(null);
  const resolvedRef = useRef<UniversalResolved | null>(null);

  const applyResolved = useCallback((next: UniversalResolved | null) => {
    resolvedRef.current = next;
    setResolved(next);
  }, []);

  const progressPollRef = useRef<number | null>(null);
  const sessionCountdownRef = useRef<number | null>(null);
  const saveTargetRef = useRef<UniversalSaveTarget | undefined>(saveTarget);
  useEffect(() => {
    saveTargetRef.current = saveTarget;
  }, [saveTarget]);

  const doneHandledRef = useRef<boolean>(false);
  const lastPhaseRef = useRef<string>('');
  const lastSaveStatusRef = useRef<string>('');
  const firstProgressSeenRef = useRef<boolean>(false);
  const pollFailRef = useRef<number>(0);
  const resolvingRef = useRef<boolean>(false);

  const kaggleSessionIdRef = useRef<string | null>(readStoredSessionId());

  const siteRef = useRef<string>('universal');
  // Site name learned from the server/worker (yt-dlp extractor), remembered per URL.
  const detectedSiteRef = useRef<{ url: string; label: string } | null>(null);
  const activeUrlRef = useRef<string>('');

  useEffect(() => {
    return () => {
      if (progressPollRef.current !== null) { window.clearInterval(progressPollRef.current); progressPollRef.current = null; }
      if (sessionCountdownRef.current !== null) { window.clearInterval(sessionCountdownRef.current); sessionCountdownRef.current = null; }
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
        if (next <= 0) return { ...prev, secondsLeft: 0 };
        return { ...prev, secondsLeft: next };
      });
    }, 1000);
  }, [stopSessionCountdown]);

  const fetchRemoteSessionInfo = useCallback(async (sid: string): Promise<UniversalKaggleSessionInfo | null> => {
    const API_BASE = getActiveBase();
    try {
      const res = await fetchWithTimeout(`${API_BASE}/universal/kaggle-session?session_id=${encodeURIComponent(sid)}`, {
        headers: await getKaggleAuthHeaders(),
      }, 12000);
      if (!res.ok) return null;
      const json: UniversalSessionResponse = await res.json();
      if (!json.ok || !json.session_id || typeof json.expires_at !== 'number') return null;
      return {
        sessionId: json.session_id,
        expiresAt: json.expires_at,
        secondsLeft: json.seconds_left ?? Math.max(0, Math.floor(json.expires_at - Date.now() / 1000)),
        ttlSeconds: json.ttl_seconds ?? 0,
        formats: json.formats || [],
      };
    } catch { return null; }
  }, []);

  const clearRemoteSession = useCallback(() => {
    kaggleSessionIdRef.current = null;
    writeStoredSessionId(null);
    setKaggleSession(null);
    setKaggleBusy(false);
    stopSessionCountdown();
  }, [stopSessionCountdown]);

  const refreshRemoteSession = useCallback(async () => {
    const sid = kaggleSessionIdRef.current;
    if (!sid) { setKaggleSession(null); stopSessionCountdown(); return; }
    const result = await fetchRemoteSessionInfo(sid);
    if (!result) { clearRemoteSession(); return; }
    setKaggleSession(result);
    startSessionCountdown();
  }, [fetchRemoteSessionInfo, startSessionCountdown, stopSessionCountdown, clearRemoteSession]);

  useEffect(() => { void refreshRemoteSession(); }, [refreshRemoteSession]);

  const pollProgress = useCallback((sessionId: string, fallbackFileName: string, stopOnResolve: boolean = false) => {
    if (progressPollRef.current !== null) {
      window.clearInterval(progressPollRef.current);
      progressPollRef.current = null;
    }

    doneHandledRef.current = false;
    lastPhaseRef.current = '';
    lastSaveStatusRef.current = '';
    firstProgressSeenRef.current = false;
    pollFailRef.current = 0;

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
      setStarting(false);
    };

    const tick = async () => {
      if (doneHandledRef.current) return;

      const API_BASE = getActiveBase();

      try {
        const res = await fetchWithTimeout(`${API_BASE}/universal/kaggle-session?session_id=${encodeURIComponent(sessionId)}`, {
          headers: await getKaggleAuthHeaders(),
        }, 15000);
        const json: UniversalProgressResponse = await res.json().catch(() => ({} as UniversalProgressResponse));
        if (!res.ok || !json.ok) {
          pollFailRef.current += 1;
          if (pollFailRef.current < POLL_MAX_FAILS) return;
          finishAll();
          if (res.status === 410) clearRemoteSession();
          const hint = res.status === 410 ? ' - session not found on server (restarted/expired), run Extract again' : '';
          onReplaceProgress(`Polling failed for ${fallbackFileName} (HTTP ${res.status})${hint}`, 'critical');
          return;
        }
        pollFailRef.current = 0;

        if (doneHandledRef.current) return;

        const resolvedFormats = (resolvingRef.current && json.status === 'waiting' && json.formats && json.formats.length > 0)
          ? json.formats : undefined;

        if (typeof json.expires_at === 'number') {
          setKaggleSession(prev => {
            if (!prev || prev.sessionId !== sessionId) return prev;
            const nextLeft = typeof json.seconds_left === 'number' ? json.seconds_left : Math.max(0, Math.floor(json.expires_at! - Date.now() / 1000));
            return { ...prev, expiresAt: json.expires_at!, secondsLeft: nextLeft, ttlSeconds: json.ttl_seconds ?? prev.ttlSeconds, formats: resolvedFormats ?? prev.formats };
          });
        }

        if (resolvedFormats) {
          resolvingRef.current = false;
          const workerSite = normalizeSiteLabel((json.meta as { site?: unknown } | null | undefined)?.site);
          if (workerSite) {
            detectedSiteRef.current = { url: activeUrlRef.current, label: workerSite };
            siteRef.current = workerSite;
          }
          applyResolved({ source: 'worker', formats: resolvedFormats, meta: normalizeMeta(json.meta) });
          if (stopOnResolve) {
            finishAll();
            onReplaceProgress(`Formats extracted. Select a format in the app and click Run.`, 'success');
            return;
          }
        }

        const phase = json.phase || '';
        const saveStatus = json.save_status || '';
        const fileName = json.file_name || fallbackFileName;

        const phaseChanged = phase !== lastPhaseRef.current;
        const saveStatusChanged = saveStatus !== lastSaveStatusRef.current;

        if (phaseChanged) {
          lastPhaseRef.current = phase;
          if (phase === 'download') onLog(`[download]\nDownload started\n${fileName}`, 'system');
          else if (phase === 'upload') onLog(`[upload]\nUpload started\n${fileName}`, 'system');
          else if (phase === 'setup') onLog(`[setup]\nKaggle kernel is running, preparing dependencies...`, 'system');
        }

        if (saveStatusChanged) {
          lastSaveStatusRef.current = saveStatus;
          if (saveStatus === 'done') onLog(`[upload]\nFile saved\n${fileName}`, 'success');
        }

        if (json.save_status === 'done' && json.finished) {
          finishAll();
          clearRemoteSession();
          onReplaceProgress(`All done`, 'success');
          return;
        }

        if (json.status === 'error' && json.finished) {
          finishAll();
          clearRemoteSession();
          onReplaceProgress(`Failed: ${json.save_error || json.error || 'unknown error'}`, 'critical');
          return;
        }

        if (json.status === 'error' && !json.finished) {
          const errMsg = json.save_error || json.error || 'unknown error';
          onLog(`[${phase || 'error'}]\nError: ${errMsg}\n${fileName}`, 'critical');
          return;
        }

        const percent = typeof json.percent === 'number' ? json.percent : 0;
        const currentHuman = json.current_human || '0 B';
        const totalHuman = json.total_human || '0 B';
        const speedHuman = json.speed_human || '0 B/s';
        const eta = json.eta_seconds;

        if (phase === 'upload') {
          onProgressLog(buildProgressEntry(fileName, percent, currentHuman, totalHuman, speedHuman, eta, 'upload'));
          return;
        }

        if (phase === 'download') {
          const hasProgress = percent > 0 || currentHuman !== '0 B';
          if (!hasProgress) return;
          if (!firstProgressSeenRef.current) firstProgressSeenRef.current = true;
          onProgressLog(buildProgressEntry(fileName, percent, currentHuman, totalHuman, speedHuman, eta, 'download'));
        }
      } catch (e: unknown) {
        pollFailRef.current += 1;
        if (pollFailRef.current < POLL_MAX_FAILS) return;
        finishAll();
        onLog(`${fallbackFileName} progress error: ${getErrorMessage(e, 'unknown')}`, 'critical');
      }
    };

    progressPollRef.current = window.setInterval(tick, 1000);
    void tick();
  }, [onLog, onProgressLog, onReplaceProgress, clearRemoteSession, applyResolved]);

  const resolveViaRemote = useCallback(async (url: string) => {
    activeUrlRef.current = url.trim();
    siteRef.current = pickSiteLabel(detectedSiteRef.current, url);
    const st = saveTargetRef.current;
    if (!st || !st.token || !st.repoId) {
      onLog('Server could not read this link. Select a Hugging Face account and repository so the Kaggle worker can resolve it.', 'critical');
      return;
    }

    setStarting(true);
    setKaggleBusy(true);
    onLog(`[${siteRef.current}]\nPreparing resolve session...`, 'system');

    try {
      const API_BASE = getActiveBase();
<<<<<<< HEAD
      // Setiap URL baru wajib mendapat session ID baru.
      // Worker yang sedang aktif akan menerima session ini melalui queue.
=======
>>>>>>> b71a9cf (update src)
      const body = {
        url: url.trim(),
        token: st.token, repo_id: st.repoId, repo_type: st.repoType, folder: st.folder,
        runner: 'kaggle',
      };

      const res = await fetchWithTimeout(`${API_BASE}/universal/kaggle-start`, {
        method: 'POST', headers: { ...(await getKaggleAuthHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }, 30000);
      const json: UniversalStartResponse = await res.json().catch(() => ({} as UniversalStartResponse));
      if (!res.ok || !json.ok || !json.session_id) throw new Error(json.detail || `HTTP ${res.status}`);
      if (json.runner !== 'kaggle') throw new Error(json.runner_error || 'Kaggle worker was not started. Check the backend configuration.');

      kaggleSessionIdRef.current = json.session_id;
      writeStoredSessionId(json.session_id);
      await refreshRemoteSession();

      onLog(`[${siteRef.current}]\nSession ID: ${json.session_id}`, 'system');
      if (json.reused) {
        onLog(`[${siteRef.current}]\nExisting Kaggle worker session reused for this URL.`, 'success');
        onLog(`[${siteRef.current}]\nWaiting for worker to extract formats...`, 'system');
      } else if (json.reused_worker) {
        onLog(`[${siteRef.current}]\nActive Kaggle worker reused. Session queued...`, 'success');
        onLog(`[${siteRef.current}]\nExtracting formats on active worker...`, 'system');
      } else {
        onLog(`[${siteRef.current}]\nKaggle worker started automatically.`, 'success');
        onLog(`[${siteRef.current}]\nKaggle kernel is booting (usually 1-2 minutes), then extracting formats...`, 'system');
      }

      resolvingRef.current = true;
      pollProgress(json.session_id, url.slice(0, 60), true);
    } catch (e: unknown) {
      setKaggleBusy(false);
      setStarting(false);
      onLog(`[${siteRef.current}]\nFailed to start resolve: ${getErrorMessage(e, 'unknown error')}`, 'critical');
    }
  }, [onLog, pollProgress, refreshRemoteSession]);

  const handleResolve = useCallback(async (url: string) => {
    activeUrlRef.current = url.trim();
    siteRef.current = pickSiteLabel(detectedSiteRef.current, url);
    const clean = url.trim();
    if (!clean) {
      onLog('URL is required.', 'critical');
      return;
    }

    if (onResetLogs) onResetLogs();
    applyResolved(null);
    setStarting(true);
    onLog(`[${siteRef.current}]\nAnalyzing link on server...`, 'system');

    try {
      const API_BASE = getActiveBase();
      const res = await fetchWithTimeout(`${API_BASE}/universal/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: clean }),
      }, 45000);
      const json: UniversalResolveResponse = await res.json().catch(() => ({} as UniversalResolveResponse));
      if (res.ok && json.ok && Array.isArray(json.formats) && json.formats.length > 0) {
        applyResolved({
          source: 'server',
          formats: json.formats,
          meta: normalizeMeta({ title: json.title, thumbnail: json.thumbnail, uploader: json.uploader, duration: json.duration }),
        });
        const serverSite = normalizeSiteLabel(json.site);
        if (serverSite) {
          detectedSiteRef.current = { url: activeUrlRef.current, label: serverSite };
          siteRef.current = serverSite;
        }
        setStarting(false);
        onLog(`[${siteRef.current}]\n${json.formats.length} formats found. Select a format and click Run.`, 'success');
        return;
      }
      onLog(`[${siteRef.current}]\nServer could not read this link${json.reason ? ` (${String(json.reason).slice(0, 80)})` : ''}. Falling back to the Kaggle worker...`, 'system');
    } catch {
      onLog(`[${siteRef.current}]\nServer resolve unavailable. Falling back to the Kaggle worker...`, 'system');
    }

    setStarting(false);
    await resolveViaRemote(clean);
  }, [onLog, onResetLogs, applyResolved, resolveViaRemote]);

  const startRemoteWithSelection = useCallback(async (url: string, formats: UniversalFormat[]) => {
    activeUrlRef.current = url.trim();
    siteRef.current = pickSiteLabel(detectedSiteRef.current, url);
    const st = saveTargetRef.current;
    if (!st || !st.token || !st.repoId) {
      onLog('Select a Hugging Face account and repository first.', 'critical');
      return;
    }

    if (onResetLogs) onResetLogs();
    setStarting(true);
    setKaggleBusy(true);
    onLog(`[${siteRef.current}]\nPreparing session...`, 'system');

    try {
      const API_BASE = getActiveBase();
<<<<<<< HEAD
      // Jangan gunakan ulang session ID URL sebelumnya.
      // Session baru akan diantrikan ke worker Kaggle yang masih hidup.
      const res = await fetch(`${API_BASE}/universal/kaggle-start`, {
=======
      const res = await fetchWithTimeout(`${API_BASE}/universal/kaggle-start`, {
>>>>>>> b71a9cf (update src)
        method: 'POST', headers: { ...(await getKaggleAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          token: st.token, repo_id: st.repoId, repo_type: st.repoType, folder: st.folder,
          runner: 'kaggle',
          formats, preselected: true,
        }),
      }, 30000);
      const json: UniversalStartResponse = await res.json().catch(() => ({} as UniversalStartResponse));
      if (!res.ok || !json.ok || !json.session_id) throw new Error(json.detail || `HTTP ${res.status}`);
      if (json.runner !== 'kaggle') throw new Error(json.runner_error || 'Kaggle worker was not started. Check the backend configuration.');

      kaggleSessionIdRef.current = json.session_id;
      writeStoredSessionId(json.session_id);
      await refreshRemoteSession();

      onLog(`[${siteRef.current}]\nSession ID: ${json.session_id}`, 'system');
      if (json.reused) {
        onLog(`[${siteRef.current}]\nExisting Kaggle worker session reused; the download will start automatically.`, 'success');
      } else if (json.reused_worker) {
        onLog(`[${siteRef.current}]\nActive Kaggle worker reused. Session queued for download...`, 'success');
      } else {
        onLog(`[${siteRef.current}]\nKaggle worker started automatically.`, 'success');
        onLog(`[${siteRef.current}]\nKaggle kernel is booting (usually 1-2 minutes)...`, 'system');
      }

      resolvingRef.current = false;
      pollProgress(json.session_id, url.slice(0, 60), false);
    } catch (e: unknown) {
      setKaggleBusy(false);
      setStarting(false);
      onLog(`[${siteRef.current}]\nFailed to start: ${getErrorMessage(e, 'unknown error')}`, 'critical');
    }
  }, [onLog, onResetLogs, pollProgress, refreshRemoteSession]);

  const handleDownload = useCallback(async (url: string, formats: UniversalFormat[]) => {
    activeUrlRef.current = url.trim();
    siteRef.current = pickSiteLabel(detectedSiteRef.current, url);
    if (!formats.length) return;

    if (resolvedRef.current?.source === 'server') {
      await startRemoteWithSelection(url, formats);
      return;
    }

    if (onResetLogs) onResetLogs();
    setStarting(true);
    setKaggleBusy(true);
    onLog(`[${siteRef.current}]\nSending selection to the Kaggle worker...`, 'system');

    try {
      const API_BASE = getActiveBase();
      const r = await fetchWithTimeout(`${API_BASE}/universal/kaggle-update?session_id=${kaggleSessionIdRef.current}`, {
        method: 'POST', headers: { ...(await getKaggleAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'download', formats,
          finished: false, phase: 'resolve', percent: 0,
          current_human: '0 B', total_human: '0 B', speed_human: '0 B/s', eta_seconds: null,
          file_name: '', error: null, save_status: null, save_error: null, save_url: null,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      resolvingRef.current = false;

      onLog(`[${siteRef.current}]\nKaggle worker resumed. Downloading...`, 'success');
      pollProgress(kaggleSessionIdRef.current!, url.slice(0, 60), false);

    } catch (e: unknown) {
      setKaggleBusy(false);
      setStarting(false);
      onLog(`[${siteRef.current}]\nFailed to resume download: ${getErrorMessage(e, 'unknown error')}`, 'critical');
    }
  }, [onLog, onResetLogs, pollProgress, startRemoteWithSelection]);

  const clearResolved = useCallback(() => { applyResolved(null); }, [applyResolved]);

  const resetSession = useCallback(() => {
    clearRemoteSession();
    onLog(`[${siteRef.current}]\nSession cleared.`, 'system');
  }, [clearRemoteSession, onLog]);

  return {
    starting, kaggleSession, kaggleBusy, resolved, clearResolved,
    handleResolve, handleDownload, resetSession, refreshRemoteSession,
  };
};
