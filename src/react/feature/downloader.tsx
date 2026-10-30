// src/react/feature/downloader.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Check, Play, CheckCircle2, Circle } from 'lucide-react';
import DlLog from './dllog';
import type { LogItem, ColabSessionView } from './dllog';
import DlSave from './dlsave';
import type { DlSaveSelection } from './dlsave';
import { isMagnetLink, useDlTorrent } from '@hook/usedltorrent';
import { useDlUniversal } from '@hook/usedluniversal';
import type { UniversalFormat } from '@hook/usedluniversal';
import { formatBytes } from '@config/utils';

type LogType = 'system' | 'critical' | 'success';

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

const Downloader: React.FC = () => {
  const [inputUrl, setInputUrl] = useState('');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [copyLabel, setCopyLabel] = useState('copy');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [saveSelection, setSaveSelectionState] = useState<DlSaveSelection>(() => readStoredSaveSelection());

  const [detectedType, setDetectedType] = useState<'torrent' | 'universal' | 'invalid' | null>(null);
  
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

  const nowTime = (): string => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatLogPrefix = (type: LogType): string => {
    const prefix = type === 'critical' ? '[error]' : type === 'success' ? '[success]' : '[info]';
    return `${prefix} ${nowTime()} `;
  };

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
    else if (trimmed.startsWith('[colab]')) taggedMsg = `[colab] ${nowTime()} ${trimmed.slice('[colab]'.length)}`;

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
    colabSession: tColabSession, colabBusy: tColabBusy,
    handleTorrentStart, handleTorrentColabStart, copyColabSession: tCopySession, resetColabSession: tResetSession,
  } = useDlTorrent({
    onLog: addLog, onProgressLog: upsertProgressLog, onReplaceProgress: replaceProgressLogWithFinal, onResetLogs: resetLogs, saveTarget: saveSelection,
  });

  const {
    starting: uStarting, colabSession: uColabSession, colabBusy: uColabBusy,
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
    setSelectedFormatIndexes(new Set());
    setThumbFailed(false);
  }, [uResolved]);

  useEffect(() => {
    if (torrentFiles.length > 0) {
      setTSelectedIndexes(new Set());
    }
  }, [torrentFiles]);

  useEffect(() => {
    const trimmed = inputUrl.trim();
    uClearResolved();

    if (!trimmed) {
      setDetectedType(null);
      if (detectLogIdRef.current !== null) { removeLogById(detectLogIdRef.current); detectLogIdRef.current = null; }
      return;
    }

    if (isMagnetLink(trimmed)) {
      setDetectedType('torrent');
      upsertDetectLog('Link detected: Magnet (Torrent)', 'success');
    } else if (isValidUrl(trimmed)) {
      setDetectedType('universal');
      upsertDetectLog('Link detected: Universal URL', 'success');
    } else {
      setDetectedType('invalid');
      upsertDetectLog('Link detected: Invalid URL or Magnet', 'critical');
    }
  }, [inputUrl, upsertDetectLog, removeLogById, uClearResolved]);

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
      resetLogs();
      await handleTorrentStart(inputUrl.trim());
    } else if (detectedType === 'universal') {
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

  const handleTorrentColabClick = useCallback(() => {
    if (tSelectedIndexes.size === 0) { addLog('Select at least one file', 'critical'); return; }
    const selected = torrentFiles.filter(f => tSelectedIndexes.has(f.index));
    handleTorrentColabStart(selected);
  }, [tSelectedIndexes, torrentFiles, addLog, handleTorrentColabStart]);

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

  const activeColabSession = useMemo<ColabSessionView | null>(() => {
    if (detectedType === 'torrent' && tColabSession) {
      return { sessionId: tColabSession.sessionId, secondsLeft: tColabSession.secondsLeft, ttlSeconds: tColabSession.ttlSeconds, sessionType: 'torrent' };
    }
    if (detectedType === 'universal' && uColabSession) {
      return { sessionId: uColabSession.sessionId, secondsLeft: uColabSession.secondsLeft, ttlSeconds: uColabSession.ttlSeconds, sessionType: 'universal' };
    }
    return null;
  }, [detectedType, tColabSession, uColabSession]);

  const activeColabUrl = useMemo(() => {
    if (detectedType === 'torrent' && tColabSession) return 'https://colab.research.google.com/drive/1HPCV9DbL2QCaahkxALemIyN2fQwcEGHd#scrollTo=GluOt8MjYi2C';
    if (detectedType === 'universal' && uColabSession) return 'https://colab.research.google.com/drive/1HPCV9DbL2QCaahkxALemIyN2fQwcEGHd#scrollTo=GluOt8MjYi2C';
    return undefined;
  }, [detectedType, tColabSession, uColabSession]);

  const handleCopyActiveSession = useCallback(async () => {
    if (activeColabSession?.sessionType === 'torrent') return await tCopySession();
    if (activeColabSession?.sessionType === 'universal') return await uCopySession();
    return false;
  }, [activeColabSession, tCopySession, uCopySession]);

  const handleResetActiveSession = useCallback(() => {
    if (activeColabSession?.sessionType === 'torrent') tResetSession();
    if (activeColabSession?.sessionType === 'universal') uResetSession();
  }, [activeColabSession, tResetSession, uResetSession]);

  const colabEnabledForTorrent = useMemo(() => !!(saveSelection.accountId && saveSelection.repoId && saveSelection.token), [saveSelection]);
  const isBusy = torrentStarting || uStarting || tColabBusy || uColabBusy;
  const allUSelected = uFormats.length > 0 && selectedFormatIndexes.size === uFormats.length;
  const allTSelected = torrentFiles.length > 0 && tSelectedIndexes.size === torrentFiles.length;
  
  const showColabBtn = (isBusy || uStarting || tColabBusy || uColabBusy) && activeColabSession && activeColabUrl;

  return (
    <div className="home-container">
      <main className="home-hero">
        <div className="downloader-body-inner">
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
              colabSession={activeColabSession} onCopySession={handleCopyActiveSession} onResetSession={handleResetActiveSession} />

            {showColabBtn && (
              <div style={{ width: '100%', marginTop: '-10px' }}>
                <a
                  href={activeColabUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="downloader-btn-run"
                  style={{ width: '100%', textDecoration: 'none', display: 'flex', padding: '12px', boxSizing: 'border-box' }}
                >
                  <ExternalLink size={18} />
                  <span>Buka Colab</span>
                </a>
              </div>
            )}

            {detectedType === 'torrent' && hasTorrentPanel && (
              <div className="downloader-results-wrap">
                <div className="downloader-result-card">
                  <div className="downloader-result-body">
                    <div className="downloader-torrent-header-row">
                      <p className="downloader-title downloader-title--inline">Torrent · {torrentInfoHash ? torrentInfoHash.slice(0, 12) + '...' : ''}</p>
                      <div className="downloader-torrent-selection-actions">
                        <button type="button" className="cloudview-selection-bar-btn" onClick={() => setTSelectedIndexes(allTSelected ? new Set() : new Set(torrentFiles.map(f => f.index)))} disabled={isBusy}>
                          {allTSelected ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                          <span className="hidden-mobile">{allTSelected ? 'Deselect All' : 'Select All'}</span>
                        </button>
                        <button type="button" className="cloudview-selection-bar-btn" onClick={handleTorrentColabClick} disabled={isBusy || !colabEnabledForTorrent || tSelectedIndexes.size === 0}>
                          <ExternalLink size={16} /> <span className="hidden-mobile">Run in Colab</span>
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
              <div className="downloader-results-wrap">
                <div className="downloader-result-card">
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
                          {uColabSession?.sessionId ? <><ExternalLink size={16} /> <span className="hidden-mobile">Add to Colab</span></> : <><Play size={16} /> <span className="hidden-mobile">Run in Colab</span></>}
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