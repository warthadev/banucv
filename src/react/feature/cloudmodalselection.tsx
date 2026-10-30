// src/react/feature/cloudmodalselection.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, X, Pencil, Trash2, FolderInput, Check, Loader2,
  AlertCircle, Search, ArrowRightLeft, Key, Eye, EyeOff,
  ChevronDown,
} from 'lucide-react';
import { HuggingFaceIcon } from '@control/icon';

export const SAME_ACCOUNT_ID = '__same_account__';

const sanitizeText = (text: string | undefined | null): string => {
  if (!text) return '';
  const element = document.createElement('div');
  element.textContent = text;
  return element.textContent || '';
};

const formatBytes = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  const fixed = i <= 1 ? value.toFixed(0) : value.toFixed(1);
  return `${fixed} ${sizes[i]}`;
};

interface FolderTreeNode {
  name: string;
  path: string;
  level: number;
  children: FolderTreeNode[];
}

const normalizePath = (p: string): string => (p || '').replace(/^\/+|\/+$/g, '');

const isPathDisabled = (path: string, disabledPaths: string[]): boolean => {
  const clean = normalizePath(path);
  if (!clean) return false;
  for (const d of disabledPaths) {
    const dc = normalizePath(d);
    if (!dc) continue;
    if (clean === dc) return true;
    if (clean.startsWith(dc + '/')) return true;
  }
  return false;
};

const buildFolderTree = (flatPaths: string[]): FolderTreeNode[] => {
  const root: FolderTreeNode = { name: '', path: '', level: -1, children: [] };
  const nodeMap = new Map<string, FolderTreeNode>();
  nodeMap.set('', root);

  const sortedPaths = [...flatPaths].sort((a, b) => a.localeCompare(b));

  for (const rawPath of sortedPaths) {
    const clean = rawPath.replace(/^\/+/, '').trim();
    if (!clean) continue;
    const segments = clean.split('/').filter(Boolean);
    let currentPath = '';
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      if (!nodeMap.has(currentPath)) {
        const newNode: FolderTreeNode = {
          name: segment,
          path: currentPath,
          level: i,
          children: [],
        };
        nodeMap.set(currentPath, newNode);
        const parentNode = nodeMap.get(parentPath);
        if (parentNode) parentNode.children.push(newNode);
      }
    }
  }

  const sortRecursive = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) sortRecursive(node.children);
  };
  sortRecursive(root.children);

  return root.children;
};

