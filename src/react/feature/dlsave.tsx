// src/react/feature/dlsave.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Folder, Check, Loader2, ArrowLeft, Search, X } from 'lucide-react';
import { auth, db } from '@config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { HuggingFaceIcon } from '@control/icon';
import { getActiveBase } from '@config/api';

const HF_API_BASE = 'https://huggingface.co/api';

export interface HFAccount {
  id: string;
  label: string;
  username: string;
  token: string;
}

export interface HFRepoOption {
  id: string;
  label: string;
  type: 'dataset' | 'model' | 'space';
}

export interface DlSaveSelection {
  accountId: string;
  accountLabel: string;
  repoId: string;
  repoType: 'dataset' | 'model' | 'space';
  folder: string;
  token: string;
}

interface FolderTreeNode {
  name: string;
  path: string;
  level: number;
  children: FolderTreeNode[];
}

const autoHeightMotion = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
};

const autoHeightTransition = {
  height: { duration: 0.24, ease: [0.4, 0, 0.2, 1] as const },
  opacity: { duration: 0.18, ease: 'easeOut' as const },
};

const smoothEase = [0.4, 0, 0.2, 1] as const;

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

interface FolderTreeItemProps {
  node: FolderTreeNode;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selected: string;
  onSelect: (path: string) => void;
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  node,
  expanded,
  onToggle,
  selected,
  onSelect,
}) => {
  const isExpanded = expanded.has(node.path);
  const hasChildren = node.children.length > 0;
  const isSelected = selected === node.path;

  return (
    <div className="downloader-folder-tree-node">
      <div
        className={`downloader-folder-tree-row${isSelected ? ' active' : ''}`}
        style={{ paddingLeft: `${node.level * 16 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className={`downloader-folder-tree-toggle${isExpanded ? ' expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.path);
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight size={14} />
          </button>
        ) : (
          <span className="downloader-folder-tree-toggle-spacer" />
        )}
        <button
          type="button"
          className="downloader-folder-tree-main"
          onClick={() => onSelect(node.path)}
        >
          <Folder size={14} className="downloader-folder-tree-icon" />
          <span className="downloader-folder-tree-name">{node.name}</span>
        </button>
        {isSelected && <Check size={14} className="downloader-folder-tree-check" />}
      </div>
      <AnimatePresence initial={false}>
        {hasChildren && isExpanded && (
          <motion.div
            className="downloader-folder-tree-children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.22, ease: smoothEase },
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
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface DlSaveProps {
  selection: DlSaveSelection;
  onChange: (next: DlSaveSelection) => void;
}

const loadAllHFAccounts = async (): Promise<HFAccount[]> => {
  try {
    const user = auth.currentUser;
    if (!user) return [];

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return [];

    const data = userSnap.data();
    const hfUsernames: string[] = data.hfUsernames || [];
    const hfTokens: string[] = data.hfTokens || [];

    const accounts: HFAccount[] = [];
    for (let i = 0; i < hfUsernames.length; i++) {
      const username = hfUsernames[i];
      const token = hfTokens[i];
      if (username && token) {
        accounts.push({
          id: username,
          label: username,
          username,
          token,
        });
      }
    }
    return accounts;
  } catch {
    return [];
  }
};

const DlSave: React.FC<DlSaveProps> = ({ selection, onChange }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [hfAccounts, setHfAccounts] = useState<HFAccount[]>([]);
  const [hfAccountsLoading, setHfAccountsLoading] = useState(false);
  const [hfAccountsError, setHfAccountsError] = useState<string | null>(null);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  const [hfRepos, setHfRepos] = useState<HFRepoOption[]>([]);
  const [hfReposLoading, setHfReposLoading] = useState(false);
  const [hfReposError, setHfReposError] = useState<string | null>(null);
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);

  const [hfFolderPaths, setHfFolderPaths] = useState<string[]>([]);
  const [hfFoldersLoading, setHfFoldersLoading] = useState(false);
  const [hfFoldersError, setHfFoldersError] = useState<string | null>(null);
  const [folderSearch, setFolderSearch] = useState('');
  const [expandedFolderPaths, setExpandedFolderPaths] = useState<Set<string>>(new Set());

  const saveDropdownRef = useRef<HTMLDivElement>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const repoDropdownRef = useRef<HTMLDivElement>(null);

  const selectedAccount = useMemo(
    () => hfAccounts.find(a => a.id === selection.accountId) || null,
    [hfAccounts, selection.accountId]
  );

  const selectedRepo = useMemo(
    () => hfRepos.find(r => r.id === selection.repoId) || null,
    [hfRepos, selection.repoId]
  );

  const folderTree = useMemo(() => buildFolderTree(hfFolderPaths), [hfFolderPaths]);

  const filteredFlatFolders = useMemo(() => {
    if (!folderSearch.trim()) return [];
    const q = folderSearch.toLowerCase().trim();
    return hfFolderPaths.filter(p => p.toLowerCase().includes(q));
  }, [hfFolderPaths, folderSearch]);

  const isSearchingFolders = folderSearch.trim().length > 0;

  const accountsReady = !hfAccountsLoading && !hfAccountsError && hfAccounts.length > 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
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

  const loadHfAccounts = useCallback(async () => {
    setHfAccountsLoading(true);
    setHfAccountsError(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        setHfAccountsError('Not logged in');
        return;
      }
      const accounts = await loadAllHFAccounts();
      if (accounts.length === 0) {
        setHfAccountsError('No Hugging Face accounts connected');
        return;
      }
      setHfAccounts(accounts);
    } catch (err: any) {
      setHfAccountsError(err?.message || 'Failed to load accounts');
    } finally {
      setHfAccountsLoading(false);
    }
  }, []);

  const loadHfRepos = useCallback(async (accountId: string, tokenOverride?: string) => {
    const account = tokenOverride
      ? { id: accountId, username: accountId, token: tokenOverride, label: accountId }
      : hfAccounts.find(a => a.id === accountId);
    if (!account) {
      setHfReposError('Account not found');
      return;
    }
    setHfReposLoading(true);
    setHfReposError(null);
    try {
      const headers: HeadersInit = { Authorization: `Bearer ${account.token}` };
      const datasetsRes = await fetch(
        `${HF_API_BASE}/datasets?author=${encodeURIComponent(account.username)}&limit=100`,
        { headers }
      );
      const datasets: any[] = datasetsRes.ok ? await datasetsRes.json() : [];
      const repos: HFRepoOption[] = [];
      if (Array.isArray(datasets)) {
        for (const ds of datasets) {
          repos.push({ id: ds.id, label: ds.id, type: 'dataset' });
        }
      }
      if (repos.length === 0) {
        setHfReposError('No datasets found');
        return;
      }
      setHfRepos(repos);
    } catch (err: any) {
      setHfReposError(err?.message || 'Failed to load repositories');
    } finally {
      setHfReposLoading(false);
    }
  }, [hfAccounts]);

  const loadHfFolders = useCallback(async (accountId: string, repoId: string, repoType: 'dataset' | 'model' | 'space', tokenOverride?: string) => {
    const account = tokenOverride
      ? { id: accountId, username: accountId, token: tokenOverride, label: accountId }
      : hfAccounts.find(a => a.id === accountId);
    if (!account) {
      setHfFoldersError('Account not found');
      return;
    }
    setHfFoldersLoading(true);
    setHfFoldersError(null);
    try {
      const API_BASE = getActiveBase();
      const res = await fetch(`${API_BASE}/hf/list-folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_id: repoId,
          repo_type: repoType,
          token: account.token,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHfFoldersError(json?.detail || `HTTP ${res.status}`);
        return;
      }
      const folders: string[] = json.folders || [];
      setHfFolderPaths(folders);
    } catch (err: any) {
      setHfFoldersError(err?.message || 'Failed to load folders');
    } finally {
      setHfFoldersLoading(false);
    }
  }, [hfAccounts]);

  useEffect(() => {
    if (!dropdownOpen) return;
    if (hfAccounts.length > 0 || hfAccountsLoading || hfAccountsError) return;
    void loadHfAccounts();
  }, [dropdownOpen, hfAccounts.length, hfAccountsLoading, hfAccountsError, loadHfAccounts]);

  useEffect(() => {
    if (!dropdownOpen) return;
    if (!selection.accountId) return;
    if (hfRepos.length > 0 || hfReposLoading || hfReposError) return;
    void loadHfRepos(selection.accountId, selection.token || undefined);
  }, [dropdownOpen, selection.accountId, selection.token, hfRepos.length, hfReposLoading, hfReposError, loadHfRepos]);

  useEffect(() => {
    if (!dropdownOpen) return;
    if (!selection.accountId || !selection.repoId) return;
    if (hfFolderPaths.length > 0 || hfFoldersLoading || hfFoldersError) return;
    void loadHfFolders(selection.accountId, selection.repoId, selection.repoType, selection.token || undefined);
  }, [dropdownOpen, selection.accountId, selection.repoId, selection.repoType, selection.token, hfFolderPaths.length, hfFoldersLoading, hfFoldersError, loadHfFolders]);

  const handleAccountSelect = (accountId: string) => {
    const account = hfAccounts.find(a => a.id === accountId);
    onChange({
      ...selection,
      accountId,
      accountLabel: account?.label || accountId,
      repoId: '',
      repoType: 'dataset',
      folder: '',
      token: account?.token || '',
    });
    setAccountDropdownOpen(false);
    setHfRepos([]);
    setHfReposError(null);
    setHfFolderPaths([]);
    setExpandedFolderPaths(new Set());
    setFolderSearch('');
    void loadHfRepos(accountId, account?.token);
  };

  const handleRepoSelect = (repo: HFRepoOption) => {
    onChange({
      ...selection,
      repoId: repo.id,
      repoType: repo.type,
      folder: '',
    });
    setRepoDropdownOpen(false);
    setHfFolderPaths([]);
    setExpandedFolderPaths(new Set());
    setFolderSearch('');
    if (selection.accountId) {
      void loadHfFolders(selection.accountId, repo.id, repo.type, selection.token || undefined);
    }
  };

  const handleToggleFolder = (path: string) => {
    setExpandedFolderPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleFolderSelect = (path: string) => {
    onChange({
      ...selection,
      folder: path,
    });
    setDropdownOpen(false);
  };

  return (
    <div className="cloudview-transfer-custom-select downloader-save-target" ref={saveDropdownRef}>
      <button
        type="button"
        className="cloudview-transfer-select-trigger"
        onClick={() => setDropdownOpen(v => !v)}
      >
        <span>Save to Hugging Face</span>
        <ChevronDown size={16} className={`cloudview-transfer-select-chevron${dropdownOpen ? ' open' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {dropdownOpen && (
          <motion.div
            className="cloudview-transfer-select-menu downloader-save-menu"
            variants={autoHeightMotion}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={autoHeightTransition}
            style={{ overflow: 'hidden' }}
            layout
          >
            <div className="downloader-hf-inline">
              <AnimatePresence mode="wait" initial={false}>
                {!accountsReady ? (
                  <motion.div
                    key="accounts-loading"
                    className="downloader-hf-inline-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: smoothEase }}
                  >
                    <Loader2 className="spin" size={12} />
                    <span>Loading...</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="accounts-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: smoothEase }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                  >
                    <div className="downloader-hf-inline-field">
                      <label className="downloader-hf-inline-label">Account</label>
                      <div className="cloudview-transfer-custom-select" ref={accountDropdownRef}>
                        <button
                          type="button"
                          className="cloudview-transfer-select-trigger"
                          onClick={() => setAccountDropdownOpen(v => !v)}
                        >
                          <span className={selection.accountId ? '' : 'placeholder'}>
                            {selectedAccount ? selectedAccount.label : 'Select account...'}
                          </span>
                          <ChevronDown size={14} className={`cloudview-transfer-select-chevron${accountDropdownOpen ? ' open' : ''}`} />
                        </button>
                        <AnimatePresence initial={false}>
                          {accountDropdownOpen && (
                            <motion.div
                              className="cloudview-transfer-select-menu"
                              variants={autoHeightMotion}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={autoHeightTransition}
                              style={{ overflow: 'hidden' }}
                            >
                              {hfAccounts.map(acc => (
                                <button
                                  key={acc.id}
                                  type="button"
                                  className={`cloudview-transfer-select-item${selection.accountId === acc.id ? ' active' : ''}`}
                                  onClick={() => handleAccountSelect(acc.id)}
                                >
                                  {acc.label}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {selection.accountId && (
                        <motion.div
                          key="repo-field"
                          className="downloader-hf-inline-field"
                          variants={autoHeightMotion}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          transition={autoHeightTransition}
                          style={{ overflow: 'hidden' }}
                        >
                          <label className="downloader-hf-inline-label">Repository</label>
                          {hfReposLoading ? (
                            <div className="downloader-hf-inline-empty">
                              <Loader2 className="spin" size={12} />
                              <span>Loading...</span>
                            </div>
                          ) : hfReposError ? (
                            <div className="downloader-hf-inline-empty downloader-hf-inline-empty--error">
                              {hfReposError}
                            </div>
                          ) : hfRepos.length === 0 ? (
                            <div className="downloader-hf-inline-empty">
                              No repositories
                            </div>
                          ) : (
                            <div className="cloudview-transfer-custom-select" ref={repoDropdownRef}>
                              <button
                                type="button"
                                className="cloudview-transfer-select-trigger"
                                onClick={() => setRepoDropdownOpen(v => !v)}
                              >
                                <span className={selection.repoId ? '' : 'placeholder'}>
                                  {selectedRepo ? selectedRepo.label : 'Select repository...'}
                                </span>
                                <ChevronDown size={14} className={`cloudview-transfer-select-chevron${repoDropdownOpen ? ' open' : ''}`} />
                              </button>
                              <AnimatePresence initial={false}>
                                {repoDropdownOpen && (
                                  <motion.div
                                    className="cloudview-transfer-select-menu"
                                    variants={autoHeightMotion}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={autoHeightTransition}
                                    style={{ overflow: 'hidden' }}
                                  >
                                    {hfRepos.map(repo => (
                                      <button
                                        key={repo.id}
                                        type="button"
                                        className={`cloudview-transfer-select-item${selection.repoId === repo.id ? ' active' : ''}`}
                                        onClick={() => handleRepoSelect(repo)}
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
                      {selection.repoId && (
                        <motion.div
                          key="folder-field"
                          className="downloader-hf-inline-field"
                          variants={autoHeightMotion}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          transition={autoHeightTransition}
                          style={{ overflow: 'hidden' }}
                        >
                          <label className="downloader-hf-inline-label">Folder</label>

                          {!hfFoldersLoading && !hfFoldersError && hfFolderPaths.length > 1 && (
                            <div className="downloader-folder-search">
                              <Search size={12} className="downloader-folder-search-icon" />
                              <input
                                type="text"
                                className="downloader-folder-search-input"
                                placeholder="Search folders..."
                                value={folderSearch}
                                onChange={(e) => setFolderSearch(e.target.value)}
                              />
                              {folderSearch && (
                                <button
                                  type="button"
                                  className="downloader-folder-search-clear"
                                  onClick={() => setFolderSearch('')}
                                  aria-label="Clear search"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          )}

                          <div className="downloader-hf-inline-folder-list">
                            {hfFoldersLoading ? (
                              <div className="downloader-hf-inline-empty">
                                <Loader2 className="spin" size={12} />
                                <span>Loading...</span>
                              </div>
                            ) : hfFoldersError ? (
                              <div className="downloader-hf-inline-empty downloader-hf-inline-empty--error">
                                {hfFoldersError}
                              </div>
                            ) : (
                              <>
                                <div
                                  className={`downloader-folder-tree-row${selection.folder === '' ? ' active' : ''}`}
                                >
                                  <span className="downloader-folder-tree-toggle-spacer" />
                                  <button
                                    type="button"
                                    className="downloader-folder-tree-main"
                                    onClick={() => handleFolderSelect('')}
                                  >
                                    <Folder size={14} className="downloader-folder-tree-icon" />
                                    <span className="downloader-folder-tree-name">Root (/)</span>
                                  </button>
                                  {selection.folder === '' && (
                                    <Check size={14} className="downloader-folder-tree-check" />
                                  )}
                                </div>

                                {isSearchingFolders ? (
                                  filteredFlatFolders.length === 0 ? (
                                    <div className="downloader-hf-inline-empty">
                                      No folders match your search
                                    </div>
                                  ) : (
                                    filteredFlatFolders.map(path => (
                                      <div
                                        key={path}
                                        className={`downloader-folder-tree-row${selection.folder === path ? ' active' : ''}`}
                                        style={{ paddingLeft: 4 }}
                                      >
                                        <span className="downloader-folder-tree-toggle-spacer" />
                                        <button
                                          type="button"
                                          className="downloader-folder-tree-main"
                                          onClick={() => handleFolderSelect(path)}
                                        >
                                          <Folder size={14} className="downloader-folder-tree-icon" />
                                          <span className="downloader-folder-tree-name">/{path}</span>
                                        </button>
                                        {selection.folder === path && (
                                          <Check size={14} className="downloader-folder-tree-check" />
                                        )}
                                      </div>
                                    ))
                                  )
                                ) : folderTree.length === 0 ? (
                                  <div className="downloader-hf-inline-empty">
                                    No folders in this repository
                                  </div>
                                ) : (
                                  folderTree.map(node => (
                                    <FolderTreeItem
                                      key={node.path}
                                      node={node}
                                      expanded={expandedFolderPaths}
                                      onToggle={handleToggleFolder}
                                      selected={selection.folder}
                                      onSelect={handleFolderSelect}
                                    />
                                  ))
                                )}
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DlSave;