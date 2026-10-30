// src/react/feature/cloudviewuisidebar.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Folder, FolderOpen, Hash, Users, ChevronLeft, ChevronRight, Home, Plus, RefreshCw, Check, Lock
} from 'lucide-react';
import type { TelegramChat, TelegramFile } from '@config/telegram';
import { formatBytes, getLabel } from '@config/telegram';
import type { HFRepo } from '@config/cloudsource';
import { getRepoTypeColor, getRepoTypeLabel } from '@config/cloudsource';
import { FileIcon } from './cloudviewuithumb';
import { sanitizeText, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, LONG_PRESS_DURATION } from '@config/cloudviewuiconfig';

export const CHAT_ACCENT: Record<string, string> = { channel: '#a855f7', group: '#10b981', supergroup: '#10b981', private: '#3b82f6', user: '#3b82f6' };

export const Breadcrumb: React.FC<{
  chat: TelegramChat | null;
  file: TelegramFile | null;
  onRoot: () => void;
  onChat: () => void;
  onChats: () => void;
  onClosePreview?: () => void;
  onBackToRepos?: () => void;
  onBackToRepoRoot?: () => void;
  sourceName?: string;
  showBackButton?: boolean;
  sourceType?: 'telegram' | 'hf_dataset';
  repoName?: string;
  currentPath?: string;
  onNavigateToPath?: (path: string) => void;
  isMobile?: boolean;
  onGoBack?: () => void;
}> = ({
  chat, file, onRoot, onChat, onChats, onClosePreview, onBackToRepos, onBackToRepoRoot,
  sourceName = 'Telegram', showBackButton = false, sourceType = 'telegram',
  repoName, currentPath = '', onNavigateToPath, isMobile = false, onGoBack
}) => {
  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];
  const isHf = sourceType === 'hf_dataset';
  const isTelegram = sourceType === 'telegram';

  if (isMobile) {
    let displayName = sourceName;
    let onBack = onRoot;

    if (isHf) {
      if (file) {
        displayName = file.name;
        onBack = onClosePreview || onGoBack || onRoot;
      } else if (pathParts.length > 0) {
        displayName = pathParts[pathParts.length - 1];
        onBack = onGoBack || onRoot;
      } else if (repoName) {
        displayName = repoName;
        onBack = onBackToRepos || onRoot;
      } else {
        displayName = 'Repositories';
        onBack = onRoot;
      }
    } else if (isTelegram) {
      if (file && chat) {
        displayName = file.name;
        onBack = onClosePreview || onChat;
      } else if (chat) {
        displayName = chat.name;
        onBack = onChats;
      } else {
        displayName = 'Chats';
        onBack = onRoot;
      }
    }

    return (
      <div className="cloudview-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', minWidth: 0, fontSize: '16px', fontWeight: '700' }}>
        <button
          className="cloudview-bc-item cloudview-bc-link"
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, padding: '2px 4px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="cloudview-bc-item cloudview-bc-current" style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, fontWeight: '700' }}>
          <span className="cloudview-bc-file-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600', fontSize: '17px' }}>{sanitizeText(displayName)}</span>
        </span>
      </div>
    );
  }

  const renderItem = (label: string, icon: React.ReactNode, onClick?: () => void, isCurrent: boolean = false) => (
    <button
      className={`cloudview-bc-item ${onClick && !isCurrent ? 'cloudview-bc-link' : 'cloudview-bc-current'}`}
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}
      disabled={isCurrent}
    >
      {icon}
      <span className="cloudview-bc-file-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sanitizeText(label)}</span>
    </button>
  );

  const renderSeparator = () => <ChevronRight size={14} className="cloudview-bc-sep" style={{ flexShrink: 0 }} />;

  return (
    <div className="cloudview-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', minWidth: 0 }}>
      {showBackButton ? (
        <button className="cloudview-bc-item cloudview-bc-link" onClick={onRoot} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <ChevronLeft size={16} />
          <span>{sanitizeText(sourceName)}</span>
        </button>
      ) : (
        <button className="cloudview-bc-item cloudview-bc-link" onClick={onRoot} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <Home size={14} />
          <span>{sanitizeText(sourceName)}</span>
        </button>
      )}

      {isTelegram && (
        <>
          {renderSeparator()}
          {renderItem('Chats', <Users size={14} style={{ flexShrink: 0 }} />, onChats, !chat && !file)}

          {chat && (
            <>
              {renderSeparator()}
              {renderItem(
                chat.name,
                chat.type === 'channel' ? <Hash size={14} style={{ flexShrink: 0 }} /> : <Users size={14} style={{ flexShrink: 0 }} />,
                file ? onChat : undefined,
                !file
              )}
            </>
          )}
        </>
      )}

      {isHf && (
        <>
          {renderSeparator()}
          {renderItem('Repositories', <Folder size={14} style={{ flexShrink: 0 }} />, onBackToRepos || onRoot, !repoName && !file)}

          {repoName && (
            <>
              {renderSeparator()}
              {renderItem(
                repoName,
                <Folder size={14} style={{ flexShrink: 0 }} />,
                onBackToRepoRoot || onRoot,
                !file && pathParts.length === 0
              )}

              {pathParts.map((folder, index) => {
                const isLast = index === pathParts.length - 1;
                const fullPath = pathParts.slice(0, index + 1).join('/');
                const isCurrent = isLast && !file;

                return (
                  <React.Fragment key={index}>
                    {renderSeparator()}
                    {renderItem(
                      folder,
                      <Folder size={14} style={{ flexShrink: 0 }} />,
                      isCurrent ? undefined : (() => onNavigateToPath?.(fullPath)),
                      isCurrent
                    )}
                  </React.Fragment>
                );
              })}
            </>
          )}
        </>
      )}

      {file && (
        <>
          {renderSeparator()}
          {renderItem(file.name, <FileIcon type={file.media_type} size={14} style={{ flexShrink: 0 }} />, undefined, true)}
        </>
      )}
    </div>
  );
};

