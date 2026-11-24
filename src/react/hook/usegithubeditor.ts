// src/react/hook/usegithubeditor.ts
import { useState, useCallback, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@config/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { 
  getGithubCredentials,
  saveGithubCredentials as saveGithubCreds,
  clearGithubCredentials,
  setGithubCredentials,
  refreshOctokit,
  fetchReposAPI,
  fetchContentsAPI,
  fetchFileContentAPI,
  saveFileAPI,
  createFileAPI,
  createFolderAPI,
  deleteFileAPI,
  deleteFolderRecursiveAPI,
  renameFileAPI,
  renameFolderRecursiveAPI,
  commitFilesAPI,
  createRepoAPI,
  deleteRepoAPI,
  renameRepoAPI,
  sortItems,
  type GithubItem,
  type GithubRepo,
  type GithubEditingFile,
  type ItemTarget
} from "@config/githubeditorhelper";

const getErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  const status = error.status;
  return typeof status === "number" ? status : undefined;
};

const updateChildrenPaths = (items: GithubItem[], oldPrefix: string, newPrefix: string): GithubItem[] => {
  return items.map(item => {
    if (item.path.startsWith(oldPrefix + "/")) {
      return { ...item, path: item.path.replace(oldPrefix, newPrefix) };
    }
    return item;
  });
};

