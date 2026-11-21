// src/react/config/cloudviewtypes.ts
import type React from 'react';
import type { HFRepo, HFSearchRepo } from '@config/huggingface';
import type { SortDir, SortField, TelegramChat, TelegramFile, TelegramFileMetadata, ViewMode } from '@config/telegram';
import type { TransferAccount, TransferRepo } from '@feature/cloudmodalselection';

export type CloudViewFile = Omit<TelegramFile, 'id'> & {
  id: string | number;
  _isFolder?: boolean;
  _folderName?: string;
  _folderSize?: number;
  _fullPath?: string;
  _path?: string;
  _url?: string;
  _streamUrl?: string;
  _thumbUrl?: string;
  _coverThumbUrl?: string;
  _coverType?: string;
  _coverSize?: number;
  _coverName?: string;
  _coverStreamUrl?: string;
  path?: string;
  sha?: string;
};

export interface HFBulkContext {
  repoId: string;
  repoType: 'dataset' | 'model' | 'space';
  token: string;
}

export interface HFApiResult<TData = unknown> {
  ok: boolean;
  error?: string;
  data?: TData;
}

export interface HFFolderListData {
  folders: string[];
}

export interface HFMoveData {
  count?: number;
}

export interface HFCopyData {
  count_copied?: number;
  count_failed_delete_src?: number;
}

export interface NavSnapshot {
  sourceId: string | null;
  sourceType: 'telegram' | 'hf_dataset' | null;
  hfView: 'repos' | 'files';
  repo: string;
  repoType: 'dataset' | 'model' | 'space' | '';
  path: string;
  fileId: string | null;
  chatId: string | null;
  mobileView: 'chats' | 'files' | 'player';
  isPublic?: boolean;
}

