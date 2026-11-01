// src/react/feature/cloudviewuipanel.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, FolderPlus, Hash, Users, Search, LayoutGrid, List, AlertCircle, Play, RefreshCw,
  HardDrive, ArrowUpDown, ArrowUp, ArrowDown, ImageIcon, Info, Pencil, Trash2, FolderInput,
  Check, CheckCircle2, Circle, Copy, ChevronRight, X, Camera, Video, Music, File, Download,
  Mic, Sticker, Gift, MonitorPlay, ExternalLink, Loader2, RectangleVertical
} from 'lucide-react';
import type { TelegramChat, TelegramFile, ViewMode, SortField, SortDir, TelegramFileMetadata } from '@config/telegram';
import { getColor, getLabel, formatBytes } from '@config/telegram';
import { MediaRender, type VideoMediaItem, type VideoMediaType } from '@system/mediarender';
import Loading from '@control/loading';
import { ThumbnailImage, VideoResBadge, FileIcon } from './cloudviewuithumb';
import {
  SelectionActionBar, RepoSelectionActionBar
} from './cloudviewuitoolbar';
import {
  RenameRepoModal, DeleteRepoModal, AddRepoModal, SquashRepoModal, VisibilityRepoModal
} from './cloudviewuimodal';
import { sanitizeText, formatDuration, formatRelativeDate, LONG_PRESS_DURATION } from '@config/cloudviewuiconfig';

const ViewIcon: React.FC<{ mode: ViewMode; size?: number }> = ({ mode, size = 15 }) => {
  if (mode === 'list') return <List size={size} />;
  if (mode === 'grid') return <LayoutGrid size={size} />;
  if (mode === 'poster') return <RectangleVertical size={size} />;
  return <ImageIcon size={size} />;
};

const SortIcon: React.FC<{ field: SortField; dir: SortDir; size?: number }> = ({ field, dir, size = 14 }) => {
  if (field === 'name') return dir === 'asc' ? <ArrowUp size={size} /> : <ArrowDown size={size} />;
  if (field === 'date') return dir === 'asc' ? <ArrowUp size={size} /> : <ArrowDown size={size} />;
  if (field === 'size') return dir === 'asc' ? <ArrowUp size={size} /> : <ArrowDown size={size} />;
  return dir === 'asc' ? <ArrowUp size={size} /> : <ArrowDown size={size} />;
};

export const DetailPanel: React.FC<{ file: TelegramFile | null; metadata?: TelegramFileMetadata | null }> = ({ file, metadata }) => {
  if (!file) return <div className="cloudview-detail-empty"><Info size={32} /><p>Select a file</p></div>;
  const sanitizedName = sanitizeText(file.name);
  const isFolder = (file as any)._isFolder === true;
  if (isFolder) {
    return (
      <div className="cloudview-detail-panel">
        <div className="cloudview-detail-header"><span>Properties</span></div>
        <div className="cloudview-detail-icon">
          <div className="cloudview-detail-icon-wrap" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
            <Folder size={36} />
          </div>
          <p className="cloudview-detail-fname">{sanitizedName}</p>
          <span className="cloudview-detail-ftype">Folder</span>
        </div>
        <div className="cloudview-detail-rows">
          <div className="cloudview-detail-row"><span>Type</span><strong>Folder</strong></div>
        </div>
      </div>
    );
  }
  return (
    <div className="cloudview-detail-panel">
      <div className="cloudview-detail-header"><span>Properties</span></div>
      <div className="cloudview-detail-icon">
        <div className="cloudview-detail-icon-wrap" style={{ background: getColor(file.media_type) + '20', color: getColor(file.media_type) }}>
          <FileIcon type={file.media_type} size={36} />
        </div>
        <p className="cloudview-detail-fname">{sanitizedName}</p>
        <span className="cloudview-detail-ftype">{getLabel(file.media_type)}</span>
      </div>
      <div className="cloudview-detail-rows">
        <div className="cloudview-detail-row"><span>Size</span><strong>{formatBytes(file.size)}</strong></div>
        <div className="cloudview-detail-row"><span>Type</span><strong>{getLabel(file.media_type)}</strong></div>
        {file.duration && <div className="cloudview-detail-row"><span>Duration</span><strong>{formatDuration(file.duration)}</strong></div>}
        {file.width && file.height && <div className="cloudview-detail-row"><span>Resolution</span><strong>{file.width}×{file.height}</strong></div>}
        {file.date && <div className="cloudview-detail-row"><span>Date</span><strong>{formatRelativeDate(file.date)}</strong></div>}
        {metadata?.format && <div className="cloudview-detail-row"><span>Format</span><strong>{sanitizeText(metadata.format)}</strong></div>}
        {metadata?.subtitleTracks && metadata.subtitleTracks.length > 0 && (
          <div className="cloudview-detail-row cloudview-detail-row--col">
            <span>Subtitles</span>
            <strong>{metadata.subtitleTracks.map(t => sanitizeText(t.language)).join(', ')}</strong>
          </div>
        )}
        {metadata?.audioTracks && metadata.audioTracks.length > 0 && (
          <div className="cloudview-detail-row cloudview-detail-row--col">
            <span>Audio Tracks</span>
            <strong>{metadata.audioTracks.map(t => sanitizeText(t.language)).join(', ')}</strong>
          </div>
        )}
        {file.caption && <div className="cloudview-detail-row cloudview-detail-row--col"><span>Caption</span><strong>{sanitizeText(file.caption)}</strong></div>}
      </div>
    </div>
  );
};