export const useGithubEditor = () => {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<GithubItem[]>([]);
  const [editingFile, setEditingFile] = useState<GithubEditingFile | null>(null);
  const [status, setStatus] = useState("ready");
  const [activeId, setActiveId] = useState<string | number>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const handleSelectedRepoChange = useCallback((repo: string | null) => {
    setSelectedRepo(repo);
    setFiles([]);
    setIsLoading(Boolean(repo && isConfigured));
  }, [isConfigured]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsFirebaseReady(true);
      if (user) {
        setIsAuthLoading(true);
        try {
          const creds = await getGithubCredentials();
          if (creds && creds.githubUsername && creds.githubToken) {
            setGithubCredentials(creds.githubUsername, creds.githubToken);
            refreshOctokit();
            setIsConfigured(true);
            setShowAuthModal(false);
            // Repository loading is handled after isConfigured changes.
          } else {
            setIsConfigured(false);
            setShowAuthModal(true);
          }
        } catch {
          setShowAuthModal(true);
        } finally {
          setIsAuthLoading(false);
        }
      } else {
        setIsConfigured(false);
        setShowAuthModal(false);
        setIsAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchReposData = useCallback(async (showLoader = true) => {
    if (!isConfigured) return;
    if (showLoader) {
      setIsLoading(true);
      setStatus("loading");
    }
    try {
      const data = await fetchReposAPI();
      setRepos(data);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      if (error instanceof Error && error.message.includes("401")) {
        setShowAuthModal(true);
        setIsConfigured(false);
      }
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, [isConfigured]);

  const saveCredentials = useCallback(async (username: string, token: string) => {
    setIsAuthLoading(true);
    try {
      await saveGithubCreds(username, token);
      setGithubCredentials(username, token);
      refreshOctokit();
      setIsConfigured(true);
      setShowAuthModal(false);
      await fetchReposData();
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  }, [fetchReposData]);

  const clearCredentials = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          githubUsername: null,
          githubToken: null,
        });
      }
    } catch (error) {
      console.error("Failed to clear GitHub credentials from Firestore:", error);
    }
    
    clearGithubCredentials();
    setGithubCredentials("", "");
    refreshOctokit();
    setIsConfigured(false);
    setSelectedRepo(null);
    setRepos([]);
    setFiles([]);
    setEditingFile(null);
    setActiveId("");
    setShowAuthModal(true);
    setStatus("ready");
  }, []);

  const closeAuthModal = useCallback(() => setShowAuthModal(false), []);
  const openAuthModal = useCallback(() => setShowAuthModal(true), []);

  const fetchContents = useCallback(async (path: string, repo: string, showLoader = true) => {
    if (!isConfigured) return;
    if (showLoader) {
      setIsLoading(true);
      setStatus("loading");
    }
    try {
      const data = await fetchContentsAPI(repo, path);
      setFiles(data);
      setStatus("ready");
    } catch (err: unknown) {
      const errorStatus = getErrorStatus(err);
      if (errorStatus === 404) {
        setFiles([]);
        setStatus("empty");
      } else {
        setStatus("error");
        if (errorStatus === 401) {
          setShowAuthModal(true);
          setIsConfigured(false);
        }
      }
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, [isConfigured]);

  const openRepository = useCallback((repo: string | null, path = '') => {
    setSelectedRepo(repo);
    setCurrentPath(path);
    setEditingFile(null);
    setActiveId('');
    setFiles([]);
    setIsLoading(Boolean(repo && isConfigured));
    if (repo && isConfigured) void fetchContents(path, repo);
  }, [fetchContents, isConfigured]);

  const navigateToPath = useCallback((path: string) => {
    setCurrentPath(path);
    setEditingFile(null);
    if (selectedRepo && isConfigured) void fetchContents(path, selectedRepo);
  }, [fetchContents, isConfigured, selectedRepo]);

  const handleFileClick = useCallback(async (file: GithubItem, repo: string) => {
    if (!isConfigured) return;
    setActiveId(file.sha);
    if (file.type === "dir") {
      navigateToPath(file.path);
      return;
    }
    setIsLoading(true);
    setStatus("loading");
    try {
      const { content, sha } = await fetchFileContentAPI(repo, file.path);
      setEditingFile({ path: file.path, content, sha });
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      if (error instanceof Error && error.message.includes("401")) {
        setShowAuthModal(true);
        setIsConfigured(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, navigateToPath]);

  const handleSave = useCallback(async (repo: string, path: string, content: string, sha: string): Promise<{ success: false } | { success: true; newContent: string; newSha: string }> => {
    if (!isConfigured) return { success: false };
    setIsLoading(true);
    setStatus("saving");
    try {
      const savedSha = await saveFileAPI(repo, path, content, sha);
      const newSha = savedSha ?? (await fetchFileContentAPI(repo, path)).sha;
      setFiles(prev => prev.map(f => f.path === path ? { ...f, sha: newSha } : f));
      if (editingFile) setEditingFile(prev => prev ? { ...prev, sha: newSha } : null);
      setStatus("saved");
      setTimeout(() => setStatus("ready"), 1500);
      return { success: true, newContent: content, newSha };
    } catch (error) {
      setStatus("error");
      if (error instanceof Error && error.message.includes("401")) {
        setShowAuthModal(true);
        setIsConfigured(false);
      }
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, editingFile]);

  const handleClear = useCallback((callback: () => void) => {
    setIsClearing(true);
    setTimeout(() => {
      callback();
      setIsClearing(false);
      setStatus("cleared");
      setTimeout(() => setStatus("ready"), 1000);
    }, 220);
  }, []);

  const handleCreateRepo = useCallback(async (name: string, description: string) => {
    if (!isConfigured || !name.trim()) return false;
    setIsCreating(true);
    setStatus("creating");
    const repoName = name.toLowerCase().replace(/\s/g, "-");
    const tempRepo = { id: Date.now(), name: repoName, description, full_name: `temp/${repoName}`, private: false, _isTemp: true };
    setRepos(prev => [tempRepo, ...prev]);
    try {
      const data = await createRepoAPI(repoName, description);
      setRepos(prev => prev.map(r => r._isTemp && r.name === repoName ? data : r));
      setStatus("created");
      setTimeout(() => setStatus("ready"), 2000);
      return true;
    } catch {
      setRepos(prev => prev.filter(r => !(r._isTemp && r.name === repoName)));
      setStatus("error");
      return false;
    } finally {
      setIsCreating(false);
    }
  }, [isConfigured]);

  const handleCreateItem = useCallback(async (type: "file" | "folder", name: string, content: string, repo: string, path: string) => {
    if (!isConfigured || !name.trim()) return false;
    setIsCreating(true);
    const fullPath = path ? `${path}/${name}` : name;
    const tempSha = `temp-${Date.now()}-${Math.random()}`;
    const newItem: GithubItem = {
      name,
      path: fullPath,
      sha: tempSha,
      type: type === "folder" ? "dir" : "file",
      _isTemp: true,
    };
    
    setFiles(prev => sortItems([...prev, newItem]));
    setStatus("creating");
    
    try {
      if (type === "folder") {
        await createFolderAPI(repo, fullPath);
        setFiles(prev => prev.map(f => 
          f.path === fullPath ? { ...f, _isTemp: false, sha: `folder-${Date.now()}` } : f
        ));
      } else {
        await createFileAPI(repo, fullPath, content || "# New File\n\nCreated from GitHub Editor");
        const { sha } = await fetchFileContentAPI(repo, fullPath);
        setFiles(prev => prev.map(f => 
          f.path === fullPath ? { ...f, sha, _isTemp: false } : f
        ));
      }
      setStatus("created");
      setTimeout(() => setStatus("ready"), 2000);
      return true;
    } catch {
      setFiles(prev => prev.filter(f => f.sha !== tempSha));
      setStatus("error");
      return false;
    } finally {
      setIsCreating(false);
    }
  }, [isConfigured]);

  const handleDeleteItem = useCallback(async (target: ItemTarget, repo: string, _currentPath: string) => {
    void _currentPath;
    if (!isConfigured || !target) return false;
    const deletedPath = target.path || "";
    const prevFiles = [...files];
    const prevEditingFile = editingFile;
    
    setFiles(prev => prev.filter(f => f.path !== deletedPath));
    if (editingFile?.path === deletedPath) setEditingFile(null);
    setIsDeleting(true);
    setStatus("deleting");
    
    try {
      if (target.type === "folder") {
        await deleteFolderRecursiveAPI(repo, deletedPath);
      } else {
        const fileToDelete = prevFiles.find(f => f.path === deletedPath);
        const sha = fileToDelete?.sha || target.sha;
        await deleteFileAPI(repo, deletedPath, sha!);
      }
      setStatus("deleted");
      setTimeout(() => setStatus("ready"), 2000);
      return true;
    } catch {
      setFiles(sortItems(prevFiles));
      if (prevEditingFile) setEditingFile(prevEditingFile);
      setStatus("error");
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [isConfigured, editingFile, files]);

  const handleDeleteRepo = useCallback(async (repoName: string) => {
    if (!isConfigured) return false;
    const prevRepos = [...repos];
    setRepos(prev => prev.filter(r => r.name !== repoName));
    setIsDeleting(true);
    setStatus("deleting");
    const wasSelected = selectedRepo === repoName;
    if (wasSelected) {
      setSelectedRepo(null);
      setCurrentPath("");
      setFiles([]);
      setIsLoading(false);
      setEditingFile(null);
      setActiveId("");
    }
    try {
      await deleteRepoAPI(repoName);
      setStatus("deleted");
      setTimeout(() => setStatus("ready"), 2000);
      return true;
    } catch {
      setRepos(prevRepos);
      if (wasSelected) {
        setSelectedRepo(repoName);
        void fetchContents("", repoName);
      }
      setStatus("error");
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [isConfigured, selectedRepo, repos, fetchContents]);

  const handleRenameItem = useCallback(async (target: ItemTarget, newName: string, repo: string): Promise<boolean> => {
    void repo;
    if (!isConfigured || !target || !newName.trim() || newName === target.name) return false;

    if (target.type === "repo") {
      const prevRepos = [...repos];
      setRepos(prev => prev.map(r => r.name === target.name ? { ...r, name: newName } : r));
      if (selectedRepo === target.name) setSelectedRepo(newName);
      setIsRenaming(true);
      setStatus("renaming");
      try {
        const data = await renameRepoAPI(target.name, newName);
        setRepos(prev => prev.map(r => r.name === newName ? { ...r, ...data } : r));
        setStatus("renamed");
        setTimeout(() => setStatus("ready"), 2000);
        return true;
      } catch {
        setRepos(prevRepos);
        if (selectedRepo === newName) setSelectedRepo(target.name);
        setStatus("error");
        return false;
      } finally {
        setIsRenaming(false);
      }
    }

    if (!selectedRepo) return false;
    const oldPath = target.path || "";
    const parts = oldPath.split("/");
    parts[parts.length - 1] = newName;
    const newPath = parts.join("/");

    const prevFiles = [...files];
    const prevEditingFile = editingFile;

    setFiles(prev => {
      let updated = prev.map(f => {
        if (f.path === oldPath) {
          return { ...f, name: newName, path: newPath };
        }
        return f;
      });
      if (target.type === "folder") {
        updated = updateChildrenPaths(updated, oldPath, newPath);
      }
      return sortItems(updated);
    });

    if (editingFile?.path === oldPath) {
      setEditingFile((prev: GithubEditingFile | null) => prev ? { ...prev, path: newPath } : null);
    }

    setIsRenaming(true);
    setStatus("renaming");

    try {
      if (target.type === "folder") {
        await renameFolderRecursiveAPI(selectedRepo, oldPath, newPath);
      } else {
        const realFile = prevFiles.find(f => f.path === oldPath);
        const sha = realFile?.sha || target.sha;
        if (!sha) throw new Error("SHA not found");
        await renameFileAPI(selectedRepo, oldPath, newPath, sha);
        try {
          const { sha: newSha } = await fetchFileContentAPI(selectedRepo, newPath);
          setFiles(prev =>
            prev.map(f => f.path === newPath ? { ...f, sha: newSha } : f)
          );
          if (editingFile?.path === newPath) {
            setEditingFile(prev => prev ? { ...prev, sha: newSha } : null);
          }
        } catch { void 0; }
      }
      setStatus("renamed");
      setTimeout(() => setStatus("ready"), 2000);
      return true;
    } catch {
      setFiles(sortItems(prevFiles));
      if (prevEditingFile) setEditingFile(prevEditingFile);
      setStatus("error");
      return false;
    } finally {
      setIsRenaming(false);
    }
  }, [isConfigured, selectedRepo, files, editingFile, repos]);

  const handleUploadFiles = useCallback(async (filesList: FileList, repo: string, path: string, isFolderUpload: boolean = false) => {
    if (!isConfigured || !repo) return false;
    setIsUploading(true);
    setStatus("uploading");

    const filesArray = Array.from(filesList);
    const entries = filesArray.map(file => {
      const relative = file.webkitRelativePath || file.name;
      return { path: path ? `${path}/${relative}` : relative, file };
    });
    const targetPaths = entries.map(entry => entry.path);

    let tempItems: GithubItem[];
    if (isFolderUpload) {
      const uniqueFolders = new Set<string>();
      for (const filePath of targetPaths) {
        const lastSlash = filePath.lastIndexOf('/');
        if (lastSlash !== -1) uniqueFolders.add(filePath.substring(0, lastSlash));
      }
      setFiles(prev => prev.filter(f => !uniqueFolders.has(f.path)));
      tempItems = Array.from(uniqueFolders).map(folderPath => ({
        name: folderPath.split('/').pop()!,
        path: folderPath,
        sha: `temp-folder-${Date.now()}-${Math.random()}`,
        type: "dir" as const,
        _isTemp: true,
      }));
    } else {
      setFiles(prev => prev.filter(f => !targetPaths.includes(f.path)));
      tempItems = entries.map((entry, idx) => ({
        name: entry.file.name,
        path: entry.path,
        sha: `temp-${Date.now()}-${idx}-${Math.random()}`,
        type: "file" as const,
        _isTemp: true,
      }));
    }
    if (tempItems.length > 0) setFiles(prev => sortItems([...prev, ...tempItems]));
    const tempPaths = new Set(tempItems.map(item => item.path));

    const topFolder = (filesArray[0]?.webkitRelativePath || '').split('/')[0];
    const message = isFolderUpload
      ? `Upload folder ${topFolder || path || 'files'} (${entries.length} files)`
      : entries.length === 1
        ? `upload ${entries[0].path}`
        : `Upload ${entries.length} files`;

    try {
      // One tree + one commit for everything, instead of GET + PUT per file.
      const { uploaded, failed } = await commitFilesAPI(repo, entries, message);
      if (isFolderUpload) {
        await fetchContents(path, repo, false);
      } else {
        setFiles(prev =>
          prev
            .filter(f => !(f._isTemp && failed.includes(f.path)))
            .map(f => (uploaded[f.path] ? { ...f, sha: uploaded[f.path], _isTemp: false } : f))
        );
      }
      setStatus("uploaded");
      setTimeout(() => setStatus("ready"), 2000);
    } catch (error) {
      setFiles(prev => prev.filter(f => !(f._isTemp && tempPaths.has(f.path))));
      setStatus("error");
      if (error instanceof Error && error.message.includes("401")) {
        setShowAuthModal(true);
        setIsConfigured(false);
      }
    }

    setIsUploading(false);
    return true;
  }, [isConfigured, fetchContents]);

  const refreshContents = useCallback(async () => {
    if (isConfigured && selectedRepo) await fetchContents(currentPath, selectedRepo, false);
  }, [isConfigured, selectedRepo, currentPath, fetchContents]);

  useEffect(() => {
    if (!isConfigured) return;
    const timer = window.setTimeout(() => {
      void fetchReposData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isConfigured, fetchReposData]);

  return {
    isAuthLoading, isConfigured, showAuthModal, isFirebaseReady,
    saveCredentials, clearCredentials, closeAuthModal, openAuthModal,
    repos, selectedRepo, currentPath, files, editingFile, status, activeId, isLoading, isClearing,
    setSelectedRepo: handleSelectedRepoChange, setCurrentPath, openRepository, navigateToPath, setEditingFile, setStatus, setActiveId,
    fetchRepos: fetchReposData, fetchContents, handleFileClick, handleSave, handleClear,
    handleCreateRepo, handleCreateItem, handleDeleteItem, handleDeleteRepo, handleRenameItem, handleUploadFiles, refreshContents,
    isLoadingState: isLoading, isCreatingState: isCreating, isDeletingState: isDeleting, isRenamingState: isRenaming, isUploadingState: isUploading,
    setIsCreating, setIsDeleting, setIsRenaming, setIsUploading,
  };
};

export type { GithubRepo, GithubItem, GithubEditingFile, ItemTarget };
