// src/react/feature/cloudviewuipack.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash, Users, Home, Plus, Search, RefreshCw, LogOut,
  AlertCircle, Check, PanelLeftOpen, PanelLeftClose, Info, ChevronRight
} from 'lucide-react';
import type { TelegramChat, TelegramFile, ViewMode, MobileView, SortField, SortDir, TelegramFileMetadata } from '@config/telegram';
import type { HFRepo } from '@config/cloudsource';
import Loading from '@control/loading';
import { CloudModalHFSearch } from './cloudmodalhfsrch';
import type { HFSearchRepo } from './cloudmodalhfsrch';
import CloudModalSelection from './cloudmodalselection';
import type { TransferAccount, TransferRepo } from './cloudmodalselection';
import type { CloudViewPackProps } from '@config/cloudviewtypes';

import { Breadcrumb, Sidebar, RepoRow, CHAT_ACCENT } from './cloudviewuisidebar';
import { FilesPanel, PlayerPanel, DetailPanel } from './cloudviewuipanel';
import { RepoSelectionActionBar } from './cloudviewuitoolbar';
import {
  RenameRepoModal, DeleteRepoModal, AddRepoModal, SquashRepoModal, VisibilityRepoModal
} from './cloudviewuimodal';
import { sanitizeText } from '@config/cloudviewuiconfig';

const MOBILE_FADE = {
  initial: { opacity: 0, scale: 0.985 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.985 },
  transition: { duration: 0.16 },
};