export const FilesPanel: React.FC<{
  selectedChat: TelegramChat | null;
  selectedRepo?: string;
  files: TelegramFile[];
  selectedFile: TelegramFile | null;
  loadingFiles: boolean;
  error: string | null;
  searchQuery: string;
  viewMode: ViewMode;
  sortField: SortField;
  sortDir: SortDir;
  showSortMenu: boolean;
  totalSize: number;
  sortMenuRef: React.RefObject<HTMLDivElement>;
  screenSize: 'mobile' | 'tablet' | 'desktop';
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  onCreateFolder: () => void;
  onToggleSortMenu: () => void;
  onSort: (field: SortField) => void;
  onCycleViewMode: () => void;
  onFileClick: (file: TelegramFile) => void;
  getStreamUrl: (chatId: number, msgId: number) => string;
  sourceType?: 'telegram' | 'hf_dataset';
  hfToken?: string;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onEnterSelection: (file: any) => void;
  onToggleSelection: (file: any) => void;
  onExitSelection: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  allSelected: boolean;
  selectedItemsCount: number;
  onBulkRename: () => void;
  onBulkMove: () => void;
  onBulkDelete: () => void;
  canBulkRename: boolean;
  canBulkMove: boolean;
  canBulkDelete: boolean;
  canSlideshow: boolean;
  slideshowKind?: 'image' | 'audio';
  onSlideshow: () => void;
  onCopy: () => void;
  canCopy: boolean;
  showCopy: boolean;
  onWatchExternal: () => void;
  canWatchExternal: boolean;
  isPublicView?: boolean;
}> = (props) => {
  const {
    selectedChat, selectedRepo, files, selectedFile, loadingFiles, error, searchQuery, viewMode,
    sortField, sortDir, showSortMenu, totalSize, sortMenuRef, screenSize,
    onSearchChange, onRefresh, onCreateFolder, onToggleSortMenu, onSort, onCycleViewMode, onFileClick,
    getStreamUrl, sourceType = 'telegram', hfToken, selectionMode, selectedIds,
    onEnterSelection, onToggleSelection, onExitSelection, onSelectAll, onDeselectAll, allSelected,
    selectedItemsCount, onBulkRename, onBulkMove, onBulkDelete, canBulkRename, canBulkMove, canBulkDelete,
    canSlideshow, slideshowKind, onSlideshow, onCopy, canCopy, showCopy, onWatchExternal, canWatchExternal,
    isPublicView = false,
  } = props;

  const isMobile = screenSize === 'mobile';
  const isDesktop = screenSize === 'desktop';
  const isTelegram = sourceType === 'telegram';
  const selectionEnabled = !isTelegram;

  const isFolder = useCallback((file: any) => file._isFolder === true, []);
  const getFileColor = useCallback((file: any) => isFolder(file) ? '#f59e0b' : getColor(file.media_type), [isFolder]);
  const getFileLabel = useCallback((file: any) => isFolder(file) ? 'Folder' : getLabel(file.media_type), [isFolder]);
  const renderResBadge = (file: any, style?: React.CSSProperties) => {
    if (sourceType !== 'hf_dataset' || file.media_type !== 'video' || isFolder(file)) return null;
    const url = getStreamUrl(selectedChat?.id ?? 0, file.id);
    return <VideoResBadge url={url} token={hfToken} fileSize={file.size || 0} enabled={!!url} style={style} />;
  };
  const getFileSize = useCallback((file: any) => isFolder(file) ? ((file as any)._folderSize ? formatBytes((file as any)._folderSize) : '—') : formatBytes(file.size), [isFolder]);

  useEffect(() => {
    if (!showSortMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (sortMenuRef.current?.contains(e.target as Node)) return;
      onToggleSortMenu();
      const swallow = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', swallow, true), 400);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onToggleSortMenu(); };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showSortMenu, onToggleSortMenu, sortMenuRef]);

  const handleItemPointerDown = useCallback((e: React.PointerEvent, file: any) => {
    if (!selectionEnabled) return;
    if (selectionMode) return;
    const target = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    let longPressTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      longPressTimer = null;
      onEnterSelection(file);
    }, LONG_PRESS_DURATION);

    const handleMove = (ev: PointerEvent) => {
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      if (dx > 8 || dy > 8) {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      }
    };

    const handleUp = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      target.removeEventListener('pointercancel', handleUp);
      target.removeEventListener('pointerleave', handleUp);
    };

    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
    target.addEventListener('pointercancel', handleUp);
    target.addEventListener('pointerleave', handleUp);
  }, [selectionMode, onEnterSelection, selectionEnabled]);

  const handleItemClick = useCallback((file: any) => {
    if (selectionEnabled && selectionMode) { onToggleSelection(file); return; }
    onFileClick(file);
  }, [selectionMode, onToggleSelection, onFileClick, selectionEnabled]);

  const handleItemContextMenu = useCallback((e: React.MouseEvent, file: any) => {
    if (!selectionEnabled) return;
    e.preventDefault();
    if (selectionMode) { onToggleSelection(file); } else { onEnterSelection(file); }
  }, [selectionMode, onToggleSelection, onEnterSelection, selectionEnabled]);

  const renderSelectionCheckbox = useCallback((file: any, size: number = 20) => (
    <div
      className={`cloudview-selection-checkbox ${selectedIds.has(file.id) ? 'cloudview-selection-checkbox--checked' : ''}`}
      style={{ width: size, height: size, minWidth: size }}
      onClick={(e) => { e.stopPropagation(); onToggleSelection(file); }}
    >
      {selectedIds.has(file.id) && <Check size={size - 6} strokeWidth={3} />}
    </div>
  ), [selectedIds, onToggleSelection]);

  if (!selectedChat && sourceType === 'telegram') {
    return <div className="cloudview-state-box"><Folder size={48} className="cloudview-state-icon" /><p>Select a chat</p></div>;
  }
  if (sourceType === 'hf_dataset' && !selectedRepo) {
    return <div className="cloudview-state-box"><Folder size={48} className="cloudview-state-icon" /><p>Select a repository</p></div>;
  }
  if (error) {
    return (
      <div className="cloudview-state-box cloudview-state-box--error">
        <AlertCircle size={40} />
        <p>{error}</p>
        <button onClick={onRefresh} className="cloudview-retry-btn">Retry</button>
      </div>
    );
  }
  if (loadingFiles && isMobile) return <Loading />;
  if (!loadingFiles && !files.length) {
    return <div className="cloudview-state-box"><Folder size={48} className="cloudview-state-icon" /><p>No files</p></div>;
  }

  const renderActionBar = () => (
    <AnimatePresence>
      {selectionEnabled && selectionMode && (
        <SelectionActionBar
          count={selectedItemsCount} allSelected={allSelected} canRename={canBulkRename} canMove={canBulkMove}
          canDelete={canBulkDelete} canCopy={canCopy} canWatch={canWatchExternal} canSlideshow={canSlideshow}
          slideshowKind={slideshowKind}
          showCopy={showCopy} isPublicView={isPublicView} onSelectAll={onSelectAll} onDeselectAll={onDeselectAll}
          onRename={onBulkRename} onMove={onBulkMove} onCopy={onCopy} onDelete={onBulkDelete} onWatch={onWatchExternal}
          onSlideshow={onSlideshow} onCancel={onExitSelection}
        />
      )}
    </AnimatePresence>
  );

  const renderToolbar = () => {
    if (selectionEnabled && selectionMode) return null;
    return (
      <div className="cloudview-panel-toolbar">
        <div className="cloudview-search-wrap">
          <Search size={14} className="cloudview-search-icon" />
          <input type="text" placeholder="Search files..." value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} className="cloudview-search-input" />
          {searchQuery && <button className="cloudview-search-clear" onClick={() => onSearchChange('')}>✕</button>}
        </div>
        <span className="cloudview-panel-count">{files.length} items</span>
        {totalSize > 0 && <span className="cloudview-panel-size"><HardDrive size={13} />{formatBytes(totalSize)}</span>}
        <div className="cloudview-toolbar-actions">
          {sourceType === 'telegram' ? (
            <button className="cloudview-toolbar-btn" onClick={onRefresh}><RefreshCw size={isMobile ? 14 : 15} /></button>
          ) : isPublicView ? (
            <button className="cloudview-toolbar-btn" onClick={onRefresh} title="Refresh"><RefreshCw size={isMobile ? 14 : 15} /></button>
          ) : (
            <button className="cloudview-toolbar-btn" onClick={onCreateFolder} title="Create folder"><FolderPlus size={isMobile ? 14 : 15} /></button>
          )}
          <div className="cloudview-sort-wrap" ref={sortMenuRef}>
            <button className={`cloudview-toolbar-btn ${showSortMenu ? 'cloudview-toolbar-btn--active' : ''}`} onClick={onToggleSortMenu}><ArrowUpDown size={isMobile ? 14 : 15} /></button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div className="cloudview-sort-menu" initial={{ opacity: 0, y: -4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.95 }}>
                  {(['name', 'date', 'size', 'type'] as SortField[]).map(field => (
                    <button key={field} className={`cloudview-sort-item ${sortField === field ? 'cloudview-sort-item--active' : ''}`} onClick={() => onSort(field)}>
                      <span className="cloudview-sort-label">{field}</span>
                      {sortField === field && <SortIcon field={field} dir={sortDir} size={14} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button className="cloudview-toolbar-btn" onClick={onCycleViewMode}><ViewIcon mode={viewMode} size={isMobile ? 14 : 15} /></button>
        </div>
      </div>
    );
  };

  const renderListView = () => {
    const wide = !isMobile;
    const selecting = !!(selectionEnabled && selectionMode);
    const showCols = wide && !selecting;
    const colClass = showCols ? (isDesktop ? 'cloudview-frow--wide cloudview-frow--date' : 'cloudview-frow--wide') : '';
    return (
      <div className={`cloudview-chats-panel cloudview-flist ${wide ? 'cloudview-flist--wide' : ''}`}>
        {showCols && (
          <div className={`cloudview-frow-head ${colClass}`}>
            <span>Name</span>
            {isDesktop && <span>Date</span>}
            <span>Type</span>
            <span className="cloudview-frow-size">Size</span>
          </div>
        )}
        {files.map((file, i) => {
          const fileColor = getFileColor(file);
          const fileLabel = getFileLabel(file);
          const fileSize = getFileSize(file);
          const isFolderItem = isFolder(file);
          const isSelected = selectedIds.has(file.id);
          return (
            <motion.div
              key={file.id}
              role="button"
              tabIndex={0}
              style={{ ['--row-accent' as any]: fileColor }}
              className={`cloudview-frow ${colClass} ${isSelected ? 'cloudview-item--selected' : ''} ${!isSelected && selectedFile?.id === file.id ? 'cloudview-frow--active' : ''}`}
              onClick={() => handleItemClick(file)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleItemClick(file); }}
              onPointerDown={(e) => handleItemPointerDown(e, file)}
              onContextMenu={(e) => handleItemContextMenu(e, file)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * 0.01, duration: 0.15 }}
            >
              <span className="cloudview-frow-main">
                {selecting && renderSelectionCheckbox(file, wide ? 18 : 22)}
                <span className="cloudview-frow-icon">
                  {isFolderItem ? <Folder size={18} /> : <FileIcon type={file.media_type} size={18} />}
                </span>
                <span className="cloudview-frow-text">
                  <span className="cloudview-frow-name">{sanitizeText(file.name)}</span>
                  {!showCols && (
                    <span className="cloudview-frow-meta">
                      <span className="cloudview-frow-chip">{fileLabel}</span>
                      {renderResBadge(file)}
                    </span>
                  )}
                </span>
              </span>
              {showCols && (
                <>
                  {isDesktop && <span className="cloudview-frow-date">{file.date ? formatRelativeDate(file.date) : '—'}</span>}
                  <span className="cloudview-frow-type">
                    <span className="cloudview-frow-chip">{fileLabel}</span>
                    {renderResBadge(file)}
                  </span>
                </>
              )}
              <span className="cloudview-frow-end">
                <span className="cloudview-frow-size">{fileSize}</span>
                {!showCols && !selecting && <ChevronRight size={16} className="cloudview-frow-chevron" />}
              </span>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const renderPosterGrid = () => (
    <div className="cloudview-file-poster-grid">
      {files.map((file, i) => {
        const fileColor = getFileColor(file);
        const fileLabel = getFileLabel(file);
        const fileSize = getFileSize(file);
        const isFolderItem = isFolder(file);
        const isImage = file.media_type === 'image' && !isFolderItem;
        const isVideo = file.media_type === 'video' && !isFolderItem && sourceType === 'hf_dataset';
        const canShowThumb = isImage || isVideo;
        const thumbUrl = canShowThumb && (selectedChat || sourceType === 'hf_dataset') ? (sourceType === 'hf_dataset' && (file as any)._thumbUrl ? (file as any)._thumbUrl : getStreamUrl(selectedChat?.id ?? 0, file.id)) : null;
        const sanitizedName = sanitizeText(file.name);
        const isSelected = selectedIds.has(file.id);
        return (
          <motion.div
            key={file.id}
            style={{ ['--card-accent' as any]: fileColor }}
            className={`cloudview-file-poster-card ${isSelected ? 'cloudview-item--selected' : ''} ${!isSelected && selectedFile?.id === file.id ? 'cloudview-file-poster-card--active' : ''}`}
            onClick={() => handleItemClick(file)}
            onPointerDown={(e) => handleItemPointerDown(e, file)}
            onContextMenu={(e) => handleItemContextMenu(e, file)}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.01 }}
          >
            <div className="cloudview-poster-media">
                    {isFolderItem ? (
                      sourceType === 'hf_dataset' && (file as any)._coverThumbUrl ? (
                        <>
                          <ThumbnailImage url={(file as any)._coverThumbUrl} alt={sanitizedName} type={(file as any)._coverType === 'video' ? 'video' : 'image'} iconType="folder" token={hfToken} fileSize={(file as any)._coverSize || 0} fileName={(file as any)._coverName || ''} fallbackUrl={(file as any)._coverStreamUrl} />
                          <span className="cloudview-thumb-folder-mark"><Folder size={12} /></span>
                        </>
                      ) : (
                        <div className="cloudview-thumb-fallback" style={{ background: '#f59e0b18', color: '#f59e0b' }}><Folder size={isMobile ? 24 : 32} /></div>
                      )
                    ) : thumbUrl && thumbUrl.length > 0 && canShowThumb ? (
                      <ThumbnailImage url={thumbUrl} alt={sanitizedName} type={file.media_type} token={sourceType === 'hf_dataset' ? hfToken : undefined} fileSize={file.size || 0} fileName={file.name || ''} fallbackUrl={sourceType === 'hf_dataset' ? (file as any)._streamUrl : undefined} />
                    ) : (
                      <div className="cloudview-thumb-fallback" style={{ background: fileColor + '18', color: fileColor }}><FileIcon type={file.media_type} size={isMobile ? 24 : 32} /></div>
                    )}
            </div>
            {selectionEnabled && selectionMode && <div className="cloudview-thumb-checkbox">{renderSelectionCheckbox(file, 20)}</div>}
            <div className="cloudview-poster-res">{renderResBadge(file)}</div>
            <div className="cloudview-poster-info">
              <p className="cloudview-poster-name">{sanitizedName}</p>
              <div className="cloudview-poster-meta">
                <span className="cloudview-poster-type">{fileLabel}</span>
                <span className="cloudview-poster-size">{fileSize}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );

  const renderMobile = () => (
    <div className="cloudview-files-panel cloudview-files-panel--mobile">
      {renderToolbar()}
      
      {renderActionBar()}

      <div className="cloudview-file-list" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {loadingFiles ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loading /></div>
        ) : !files.length ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="cloudview-state-box"><Folder size={48} className="cloudview-state-icon" /><p>No files</p></div></div>
        ) : viewMode === 'list' ? (
          renderListView()
        ) : viewMode === 'grid' ? (
          <div className="cloudview-file-grid">
            {files.map((file, i) => {
              const fileColor = getFileColor(file);
              const fileLabel = getFileLabel(file);
              const fileSize = getFileSize(file);
              const isFolderItem = isFolder(file);
              const isSelected = selectedIds.has(file.id);
              return (
                <motion.div
                  key={file.id}
                  style={{ ['--card-accent' as any]: fileColor }}
                  className={`cloudview-file-grid-card ${isSelected ? 'cloudview-item--selected' : ''} ${!isSelected && selectedFile?.id === file.id ? 'cloudview-file-grid-card--active' : ''}`}
                  onClick={() => handleItemClick(file)}
                  onPointerDown={(e) => handleItemPointerDown(e, file)}
                  onContextMenu={(e) => handleItemContextMenu(e, file)}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.01 }} whileTap={{ scale: 0.97 }}
                >
                  {selectionEnabled && selectionMode && <div className="cloudview-file-grid-checkbox">{renderSelectionCheckbox(file, 20)}</div>}
                  <div className="cloudview-grid-card-icon" style={{ background: fileColor + '18', color: fileColor }}>
                    {isFolderItem ? <Folder size={isMobile ? 20 : 24} /> : <FileIcon type={file.media_type} size={isMobile ? 20 : 24} />}
                  </div>
                  <div className="cloudview-grid-card-body">
                    <p className="cloudview-grid-card-name" style={isFolderItem ? { fontWeight: 600 } : {}}>{sanitizeText(file.name)}</p>
                    <span className="cloudview-grid-card-meta">{fileSize}</span>
                  </div>
                  <span className="cloudview-grid-card-chip-group">
                    <span className="cloudview-grid-card-type-chip" style={{ background: fileColor + '18', color: fileColor }}>{fileLabel}</span>
                    {renderResBadge(file)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        ) : viewMode === 'poster' ? (
          renderPosterGrid()
        ) : (
          <div className="cloudview-file-thumbnail-grid">
            {files.map((file, i) => {
              const fileColor = getFileColor(file);
              const fileLabel = getFileLabel(file);
              const fileSize = getFileSize(file);
              const isFolderItem = isFolder(file);
              const isImage = file.media_type === 'image' && !isFolderItem;
              const isVideo = file.media_type === 'video' && !isFolderItem && sourceType === 'hf_dataset';
              const canShowThumb = isImage || isVideo;
              const thumbUrl = canShowThumb && (selectedChat || sourceType === 'hf_dataset') ? (sourceType === 'hf_dataset' && (file as any)._thumbUrl ? (file as any)._thumbUrl : getStreamUrl(selectedChat?.id ?? 0, file.id)) : null;
              const sanitizedName = sanitizeText(file.name);
              const isSelected = selectedIds.has(file.id);
              return (
                <motion.div
                  key={file.id}
                  className={`cloudview-file-thumb-card ${isSelected ? 'cloudview-item--selected' : ''} ${!isSelected && selectedFile?.id === file.id ? 'cloudview-file-thumb-card--active' : ''}`}
                  onClick={() => handleItemClick(file)}
                  onPointerDown={(e) => handleItemPointerDown(e, file)}
                  onContextMenu={(e) => handleItemContextMenu(e, file)}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.01 }}
                >
                  <div className="cloudview-thumb-preview">
                    {selectionEnabled && selectionMode && <div className="cloudview-thumb-checkbox">{renderSelectionCheckbox(file, 20)}</div>}
                    {isFolderItem ? (
                      sourceType === 'hf_dataset' && (file as any)._coverThumbUrl ? (
                        <>
                          <ThumbnailImage url={(file as any)._coverThumbUrl} alt={sanitizedName} type={(file as any)._coverType === 'video' ? 'video' : 'image'} iconType="folder" token={hfToken} fileSize={(file as any)._coverSize || 0} fileName={(file as any)._coverName || ''} fallbackUrl={(file as any)._coverStreamUrl} />
                          <span className="cloudview-thumb-folder-mark"><Folder size={12} /></span>
                        </>
                      ) : (
                        <div className="cloudview-thumb-fallback" style={{ background: '#f59e0b18', color: '#f59e0b' }}><Folder size={isMobile ? 24 : 32} /></div>
                      )
                    ) : thumbUrl && thumbUrl.length > 0 && canShowThumb ? (
                      <ThumbnailImage url={thumbUrl} alt={sanitizedName} type={file.media_type} token={sourceType === 'hf_dataset' ? hfToken : undefined} fileSize={file.size || 0} fileName={file.name || ''} fallbackUrl={sourceType === 'hf_dataset' ? (file as any)._streamUrl : undefined} />
                    ) : (
                      <div className="cloudview-thumb-fallback" style={{ background: fileColor + '18', color: fileColor }}><FileIcon type={file.media_type} size={isMobile ? 24 : 32} /></div>
                    )}
                  </div>
                  <div className="cloudview-thumb-info">
                    <p className="cloudview-thumb-name" style={isFolderItem ? { fontWeight: 600 } : {}}>{sanitizedName}</p>
                    <div className="cloudview-thumb-meta">
                      <span className="cloudview-thumb-type-group">
                        <span className="cloudview-thumb-type">{fileLabel}</span>
                        {renderResBadge(file)}
                      </span>
                      <span className="cloudview-thumb-size">{fileSize}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderDesktop = () => (
    <div className="cloudview-files-panel">
      {renderToolbar()}

      {renderActionBar()}

      <div className="cloudview-file-list" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {loadingFiles && !isMobile && (
          <div className="cloudview-files-loading-overlay">
            <div className="cloudview-files-loading-inline">
              <div className="cloudview-loading-spinner" />
              <span>Loading files...</span>
            </div>
          </div>
        )}

        {!files.length ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="cloudview-state-box"><Folder size={48} className="cloudview-state-icon" /><p>No files</p></div></div>
        ) : viewMode === 'list' ? (
          renderListView()
        ) : viewMode === 'grid' ? (
          <div className="cloudview-file-grid">
            {files.map((file, i) => {
              const fileColor = getFileColor(file);
              const fileLabel = getFileLabel(file);
              const fileSize = getFileSize(file);
              const isFolderItem = isFolder(file);
              const isSelected = selectedIds.has(file.id);
              return (
                <motion.div
                  key={file.id}
                  style={{ ['--card-accent' as any]: fileColor }}
                  className={`cloudview-file-grid-card ${isSelected ? 'cloudview-item--selected' : ''} ${!isSelected && selectedFile?.id === file.id ? 'cloudview-file-grid-card--active' : ''}`}
                  onClick={() => handleItemClick(file)}
                  onPointerDown={(e) => handleItemPointerDown(e, file)}
                  onContextMenu={(e) => handleItemContextMenu(e, file)}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.01 }} whileTap={{ scale: 0.97 }}
                >
                  {selectionEnabled && selectionMode && <div className="cloudview-file-grid-checkbox">{renderSelectionCheckbox(file, 20)}</div>}
                  <div className="cloudview-grid-card-icon" style={{ background: fileColor + '18', color: fileColor }}>
                    {isFolderItem ? <Folder size={isMobile ? 20 : 24} /> : <FileIcon type={file.media_type} size={isMobile ? 20 : 24} />}
                  </div>
                  <div className="cloudview-grid-card-body">
                    <p className="cloudview-grid-card-name" style={isFolderItem ? { fontWeight: 600 } : {}}>{sanitizeText(file.name)}</p>
                    <span className="cloudview-grid-card-meta">{fileSize}</span>
                  </div>
                  <span className="cloudview-grid-card-chip-group">
                    <span className="cloudview-grid-card-type-chip" style={{ background: fileColor + '18', color: fileColor }}>{fileLabel}</span>
                    {renderResBadge(file)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        ) : viewMode === 'poster' ? (
          renderPosterGrid()
        ) : (
          <div className="cloudview-file-thumbnail-grid">
            {files.map((file, i) => {
              const fileColor = getFileColor(file);
              const fileLabel = getFileLabel(file);
              const fileSize = getFileSize(file);
              const isFolderItem = isFolder(file);
              const isImage = file.media_type === 'image' && !isFolderItem;
              const isVideo = file.media_type === 'video' && !isFolderItem && sourceType === 'hf_dataset';
              const canShowThumb = isImage || isVideo;
              const thumbUrl = canShowThumb && (selectedChat || sourceType === 'hf_dataset') ? (sourceType === 'hf_dataset' && (file as any)._thumbUrl ? (file as any)._thumbUrl : getStreamUrl(selectedChat?.id ?? 0, file.id)) : null;
              const sanitizedName = sanitizeText(file.name);
              const isSelected = selectedIds.has(file.id);
              return (
                <motion.div
                  key={file.id}
                  className={`cloudview-file-thumb-card ${isSelected ? 'cloudview-item--selected' : ''} ${!isSelected && selectedFile?.id === file.id ? 'cloudview-file-thumb-card--active' : ''}`}
                  onClick={() => handleItemClick(file)}
                  onPointerDown={(e) => handleItemPointerDown(e, file)}
                  onContextMenu={(e) => handleItemContextMenu(e, file)}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.01 }}
                >
                  <div className="cloudview-thumb-preview">
                    {selectionEnabled && selectionMode && <div className="cloudview-thumb-checkbox">{renderSelectionCheckbox(file, 20)}</div>}
                    {isFolderItem ? (
                      sourceType === 'hf_dataset' && (file as any)._coverThumbUrl ? (
                        <>
                          <ThumbnailImage url={(file as any)._coverThumbUrl} alt={sanitizedName} type={(file as any)._coverType === 'video' ? 'video' : 'image'} iconType="folder" token={hfToken} fileSize={(file as any)._coverSize || 0} fileName={(file as any)._coverName || ''} fallbackUrl={(file as any)._coverStreamUrl} />
                          <span className="cloudview-thumb-folder-mark"><Folder size={12} /></span>
                        </>
                      ) : (
                        <div className="cloudview-thumb-fallback" style={{ background: '#f59e0b18', color: '#f59e0b' }}><Folder size={isMobile ? 24 : 32} /></div>
                      )
                    ) : thumbUrl && thumbUrl.length > 0 && canShowThumb ? (
                      <ThumbnailImage url={thumbUrl} alt={sanitizedName} type={file.media_type} token={sourceType === 'hf_dataset' ? hfToken : undefined} fileSize={file.size || 0} fileName={file.name || ''} fallbackUrl={sourceType === 'hf_dataset' ? (file as any)._streamUrl : undefined} />
                    ) : (
                      <div className="cloudview-thumb-fallback" style={{ background: fileColor + '18', color: fileColor }}><FileIcon type={file.media_type} size={isMobile ? 24 : 32} /></div>
                    )}
                  </div>
                  <div className="cloudview-thumb-info">
                    <p className="cloudview-thumb-name" style={isFolderItem ? { fontWeight: 600 } : {}}>{sanitizedName}</p>
                    <div className="cloudview-thumb-meta">
                      <span className="cloudview-thumb-type-group">
                        <span className="cloudview-thumb-type">{fileLabel}</span>
                        {renderResBadge(file)}
                      </span>
                      <span className="cloudview-thumb-size">{fileSize}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return isMobile ? renderMobile() : renderDesktop();
};

export const PlayerPanel: React.FC<{
  selectedFile: TelegramFile | null;
  selectedChat: TelegramChat | null;
  sourceType?: 'telegram' | 'hf_dataset';
  hfToken?: string;
  fileMetadata?: TelegramFileMetadata | null;
  onDownload: (chatId: number, msgId: number, filename: string) => void;
  onFileGone: (fileId: number) => void;
  onImageError: (fileId: number) => void;
  onMediaLoaded: (fileId: number) => void;
  getStreamUrl: (chatId: number, msgId: number) => string;
}> = ({
  selectedFile,
  selectedChat,
  sourceType = 'telegram',
  hfToken,
  fileMetadata,
  onDownload,
  onFileGone,
  onImageError,
  onMediaLoaded,
  getStreamUrl
}) => {
  const isFolder = (selectedFile as any)?._isFolder === true;
  const isMedia = !!selectedFile && !isFolder && ['video', 'audio', 'image', 'gif'].includes(selectedFile.media_type);
  const rawStreamUrl = selectedFile && !isFolder ? getStreamUrl(selectedChat?.id ?? 0, selectedFile.id) : '';

  if (!selectedFile || (sourceType === 'telegram' && !selectedChat)) return <div className="cloudview-state-box"><Play size={48} className="cloudview-state-icon" /><p>Select a file</p></div>;

  if (isFolder) {
    return (
      <div className="cloudview-player-panel">
        <div className="cloudview-file-preview-placeholder">
          <div className="cloudview-preview-icon" style={{ color: '#f59e0b' }}>
            <Folder size={56} />
          </div>
          <p style={{ fontWeight: 600, fontSize: '18px' }}>{sanitizeText(selectedFile.name)}</p>
          <span>Folder</span>
        </div>
      </div>
    );
  }

  const streamUrl = rawStreamUrl;

  if (!streamUrl || streamUrl.length === 0) {
    return (
      <div className="cloudview-player-panel">
        <div className="cloudview-file-preview-placeholder">
          <div className="cloudview-preview-icon" style={{ color: getColor(selectedFile.media_type) }}>
            <FileIcon type={selectedFile.media_type} size={56} />
          </div>
          <p>No stream URL available</p>
          <span>{getLabel(selectedFile.media_type)}</span>
          <button className="cloudview-player-download" onClick={() => onDownload(selectedChat?.id ?? 0, selectedFile.id, selectedFile.name)}>
            <Download size={16} /> Download
          </button>
        </div>
      </div>
    );
  }

  if (selectedFile.media_type === 'image') {
    return (
      <div className="cloudview-player-panel">
        <div className="cloudview-file-preview-placeholder">
          <div className="cloudview-preview-icon" style={{ color: getColor(selectedFile.media_type) }}>
            <ImageIcon size={56} />
          </div>
          <p style={{ fontWeight: 600, fontSize: '18px' }}>{sanitizeText(selectedFile.name)}</p>
          <span>Open the file from the image list to view it in slideshow</span>
        </div>
      </div>
    );
  }

  const handleMediaError = async () => {
    if (selectedFile.media_type === 'image' || selectedFile.media_type === 'audio') {
      onImageError(selectedFile.id);
      onFileGone(selectedFile.id);
    } else {
      try {
        const res = await fetch(streamUrl, {
          method: 'HEAD',
          headers: sourceType === 'hf_dataset' && hfToken ? { Authorization: `Bearer ${hfToken}` } : undefined,
        });
        if (res.status === 410) onFileGone(selectedFile.id);
      } catch {
        onFileGone(selectedFile.id);
      }
    }
    onMediaLoaded(selectedFile.id);
  };

  const videoItem: VideoMediaItem = {
    id: selectedFile.id,
    type: selectedFile.media_type as VideoMediaType,
    url: streamUrl,
    name: selectedFile.name,
    size: selectedFile.size,
    duration: selectedFile.duration || fileMetadata?.duration,
    width: selectedFile.width || fileMetadata?.width,
    height: selectedFile.height || fileMetadata?.height,
    caption: selectedFile.caption,
    thumbnail: sourceType === 'hf_dataset' ? (selectedFile as any)._thumbUrl : undefined,
  };

  if (!isMedia) return (
    <div className="cloudview-player-panel">
      <div className="cloudview-file-preview-placeholder">
        <div className="cloudview-preview-icon" style={{ color: getColor(selectedFile.media_type) }}>
          <FileIcon type={selectedFile.media_type} size={56} />
        </div>
        <p>Preview not available</p>
        <span>{getLabel(selectedFile.media_type)}</span>
        {fileMetadata?.subtitleTracks && fileMetadata.subtitleTracks.length > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Subtitles: {fileMetadata.subtitleTracks.map(t => sanitizeText(t.language)).join(', ')}
          </span>
        )}
        <button className="cloudview-player-download" onClick={() => onDownload(selectedChat?.id ?? 0, selectedFile.id, selectedFile.name)}>
          <Download size={16} /> Download
        </button>
      </div>
    </div>
  );

  return (
    <div className="cloudview-player-panel">
      <MediaRender
        item={videoItem}
        autoPlay
        showControls
        showMeta
        showDownload
        token={sourceType === 'hf_dataset' ? hfToken : undefined}
        onDownload={() => onDownload(selectedChat?.id ?? 0, selectedFile.id, selectedFile.name)}
        onError={handleMediaError}
      />
    </div>
  );
};