export const Sidebar: React.FC<{
  dialogs: TelegramChat[];
  selectedChat: TelegramChat | null;
  loading: boolean;
  onChatClick: (chat: TelegramChat) => void;
  onRefresh: () => void;
  onAddRepo?: () => void;
  collapsed: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  sourceType?: 'telegram' | 'hf_dataset';
  hfRepos?: HFRepo[];
  onRepoClick?: (repo: HFRepo) => void;
  selectedRepo?: string;
  repoSelectionMode?: boolean;
  selectedRepoIds?: Set<string>;
  onEnterRepoSelection?: (repo: HFRepo) => void;
  onToggleRepoSelection?: (repo: HFRepo) => void;
  hideAddRepo?: boolean;
}> = ({
  dialogs, selectedChat, loading, onChatClick, onRefresh, onAddRepo = () => {}, collapsed, width, onWidthChange,
  sourceType = 'telegram', hfRepos = [], onRepoClick, selectedRepo,
  repoSelectionMode = false, selectedRepoIds = new Set(),
  onEnterRepoSelection = () => {}, onToggleRepoSelection = () => {},
  hideAddRepo = false,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef({ startX: 0, startWidth: SIDEBAR_MIN_WIDTH });

  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    try { target.setPointerCapture(e.pointerId); } catch {}
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: width };
  }, [width]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isResizing) return;
    const delta = e.clientX - resizeRef.current.startX;
    const newWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, resizeRef.current.startWidth + delta));
    onWidthChange(newWidth);
  }, [isResizing, onWidthChange]);

  const endResize = useCallback((e: React.PointerEvent) => {
    if (!isResizing) return;
    const target = e.currentTarget as HTMLElement;
    try { target.releasePointerCapture(e.pointerId); } catch {}
    setIsResizing(false);
  }, [isResizing]);

  useEffect(() => {
    if (!isResizing) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
    };
  }, [isResizing]);

  const longPressFiredRef = useRef(false);

  const handleRepoPointerDown = useCallback((e: React.PointerEvent, repo: HFRepo) => {
    longPressFiredRef.current = false;
    if (repoSelectionMode) return;
    const target = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    let longPressTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      longPressTimer = null;
      longPressFiredRef.current = true;
      onEnterRepoSelection(repo);
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
  }, [repoSelectionMode, onEnterRepoSelection]);

  const handleRepoContextMenu = useCallback((e: React.MouseEvent, repo: HFRepo) => {
    e.preventDefault();
    if (longPressFiredRef.current) return;
    longPressFiredRef.current = true;
    if (repoSelectionMode) { onToggleRepoSelection(repo); }
    else { onEnterRepoSelection(repo); }
  }, [repoSelectionMode, onToggleRepoSelection, onEnterRepoSelection]);

  const handleRepoItemClick = useCallback((repo: HFRepo) => {
    if (longPressFiredRef.current) { longPressFiredRef.current = false; return; }
    onRepoClick?.(repo);
  }, [onRepoClick]);

  return (
    <aside
      className={`cloudview-sidebar${collapsed ? ' cloudview-sidebar--collapsed' : ''}${isResizing ? ' cloudview-sidebar--resizing' : ''}`}
      style={{ width: collapsed ? 44 : width, minWidth: collapsed ? 44 : width }}
    >
      {!collapsed && (
        <div
          className="cloudview-sidebar-resize"
          onPointerDown={startResize}
          onPointerMove={onPointerMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          title="Drag to resize"
        />
      )}
      <div className="cloudview-sidebar-header">
        {!collapsed && <span className="cloudview-sidebar-title">{sourceType === 'telegram' ? 'Chats' : 'Repositories'}</span>}
        {sourceType === 'hf_dataset' ? (
          hideAddRepo ? null : (
            <button className="cloudview-sidebar-refresh" onClick={onAddRepo} title="Add repository"><Plus size={16} /></button>
          )
        ) : (
          <button className="cloudview-sidebar-refresh" onClick={onRefresh} title="Refresh"><RefreshCw size={14} /></button>
        )}
      </div>
      <div className="cloudview-sidebar-tree">
        <div className="cloudview-tree-root">
          <FolderOpen size={16} className="cloudview-tree-root-icon" />
          {!collapsed && <span>{sourceType === 'telegram' ? 'My Chats' : 'My Repositories'}</span>}
        </div>
        {!collapsed && loading ? (
          <div className="cloudview-sidebar-loading">
            <div className="cloudview-loading-spinner"></div>
            <span>{sourceType === 'telegram' ? 'Loading chats...' : 'Loading repositories...'}</span>
          </div>
        ) : (
          <ul className="cloudview-tree-list">
            {sourceType === 'telegram' ? (
              dialogs.map((chat) => (
                <li key={chat.id}>
                  <button className={`cloudview-tree-item ${selectedChat?.id === chat.id ? 'cloudview-tree-item--active' : ''}`} style={{ ['--row-accent' as any]: CHAT_ACCENT[chat.type] || 'var(--primary)' }} onClick={() => onChatClick(chat)} title={sanitizeText(chat.name)}>
                    <span className="cloudview-tree-icon">{chat.type === 'channel' ? <Hash size={15} /> : <Users size={15} />}</span>
                    {!collapsed && (
                      <>
                        <span className="cloudview-tree-label">{sanitizeText(chat.name)}</span>
                        {chat.unread_count !== undefined && chat.unread_count !== null && chat.unread_count > 0 && (
                          <span className="cloudview-tree-badge">{chat.unread_count}</span>
                        )}
                      </>
                    )}
                  </button>
                </li>
              ))
            ) : (
              hfRepos.map((repo) => {
                const isSelected = selectedRepoIds.has(repo.full_name);
                return (
                  <li key={repo.full_name}>
                    <button
                      className={`cloudview-tree-item ${selectedRepo === repo.full_name && !repoSelectionMode ? 'cloudview-tree-item--active' : ''} ${isSelected ? 'cloudview-item--selected' : ''}`}
                      style={{ ['--row-accent' as any]: getRepoTypeColor(repo.type) }}
                      onClick={() => handleRepoItemClick(repo)}
                      onPointerDown={(e) => handleRepoPointerDown(e, repo)}
                      onContextMenu={(e) => handleRepoContextMenu(e, repo)}
                      title={sanitizeText(repo.name)}
                    >
                      {repoSelectionMode && (
                        <span
                          className={`cloudview-selection-checkbox ${isSelected ? 'cloudview-selection-checkbox--checked' : ''}`}
                          style={{ width: 16, height: 16, minWidth: 16 }}
                          onClick={(e) => { e.stopPropagation(); onToggleRepoSelection(repo); }}
                        >
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </span>
                      )}
                      <span className="cloudview-tree-icon"><Folder size={15} /></span>
                      {!collapsed && (
                        <>
                          <span className="cloudview-tree-label">{sanitizeText(repo.name)}</span>
                          <span className="cloudview-tree-chip">{getRepoTypeLabel(repo.type)}</span>
                          {repo.size !== undefined && repo.size > 0 && (
                            <span className="cloudview-tree-size">{formatBytes(repo.size)}</span>
                          )}
                          {repo.private && <Lock size={14} style={{ color: 'var(--text-muted)' }} />}
                        </>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    </aside>
  );
};

export const RepoRow: React.FC<{
  repo: HFRepo;
  isActive: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  onRepoClick?: (repo: HFRepo) => void;
  onEnterRepoSelection: (repo: HFRepo) => void;
  onToggleRepoSelection: (repo: HFRepo) => void;
}> = ({
  repo, isActive, isSelected, selectionMode,
  onRepoClick, onEnterRepoSelection, onToggleRepoSelection,
}) => {
  const longPressFiredRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    longPressFiredRef.current = false;
    if (selectionMode) return;
    const target = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    let longPressTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      longPressTimer = null;
      longPressFiredRef.current = true;
      onEnterRepoSelection(repo);
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
  }, [selectionMode, onEnterRepoSelection, repo]);

  const handleClick = useCallback(() => {
    if (longPressFiredRef.current) { longPressFiredRef.current = false; return; }
    if (selectionMode) { onToggleRepoSelection(repo); return; }
    onRepoClick?.(repo);
  }, [selectionMode, onToggleRepoSelection, onRepoClick, repo]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (longPressFiredRef.current) return;
    longPressFiredRef.current = true;
    if (selectionMode) { onToggleRepoSelection(repo); }
    else { onEnterRepoSelection(repo); }
  }, [selectionMode, onToggleRepoSelection, onEnterRepoSelection, repo]);

  return (
    <div
      role="button"
      tabIndex={0}
      className={`cloudview-frow ${isSelected ? 'cloudview-item--selected' : ''} ${!isSelected && isActive ? 'cloudview-frow--active' : ''}`}
      style={{ ['--row-accent' as any]: getRepoTypeColor(repo.type) }}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
    >
      <span className="cloudview-frow-main">
        {selectionMode && (
          <span
            className={`cloudview-selection-checkbox ${isSelected ? 'cloudview-selection-checkbox--checked' : ''}`}
            style={{ width: 22, height: 22, minWidth: 22 }}
            onClick={(e) => { e.stopPropagation(); onToggleRepoSelection(repo); }}
          >
            {isSelected && <Check size={16} strokeWidth={3} />}
          </span>
        )}
        <span className="cloudview-frow-icon"><Folder size={18} /></span>
        <span className="cloudview-frow-text">
          <span className="cloudview-frow-name">{sanitizeText(repo.name)}</span>
          <span className="cloudview-frow-meta">
            <span className="cloudview-frow-chip">{getRepoTypeLabel(repo.type)}</span>
          </span>
        </span>
      </span>
      <span className="cloudview-frow-end">
        {repo.private && <Lock size={14} style={{ color: 'var(--text-muted)' }} />}
        {!selectionMode && <ChevronRight size={16} className="cloudview-frow-chevron" />}
      </span>
    </div>
  );
};