export const CloudViewPack: React.FC<CloudViewPackProps> = (props) => {
  const {
    dialogs, selectedChat, sortedFiles, selectedFile, loading, loadingFiles,
    searchQuery, viewMode, sortField, sortDir, showSortMenu, error,
    sidebarCollapsed, sidebarWidth, showDetail, screenSize, mobileView, totalSize,
    fileMetadata, sortMenuRef,
    sourceName = 'Telegram', showBackButton = false, sourceType = 'telegram', tgSession,
    onClosePreview,
    setSearchQuery, setSidebarCollapsed, setSidebarWidth, setShowDetail, setMobileView,
    fetchDialogs, refreshCurrentChatFiles, handleChatClick, handleFileClick,
    handleBackToRoot, handleBackToFiles, handleBackToChats, handleFileGone, handleImageError,
    handleMediaLoaded, getStreamUrl, handleDownload, toggleSort, cycleViewMode,
    setShowSortMenu, clearSession,
    hfRepos = [], hfSelectedRepo, onRepoClick, onBackToRepos, onBackToRepoRoot, hfRepoName, hfToken,
    currentPath = '', onNavigateToPath, onGoBack,
    selectionMode = false,
    selectedIds = new Set(),
    onEnterSelection = () => {},
    onToggleSelection = () => {},
    onExitSelection = () => {},
    onSelectAll = () => {},
    onDeselectAll = () => {},
    allSelected = false,
    selectedItemsCount = 0,
    onBulkRename = () => {},
    onBulkMove = () => {},
    onBulkDelete = () => {},
    canBulkRename = false,
    canBulkMove = false,
    canBulkDelete = false,
    onCopy = () => {},
    canCopy = false,
    showCopy = false,
    onWatchExternal = () => {},
    canWatchExternal = false,
    onSlideshow = () => {},
    canSlideshow = false,
    slideshowKind = 'image',
    onCreateFolder = () => {},
    renameModalOpen = false,
    renameValue = '',
    renameTarget = null,
    setRenameValue = () => {},
    onRenameConfirm = () => {},
    onRenameClose = () => {},
    deleteModalOpen = false,
    deleteTargets = [],
    onDeleteConfirm = () => {},
    onDeleteClose = () => {},
    bulkActionLoading = false,
    bulkError = null,
    bulkSuccess = null,
    createFolderModalOpen = false,
    createFolderValue = '',
    setCreateFolderValue = () => {},
    onCreateFolderConfirm = () => {},
    onCreateFolderClose = () => {},
    transferModalOpen = false,
    transferTargets = [],
    transferSourceAccountId = null,
    transferSourceAccountLabel = '',
    transferSourceRepoId = '',
    transferSourceRepoType = 'dataset',
    transferAccounts = [],
    transferReposByAccount = {},
    transferReposLoading = false,
    transferReposError = null,
    onTransferFetchRepos = () => {},
    transferDestFoldersByRepo = {},
    transferDestFoldersLoading = false,
    transferDestFoldersError = null,
    onTransferFetchDestFolders = () => {},
    transferDisabledPaths = [],
    onTransferConfirm = () => {},
    onTransferClose = () => {},
    transferMode = 'move',
    transferIsPublicSource = false,
    repoSelectionMode = false,
    selectedRepoIds = new Set(),
    onEnterRepoSelection = () => {},
    onToggleRepoSelection = () => {},
    onExitRepoSelection = () => {},
    onSelectAllRepos = () => {},
    onDeselectAllRepos = () => {},
    allReposSelected = false,
    selectedReposCount = 0,
    onRenameRepo = () => {},
    onDeleteRepo = () => {},
    onUpdateRepoVisibility = () => {},
    onSquashRepo = () => {},
    onAddRepo = () => {},
    addRepoModalOpen = false,
    onAddRepoConfirm = () => {},
    onAddRepoClose = () => {},
    canSquashRepo = false,
    squashRepoModalOpen = false,
    squashRepoTargets = [],
    onSquashRepoConfirm = () => {},
    onSquashRepoClose = () => {},
    canRenameRepo = false,
    canDeleteRepo = false,
    canUpdateRepoVisibility = false,
    selectedRepoPrivate = null,
    renameRepoModalOpen = false,
    renameRepoValue = '',
    renameRepoTarget = null,
    setRenameRepoValue = () => {},
    onRenameRepoConfirm = () => {},
    onRenameRepoClose = () => {},
    deleteRepoModalOpen = false,
    deleteRepoTargets = [],
    onDeleteRepoConfirm = () => {},
    onDeleteRepoClose = () => {},
    visibilityRepoModalOpen = false,
    visibilityRepoTarget = null,
    onVisibilityRepoConfirm = () => {},
    onVisibilityRepoClose = () => {},
    onOpenPublicRepo = () => {},
    isPublicView = false,
  } = props;

  const [isMobile, setIsMobile] = useState(screenSize === 'mobile');
  const [internalSidebarWidth, setInternalSidebarWidth] = useState(sidebarWidth || 220);
  const [hfSearchOpen, setHfSearchOpen] = useState(false);

  useEffect(() => { setIsMobile(screenSize === 'mobile'); }, [screenSize]);

  const scrollAllToTop = useCallback(() => {
    window.scrollTo(0, 0);
    document.scrollingElement?.scrollTo(0, 0);
    document
      .querySelectorAll<HTMLElement>('.cloudview-main-panel, .cloudview-file-list, .cloudview-file-grid, .cloudview-file-thumbnail-grid, .cloudview-file-poster-grid, .cloudview-chats-panel')
      .forEach((el) => { el.scrollTop = 0; });
  }, []);

  const inPlayer = isMobile ? mobileView === 'player' : !!selectedFile;
  useEffect(() => {
    if (!inPlayer) return;
    scrollAllToTop();
    const raf = requestAnimationFrame(scrollAllToTop);
    const timer = setTimeout(scrollAllToTop, 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [inPlayer, selectedFile?.id, scrollAllToTop]);

  const pendingTopRef = useRef(false);
  useEffect(() => {
    pendingTopRef.current = true;
    scrollAllToTop();
    const raf = requestAnimationFrame(scrollAllToTop);
    const expire = setTimeout(() => { pendingTopRef.current = false; }, 3000);
    return () => { cancelAnimationFrame(raf); clearTimeout(expire); };
  }, [currentPath, selectedChat?.id, scrollAllToTop]);
  useEffect(() => {
    if (loadingFiles || !pendingTopRef.current) return;
    scrollAllToTop();
    pendingTopRef.current = false;
  }, [loadingFiles, scrollAllToTop]);
  useEffect(() => {
    if (sidebarWidth !== internalSidebarWidth) setInternalSidebarWidth(sidebarWidth);
  }, [sidebarWidth]);

  const handleWidthChange = useCallback((newWidth: number) => {
    setInternalSidebarWidth(newWidth);
    if (setSidebarWidth) setSidebarWidth(newWidth);
  }, [setSidebarWidth]);

  const handleOpenHFSearch = useCallback(() => { setHfSearchOpen(true); }, []);
  const handleCloseHFSearch = useCallback(() => { setHfSearchOpen(false); }, []);
  const handleSelectPublicRepo = useCallback((repo: HFSearchRepo) => {
    onOpenPublicRepo(repo);
    setHfSearchOpen(false);
  }, [onOpenPublicRepo]);

  const showHFSearchBtn = sourceType === 'hf_dataset';
  const handleLogout = useCallback(async () => { if (clearSession) await clearSession(); }, [clearSession]);

  const handleRootClick = useCallback(() => {
    if (sourceType === 'hf_dataset') {
      if (mobileView === 'chats' || !hfSelectedRepo) { handleBackToRoot(); return; }
      if (selectedFile) { handleBackToFiles(); return; }
      if (onBackToRepos) { onBackToRepos(); } else { handleBackToRoot(); }
      return;
    }
    handleBackToRoot();
  }, [sourceType, mobileView, hfSelectedRepo, handleBackToRoot, selectedFile, handleBackToFiles, onBackToRepos]);

  const renderBreadcrumb = useCallback((isMobileView: boolean = false) => (
    <Breadcrumb
      key={sourceType === 'hf_dataset' ? `breadcrumb-${currentPath}-${mobileView}` : 'breadcrumb-telegram'}
      chat={selectedChat} file={selectedFile} onRoot={handleRootClick} onChat={handleBackToFiles} onChats={handleBackToChats}
      onClosePreview={onClosePreview} onBackToRepos={onBackToRepos} onBackToRepoRoot={onBackToRepoRoot} sourceName={sourceName}
      showBackButton={showBackButton} sourceType={sourceType} repoName={sourceType === 'hf_dataset' ? hfRepoName : undefined}
      currentPath={sourceType === 'hf_dataset' ? currentPath : ''} onNavigateToPath={onNavigateToPath} isMobile={isMobileView} onGoBack={onGoBack}
    />
  ), [sourceType, currentPath, mobileView, selectedChat, selectedFile, handleRootClick, handleBackToFiles, handleBackToChats, onClosePreview, onBackToRepos, onBackToRepoRoot, sourceName, showBackButton, hfRepoName, onNavigateToPath, onGoBack]);

  const renderNotifications = useCallback(() => (
    <>
      <AnimatePresence>
        {bulkError && (
          <motion.div className="cloudview-toast cloudview-toast--error" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
            <AlertCircle size={16} /><span>{bulkError}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {bulkSuccess && (
          <motion.div className="cloudview-toast cloudview-toast--success" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
            <Check size={16} /><span>{bulkSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  ), [bulkError, bulkSuccess]);

  const renderModals = useCallback(() => {
    if (sourceType !== 'hf_dataset') return null;
    return (
      <>
        <CloudModalSelection
          renameOpen={renameModalOpen} renameValue={renameValue} renameTarget={renameTarget} setRenameValue={setRenameValue}
          onRenameConfirm={onRenameConfirm} onRenameClose={onRenameClose} deleteOpen={deleteModalOpen} deleteTargets={deleteTargets}
          onDeleteConfirm={onDeleteConfirm} onDeleteClose={onDeleteClose} createFolderOpen={createFolderModalOpen}
          createFolderValue={createFolderValue} createFolderCurrentPath={currentPath} setCreateFolderValue={setCreateFolderValue}
          onCreateFolderConfirm={onCreateFolderConfirm} onCreateFolderClose={onCreateFolderClose} transferOpen={transferModalOpen}
          transferTargets={transferTargets} transferSourceAccountId={transferSourceAccountId} transferSourceAccountLabel={transferSourceAccountLabel}
          transferSourceRepoId={transferSourceRepoId} transferSourceRepoType={transferSourceRepoType} transferAccounts={transferAccounts}
          transferReposByAccount={transferReposByAccount} transferReposLoading={transferReposLoading} transferReposError={transferReposError}
          onTransferFetchRepos={onTransferFetchRepos} transferDestFoldersByRepo={transferDestFoldersByRepo}
          transferDestFoldersLoading={transferDestFoldersLoading} transferDestFoldersError={transferDestFoldersError}
          onTransferFetchDestFolders={onTransferFetchDestFolders} transferDisabledPaths={transferDisabledPaths}
          onTransferConfirm={onTransferConfirm} onTransferClose={onTransferClose} transferMode={transferMode}
          isPublicSource={transferIsPublicSource} loading={bulkActionLoading}
        />
        <RenameRepoModal open={renameRepoModalOpen} value={renameRepoValue} target={renameRepoTarget} onChangeValue={setRenameRepoValue} onConfirm={onRenameRepoConfirm} onClose={onRenameRepoClose} loading={bulkActionLoading} />
        <DeleteRepoModal open={deleteRepoModalOpen} targets={deleteRepoTargets} onConfirm={onDeleteRepoConfirm} onClose={onDeleteRepoClose} loading={bulkActionLoading} />
        <AddRepoModal open={addRepoModalOpen} onConfirm={onAddRepoConfirm} onClose={onAddRepoClose} loading={bulkActionLoading} />
        <SquashRepoModal open={squashRepoModalOpen} targets={squashRepoTargets} onConfirm={onSquashRepoConfirm} onClose={onSquashRepoClose} loading={bulkActionLoading} />
        <VisibilityRepoModal open={visibilityRepoModalOpen} target={visibilityRepoTarget} onConfirm={onVisibilityRepoConfirm} onClose={onVisibilityRepoClose} loading={bulkActionLoading} />
      </>
    );
  }, [sourceType, renameModalOpen, renameValue, renameTarget, setRenameValue, onRenameConfirm, onRenameClose, deleteModalOpen, deleteTargets, onDeleteConfirm, onDeleteClose, createFolderModalOpen, createFolderValue, currentPath, setCreateFolderValue, onCreateFolderConfirm, onCreateFolderClose, transferModalOpen, transferMode, transferTargets, transferSourceAccountId, transferSourceAccountLabel, transferSourceRepoId, transferSourceRepoType, transferAccounts, transferReposByAccount, transferReposLoading, transferReposError, onTransferFetchRepos, transferDestFoldersByRepo, transferDestFoldersLoading, transferDestFoldersError, onTransferFetchDestFolders, transferDisabledPaths, onTransferConfirm, onTransferClose, bulkActionLoading, transferIsPublicSource, renameRepoModalOpen, renameRepoValue, renameRepoTarget, setRenameRepoValue, onRenameRepoConfirm, onRenameRepoClose, deleteRepoModalOpen, deleteRepoTargets, onDeleteRepoConfirm, onDeleteRepoClose, visibilityRepoModalOpen, visibilityRepoTarget, onVisibilityRepoConfirm, onVisibilityRepoClose, squashRepoModalOpen, squashRepoTargets, onSquashRepoConfirm, onSquashRepoClose, addRepoModalOpen, onAddRepoConfirm, onAddRepoClose]);

  if (isMobile) {
    if (loading) return <Loading />;

    const isInsideRepo = sourceType === 'hf_dataset' && !!hfSelectedRepo;

    return (
      <div className="cloudview-root cloudview-root--mobile" style={{ height: '100vh', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
        <header className="cloudview-mobile-header" style={{ position: 'sticky', top: 0, height: '56px', background: 'var(--bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', zIndex: 100, flexShrink: 0 }}>
          <div className="cloudview-mobile-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, overflow: 'hidden' }}>{renderBreadcrumb(true)}</div>
          </div>
          <div className="cloudview-mobile-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span className="cloudview-mobile-count" style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {sourceType === 'telegram' ? (mobileView === 'chats' ? `${dialogs.length} chats` : '') : (mobileView === 'chats' ? `${hfRepos.length} repos` : '')}
            </span>
            <button className="cloudview-toolbar-btn" onClick={handleBackToRoot} title="Home" style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: '6px', color: 'var(--text-sub)', cursor: 'pointer' }}><Home size={18} /></button>
            {sourceType === 'hf_dataset' && !isPublicView && !isInsideRepo ? (
              <button className="cloudview-toolbar-btn" onClick={onAddRepo} title="Add repository" style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: '6px', color: 'var(--text-sub)', cursor: 'pointer' }}><Plus size={18} /></button>
            ) : sourceType === 'telegram' ? (
              <button className="cloudview-toolbar-btn" onClick={fetchDialogs} style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: '6px', color: 'var(--text-sub)', cursor: 'pointer' }}><RefreshCw size={16} /></button>
            ) : null}
            {showHFSearchBtn && <button className="cloudview-toolbar-btn" onClick={handleOpenHFSearch} title="Search Hugging Face" style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: '6px', color: 'var(--text-sub)', cursor: 'pointer' }}><Search size={18} /></button>}
            {clearSession && !isPublicView && <button className="cloudview-toolbar-btn" onClick={handleLogout} style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: '6px', color: 'var(--text-sub)', cursor: 'pointer' }}><LogOut size={16} /></button>}
          </div>
        </header>

        <AnimatePresence>
          {sourceType === 'hf_dataset' && repoSelectionMode && !isPublicView && (
            <RepoSelectionActionBar
              count={selectedReposCount} allSelected={allReposSelected} canRename={canRenameRepo} canDelete={canDeleteRepo}
              canUpdateVisibility={canUpdateRepoVisibility} canSquash={canSquashRepo} selectedRepoPrivate={selectedRepoPrivate}
              onSelectAll={onSelectAllRepos} onDeselectAll={onDeselectAllRepos} onRename={onRenameRepo} onDelete={onDeleteRepo}
              onUpdateVisibility={onUpdateRepoVisibility} onSquash={onSquashRepo} onCancel={onExitRepoSelection}
            />
          )}
        </AnimatePresence>

        <main className="cloudview-mobile-content" style={{ flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative' }}>
          <AnimatePresence mode="wait">
            {mobileView === 'chats' && (
              <motion.div key="chats" className="cloudview-mobile-panel" {...MOBILE_FADE} style={{ height: '100%', overflowY: 'auto', position: 'relative' }}>
                {sourceType === 'telegram' ? (
                  <ul className="cloudview-chats-list">
                    {dialogs.map((chat) => (
                      <motion.li key={chat.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                        <div
                          role="button"
                          tabIndex={0}
                          className={`cloudview-frow ${selectedChat?.id === chat.id ? 'cloudview-frow--active' : ''}`}
                          style={{ ['--row-accent' as any]: CHAT_ACCENT[chat.type] || 'var(--primary)' }}
                          onClick={() => handleChatClick(chat)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleChatClick(chat); }}
                        >
                          <span className="cloudview-frow-main">
                            <span className="cloudview-frow-icon">{chat.type === 'channel' ? <Hash size={18} /> : <Users size={18} />}</span>
                            <span className="cloudview-frow-text">
                              <span className="cloudview-frow-name">{sanitizeText(chat.name)}</span>
                              <span className="cloudview-frow-meta">
                                <span className="cloudview-frow-chip">{sanitizeText(chat.type)}</span>
                              </span>
                            </span>
                          </span>
                          <span className="cloudview-frow-end">
                            {chat.unread_count !== undefined && chat.unread_count !== null && chat.unread_count > 0 ? <span className="cloudview-unread">{chat.unread_count}</span> : null}
                            <ChevronRight size={16} className="cloudview-frow-chevron" />
                          </span>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                ) : (
                  <ul className="cloudview-chats-list" style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                    {hfRepos.map((repo) => {
                      const isSelected = selectedRepoIds.has(repo.full_name);
                      return (
                        <motion.li key={repo.full_name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} style={{ listStyle: 'none' }}>
                          <RepoRow repo={repo} isActive={hfSelectedRepo === repo.full_name && !repoSelectionMode} isSelected={isSelected} selectionMode={repoSelectionMode} onRepoClick={onRepoClick} onEnterRepoSelection={onEnterRepoSelection} onToggleRepoSelection={onToggleRepoSelection} />
                        </motion.li>
                      );
                    })}
                  </ul>
                )}
              </motion.div>
            )}
            {mobileView === 'files' && (
              <motion.div key="files" className="cloudview-mobile-panel" {...MOBILE_FADE} style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
                <FilesPanel
                  selectedChat={selectedChat} selectedRepo={hfSelectedRepo} files={sortedFiles} selectedFile={selectedFile} loadingFiles={loadingFiles} error={error}
                  searchQuery={searchQuery} viewMode={viewMode} sortField={sortField} sortDir={sortDir} showSortMenu={showSortMenu} totalSize={totalSize}
                  sortMenuRef={sortMenuRef} screenSize={screenSize} onSearchChange={setSearchQuery} onRefresh={refreshCurrentChatFiles} onCreateFolder={onCreateFolder}
                  onToggleSortMenu={() => setShowSortMenu(!showSortMenu)} onSort={toggleSort} onCycleViewMode={cycleViewMode} onFileClick={handleFileClick}
                  getStreamUrl={getStreamUrl} sourceType={sourceType} hfToken={hfToken} selectionMode={selectionMode} selectedIds={selectedIds}
                  onEnterSelection={onEnterSelection} onToggleSelection={onToggleSelection} onExitSelection={onExitSelection} onSelectAll={onSelectAll}
                  onDeselectAll={onDeselectAll} allSelected={allSelected} selectedItemsCount={selectedItemsCount} onBulkRename={onBulkRename} onBulkMove={onBulkMove}
                  onBulkDelete={onBulkDelete} canBulkRename={canBulkRename} canBulkMove={canBulkMove} canBulkDelete={canBulkDelete} canSlideshow={canSlideshow} slideshowKind={slideshowKind}
                  onSlideshow={onSlideshow} onCopy={onCopy} canCopy={canCopy} showCopy={showCopy} onWatchExternal={onWatchExternal} canWatchExternal={canWatchExternal} isPublicView={isPublicView}
                />
              </motion.div>
            )}
            {mobileView === 'player' && (
              <motion.div key="player" className="cloudview-mobile-panel" {...MOBILE_FADE} style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
                <PlayerPanel key={selectedFile?.id} selectedFile={selectedFile} selectedChat={selectedChat} sourceType={sourceType} hfToken={hfToken} fileMetadata={fileMetadata} onDownload={handleDownload} onFileGone={handleFileGone} onImageError={handleImageError} onMediaLoaded={handleMediaLoaded} getStreamUrl={getStreamUrl} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        {renderNotifications()}
        {renderModals()}
        <CloudModalHFSearch isOpen={hfSearchOpen} onClose={handleCloseHFSearch} onSelectRepo={handleSelectPublicRepo} token={hfToken} />
      </div>
    );
  }

  const isTablet = screenSize === 'tablet';
  const tabletSidebarWidth = 240;
  const sidebarWidthToUse = isTablet ? tabletSidebarWidth : internalSidebarWidth;

  return (
    <div className={`cloudview-root ${isTablet ? 'cloudview-root--tablet' : 'cloudview-root--desktop'}`} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="cloudview-titlebar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '0 12px', height: '44px', background: 'var(--bg)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div className="cloudview-titlebar-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {!isTablet && <button className="cloudview-sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ background: 'none', border: 'none', borderRadius: '6px', padding: '6px', color: 'var(--text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>}
          {renderBreadcrumb(false)}
        </div>
        <div className="cloudview-titlebar-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {showHFSearchBtn && <button className="cloudview-toolbar-btn" onClick={handleOpenHFSearch} title="Search Hugging Face" style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: '6px', color: 'var(--text-sub)', cursor: 'pointer' }}><Search size={16} /></button>}
          {selectedFile && <button className={`cloudview-toolbar-btn ${showDetail ? 'cloudview-toolbar-btn--active' : ''}`} onClick={() => setShowDetail(!showDetail)} style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: '6px', color: 'var(--text-sub)', cursor: 'pointer' }}><Info size={16} /></button>}
          {clearSession && !isPublicView && <button className="cloudview-toolbar-btn" onClick={handleLogout} style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: '6px', color: 'var(--text-sub)', cursor: 'pointer' }}><LogOut size={16} /></button>}
        </div>
      </div>
      <div className="cloudview-desktop-body" style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <Sidebar dialogs={dialogs} selectedChat={selectedChat} loading={loading} onChatClick={handleChatClick} onRefresh={fetchDialogs} onAddRepo={onAddRepo} collapsed={isTablet ? false : sidebarCollapsed} width={sidebarWidthToUse} onWidthChange={isTablet ? () => {} : handleWidthChange} sourceType={sourceType} hfRepos={hfRepos} onRepoClick={onRepoClick} selectedRepo={hfSelectedRepo} repoSelectionMode={repoSelectionMode} selectedRepoIds={selectedRepoIds} onEnterRepoSelection={onEnterRepoSelection} onToggleRepoSelection={onToggleRepoSelection} hideAddRepo={isPublicView} />
        <main className="cloudview-main-panel" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg)' }}>
          {sourceType === 'hf_dataset' && repoSelectionMode && !isPublicView && (
            <RepoSelectionActionBar count={selectedReposCount} allSelected={allReposSelected} canRename={canRenameRepo} canDelete={canDeleteRepo} canUpdateVisibility={canUpdateRepoVisibility} canSquash={canSquashRepo} selectedRepoPrivate={selectedRepoPrivate} onSelectAll={onSelectAllRepos} onDeselectAll={onDeselectAllRepos} onRename={onRenameRepo} onDelete={onDeleteRepo} onUpdateVisibility={onUpdateRepoVisibility} onSquash={onSquashRepo} onCancel={onExitRepoSelection} />
          )}
          {!selectedFile ? (
            <FilesPanel selectedChat={selectedChat} selectedRepo={hfSelectedRepo} files={sortedFiles} selectedFile={selectedFile} loadingFiles={loadingFiles} error={error} searchQuery={searchQuery} viewMode={viewMode} sortField={sortField} sortDir={sortDir} showSortMenu={showSortMenu} totalSize={totalSize} sortMenuRef={sortMenuRef} screenSize={screenSize} onSearchChange={setSearchQuery} onRefresh={refreshCurrentChatFiles} onCreateFolder={onCreateFolder} onToggleSortMenu={() => setShowSortMenu(!showSortMenu)} onSort={toggleSort} onCycleViewMode={cycleViewMode} onFileClick={handleFileClick} getStreamUrl={getStreamUrl} sourceType={sourceType} hfToken={hfToken} selectionMode={selectionMode} selectedIds={selectedIds} onEnterSelection={onEnterSelection} onToggleSelection={onToggleSelection} onExitSelection={onExitSelection} onSelectAll={onSelectAll} onDeselectAll={onDeselectAll} allSelected={allSelected} selectedItemsCount={selectedItemsCount} onBulkRename={onBulkRename} onBulkMove={onBulkMove} onBulkDelete={onBulkDelete} canBulkRename={canBulkRename} canBulkMove={canBulkMove} canBulkDelete={canBulkDelete} canSlideshow={canSlideshow} slideshowKind={slideshowKind} onSlideshow={onSlideshow} onCopy={onCopy} canCopy={canCopy} showCopy={showCopy} onWatchExternal={onWatchExternal} canWatchExternal={canWatchExternal} isPublicView={isPublicView} />
          ) : (
            <PlayerPanel key={selectedFile?.id} selectedFile={selectedFile} selectedChat={selectedChat} sourceType={sourceType} hfToken={hfToken} fileMetadata={fileMetadata} onDownload={handleDownload} onFileGone={handleFileGone} onImageError={handleImageError} onMediaLoaded={handleMediaLoaded} getStreamUrl={getStreamUrl} />
          )}
        </main>
        <AnimatePresence>
          {showDetail && selectedFile && (
            <motion.aside className="cloudview-detail-pane" initial={{ width: 0, opacity: 0 }} animate={{ width: isTablet ? 220 : 260, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ borderLeft: '1px solid var(--border-color)', background: 'var(--bg)', overflow: 'hidden', flexShrink: 0 }}>
              <DetailPanel file={selectedFile} metadata={fileMetadata} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
      {renderNotifications()}
      {renderModals()}
      <CloudModalHFSearch isOpen={hfSearchOpen} onClose={handleCloseHFSearch} onSelectRepo={handleSelectPublicRepo} token={hfToken} />
    </div>
  );
};

export default CloudViewPack;