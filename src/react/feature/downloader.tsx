// src/react/feature/downloader.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, Check, Play, CheckCircle2, Circle, Eye, EyeOff, LoaderCircle, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import DlLog from './dllog';
import type { LogItem, KaggleRemoteSessionView } from './dllog';
import DlSave from './dlsave';
import type { DlSaveSelection } from './dlsave';
import { isMagnetLink, useDlTorrent } from '@hook/usedltorrent';
import { useDlUniversal } from '@hook/usedluniversal';
import type { UniversalFormat } from '@hook/usedluniversal';
import { formatBytes } from '@config/utils';
import { getAuth } from '@config/firebase';
import { deleteKaggleCredentials, loadKaggleCredentials, saveKaggleCredentials, type KaggleCredentials } from '@config/kagglecredentials';

type LogType = 'system' | 'critical' | 'success';
const nowTime = (): string => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const formatLogPrefix = (type: LogType): string => {
  const prefix = type === 'critical' ? '[error]' : type === 'success' ? '[success]' : '[info]';
  return `${prefix} ${nowTime()} `;
};

const SAVE_SELECTION_STORAGE_KEY = 'wartha_dl_save_selection';

const DEFAULT_SAVE_SELECTION: DlSaveSelection = {
  accountId: '', accountLabel: '', repoId: '', repoType: 'dataset', folder: '', token: '',
};

const readStoredSaveSelection = (): DlSaveSelection => {
  try {
    const raw = localStorage.getItem(SAVE_SELECTION_STORAGE_KEY);
    if (!raw) return DEFAULT_SAVE_SELECTION;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SAVE_SELECTION;
    return {
      accountId: typeof parsed.accountId === 'string' ? parsed.accountId : '',
      accountLabel: typeof parsed.accountLabel === 'string' ? parsed.accountLabel : '',
      repoId: typeof parsed.repoId === 'string' ? parsed.repoId : '',
      repoType: parsed.repoType === 'model' || parsed.repoType === 'space' || parsed.repoType === 'dataset' ? parsed.repoType : 'dataset',
      folder: typeof parsed.folder === 'string' ? parsed.folder : '',
      token: typeof parsed.token === 'string' ? parsed.token : '',
    };
  } catch { return DEFAULT_SAVE_SELECTION; }
};

const isValidUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try { const u = new URL(trimmed); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
};