const ChevronRight: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const FolderTreeItem: React.FC<{
  node: FolderTreeNode;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selected: string;
  onSelect: (path: string) => void;
  disabledPaths: string[];
}> = React.memo(({ node, expanded, onToggle, selected, onSelect, disabledPaths }) => {
  const isExpanded = expanded.has(node.path);
  const hasChildren = node.children.length > 0;
  const isSelected = selected === node.path;
  const isDisabled = isPathDisabled(node.path, disabledPaths);

  return (
    <div className="cloudview-folder-tree-node">
      <div
        className={`cloudview-folder-tree-row ${isSelected ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
        style={{ paddingLeft: `${node.level * 18 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className={`cloudview-folder-tree-toggle ${isExpanded ? 'expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.path);
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight size={14} />
          </button>
        ) : (
          <span className="cloudview-folder-tree-toggle-spacer" />
        )}
        <button
          type="button"
          className="cloudview-folder-tree-main"
          onClick={() => {
            if (isDisabled) return;
            onSelect(node.path);
          }}
          disabled={isDisabled}
          title={isDisabled ? 'Cannot select this folder' : undefined}
        >
          <Folder size={15} className="cloudview-folder-tree-icon" />
          <span className="cloudview-folder-tree-name">{sanitizeText(node.name)}</span>
        </button>
        {isSelected && !isDisabled && <Check size={15} className="cloudview-folder-tree-check" />}
      </div>
      <AnimatePresence initial={false}>
        {hasChildren && isExpanded && (
          <motion.div
            className="cloudview-folder-tree-children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.18, ease: 'easeOut' },
            }}
            style={{ overflow: 'hidden' }}
          >
            {node.children.map(child => (
              <FolderTreeItem
                key={child.path}
                node={child}
                expanded={expanded}
                onToggle={onToggle}
                selected={selected}
                onSelect={onSelect}
                disabledPaths={disabledPaths}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
FolderTreeItem.displayName = 'FolderTreeItem';

interface RenameModalProps {
  open: boolean;
  value: string;
  target: any;
  onChangeValue: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}

const RenameModal: React.FC<RenameModalProps> = ({
  open, value, target, onChangeValue, onConfirm, onClose, loading,
}) => {
  if (!target) return null;
  const isFolder = target._isFolder === true;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cloudview-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="cloudview-modal"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.17 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="cloudview-modal-title">
              Rename {isFolder ? 'folder' : 'file'}
            </h3>
            <p className="cloudview-modal-desc">
              Enter a new name for <strong>{sanitizeText(target.name)}</strong>
            </p>
            <input
              className="cloudview-modal-input"
              type="text"
              value={value}
              onChange={(e) => onChangeValue(e.target.value)}
              placeholder="New name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirm();
                if (e.key === 'Escape') onClose();
              }}
            />
            <div className="cloudview-modal-actions">
              <button className="cloudview-modal-btn cloudview-modal-btn--cancel" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button className="cloudview-modal-btn cloudview-modal-btn--confirm" onClick={onConfirm} disabled={loading || !value.trim()}>
                {loading ? <Loader2 className="spin" size={16} /> : 'Rename'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface DeleteModalProps {
  open: boolean;
  targets: any[];
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  open, targets, onConfirm, onClose, loading,
}) => {
  const deleteTitle = targets.length === 1
    ? `Delete ${targets[0]?._isFolder ? 'folder' : 'file'}`
    : `Delete ${targets.length} items`;

  return (
    <AnimatePresence>
      {open && targets.length > 0 && (
        <motion.div
          className="cloudview-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="cloudview-modal cloudview-modal--danger"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.17 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cloudview-modal-danger-icon">
              <AlertCircle size={26} />
            </div>
            <h3 className="cloudview-modal-title">{deleteTitle}?</h3>
            <p className="cloudview-modal-desc">
              {targets.length === 1
                ? <>Delete <strong>{sanitizeText(targets[0]?.name || '')}</strong>{targets[0]?._isFolder ? ' and all files inside' : ''}? This cannot be undone.</>
                : <>Delete <strong>{targets.length} items</strong>? This cannot be undone.</>
              }
            </p>
            <div className="cloudview-modal-actions">
              <button className="cloudview-modal-btn cloudview-modal-btn--cancel" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button className="cloudview-modal-btn cloudview-modal-btn--danger" onClick={onConfirm} disabled={loading}>
                {loading ? <Loader2 className="spin" size={16} /> : 'Delete'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface CreateFolderModalProps {
  open: boolean;
  value: string;
  currentPath?: string;
  onChangeValue: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  open, value, currentPath = '', onChangeValue, onConfirm, onClose, loading,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cloudview-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="cloudview-modal"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.17 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="cloudview-modal-title">Create folder</h3>
            <p className="cloudview-modal-desc">
              {currentPath ? (
                <>Will be created inside <strong>/{currentPath}</strong></>
              ) : (
                <>Will be created at repository root</>
              )}
            </p>
            <input
              className="cloudview-modal-input"
              type="text"
              value={value}
              onChange={(e) => onChangeValue(e.target.value)}
              placeholder="Folder name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirm();
                if (e.key === 'Escape') onClose();
              }}
            />
            <div className="cloudview-modal-actions">
              <button
                className="cloudview-modal-btn cloudview-modal-btn--cancel"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="cloudview-modal-btn cloudview-modal-btn--confirm"
                onClick={onConfirm}
                disabled={loading || !value.trim()}
              >
                {loading ? <Loader2 className="spin" size={16} /> : 'Create'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export interface TransferAccount {
  id: string;
  label: string;
  username: string;
  token: string;
}

export interface TransferRepo {
  id: string;
  label: string;
  type: 'dataset' | 'model' | 'space';
}

interface TransferModalProps {
  open: boolean;
  targets: any[];
  sourceAccountId: string | null;
  sourceAccountLabel: string;
  sourceRepoId: string;
  sourceRepoType: 'dataset' | 'model' | 'space';
  accounts: TransferAccount[];
  reposByAccount: Record<string, TransferRepo[]>;
  reposLoading: boolean;
  reposError: string | null;
  fetchReposForAccount: (accountId: string) => void;
  destFoldersByRepo: Record<string, { label: string; path: string }[]>;
  destFoldersLoading: boolean;
  destFoldersError: string | null;
  fetchDestFolders: (accountId: string, repoId: string) => void;
  disabledPaths?: string[];
  onConfirm: (params: {
    dstAccountId: string;
    dstRepoId: string;
    dstRepoType: 'dataset' | 'model' | 'space';
    dstPathPrefix: string;
  }) => void;
  onClose: () => void;
  mode: 'move' | 'copy';
  loading: boolean;
  isPublicSource?: boolean;
}

const TransferModal: React.FC<TransferModalProps> = ({
  open, targets, sourceAccountId, sourceAccountLabel, sourceRepoId, sourceRepoType,
  accounts, reposByAccount, reposLoading, reposError, fetchReposForAccount,
  destFoldersByRepo, destFoldersLoading, destFoldersError, fetchDestFolders,
  disabledPaths = [],
  onConfirm, onClose, mode, loading,
  isPublicSource = false,
}) => {
  const isCopy = mode === 'copy';
  const verb = isCopy ? 'Copy' : 'Move';
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [selectedRepoType, setSelectedRepoType] = useState<'dataset' | 'model' | 'space'>('dataset');
  const [selectedDestFolder, setSelectedDestFolder] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const repoDropdownRef = useRef<HTMLDivElement>(null);

  const sourceAccount = useMemo(() => {
    return accounts.find(a => a.id === sourceAccountId);
  }, [accounts, sourceAccountId]);

  const hasSourceAccount = !!sourceAccountId && !isPublicSource;

  const availableAccounts = useMemo(() => {
    if (isPublicSource) return accounts;
    return accounts.filter(a => a.id !== sourceAccountId);
  }, [accounts, sourceAccountId, isPublicSource]);

  const sameAccountLabel = useMemo(() => {
    if (sourceAccountLabel) {
      return `Same Account (${sourceAccountLabel})`;
    }
    return 'Same Account';
  }, [sourceAccountLabel]);

  const showSameAccount = hasSourceAccount && !isPublicSource;

  useEffect(() => {
    if (open) {
      if (isPublicSource) {
        setSelectedAccountId('');
        setSelectedRepoId('');
        setSelectedRepoType('dataset');
        setSelectedDestFolder('');
        setConfirmOpen(false);
        setFolderSearch('');
        setExpandedPaths(new Set());
        setAccountDropdownOpen(false);
        setRepoDropdownOpen(false);
        return;
      }
      setSelectedAccountId(hasSourceAccount ? SAME_ACCOUNT_ID : '');
      setSelectedRepoId(hasSourceAccount ? sourceRepoId : '');
      setSelectedRepoType(sourceRepoType || 'dataset');
      setSelectedDestFolder('');
      setConfirmOpen(false);
      setFolderSearch('');
      setExpandedPaths(new Set());
      setAccountDropdownOpen(false);
      setRepoDropdownOpen(false);
    }
  }, [open, isPublicSource, hasSourceAccount, sourceRepoId, sourceRepoType]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target as Node)) {
        setRepoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resolvedAccountId = useMemo(() => {
    if (selectedAccountId === SAME_ACCOUNT_ID) return sourceAccountId || '';
    return selectedAccountId;
  }, [selectedAccountId, sourceAccountId]);

  useEffect(() => {
    if (!open) return;
    if (!resolvedAccountId) {
      setSelectedRepoId('');
      return;
    }

    const repos = reposByAccount[resolvedAccountId];
    if (!repos && !reposLoading) {
      fetchReposForAccount(resolvedAccountId);
    }
  }, [resolvedAccountId, reposByAccount, reposLoading, fetchReposForAccount, open]);

  const currentRepos = useMemo<TransferRepo[]>(() => {
    if (!resolvedAccountId) return [];
    const repos = reposByAccount[resolvedAccountId] || [];
    if (
      !isPublicSource &&
      selectedAccountId === SAME_ACCOUNT_ID &&
      sourceRepoId &&
      !repos.some(r => r.id === sourceRepoId && r.type === sourceRepoType)
    ) {
      return [
        { id: sourceRepoId, label: `${sourceRepoId} (${sourceRepoType})`, type: sourceRepoType },
        ...repos,
      ];
    }
    return repos;
  }, [resolvedAccountId, reposByAccount, sourceRepoId, sourceRepoType, isPublicSource, selectedAccountId]);

  useEffect(() => {
    if (currentRepos.length === 0) {
      setSelectedRepoId('');
      return;
    }
    if (!currentRepos.some(r => r.id === selectedRepoId)) {
      setSelectedRepoId(currentRepos[0].id);
      setSelectedRepoType(currentRepos[0].type);
    }
  }, [currentRepos, selectedRepoId]);

  useEffect(() => {
    if (!open) return;
    if (!resolvedAccountId || !selectedRepoId) return;
    const key = `${resolvedAccountId}:${selectedRepoId}`;
    const cached = destFoldersByRepo[key];
    if (!cached && !destFoldersLoading) {
      fetchDestFolders(resolvedAccountId, selectedRepoId);
    }
  }, [open, resolvedAccountId, selectedRepoId, destFoldersByRepo, destFoldersLoading, fetchDestFolders]);

  useEffect(() => {
    setSelectedDestFolder('');
    setFolderSearch('');
    setExpandedPaths(new Set());
  }, [selectedAccountId, selectedRepoId]);

  const currentDestFoldersKey = resolvedAccountId && selectedRepoId
    ? `${resolvedAccountId}:${selectedRepoId}`
    : '';
  const currentDestFolders = currentDestFoldersKey
    ? (destFoldersByRepo[currentDestFoldersKey] || [])
    : [];

  const flatFolderPaths = useMemo(() => {
    return currentDestFolders
      .filter(opt => opt.path && opt.path.trim())
      .map(opt => opt.path);
  }, [currentDestFolders]);

  const treeData = useMemo(() => buildFolderTree(flatFolderPaths), [flatFolderPaths]);

  const isSearching = folderSearch.trim().length > 0;

  const filteredFlatFolders = useMemo(() => {
    if (!isSearching) return [];
    const q = folderSearch.toLowerCase().trim();
    return currentDestFolders.filter(opt =>
      opt.label.toLowerCase().includes(q) || opt.path.toLowerCase().includes(q)
    );
  }, [currentDestFolders, folderSearch, isSearching]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const totalSize = useMemo(() => {
    return targets.reduce((acc, t) => acc + (t.size || t._folderSize || 0), 0);
  }, [targets]);

  const canConfirm = !!selectedAccountId && !!selectedRepoId && !loading;

  const handleFinalConfirm = useCallback(() => {
    setConfirmOpen(false);
    onConfirm({
      dstAccountId: resolvedAccountId,
      dstRepoId: selectedRepoId,
      dstRepoType: selectedRepoType,
      dstPathPrefix: selectedDestFolder.replace(/^\/+|\/+$/g, ''),
    });
  }, [resolvedAccountId, selectedRepoId, selectedRepoType, selectedDestFolder, onConfirm]);

  const selectedAccount = useMemo(() => {
    if (selectedAccountId === SAME_ACCOUNT_ID) {
      return sourceAccount || null;
    }
    return availableAccounts.find(a => a.id === selectedAccountId);
  }, [availableAccounts, selectedAccountId, sourceAccount]);

  const selectedRepo = useMemo(() => (
    currentRepos.find(r => r.id === selectedRepoId)
  ), [currentRepos, selectedRepoId]);

  const shouldShowFolderPicker = !!selectedAccountId && !!selectedRepoId;

  const isSameAccountSelection = selectedAccountId === SAME_ACCOUNT_ID;

  const isSameRepoAsSource = !isPublicSource &&
    selectedRepoId === sourceRepoId &&
    selectedRepoType === sourceRepoType && (
    isSameAccountSelection ||
    selectedAccountId === sourceAccountId
  );

  const effectiveDisabledPaths = isSameRepoAsSource ? disabledPaths : [];

  const handleRequestConfirm = useCallback(() => {
    if (!canConfirm) return;
    if (isCopy || isSameRepoAsSource || isPublicSource) {
      handleFinalConfirm();
      return;
    }
    setConfirmOpen(true);
  }, [canConfirm, isCopy, isSameRepoAsSource, handleFinalConfirm, isPublicSource]);

  const destinationLabel = useMemo(() => {
    if (!selectedAccount) return '';
    return selectedAccount.label;
  }, [selectedAccount]);

  const repoDropdownDisabled = !selectedAccountId || loading;

  return (
    <>
      <AnimatePresence>
        {open && !confirmOpen && (
          <motion.div
            className="cloudview-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          >
            <motion.div
              className="cloudview-modal cloudview-modal--transfer"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.17 }}
              onClick={(e) => e.stopPropagation()}
              layout
            >
              <h3 className="cloudview-modal-title">{verb}</h3>
              <p className="cloudview-modal-desc">
                {verb} <strong>{targets.length} item{targets.length > 1 ? 's' : ''}</strong>
                {totalSize > 0 ? ` (${formatBytes(totalSize)})` : ''}
                {isSameRepoAsSource ? ' within this repository' : ' to another repository or account'}
              </p>

              <div className="cloudview-transfer-source">
                <div className="cloudview-transfer-source-label">From</div>
                <div className="cloudview-transfer-source-value">
                  <HuggingFaceIcon size={16} />
                  <span>{sanitizeText(sourceAccountLabel)}</span>
                  <span className="cloudview-transfer-source-repo">{sanitizeText(sourceRepoId)}</span>
                </div>
              </div>

              <div className="cloudview-transfer-field">
                <label className="cloudview-transfer-label">Destination Account</label>
                {availableAccounts.length === 0 ? (
                  <div className="cloudview-modal-empty" style={{ padding: '10px' }}>
                    No Hugging Face accounts available. Add one in Cloud Manager.
                  </div>
                ) : (
                  <div className="cloudview-transfer-custom-select" ref={accountDropdownRef}>
                    <button
                      type="button"
                      className="cloudview-transfer-select-trigger"
                      onClick={() => !loading && setAccountDropdownOpen(!accountDropdownOpen)}
                      disabled={loading}
                    >
                      <span className={selectedAccountId ? '' : 'placeholder'}>
                        {isSameAccountSelection
                          ? sameAccountLabel
                          : (selectedAccount
                            ? selectedAccount.label
                            : 'Select account...')}
                      </span>
                      <ChevronDown size={16} className={`cloudview-transfer-select-chevron ${accountDropdownOpen ? 'open' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {accountDropdownOpen && (
                        <motion.div
                          className="cloudview-transfer-select-menu"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                        >
                          {showSameAccount && (
                            <button
                              key="__same__"
                              type="button"
                              className={`cloudview-transfer-select-item ${isSameAccountSelection ? 'active' : ''}`}
                              onClick={() => {
                                setSelectedAccountId(SAME_ACCOUNT_ID);
                                setAccountDropdownOpen(false);
                              }}
                            >
                              {sameAccountLabel}
                            </button>
                          )}
                          {availableAccounts.map(acc => (
                            <button
                              key={acc.id}
                              type="button"
                              className={`cloudview-transfer-select-item ${selectedAccountId === acc.id ? 'active' : ''}`}
                              onClick={() => {
                                setSelectedAccountId(acc.id);
                                setAccountDropdownOpen(false);
                              }}
                            >
                              {acc.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <AnimatePresence initial={false}>
                {selectedAccountId && (
                  <motion.div
                    key="repo-field"
                    className="cloudview-transfer-field"
                    initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    animate={{
                      opacity: 1,
                      height: 'auto',
                      transitionEnd: { overflow: 'visible' },
                    }}
                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    transition={{
                      height: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
                      opacity: { duration: 0.18, ease: 'easeOut' },
                    }}
                  >
                    <label className="cloudview-transfer-label">Destination Repository</label>
                    {reposLoading && currentRepos.length === 0 ? (
                      <div className="cloudview-modal-empty" style={{ padding: '10px' }}>
                        <Loader2 className="spin" size={16} />
                        <span style={{ marginLeft: 8 }}>Loading repositories...</span>
                      </div>
                    ) : reposError ? (
                      <div className="cloudview-modal-empty" style={{ padding: '10px', color: '#ef4444' }}>
                        {reposError}
                      </div>
                    ) : currentRepos.length === 0 ? (
                      <div className="cloudview-modal-empty" style={{ padding: '10px' }}>
                        No repositories found
                      </div>
                    ) : (
                      <div className="cloudview-transfer-custom-select" ref={repoDropdownRef}>
                        <button
                          type="button"
                          className="cloudview-transfer-select-trigger"
                          onClick={() => !repoDropdownDisabled && setRepoDropdownOpen(!repoDropdownOpen)}
                          disabled={repoDropdownDisabled}
                        >
                          <span className={selectedRepoId ? '' : 'placeholder'}>
                            {selectedRepo
                              ? selectedRepo.label
                              : 'Select repository...'}
                          </span>
                          <ChevronDown size={16} className={`cloudview-transfer-select-chevron ${repoDropdownOpen ? 'open' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {repoDropdownOpen && (
                            <motion.div
                              className="cloudview-transfer-select-menu"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.15 }}
                            >
                              {currentRepos.map(repo => (
                                <button
                                  key={repo.id}
                                  type="button"
                                  className={`cloudview-transfer-select-item ${selectedRepoId === repo.id ? 'active' : ''}`}
                                  onClick={() => {
                                    setSelectedRepoId(repo.id);
                                    setSelectedRepoType(repo.type);
                                    setRepoDropdownOpen(false);
                                  }}
                                >
                                  {repo.label}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {shouldShowFolderPicker && (
                  <motion.div
                    key="folder-field"
                    className="cloudview-transfer-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{
                      height: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
                      opacity: { duration: 0.18, ease: 'easeOut' },
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <label className="cloudview-transfer-label">Destination Folder</label>

                    {!destFoldersLoading && !destFoldersError && currentDestFolders.length > 1 && (
                      <div className="cloudview-modal-search-wrap">
                        <Search size={14} className="cloudview-modal-search-icon" />
                        <input
                          type="text"
                          className="cloudview-modal-search-input"
                          placeholder="Search folders..."
                          value={folderSearch}
                          onChange={(e) => setFolderSearch(e.target.value)}
                        />
                        {folderSearch && (
                          <button
                            className="cloudview-modal-search-clear"
                            onClick={() => setFolderSearch('')}
                            title="Clear search"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    )}

                    <div className="cloudview-modal-folder-list">
                      {destFoldersLoading ? (
                        <div className="cloudview-modal-empty">
                          <Loader2 className="spin" size={18} />
                          <span style={{ marginLeft: 8 }}>Loading folders...</span>
                        </div>
                      ) : destFoldersError ? (
                        <div className="cloudview-modal-empty" style={{ color: '#ef4444' }}>
                          {destFoldersError}
                        </div>
                      ) : isSearching ? (
                        filteredFlatFolders.length === 0 ? (
                          <div className="cloudview-modal-empty">
                            No folders match your search
                          </div>
                        ) : (
                          filteredFlatFolders.map((opt) => {
                            const isDisabled = isPathDisabled(opt.path, effectiveDisabledPaths);
                            return (
                              <div
                                key={opt.path || '__root__'}
                                className={`cloudview-folder-tree-row ${selectedDestFolder === opt.path ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                              >
                                <button
                                  type="button"
                                  className="cloudview-folder-tree-main"
                                  onClick={() => {
                                    if (isDisabled) return;
                                    setSelectedDestFolder(opt.path);
                                  }}
                                  disabled={isDisabled}
                                  title={isDisabled ? 'Cannot select this folder' : undefined}
                                >
                                  <Folder size={15} className="cloudview-folder-tree-icon" />
                                  <span className="cloudview-folder-tree-name">{opt.label}</span>
                                </button>
                                {selectedDestFolder === opt.path && !isDisabled && <Check size={15} className="cloudview-folder-tree-check" />}
                              </div>
                            );
                          })
                        )
                      ) : (
                        <>
                          <div
                            className={`cloudview-folder-tree-row cloudview-folder-tree-row--root ${selectedDestFolder === '' ? 'active' : ''}`}
                          >
                            <span className="cloudview-folder-tree-toggle-spacer" />
                            <button
                              type="button"
                              className="cloudview-folder-tree-main"
                              onClick={() => setSelectedDestFolder('')}
                            >
                              <Folder size={15} className="cloudview-folder-tree-icon" />
                              <span className="cloudview-folder-tree-name">Root (/)</span>
                            </button>
                            {selectedDestFolder === '' && <Check size={15} className="cloudview-folder-tree-check" />}
                          </div>
                          {treeData.length === 0 ? (
                            <div className="cloudview-modal-empty">
                              No folders in this repository
                            </div>
                          ) : (
                            treeData.map(node => (
                              <FolderTreeItem
                                key={node.path}
                                node={node}
                                expanded={expandedPaths}
                                onToggle={toggleExpand}
                                selected={selectedDestFolder}
                                onSelect={setSelectedDestFolder}
                                disabledPaths={effectiveDisabledPaths}
                              />
                            ))
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="cloudview-transfer-notice">
                <AlertCircle size={14} />
                <span>
                  {isCopy
                    ? 'Originals stay in place. Files with the same name at the destination will be replaced.'
                    : (isSameRepoAsSource
                      ? 'Items are moved inside this repository in a single commit.'
                      : 'Files will be copied to destination, then removed from source.')}
                </span>
              </div>

              <div className="cloudview-modal-actions">
                <button className="cloudview-modal-btn cloudview-modal-btn--cancel" onClick={onClose} disabled={loading}>
                  Cancel
                </button>
                <button
                  className="cloudview-modal-btn cloudview-modal-btn--confirm"
                  onClick={handleRequestConfirm}
                  disabled={!canConfirm}
                >
                  {loading ? <Loader2 className="spin" size={16} /> : verb}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && !isCopy && !isPublicSource && confirmOpen && (
          <motion.div
            className="cloudview-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setConfirmOpen(false)}
          >
            <motion.div
              className="cloudview-modal cloudview-modal--danger"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.17 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cloudview-modal-danger-icon">
                <AlertCircle size={26} />
              </div>
              <h3 className="cloudview-modal-title">Confirm Move</h3>
              <p className="cloudview-modal-desc">
                Move <strong>{targets.length} item{targets.length > 1 ? 's' : ''}</strong> from{' '}
                <strong>{sanitizeText(sourceRepoId)}</strong> to{' '}
                <strong>{sanitizeText(destinationLabel)} / {sanitizeText(selectedRepoId)}</strong>
                {selectedDestFolder ? <> / <strong>{sanitizeText(selectedDestFolder)}</strong></> : null}?
              </p>
              <p className="cloudview-modal-desc" style={{ marginTop: 4 }}>
                Files will be <strong>copied</strong> to destination, then <strong>deleted</strong> from source.
                This cannot be undone.
              </p>
              <div className="cloudview-modal-actions">
                <button
                  className="cloudview-modal-btn cloudview-modal-btn--cancel"
                  onClick={() => setConfirmOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="cloudview-modal-btn cloudview-modal-btn--danger"
                  onClick={handleFinalConfirm}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="spin" size={16} /> : 'Yes, Move'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export interface CloudModalSelectionProps {
  renameOpen: boolean;
  renameValue: string;
  renameTarget: any;
  setRenameValue: (v: string) => void;
  onRenameConfirm: () => void;
  onRenameClose: () => void;

  deleteOpen: boolean;
  deleteTargets: any[];
  onDeleteConfirm: () => void;
  onDeleteClose: () => void;

  createFolderOpen: boolean;
  createFolderValue: string;
  createFolderCurrentPath: string;
  setCreateFolderValue: (v: string) => void;
  onCreateFolderConfirm: () => void;
  onCreateFolderClose: () => void;

  transferOpen: boolean;
  transferTargets: any[];
  transferSourceAccountId: string | null;
  transferSourceAccountLabel: string;
  transferSourceRepoId: string;
  transferSourceRepoType: 'dataset' | 'model' | 'space';
  transferAccounts: TransferAccount[];
  transferReposByAccount: Record<string, TransferRepo[]>;
  transferReposLoading: boolean;
  transferReposError: string | null;
  onTransferFetchRepos: (accountId: string) => void;
  transferDestFoldersByRepo: Record<string, { label: string; path: string }[]>;
  transferDestFoldersLoading: boolean;
  transferDestFoldersError: string | null;
  onTransferFetchDestFolders: (accountId: string, repoId: string) => void;
  transferDisabledPaths?: string[];
  onTransferConfirm: (params: {
    dstAccountId: string;
    dstRepoId: string;
    dstRepoType: 'dataset' | 'model' | 'space';
    dstPathPrefix: string;
  }) => void;
  onTransferClose: () => void;
  transferMode?: 'move' | 'copy';
  isPublicSource?: boolean;

  loading: boolean;
}

const CloudModalSelection: React.FC<CloudModalSelectionProps> = (props) => {
  return (
    <>
      <RenameModal
        open={props.renameOpen}
        value={props.renameValue}
        target={props.renameTarget}
        onChangeValue={props.setRenameValue}
        onConfirm={props.onRenameConfirm}
        onClose={props.onRenameClose}
        loading={props.loading}
      />
      <DeleteModal
        open={props.deleteOpen}
        targets={props.deleteTargets}
        onConfirm={props.onDeleteConfirm}
        onClose={props.onDeleteClose}
        loading={props.loading}
      />
      <CreateFolderModal
        open={props.createFolderOpen}
        value={props.createFolderValue}
        currentPath={props.createFolderCurrentPath}
        onChangeValue={props.setCreateFolderValue}
        onConfirm={props.onCreateFolderConfirm}
        onClose={props.onCreateFolderClose}
        loading={props.loading}
      />
      <TransferModal
        open={props.transferOpen}
        targets={props.transferTargets}
        sourceAccountId={props.transferSourceAccountId}
        sourceAccountLabel={props.transferSourceAccountLabel}
        sourceRepoId={props.transferSourceRepoId}
        sourceRepoType={props.transferSourceRepoType}
        accounts={props.transferAccounts}
        reposByAccount={props.transferReposByAccount}
        reposLoading={props.transferReposLoading}
        reposError={props.transferReposError}
        fetchReposForAccount={props.onTransferFetchRepos}
        destFoldersByRepo={props.transferDestFoldersByRepo}
        destFoldersLoading={props.transferDestFoldersLoading}
        destFoldersError={props.transferDestFoldersError}
        fetchDestFolders={props.onTransferFetchDestFolders}
        disabledPaths={props.transferDisabledPaths || []}
        onConfirm={props.onTransferConfirm}
        onClose={props.onTransferClose}
        mode={props.transferMode || 'move'}
        loading={props.loading}
        isPublicSource={props.isPublicSource || false}
      />
    </>
  );
};

export default CloudModalSelection;