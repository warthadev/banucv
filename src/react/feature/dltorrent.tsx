// src/react/feature/dltorrent.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { formatBytes } from '@config/utils';
import type { TorrentFile } from '@hook/usedltorrent';

interface DlTorrentProps {
  infoHash: string | null;
  files: TorrentFile[];
  onColab?: (files: TorrentFile[]) => void;
  colabEnabled?: boolean;
  colabSessionId?: string | null;
  colabBusy?: boolean;
}

const DlTorrent: React.FC<DlTorrentProps> = ({
  infoHash,
  files,
  onColab,
  colabEnabled = false,
  colabSessionId = null,
  colabBusy = false,
}) => {
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) =>
      String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' }) || a.index - b.index
    );
  }, [files]);

  const isBusy = colabBusy;
  const selectedCount = selectedIndexes.size;

  const hasActiveSession = !!colabSessionId;
  const colabTitle = hasActiveSession
    ? 'Append to existing Colab session'
    : 'Run download in Google Colab (server bebas beban)';

  const allSelected = sortedFiles.length > 0 && selectedIndexes.size === sortedFiles.length;

  useEffect(() => {
    if (isBusy) {
      setSelectedIndexes(prev => (prev.size === 0 ? prev : new Set()));
    }
  }, [isBusy]);

  const toggleSelection = useCallback((file: TorrentFile) => {
    if (isBusy) return;
    setSelectedIndexes(prev => {
      const next = new Set(prev);
      if (next.has(file.index)) {
        next.delete(file.index);
      } else {
        next.add(file.index);
      }
      return next;
    });
  }, [isBusy]);

  const selectAll = useCallback(() => {
    if (isBusy) return;
    setSelectedIndexes(new Set(sortedFiles.map(f => f.index)));
  }, [isBusy, sortedFiles]);

  const deselectAll = useCallback(() => {
    if (isBusy) return;
    setSelectedIndexes(new Set());
  }, [isBusy]);

  const handleColab = useCallback(() => {
    if (isBusy) return;
    if (!onColab || selectedIndexes.size === 0) return;
    const selected = sortedFiles.filter(f => selectedIndexes.has(f.index));
    if (selected.length === 0) return;
    onColab(selected);
    setSelectedIndexes(new Set());
  }, [isBusy, onColab, selectedIndexes, sortedFiles]);

  return (
    <div className="downloader-result-card">
      <div className="downloader-result-body">
        <div className="downloader-torrent-header-row">
          <p className="downloader-title downloader-title--inline">
            Torrent · {infoHash ? infoHash.slice(0, 12) + '...' : ''}
          </p>
          <div className="downloader-torrent-selection-actions">
            <button
              type="button"
              className="cloudview-selection-bar-btn"
              onClick={allSelected ? deselectAll : selectAll}
              disabled={isBusy || sortedFiles.length === 0}
              title={allSelected ? 'Deselect all' : 'Select all'}
            >
              {allSelected ? <CheckCircle2 size={16} /> : <Circle size={16} />}
              <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
            </button>
            {colabEnabled && onColab && (
              <button
                type="button"
                className="cloudview-selection-bar-btn"
                onClick={handleColab}
                disabled={isBusy || selectedCount === 0}
                title={colabTitle}
              >
                {colabBusy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <ExternalLink size={16} />
                )}
                <span>
                  {colabBusy
                    ? 'Processing...'
                    : hasActiveSession
                      ? 'Add to Colab'
                      : 'Run in Colab'}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="downloader-torrent-plain-list">
          {sortedFiles.map(file => {
            const isDisabled = isBusy;
            const isSelected = selectedIndexes.has(file.index);

            const itemClass = [
              'downloader-torrent-plain-item',
              isSelected ? 'downloader-torrent-plain-item--selected' : '',
            ].filter(Boolean).join(' ');

            const clickable = !isBusy;

            return (
              <div
                key={file.index}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : -1}
                className={itemClass}
                onClick={clickable ? () => toggleSelection(file) : undefined}
                onKeyDown={clickable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSelection(file);
                  }
                } : undefined}
                style={{
                  opacity: isDisabled ? 0.5 : 1,
                  cursor: clickable ? 'pointer' : 'not-allowed',
                  pointerEvents: clickable ? 'auto' : 'none',
                }}
                aria-disabled={!clickable}
              >
                <span
                  className={`downloader-torrent-plain-checkbox${isSelected ? ' downloader-torrent-plain-checkbox--checked' : ''}`}
                >
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="downloader-torrent-plain-name">
                  {file.name}
                </span>
                <span className="downloader-torrent-plain-size">
                  {formatBytes(file.size)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DlTorrent;