const formatDuration = (sec?: number | null): string => {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

interface KaggleCredentialFormProps {
  username: string;
  token: string;
  showToken: boolean;
  hasCredentials: boolean;
  saving: boolean;
  error: string | null;
  message: string | null;
  onUsernameChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onToggleToken: () => void;
  onSave: () => void;
  onDelete: () => void;
}

const KaggleCredentialForm: React.FC<KaggleCredentialFormProps> = ({
  username, token, showToken, hasCredentials, saving, error, message,
  onUsernameChange, onTokenChange, onToggleToken, onSave, onDelete,
}) => (
  <div className="global-stack global-stack--gap-10">
    {hasCredentials && (
      <div className="su-profile-card setting-agent-safe-status global-inline-row global-inline-row--gap-8">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>
          Kaggle connected as {username}
          <small>Saved as plaintext in this account’s Firestore settings.</small>
        </span>
      </div>
    )}
    <div className="setting-agent-form">
      <label className="setting-agent-label" htmlFor="downloader-kaggle-username">Kaggle username</label>
      <input
        id="downloader-kaggle-username"
        className="setting-agent-input"
        type="text"
        name="kaggle-username"
        value={username}
        onChange={event => onUsernameChange(event.target.value)}
        placeholder="Your Kaggle username"
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="none"
        disabled={saving}
        required
      />
      <label className="setting-agent-label" htmlFor="downloader-kaggle-token">Kaggle API token</label>
      <div className="su-list-item setting-agent-key-control">
        <input
          id="downloader-kaggle-token"
          className="setting-agent-input setting-agent-key-input"
          type={showToken ? 'text' : 'password'}
          name="kaggle-api-token"
          value={token}
          onChange={event => onTokenChange(event.target.value)}
          placeholder={hasCredentials ? 'Enter a token to replace the saved token' : 'Paste your Kaggle API token'}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          disabled={saving}
          required
        />
        <button
          className="setting-agent-reveal-btn global-icon-button"
          type="button"
          onClick={onToggleToken}
          aria-label={showToken ? 'Hide Kaggle API token' : 'Reveal Kaggle API token'}
          aria-pressed={showToken}
          disabled={!token || saving}
        >
          {showToken ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
    {error && <p className="setting-agent-error global-inline-row global-inline-row--gap-8" role="alert"><AlertCircle size={15} />{error}</p>}
    <div className="settings-section-actions">
      <button className="setting-agent-primary settings-section-save-btn" type="button" onClick={onSave} disabled={saving}>
        {saving ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <Save size={16} aria-hidden="true" />}
        {saving ? 'Saving…' : hasCredentials ? 'Update credentials' : 'Save and continue'}
      </button>
      {hasCredentials && (
        <button className="setting-agent-danger" type="button" onClick={onDelete} disabled={saving}>
          {saving ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <Trash2 size={16} aria-hidden="true" />}
          Remove
        </button>
      )}
      {message && <p className="settings-save-feedback" role="status"><CheckCircle2 size={15} aria-hidden="true" /><span>{message}</span></p>}
    </div>
  </div>
);

const Downloader: React.FC = () => {
  const [inputUrl, setInputUrl] = useState('');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [copyLabel, setCopyLabel] = useState('copy');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [saveSelection, setSaveSelectionState] = useState<DlSaveSelection>(() => readStoredSaveSelection());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [kaggleAuthReady, setKaggleAuthReady] = useState(false);
  const [kaggleCredentials, setKaggleCredentials] = useState<KaggleCredentials | null>(null);
  const [kaggleUsername, setKaggleUsername] = useState('');
  const [kaggleToken, setKaggleToken] = useState('');
  const [showKaggleToken, setShowKaggleToken] = useState(false);
  const [kaggleCredentialsLoading, setKaggleCredentialsLoading] = useState(true);
  const [kaggleCredentialsSaving, setKaggleCredentialsSaving] = useState(false);
  const [kaggleCredentialsError, setKaggleCredentialsError] = useState<string | null>(null);
  const [kaggleCredentialsMessage, setKaggleCredentialsMessage] = useState<string | null>(null);
  const kaggleCredentialsRequestRef = useRef(0);

  const detectedType = useMemo<'torrent' | 'universal' | 'invalid' | null>(() => {
    const trimmed = inputUrl.trim();
    if (!trimmed) return null;
    if (isMagnetLink(trimmed)) return 'torrent';
    if (isValidUrl(trimmed)) return 'universal';
    return 'invalid';
  }, [inputUrl]);
  
  const [thumbFailed, setThumbFailed] = useState(false);
  const [selectedFormatIndexes, setSelectedFormatIndexes] = useState<Set<number>>(new Set());
  const [tSelectedIndexes, setTSelectedIndexes] = useState<Set<number>>(new Set());

  const terminalRef = useRef<HTMLDivElement>(null);
  const detectLogIdRef = useRef<number | null>(null);
  const logIdCounterRef = useRef<number>(0);
  const lastResolvedUrlRef = useRef<string>('');

  const setSaveSelection = useCallback((next: DlSaveSelection) => {
    setSaveSelectionState(next);
    try { localStorage.setItem(SAVE_SELECTION_STORAGE_KEY, JSON.stringify(next)); } catch { void 0; }
  }, []);

  const refreshKaggleCredentials = useCallback(async (user: User | null) => {
    const requestId = ++kaggleCredentialsRequestRef.current;
    setKaggleCredentialsLoading(Boolean(user));
    setKaggleCredentialsError(null);
    if (!user) {
      setKaggleCredentials(null);
      setKaggleUsername('');
      setKaggleToken('');
      setKaggleCredentialsLoading(false);
      return;
    }
    try {
      const saved = await loadKaggleCredentials();
      if (requestId !== kaggleCredentialsRequestRef.current) return;
      setKaggleCredentials(saved);
      setKaggleUsername(saved?.username || '');
      setKaggleToken(saved?.apiToken || '');
      setShowKaggleToken(false);
    } catch (error) {
      if (requestId === kaggleCredentialsRequestRef.current) {
        setKaggleCredentials(null);
        setKaggleCredentialsError(error instanceof Error ? error.message : 'Unable to load this account’s Kaggle settings.');
      }
    } finally {
      if (requestId === kaggleCredentialsRequestRef.current) setKaggleCredentialsLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    let disposed = false;
    getAuth().then(firebaseAuth => {
      if (disposed) return;
      unsubscribe = onAuthStateChanged(firebaseAuth, user => {
        setCurrentUser(user);
        setKaggleAuthReady(true);
        setKaggleCredentialsMessage(null);
        setKaggleCredentialsError(null);
        setKaggleToken('');
        void refreshKaggleCredentials(user);
      });
    }).catch((error: unknown) => {
      setKaggleAuthReady(true);
      setKaggleCredentialsLoading(false);
      setKaggleCredentialsError(error instanceof Error ? error.message : 'Firebase authentication is unavailable.');
    });
    return () => {
      disposed = true;
      kaggleCredentialsRequestRef.current += 1;
      unsubscribe();
    };
  }, [refreshKaggleCredentials]);

  const handleSaveKaggleCredentials = useCallback(async () => {
    setKaggleCredentialsMessage(null);
    setKaggleCredentialsError(null);
    if (!currentUser) {
      setKaggleCredentialsError('Sign in to save Kaggle credentials for this account.');
      return;
    }
    if (!kaggleUsername.trim() || !kaggleToken.trim()) {
      setKaggleCredentialsError('Enter both the Kaggle username and API token.');
      return;
    }
    setKaggleCredentialsSaving(true);
    try {
      const saved = await saveKaggleCredentials(kaggleUsername, kaggleToken);
      setKaggleCredentials(saved);
      setKaggleUsername(saved.username);
      setKaggleToken(saved.apiToken);
      setShowKaggleToken(false);
      setKaggleCredentialsMessage('Kaggle credentials saved for this account.');
    } catch (error) {
      setKaggleCredentialsError(error instanceof Error ? error.message : 'Could not save this account’s Kaggle credentials.');
    } finally {
      setKaggleCredentialsSaving(false);
    }
  }, [currentUser, kaggleUsername, kaggleToken]);

  const handleDeleteKaggleCredentials = useCallback(async () => {
    if (!currentUser || kaggleCredentialsSaving) return;
    setKaggleCredentialsSaving(true);
    setKaggleCredentialsError(null);
    setKaggleCredentialsMessage(null);
    try {
      await deleteKaggleCredentials();
      setKaggleCredentials(null);
      setKaggleUsername('');
      setKaggleToken('');
      setShowKaggleToken(false);
      setKaggleCredentialsMessage('Kaggle credentials removed. Save them again to enter the Downloader.');
    } catch (error) {
      setKaggleCredentialsError(error instanceof Error ? error.message : 'Could not remove this account’s Kaggle credentials.');
    } finally {
      setKaggleCredentialsSaving(false);
    }
  }, [currentUser, kaggleCredentialsSaving]);

  const addLog = useCallback((msg: string, type: LogType = 'system') => {
    const id = ++logIdCounterRef.current;
    const trimmed = msg.trimStart();
    let fullMsg: string;
    if (trimmed.startsWith('[') && trimmed.includes(']')) {
      const bracketEnd = trimmed.indexOf(']');
      fullMsg = `${trimmed.slice(0, bracketEnd + 1)} ${nowTime()} ${trimmed.slice(bracketEnd + 1)}`;
    } else { fullMsg = `${formatLogPrefix(type)}\n${msg}`; }
    setLogs(prev => [...prev, { id, msg: fullMsg, type }]);
    return id;
  }, []);

  const removeLogById = useCallback((id: number) => { setLogs(prev => prev.filter(l => l.id !== id)); }, []);

  const upsertDetectLog = useCallback((msg: string, type: LogType = 'success') => {
    const fullMsg = `${formatLogPrefix(type)}\n${msg}`;
    setLogs(prev => {
      if (detectLogIdRef.current !== null) {
        const idx = prev.findIndex(l => l.id === detectLogIdRef.current);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], msg: fullMsg, type };
          return next;
        }
      }
      const id = ++logIdCounterRef.current;
      detectLogIdRef.current = id;
      return [...prev, { id, msg: fullMsg, type }];
    });
  }, []);

  const resetLogs = useCallback(() => { setLogs([]); detectLogIdRef.current = null; }, []);

  const upsertProgressLog = useCallback((msg: string) => {
    const trimmed = msg.trimStart();
    let taggedMsg = msg;
    if (trimmed.startsWith('[download]')) taggedMsg = `[download] ${nowTime()} ${trimmed.slice('[download]'.length)}`;
    else if (trimmed.startsWith('[upload]')) taggedMsg = `[upload] ${nowTime()} ${trimmed.slice('[upload]'.length)}`;
    else if (trimmed.startsWith('[kaggle]')) taggedMsg = `[kaggle] ${nowTime()} ${trimmed.slice('[kaggle]'.length)}`;

    setLogs(prev => {
      const next = [...prev];
      const lastIndex = next.length - 1;
      if (lastIndex >= 0 && next[lastIndex].progress) next[lastIndex] = { ...next[lastIndex], msg: taggedMsg };
      else next.push({ msg: taggedMsg, type: 'system', progress: true, id: ++logIdCounterRef.current });
      return next;
    });
  }, []);

  const replaceProgressLogWithFinal = useCallback((finalMsg: string, type: LogType = 'success') => {
    const fullMsg = `${formatLogPrefix(type)}\n${finalMsg}`;
    setLogs(prev => {
      const next = [...prev];
      const lastIndex = next.length - 1;
      if (lastIndex >= 0 && next[lastIndex].progress) next[lastIndex] = { msg: fullMsg, type };
      else next.push({ msg: fullMsg, type, id: ++logIdCounterRef.current });
      return next;
    });
  }, []);

  const {
    torrentInfoHash, torrentFiles, torrentStarting, hasTorrentPanel,
    kaggleSession: tKaggleSession, kaggleBusy: tKaggleBusy,
    handleTorrentStart, handleTorrentRemoteStart, copyRemoteSession: tCopySession, resetRemoteSession: tResetSession,
  } = useDlTorrent({
    onLog: addLog, onProgressLog: upsertProgressLog, onReplaceProgress: replaceProgressLogWithFinal, onResetLogs: resetLogs, saveTarget: saveSelection,
  });

  const {
    starting: uStarting, kaggleSession: uKaggleSession, kaggleBusy: uKaggleBusy,
    resolved: uResolved, clearResolved: uClearResolved,
    handleResolve: uHandleResolve, handleDownload: uHandleDownload, copySession: uCopySession, resetSession: uResetSession,
  } = useDlUniversal({
    onLog: addLog, onProgressLog: upsertProgressLog, onReplaceProgress: replaceProgressLogWithFinal, onResetLogs: resetLogs, saveTarget: saveSelection,
  });

  const uFormats: UniversalFormat[] = useMemo(() => uResolved?.formats ?? [], [uResolved]);
  const uMeta = uResolved?.meta ?? null;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    const trimmed = inputUrl.trim();
    uClearResolved();
    if (!trimmed) {
      if (detectLogIdRef.current !== null) { removeLogById(detectLogIdRef.current); detectLogIdRef.current = null; }
      return;
    }
    if (detectedType === 'torrent') {
      upsertDetectLog('Link detected: Magnet (Torrent)', 'success');
    } else if (detectedType === 'universal') {
      upsertDetectLog('Link detected: Universal URL', 'success');
    } else {
      upsertDetectLog('Link detected: Invalid URL or Magnet', 'critical');
    }
  }, [inputUrl, detectedType, upsertDetectLog, removeLogById, uClearResolved]);
  const copyToClipboard = useCallback(() => {
    if (!logs.length) return;
    navigator.clipboard.writeText(logs.map(l => l.msg).join('\n\n')).then(() => {
      setCopyLabel('copied!');
      setTimeout(() => setCopyLabel('copy'), 2000);
    }).catch(() => {});
  }, [logs]);

  const handleRun = useCallback(async () => {
    if (!inputUrl.trim()) { addLog('URL must not be empty', 'critical'); return; }
    
    if (detectedType === 'torrent') {
      setTSelectedIndexes(new Set());
      resetLogs();
      await handleTorrentStart(inputUrl.trim());
    } else if (detectedType === 'universal') {
      setSelectedFormatIndexes(new Set());
      setThumbFailed(false);
      uClearResolved();
      const trimmed = inputUrl.trim();
      if (lastResolvedUrlRef.current && lastResolvedUrlRef.current !== trimmed) {
        uResetSession();
      }
      lastResolvedUrlRef.current = trimmed;
      await uHandleResolve(trimmed);
    } else {
      addLog('Invalid link format.', 'critical');
    }
  }, [inputUrl, detectedType, addLog, handleTorrentStart, uHandleResolve, uClearResolved, uResetSession, resetLogs]);

  const handleUniversalDownload = useCallback(async () => {
    if (selectedFormatIndexes.size === 0) { addLog('Select at least one format', 'critical'); return; }
    const selected = uFormats.filter(f => selectedFormatIndexes.has(f.index));
    await uHandleDownload(inputUrl.trim(), selected);
  }, [inputUrl, addLog, uHandleDownload, selectedFormatIndexes, uFormats]);

  const handleTorrentRemoteClick = useCallback(() => {
    if (tSelectedIndexes.size === 0) { addLog('Select at least one file', 'critical'); return; }
    const selected = torrentFiles.filter(f => tSelectedIndexes.has(f.index));
    handleTorrentRemoteStart(selected);
  }, [tSelectedIndexes, torrentFiles, addLog, handleTorrentRemoteStart]);

  const toggleUIndex = (index: number) => {
    setSelectedFormatIndexes(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleTIndex = (index: number) => {
    setTSelectedIndexes(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const activeRemoteSession = useMemo<KaggleRemoteSessionView | null>(() => {
    if (detectedType === 'torrent' && tKaggleSession) {
      return { sessionId: tKaggleSession.sessionId, secondsLeft: tKaggleSession.secondsLeft, ttlSeconds: tKaggleSession.ttlSeconds, sessionType: 'torrent' };
    }
    if (detectedType === 'universal' && uKaggleSession) {
      return { sessionId: uKaggleSession.sessionId, secondsLeft: uKaggleSession.secondsLeft, ttlSeconds: uKaggleSession.ttlSeconds, sessionType: 'universal' };
    }
    return null;
  }, [detectedType, tKaggleSession, uKaggleSession]);

  const handleCopyActiveSession = useCallback(async () => {
    if (activeRemoteSession?.sessionType === 'torrent') return await tCopySession();
    if (activeRemoteSession?.sessionType === 'universal') return await uCopySession();
    return false;
  }, [activeRemoteSession, tCopySession, uCopySession]);

  const handleResetActiveSession = useCallback(() => {
    if (activeRemoteSession?.sessionType === 'torrent') tResetSession();
    if (activeRemoteSession?.sessionType === 'universal') uResetSession();
  }, [activeRemoteSession, tResetSession, uResetSession]);

  const remoteEnabledForTorrent = useMemo(() => !!(saveSelection.accountId && saveSelection.repoId && saveSelection.token), [saveSelection]);
  const isBusy = torrentStarting || uStarting || tKaggleBusy || uKaggleBusy;
  const allUSelected = uFormats.length > 0 && selectedFormatIndexes.size === uFormats.length;
  const allTSelected = torrentFiles.length > 0 && tSelectedIndexes.size === torrentFiles.length;

  const kaggleCredentialForm = (
    <KaggleCredentialForm
      username={kaggleUsername}
      token={kaggleToken}
      showToken={showKaggleToken}
      hasCredentials={Boolean(kaggleCredentials)}
      saving={kaggleCredentialsSaving}
      error={kaggleCredentialsError}
      message={kaggleCredentialsMessage}
      onUsernameChange={setKaggleUsername}
      onTokenChange={value => { setKaggleToken(value); setKaggleCredentialsMessage(null); }}
      onToggleToken={() => setShowKaggleToken(value => !value)}
      onSave={() => void handleSaveKaggleCredentials()}
      onDelete={() => void handleDeleteKaggleCredentials()}
    />
  );

  if (!kaggleAuthReady || kaggleCredentialsLoading) {
    return (
      <div className="home-container global-page">
        <main className="home-hero">
          <div className="downloader-body-inner">
            <section className="setting-agent-card global-card global-section global-card--padded" aria-label="Kaggle credentials" aria-busy="true">
              <div className="setting-agent-loading global-inline-row global-inline-row--gap-8" role="status">
                <LoaderCircle size={18} className="setting-agent-spinner" /> Loading Kaggle settings…
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (!currentUser || !kaggleCredentials) {
    return (
      <div className="home-container global-page">
        <main className="home-hero">
          <div className="downloader-body-inner">
            <section className="setting-agent-card global-card global-section global-card--padded" aria-label="Set up Kaggle for Downloader">
              <h1 className="downloader-title">Connect your Kaggle account</h1>
              <p className="setting-agent-note">Save your Kaggle username and API token to continue to the Downloader. These credentials apply only to your signed-in account.</p>
              {!currentUser ? (
                <p className="setting-agent-note" role="status">Sign in to your Firebase account before setting up Kaggle credentials.</p>
              ) : kaggleCredentialForm}
            </section>
          </div>
        </main>
      </div>
    );
  }
  
  return (
    <div className="home-container global-page">
      <main className="home-hero">
        <div className="downloader-body-inner">
          <details className="global-card global-card--padded global-section" style={{ marginBottom: 12 }}>
            <summary className="setting-agent-label" style={{ cursor: 'pointer' }}>Manage Kaggle credentials · {kaggleCredentials.username}</summary>
            <div style={{ marginTop: 12 }}>{kaggleCredentialForm}</div>
          </details>
          <div className="downloader-input-row">
            <DlSave selection={saveSelection} onChange={setSaveSelection} />
            <input type="text" className="downloader-input" placeholder="Paste Magnet or Video URL here..." value={inputUrl} onChange={e => setInputUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRun()} />
            <button className={`downloader-btn-run${isBusy ? ' loading' : ''}`} onClick={handleRun} disabled={isBusy}>
              {isBusy && <span className="downloader-spinner" />}
              {torrentStarting || uStarting ? 'Processing...' : 'Extract'}
            </button>
          </div>

          <div className={`downloader-body${isMobile ? ' mobile' : ''}`}>
            <DlLog logs={logs} isMobile={isMobile} copyLabel={copyLabel} onCopy={copyToClipboard} terminalRef={terminalRef}
              kaggleSession={activeRemoteSession} onCopySession={handleCopyActiveSession} onResetSession={handleResetActiveSession} />

            {detectedType === 'torrent' && hasTorrentPanel && (
              <div className="downloader-results-wrap global-section global-section--spaced">
                <div className="downloader-result-card global-card">
                  <div className="downloader-result-body">
                    <div className="downloader-torrent-header-row">
                      <p className="downloader-title downloader-title--inline">Torrent · {torrentInfoHash ? torrentInfoHash.slice(0, 12) + '...' : ''}</p>
                      <div className="downloader-torrent-selection-actions">
                        <button type="button" className="cloudview-selection-bar-btn" onClick={() => setTSelectedIndexes(allTSelected ? new Set() : new Set(torrentFiles.map(f => f.index)))} disabled={isBusy}>
                          {allTSelected ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                          <span className="hidden-mobile">{allTSelected ? 'Deselect All' : 'Select All'}</span>
                        </button>
                        <button type="button" className="cloudview-selection-bar-btn" onClick={handleTorrentRemoteClick} disabled={isBusy || !remoteEnabledForTorrent || tSelectedIndexes.size === 0}>
                          <ExternalLink size={16} /> <span className="hidden-mobile">Run on Kaggle</span>
                        </button>
                      </div>
                    </div>
                    <div className="downloader-torrent-plain-list">
                      {torrentFiles.map(f => {
                        const isSelected = tSelectedIndexes.has(f.index);
                        return (
                          <div key={f.index} role="button" className={`downloader-torrent-plain-item ${isSelected ? 'downloader-torrent-plain-item--selected' : ''}`} onClick={() => !isBusy && toggleTIndex(f.index)}>
                            <span className={`downloader-torrent-plain-checkbox${isSelected ? ' downloader-torrent-plain-checkbox--checked' : ''}`}>
                              {isSelected && <Check size={16} strokeWidth={3} />}
                            </span>
                            <span className="downloader-torrent-plain-name">{f.name}</span>
                            <span className="downloader-torrent-plain-size">{formatBytes(f.size)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detectedType === 'universal' && uFormats.length > 0 && (
              <div className="downloader-results-wrap global-section global-section--spaced">
                <div className="downloader-result-card global-card">
                  <div className="downloader-result-body">
                    {uMeta && (uMeta.title || uMeta.thumbnail) && (
                      <div className="downloader-preview">
                        {uMeta.thumbnail && !thumbFailed && (
                          <img
                            className="downloader-preview-thumb"
                            src={uMeta.thumbnail}
                            alt=""
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            onError={() => setThumbFailed(true)}
                          />
                        )}
                        <div className="downloader-preview-info" style={{ textAlign: 'left' }}>
                          {uMeta.title && <p className="downloader-preview-title">{uMeta.title}</p>}
                          {(uMeta.uploader || uMeta.duration) && (
                            <p className="downloader-preview-sub">{[uMeta.uploader, formatDuration(uMeta.duration)].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="downloader-torrent-header-row">
                      <p className="downloader-title downloader-title--inline">Universal · {uFormats.length} formats</p>
                      <div className="downloader-torrent-selection-actions">
                        <button type="button" className="cloudview-selection-bar-btn" onClick={allUSelected ? () => setSelectedFormatIndexes(new Set()) : () => setSelectedFormatIndexes(new Set(uFormats.map(f => f.index)))} disabled={isBusy}>
                          {allUSelected ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                          <span className="hidden-mobile">{allUSelected ? 'Deselect All' : 'Select All'}</span>
                        </button>
                        <button type="button" className="cloudview-selection-bar-btn" onClick={handleUniversalDownload} disabled={isBusy || selectedFormatIndexes.size === 0}>
                          {uKaggleSession?.sessionId ? <><ExternalLink size={16} /> <span className="hidden-mobile">Add to Kaggle</span></> : <><Play size={16} /> <span className="hidden-mobile">Run on Kaggle</span></>}
                        </button>
                      </div>
                    </div>
                    <div className="downloader-torrent-plain-list">
                      {uFormats.map(f => {
                        const isSelected = selectedFormatIndexes.has(f.index);
                        return (
                          <div key={f.index} role="button" className={`downloader-torrent-plain-item ${isSelected ? 'downloader-torrent-plain-item--selected' : ''}`} onClick={() => !isBusy && toggleUIndex(f.index)}>
                            <span className={`downloader-torrent-plain-checkbox${isSelected ? ' downloader-torrent-plain-checkbox--checked' : ''}`}>
                              {isSelected && <Check size={16} strokeWidth={3} />}
                            </span>
                            <span className="downloader-torrent-plain-name">{f.name}</span>
                            <span className="downloader-torrent-plain-size">{[f.label, f.size > 0 ? formatBytes(f.size) : ''].filter(Boolean).join(' · ')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default Downloader;
