// src/react/feature/dllog.tsx
import React from 'react';
import { Copy, RefreshCw } from 'lucide-react';

type LogType = 'system' | 'critical' | 'success';

export interface LogItem {
  id?: number;
  msg: string;
  type: LogType;
  progress?: boolean;
}

export interface KaggleRemoteSessionView {
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
  kaggleSession?: KaggleRemoteSessionView | null;
  onResetSession?: () => void;
}

const getLogColor = (type: LogType) => {
  if (type === 'critical') return '#ef4444';
  if (type === 'success') return '#22c55e';
  return 'var(--global-color-text-secondary)';
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
  kaggleSession,
  onResetSession,
}) => {
  const expired = !!kaggleSession && kaggleSession.secondsLeft <= 0;

  return (
    <div className="downloader-console-wrap">
      <div className="downloader-console-header">
        <span className="downloader-console-label">● kernel log</span>
        <div className="downloader-console-header-actions">
          {kaggleSession && (
            <>
              <div className="downloader-kaggle-session-stack">
                <span
                  className={`downloader-kaggle-session-timer${expired ? ' is-expired' : ''}`}
                  translate="no"
                >
                  {formatCountdown(kaggleSession.secondsLeft)}
                </span>
                <span
                  className="downloader-kaggle-session-id"
                  translate="no"
                >
                  [{getSessionTag(kaggleSession.sessionType)}] {kaggleSession.sessionId}
                </span>
              </div>
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
      </div>
    </div>
  );
};

export default DlLog;
