// src/react/feature/dllog.tsx
import React, { useState } from 'react';
import { Copy, Check, RefreshCw, ExternalLink } from 'lucide-react';

type LogType = 'system' | 'critical' | 'success';

export interface LogItem {
  id?: number;
  msg: string;
  type: LogType;
  progress?: boolean;
}

export interface ColabSessionView {
  sessionId: string;
  secondsLeft: number;
  ttlSeconds: number;
  sessionType: 'torrent' | 'universal';
}

interface DlLogProps {
  logs: LogItem[];
  isMobile: boolean;
  copyLabel: string;
  onCopy: () => void;
  terminalRef: React.RefObject<HTMLDivElement | null>;
  colabSession?: ColabSessionView | null;
  onCopySession?: () => Promise<boolean>;
  onResetSession?: () => void;
  colabUrl?: string;
}

const getLogColor = (type: LogType) => {
  if (type === 'critical') return '#ef4444';
  if (type === 'success') return '#22c55e';
  return 'var(--text-sub)';
};

const formatCountdown = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
};

const getSessionTag = (type: 'torrent' | 'universal'): string => {
  return type === 'torrent' ? 'TRN' : 'UNI';
};

const DlLog: React.FC<DlLogProps> = ({
  logs,
  isMobile,
  onCopy,
  terminalRef,
  colabSession,
  onCopySession,
  onResetSession,
  colabUrl,
}) => {
  const [sessionCopied, setSessionCopied] = useState(false);

  const handleCopySession = async () => {
    if (!onCopySession) return;
    const ok = await onCopySession();
    if (ok) {
      setSessionCopied(true);
      setTimeout(() => setSessionCopied(false), 2000);
    }
  };

  const expired = !!colabSession && colabSession.secondsLeft <= 0;
  const showColabLink = !!(colabSession && colabUrl);

  return (
    <div className="downloader-console-wrap">
      <div className="downloader-console-header">
        <span className="downloader-console-label">● kernel log</span>
        <div className="downloader-console-header-actions">
          {colabSession && (
            <>
              <div className="downloader-colab-session-stack">
                <span
                  className={`downloader-colab-session-timer${expired ? ' is-expired' : ''}`}
                  translate="no"
                >
                  {formatCountdown(colabSession.secondsLeft)}
                </span>
                <span
                  className="downloader-colab-session-id"
                  translate="no"
                >
                  [{getSessionTag(colabSession.sessionType)}] {colabSession.sessionId}
                </span>
              </div>
              <button
                type="button"
                className="cloudview-selection-bar-btn"
                onClick={handleCopySession}
                title="Copy session ID"
              >
                {sessionCopied ? <Check size={16} /> : <Copy size={16} />}
                <span>{sessionCopied ? 'Copied' : 'Copy Session'}</span>
              </button>
              {expired && onResetSession && (
                <button
                  type="button"
                  className="cloudview-selection-bar-btn"
                  onClick={onResetSession}
                  title="Start new session"
                >
                  <RefreshCw size={16} />
                  <span>Reset</span>
                </button>
              )}
            </>
          )}
          <button
            type="button"
            className="cloudview-selection-bar-btn"
            onClick={onCopy}
            title="Copy log"
          >
            <Copy size={16} />
            <span>Copy Log</span>
          </button>
        </div>
      </div>

      <div
        ref={terminalRef}
        className={`downloader-terminal${isMobile ? ' mobile' : ''}`}
      >
        {logs.length === 0 && (
          <span className="downloader-terminal-empty">
            # Waiting for commands...
          </span>
        )}
        {logs.map((log, i) => (
          <React.Fragment key={log.id ?? i}>
            <div
              className="downloader-log-line"
              data-type={log.type}
              style={{
                color: getLogColor(log.type),
              }}
            >
              {log.msg}
            </div>
            <div className="downloader-log-spacer" aria-hidden="true" />
          </React.Fragment>
        ))}
        {showColabLink && (
          <div className="downloader-colab-url-row" style={{ marginTop: 4 }}>
            <a
              className="downloader-colab-url-link"
              href={colabUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} />
              Open Colab
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default DlLog;