export interface CloudViewPackProps {
  dialogs: TelegramChat[];
  selectedChat: TelegramChat | null;
  files: CloudViewFile[];
  sortedFiles: CloudViewFile[];
  selectedFile: CloudViewFile | null;
  loading: boolean;
  loadingFiles: boolean;
  searchQuery: string;
  viewMode: ViewMode | 'poster';
  sortField: SortField;
  sortDir: SortDir;
  showSortMenu: boolean;
  error: string | null;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  showDetail: boolean;
  screenSize: 'mobile' | 'tablet' | 'desktop';
  mobileView: 'chats' | 'files' | 'player';
  totalSize: number;
  fileMetadata: TelegramFileMetadata | null;
  sortMenuRef: React.RefObject<HTMLDivElement | null>;
  sourceName?: string;
  showBackButton?: boolean;
  sourceType?: 'telegram' | 'hf_dataset';
  tgSession?: string | null;
  onBackToRoot?: () => void;
  onClosePreview?: () => void;
  setSearchQuery: (q: string) => void;
  setSidebarCollapsed: (c: boolean) => void;
  setShowDetail: (s: boolean) => void;
  setMobileView: (v: 'chats' | 'files' | 'player') => void;
  fetchDialogs: () => void;
  refreshCurrentChatFiles: () => void;
  handleChatClick: (chat: TelegramChat) => void;
  handleFileClick: (file: CloudViewFile) => void;
  handleBackToRoot: () => void;
  handleBackToFiles: () => void;
  handleBackToChats: () => void;
  handleFileGone: (fileId: number) => void;
  handleImageError: (fileId: number) => void;
  handleMediaLoaded: (fileId: number) => void;
  getStreamUrl: (chatId: number | string, msgId: number | string) => string;
  handleDownload: (chatId: number, msgId: number, filename: string) => void;
  hfToken?: string;
  toggleSort: (field: SortField) => void;
  cycleViewMode: () => void;
  setShowSortMenu: (s: boolean) => void;
  clearSession?: () => void;
  hfRepos?: HFRepo[];
  hfSelectedRepo?: string;
  onRepoClick?: (repo: HFRepo) => void;
  onBackToRepos?: () => void;
  onBackToRepoRoot?: () => void;
  hfRepoName?: string;
  currentPath?: string;
  onNavigateToPath?: (path: string) => void;
  onGoBack?: () => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onEnterSelection?: (file: CloudViewFile) => void;
  onToggleSelection?: (file: CloudViewFile) => void;
  onExitSelection?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  allSelected?: boolean;
  selectedItemsCount?: number;
  onBulkRename?: () => void;
  onBulkMove?: () => void;
  onBulkDelete?: () => void;
  canBulkRename?: boolean;
  canBulkMove?: boolean;
  canBulkDelete?: boolean;
  onCopy?: () => void;
  canCopy?: boolean;
  showCopy?: boolean;
  onWatchExternal?: () => void;
  canWatchExternal?: boolean;
  onSlideshow?: () => void;
  canSlideshow?: boolean;
  slideshowKind?: 'image' | 'audio';
  onCreateFolder?: () => void;
  renameModalOpen?: boolean;
  renameValue?: string;
  renameTarget?: CloudViewFile | null;
  setRenameValue?: (v: string) => void;
  onRenameConfirm?: () => void;
  onRenameClose?: () => void;
  deleteModalOpen?: boolean;
  deleteTargets?: CloudViewFile[];
  onDeleteConfirm?: () => void;
  onDeleteClose?: () => void;
  bulkActionLoading?: boolean;
  bulkError?: string | null;
  bulkSuccess?: string | null;
  createFolderModalOpen?: boolean;
  createFolderValue?: string;
  setCreateFolderValue?: (v: string) => void;
  onCreateFolderConfirm?: () => void;
  onCreateFolderClose?: () => void;
  transferModalOpen?: boolean;
  transferTargets?: CloudViewFile[];
  transferSourceAccountId?: string | null;
  transferSourceAccountLabel?: string;
  transferSourceRepoId?: string;
  transferSourceRepoType?: 'dataset' | 'model' | 'space';
  transferAccounts?: TransferAccount[];
  transferReposByAccount?: Record<string, TransferRepo[]>;
  transferReposLoading?: boolean;
  transferReposError?: string | null;
  onTransferFetchRepos?: (accountId: string) => void;
  transferDestFoldersByRepo?: Record<string, { label: string; path: string }[]>;
  transferDestFoldersLoading?: boolean;
  transferDestFoldersError?: string | null;
  onTransferFetchDestFolders?: (accountId: string, repoId: string) => void;
  transferDisabledPaths?: string[];
  onTransferConfirm?: (params: {
    dstAccountId: string;
    dstRepoId: string;
    dstRepoType: 'dataset' | 'model' | 'space';
    dstPathPrefix: string;
  }) => void;
  onTransferClose?: () => void;
  transferMode?: 'move' | 'copy';
  transferIsPublicSource?: boolean;
  repoSelectionMode?: boolean;
  selectedRepoIds?: Set<string>;
  onEnterRepoSelection?: (repo: HFRepo) => void;
  onToggleRepoSelection?: (repo: HFRepo) => void;
  onExitRepoSelection?: () => void;
  onSelectAllRepos?: () => void;
  onDeselectAllRepos?: () => void;
  allReposSelected?: boolean;
  selectedReposCount?: number;
  onRenameRepo?: () => void;
  onDeleteRepo?: () => void;
  onUpdateRepoVisibility?: () => void;
  onSquashRepo?: () => void;
  onAddRepo?: () => void;
  addRepoModalOpen?: boolean;
  onAddRepoConfirm?: (params: { name: string; type: 'dataset' | 'model' | 'space'; isPrivate: boolean }) => void;
  onAddRepoClose?: () => void;
  canSquashRepo?: boolean;
  squashRepoModalOpen?: boolean;
  squashRepoTargets?: HFRepo[];
  onSquashRepoConfirm?: () => void;
  onSquashRepoClose?: () => void;
  canRenameRepo?: boolean;
  canDeleteRepo?: boolean;
  canUpdateRepoVisibility?: boolean;
  selectedRepoPrivate?: boolean | null;
  renameRepoModalOpen?: boolean;
  renameRepoValue?: string;
  renameRepoTarget?: HFRepo | null;
  setRenameRepoValue?: (v: string) => void;
  onRenameRepoConfirm?: () => void;
  onRenameRepoClose?: () => void;
  deleteRepoModalOpen?: boolean;
  deleteRepoTargets?: HFRepo[];
  onDeleteRepoConfirm?: () => void;
  onDeleteRepoClose?: () => void;
  visibilityRepoModalOpen?: boolean;
  visibilityRepoTarget?: HFRepo | null;
  onVisibilityRepoConfirm?: (isPrivate: boolean) => void;
  onVisibilityRepoClose?: () => void;
  onOpenPublicRepo?: (repo: HFSearchRepo) => void;
  isPublicView?: boolean;
}
