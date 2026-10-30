// src/react/hook/usedluniversal.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveBase } from '@config/api';

const SESSION_STORAGE_KEY = 'wartha_universal_session_id';
const POLL_MAX_FAILS = 15;

type LogType = 'system' | 'critical' | 'success';

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
  source: 'server' | 'colab';
  formats: UniversalFormat[];
  meta: UniversalMeta | null;
}

const normalizeMeta = (raw: any): UniversalMeta | null => {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title : '';
  const thumbnail = typeof raw.thumbnail === 'string' && raw.thumbnail.startsWith('https://') ? raw.thumbnail : null;
  if (!title && !thumbnail) return null;
  return {
    title,
    thumbnail,
    uploader: typeof raw.uploader === 'string' ? raw.uploader : null,
    duration: typeof raw.duration === 'number' ? raw.duration : null,
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

export interface UniversalColabSessionInfo {
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

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { void 0; }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
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

export const useDlUniversal = ({
  onLog, onProgressLog, onReplaceProgress, onResetLogs, saveTarget,
}: UseDlUniversalOptions) => {
  const [colabSession, setColabSession] = useState<UniversalColabSessionInfo | null>(null);
  const [colabBusy, setColabBusy] = useState(false);
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
  saveTargetRef.current = saveTarget;

  const doneHandledRef = useRef<boolean>(false);
  const lastPhaseRef = useRef<string>('');
  const lastSaveStatusRef = useRef<string>('');
  const firstProgressSeenRef = useRef<boolean>(false);
  const pollFailRef = useRef<number>(0);
  const resolvingRef = useRef<boolean>(false);

  const colabSessionIdRef = useRef<string | null>(readStoredSessionId());

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
      setColabSession(prev => {
        if (!prev) return prev;
        const next = Math.max(0, Math.floor(prev.expiresAt - Date.now() / 1000));
        if (next <= 0) return { ...prev, secondsLeft: 0 };
        return { ...prev, secondsLeft: next };
      });
    }, 1000);
  }, [stopSessionCountdown]);

  const fetchColabSessionInfo = useCallback(async (sid: string): Promise<UniversalColabSessionInfo | null> => {
    const API_BASE = getActiveBase();
    try {
      const res = await fetch(`${API_BASE}/universal/colab-session?session_id=${encodeURIComponent(sid)}`);
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

  const clearColabSession = useCallback(() => {
    colabSessionIdRef.current = null;
    writeStoredSessionId(null);
    setColabSession(null);
    setColabBusy(false);
    stopSessionCountdown();
  }, [stopSessionCountdown]);

  const refreshColabSession = useCallback(async () => {
    const sid = colabSessionIdRef.current;
    if (!sid) { setColabSession(null); stopSessionCountdown(); return; }
    const result = await fetchColabSessionInfo(sid);
    if (!result) { setColabSession(null); stopSessionCountdown(); return; }
    setColabSession(result);
    startSessionCountdown();
  }, [fetchColabSessionInfo, startSessionCountdown, stopSessionCountdown]);

  useEffect(() => { void refreshColabSession(); }, [refreshColabSession]);

  const ensureLiveSession = useCallback(async (): Promise<string | null> => {
    const sid = colabSessionIdRef.current;
    if (!sid) return null;
    const info = await fetchColabSessionInfo(sid);
    if (info) return sid;
    colabSessionIdRef.current = null;
    writeStoredSessionId(null);
    setColabSession(null);
    stopSessionCountdown();
    return null;
  }, [fetchColabSessionInfo, stopSessionCountdown]);

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
      setColabBusy(false);
      setStarting(false);
    };

    const tick = async () => {
      if (doneHandledRef.current) return;

      const API_BASE = getActiveBase();

      try {
        const res = await fetch(`${API_BASE}/universal/colab-session?session_id=${encodeURIComponent(sessionId)}`);
        const json: UniversalProgressResponse = await res.json().catch(() => ({} as UniversalProgressResponse));
        if (!res.ok || !json.ok) {
          pollFailRef.current += 1;
          if (pollFailRef.current < POLL_MAX_FAILS) return;
          finishAll();
          const hint = res.status === 410 ? ' - session not found on server (restarted/expired), run Extract again' : '';
          onReplaceProgress(`Polling failed for ${fallbackFileName} (HTTP ${res.status})${hint}`, 'critical');
          return;
        }
        pollFailRef.current = 0;

        if (doneHandledRef.current) return;

        const resolvedFormats = (resolvingRef.current && json.status === 'waiting' && json.formats && json.formats.length > 0)
          ? json.formats : undefined;

        if (typeof json.expires_at === 'number') {
          setColabSession(prev => {
            if (!prev || prev.sessionId !== sessionId) return prev;
            const nextLeft = typeof json.seconds_left === 'number' ? json.seconds_left : Math.max(0, Math.floor(json.expires_at! - Date.now() / 1000));
            return { ...prev, expiresAt: json.expires_at!, secondsLeft: nextLeft, ttlSeconds: json.ttl_seconds ?? prev.ttlSeconds, formats: resolvedFormats ?? prev.formats };
          });
        }

        if (resolvedFormats) {
          resolvingRef.current = false;
          applyResolved({ source: 'colab', formats: resolvedFormats, meta: normalizeMeta(json.meta) });
          if (stopOnResolve) {
            finishAll();
            onReplaceProgress(`Formats extracted. Please select and click Run in Colab.`, 'success');
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
        }

        if (saveStatusChanged) {
          lastSaveStatusRef.current = saveStatus;
          if (saveStatus === 'done') onLog(`[upload]\nFile saved\n${fileName}`, 'success');
        }

        if (json.save_status === 'done' && json.finished) {
          finishAll();
          onReplaceProgress(`All done`, 'success');
          void refreshColabSession();
          return;
        }

        if (json.status === 'error' && json.finished) {
          finishAll();
          onReplaceProgress(`Failed: ${json.save_error || json.error || 'unknown error'}`, 'critical');
          void refreshColabSession();
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
      } catch (e: any) {
        pollFailRef.current += 1;
        if (pollFailRef.current < POLL_MAX_FAILS) return;
        finishAll();
        onLog(`${fallbackFileName} progress error: ${e?.message || 'unknown'}`, 'critical');
      }
    };

    progressPollRef.current = window.setInterval(tick, 1000);
    void tick();
  }, [onLog, onProgressLog, onReplaceProgress, refreshColabSession, applyResolved]);

  const resolveViaColab = useCallback(async (url: string) => {
    const st = saveTargetRef.current;
    if (!st || !st.token || !st.repoId) {
      onLog('Server could not read this link. Select a Hugging Face account and repository to resolve via Colab.', 'critical');
      return;
    }

    setStarting(true);
    setColabBusy(true);
    onLog(`[universal]\nPreparing resolve session...`, 'system');

    try {
      const API_BASE = getActiveBase();
      const liveSid = await ensureLiveSession();
      const body = {
        url: url.trim(),
        session_id: liveSid || undefined,
        token: st.token, repo_id: st.repoId, repo_type: st.repoType, folder: st.folder,
      };

      const res = await fetch(`${API_BASE}/universal/colab-start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok || !json.session_id) throw new Error(json.detail || `HTTP ${res.status}`);

      colabSessionIdRef.current = json.session_id;
      writeStoredSessionId(json.session_id);
      await refreshColabSession();

      onLog(`[universal]\nSession ID: ${json.session_id}`, 'system');
      const copied = await copyToClipboard(json.session_id);
      if (copied) onLog('[universal]\nSession ID copied to clipboard', 'success');
      else onLog('[universal]\nCopy Session ID manually', 'system');

      if (json.reused) {
        onLog('[universal]\nSession ID unchanged. If Colab is still running it will pick up this URL automatically.', 'success');
      } else {
        onLog('[universal]\nPlease open Colab and paste the Session ID manually.', 'success');
      }
      onLog('[universal]\nWaiting for Colab to extract formats...', 'system');

      resolvingRef.current = true;
      pollProgress(json.session_id, url.slice(0, 60), true);
    } catch (e: any) {
      setColabBusy(false);
      setStarting(false);
      onLog(`[universal]\nFailed to start resolve: ${e?.message || 'unknown error'}`, 'critical');
    }
  }, [onLog, pollProgress, refreshColabSession, ensureLiveSession]);

  const handleResolve = useCallback(async (url: string) => {
    const clean = url.trim();
    if (!clean) {
      onLog('URL is required.', 'critical');
      return;
    }

    if (onResetLogs) onResetLogs();
    applyResolved(null);
    setStarting(true);
    onLog('[universal]\nAnalyzing link on server...', 'system');

    try {
      const API_BASE = getActiveBase();
      const res = await fetch(`${API_BASE}/universal/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: clean }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json.ok && Array.isArray(json.formats) && json.formats.length > 0) {
        applyResolved({
          source: 'server',
          formats: json.formats,
          meta: normalizeMeta({ title: json.title, thumbnail: json.thumbnail, uploader: json.uploader, duration: json.duration }),
        });
        setStarting(false);
        onLog(`[universal]\n${json.formats.length} formats found. Select and run in Colab.`, 'success');
        return;
      }
      onLog(`[universal]\nServer could not read this link${json.reason ? ` (${String(json.reason).slice(0, 80)})` : ''}. Falling back to Colab...`, 'system');
    } catch {
      onLog('[universal]\nServer resolve unavailable. Falling back to Colab...', 'system');
    }

    setStarting(false);
    await resolveViaColab(clean);
  }, [onLog, onResetLogs, applyResolved, resolveViaColab]);

  const startColabWithSelection = useCallback(async (url: string, formats: UniversalFormat[]) => {
    const st = saveTargetRef.current;
    if (!st || !st.token || !st.repoId) {
      onLog('Select a Hugging Face account and repository first.', 'critical');
      return;
    }

    if (onResetLogs) onResetLogs();
    setStarting(true);
    setColabBusy(true);
    onLog('[universal]\nPreparing session...', 'system');

    try {
      const API_BASE = getActiveBase();
      const liveSid = await ensureLiveSession();
      const res = await fetch(`${API_BASE}/universal/colab-start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(), session_id: liveSid || undefined,
          token: st.token, repo_id: st.repoId, repo_type: st.repoType, folder: st.folder,
          formats, preselected: true,
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok || !json.session_id) throw new Error(json.detail || `HTTP ${res.status}`);

      colabSessionIdRef.current = json.session_id;
      writeStoredSessionId(json.session_id);
      await refreshColabSession();

      onLog(`[universal]\nSession ID: ${json.session_id}`, 'system');
      const copied = await copyToClipboard(json.session_id);
      if (copied) onLog('[universal]\nSession ID copied to clipboard', 'success');
      else onLog('[universal]\nCopy Session ID manually', 'system');

      if (json.reused) {
        onLog('[universal]\nSession ID unchanged. If Colab is still running it will start this download automatically.', 'success');
      } else {
        onLog('[universal]\nPlease open Colab and paste the Session ID manually.', 'success');
      }
      onLog('[universal]\nWaiting for Colab to start...', 'system');

      resolvingRef.current = false;
      pollProgress(json.session_id, url.slice(0, 60), false);
    } catch (e: any) {
      setColabBusy(false);
      setStarting(false);
      onLog(`[universal]\nFailed to start: ${e?.message || 'unknown error'}`, 'critical');
    }
  }, [onLog, onResetLogs, pollProgress, refreshColabSession, ensureLiveSession]);

  const handleDownload = useCallback(async (url: string, formats: UniversalFormat[]) => {
    if (!formats.length) return;

    if (resolvedRef.current?.source === 'server') {
      await startColabWithSelection(url, formats);
      return;
    }

    if (onResetLogs) onResetLogs();
    setStarting(true);
    setColabBusy(true);
    onLog(`[universal]\nSending selection to Colab...`, 'system');

    try {
      const API_BASE = getActiveBase();
      const r = await fetch(`${API_BASE}/universal/colab-update?session_id=${colabSessionIdRef.current}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'download', formats,
          finished: false, phase: 'resolve', percent: 0,
          current_human: '0 B', total_human: '0 B', speed_human: '0 B/s', eta_seconds: null,
          file_name: '', error: null, save_status: null, save_error: null, save_url: null,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      resolvingRef.current = false;

      onLog('[universal]\nColab resumed. Downloading...', 'success');
      pollProgress(colabSessionIdRef.current!, url.slice(0, 60), false);

    } catch (e: any) {
      setColabBusy(false);
      setStarting(false);
      onLog(`[universal]\nFailed to resume download: ${e?.message || 'unknown error'}`, 'critical');
    }
  }, [onLog, onResetLogs, pollProgress, startColabWithSelection]);

  const clearResolved = useCallback(() => { applyResolved(null); }, [applyResolved]);

  const copySession = useCallback(async (): Promise<boolean> => {
    const sid = colabSessionIdRef.current;
    if (!sid) return false;
    return await copyToClipboard(sid);
  }, []);

  const resetSession = useCallback(() => {
    clearColabSession();
    onLog('[universal]\nSession cleared.', 'system');
  }, [clearColabSession, onLog]);

  return {
    starting, colabSession, colabBusy, resolved, clearResolved,
    handleResolve, handleDownload, copySession, resetSession, refreshColabSession,
  };
};