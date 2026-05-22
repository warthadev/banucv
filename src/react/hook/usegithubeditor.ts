// src/react/hook/usegithubeditor.ts
import { useState, useCallback, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@config/firebase";
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
  uploadFileAPI,
  updateFileAPI,
  createRepoAPI,
  deleteRepoAPI,
  renameRepoAPI,
  sortItems,
  type GithubItem,
  type ItemTarget
} from "@config/githubeditorhelper";

const updateChildrenPaths = (items: any[], oldPrefix: string, newPrefix: string): any[] => {
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
  
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<any[]>([]);
  const [editingFile, setEditingFile] = useState<any>(null);
  const [status, setStatus] = useState("ready");
  const [activeId, setActiveId] = useState<string | number>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Auth & init
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
            await fetchReposData();
          } else {
            setIsConfigured(false);
            setShowAuthModal(true);
          }
        } catch (error) {
          console.error("Error loading GitHub credentials:", error);
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
      console.error("Error fetching repos:", error);
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
      console.error("Error saving credentials:", error);
      setStatus("error");
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  }, [fetchReposData]);

  const clearCredentials = useCallback(() => {
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
    } catch (err: any) {
      if (err.status === 404) {
        setFiles([]);
        setStatus("empty");
      } else {
        console.error("Error fetching contents:", err);
        setStatus("error");
        if (err.status === 401) {
          setShowAuthModal(true);
          setIsConfigured(false);
        }
      }
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, [isConfigured]);

  const handleFileClick = useCallback(async (file: any, repo: string) => {
    if (!isConfigured) return;
    setActiveId(file.sha);
    if (file.type === "dir") {
      setCurrentPath(file.path);
      setEditingFile(null);
      return;
    }
    setIsLoading(true);
    setStatus("loading");
    try {
      const { content, sha } = await fetchFileContentAPI(repo, file.path);
      setEditingFile({ path: file.path, content, sha });
      setStatus("ready");
    } catch (error) {
      console.error("Error fetching file:", error);
      setStatus("error");
      if (error instanceof Error && error.message.includes("401")) {
        setShowAuthModal(true);
        setIsConfigured(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured]);

  const handleSave = useCallback(async (repo: string, path: string, content: string, sha: string) => {
    if (!isConfigured) return { success: false };
    setIsLoading(true);
    setStatus("saving");
    try {
      await saveFileAPI(repo, path, content, sha);
      const { sha: newSha } = await fetchFileContentAPI(repo, path);
      setFiles(prev => prev.map(f => f.path === path ? { ...f, sha: newSha } : f));
      if (editingFile) setEditingFile((prev: any) => ({ ...prev, sha: newSha }));
      setStatus("saved");
      setTimeout(() => setStatus("ready"), 1500);
      return { success: true, newContent: content, newSha };
    } catch (error) {
      console.error("Error saving file:", error);
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
    const tempRepo = { id: `temp-${Date.now()}`, name: repoName, description, full_name: `temp/${repoName}`, private: false, _isTemp: true };
    setRepos(prev => [tempRepo, ...prev]);
    try {
      const data = await createRepoAPI(repoName, description);
      setRepos(prev => prev.map(r => r._isTemp && r.name === repoName ? data : r));
      setStatus("created");
      setTimeout(() => setStatus("ready"), 2000);
      return true;
    } catch (error) {
      console.error("Error creating repo:", error);
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
    const newItem = { 
      name, 
      path: fullPath, 
      sha: tempSha, 
      type: type === "folder" ? "dir" : "file", 
      _isTemp: true 
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
    } catch (error) {
      console.error("Error creating item:", error);
      setFiles(prev => prev.filter(f => f.sha !== tempSha));
      setStatus("error");
      return false;
    } finally {
      setIsCreating(false);
    }
  }, [isConfigured]);

  const handleDeleteItem = useCallback(async (target: ItemTarget, repo: string, _currentPath: string) => {
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
    } catch (error) {
      console.error("Error deleting item:", error);
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
      setEditingFile(null);
      setActiveId("");
    }
    try {
      await deleteRepoAPI(repoName);
      setStatus("deleted");
      setTimeout(() => setStatus("ready"), 2000);
      return true;
    } catch (error) {
      console.error("Error deleting repo:", error);
      setRepos(sortItems(prevRepos));
      if (wasSelected) setSelectedRepo(repoName);
      setStatus("error");
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [isConfigured, selectedRepo, repos]);

  const handleRenameItem = useCallback(async (target: ItemTarget, newName: string, repo: string): Promise<boolean> => {
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
      } catch (error) {
        console.error("Error renaming repo:", error);
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
      setEditingFile((prev: any) => prev ? { ...prev, path: newPath } : null);
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
            setEditingFile((prev: any) => prev ? { ...prev, sha: newSha } : null);
          }
        } catch (err) {
          console.warn("Failed to fetch new SHA after rename", err);
        }
      }
      setStatus("renamed");
      setTimeout(() => setStatus("ready"), 2000);
      return true;
    } catch (error) {
      console.error("Error renaming item:", error);
      setFiles(sortItems(prevFiles));
      if (prevEditingFile) setEditingFile(prevEditingFile);
      setStatus("error");
      return false;
    } finally {
      setIsRenaming(false);
    }
  }, [isConfigured, selectedRepo, files, editingFile, repos]);

  // ========== UPLOAD HANDLER ==========
  const handleUploadFiles = useCallback(async (filesList: FileList, repo: string, path: string, isFolderUpload: boolean = false) => {
    if (!isConfigured || !repo) return false;
    setIsUploading(true);
    setStatus("uploading");

    const filesArray = Array.from(filesList);
    const fileContentMap = new Map<string, string>();
    const targetPaths: string[] = [];

    // Read all files content and collect target paths
    for (const file of filesArray) {
      const relative = (file as any).webkitRelativePath || file.name;
      const filePath = path ? `${path}/${relative}` : relative;
      targetPaths.push(filePath);
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
      fileContentMap.set(filePath, content);
    }

    if (isFolderUpload) {
      // ===== UPLOAD FOLDER (only show folder entries) =====
      // Extract unique parent folder paths (e.g., "src/components")
      const uniqueFolders = new Set<string>();
      for (const filePath of targetPaths) {
        const lastSlash = filePath.lastIndexOf('/');
        if (lastSlash !== -1) {
          const folderPath = filePath.substring(0, lastSlash);
          uniqueFolders.add(folderPath);
        }
      }

      // Remove existing entries that have the same path (avoid duplicates)
      setFiles(prev => prev.filter(f => !uniqueFolders.has(f.path)));

      // Create temporary folder entries (optimistic update)
      const tempFolders = Array.from(uniqueFolders).map(folderPath => ({
        name: folderPath.split('/').pop()!,
        path: folderPath,
        sha: `temp-folder-${Date.now()}-${Math.random()}`,
        type: "dir" as const,
        _isTemp: true,
      }));
      if (tempFolders.length > 0) {
        setFiles(prev => sortItems([...prev, ...tempFolders]));
      }

      // Upload all files (including sub-files) to GitHub
      let successCount = 0;
      for (const filePath of targetPaths) {
        try {
          const content = fileContentMap.get(filePath)!;
          let existingSha: string | null = null;
          try {
            const existing = await fetchFileContentAPI(repo, filePath);
            existingSha = existing.sha;
          } catch (err: any) {
            if (err.status !== 404) throw err;
          }
          if (existingSha) {
            await updateFileAPI(repo, filePath, content, existingSha);
          } else {
            await uploadFileAPI(repo, filePath, content);
          }
          successCount++;
        } catch (error) {
          console.error(`Error uploading ${filePath}:`, error);
        }
      }

      if (successCount === 0) {
        // Failed: remove temporary folders
        setFiles(prev => prev.filter(f => !tempFolders.some(tf => tf.path === f.path)));
        setStatus("error");
      } else {
        // Success: refresh the current directory (parent) to show actual folder data from GitHub
        await fetchContents(path, repo, false);
        setStatus("uploaded");
        setTimeout(() => setStatus("ready"), 2000);
      }
    } else {
      // ===== UPLOAD INDIVIDUAL FILES (with optimistic update + overwrite) =====
      // Remove existing files with same path
      setFiles(prev => prev.filter(f => !targetPaths.includes(f.path)));

      // Create temporary file entries
      const tempItems = filesArray.map((file, idx) => {
        const relative = (file as any).webkitRelativePath || file.name;
        const filePath = path ? `${path}/${relative}` : relative;
        return {
          name: file.name,
          path: filePath,
          sha: `temp-${Date.now()}-${idx}-${Math.random()}`,
          type: "file" as const,
          _isTemp: true,
        };
      });
      setFiles(prev => sortItems([...prev, ...tempItems]));

      let successCount = 0;
      for (const tempItem of tempItems) {
        try {
          const content = fileContentMap.get(tempItem.path)!;
          let existingSha: string | null = null;
          try {
            const existing = await fetchFileContentAPI(repo, tempItem.path);
            existingSha = existing.sha;
          } catch (err: any) {
            if (err.status !== 404) throw err;
          }
          if (existingSha) {
            await updateFileAPI(repo, tempItem.path, content, existingSha);
          } else {
            await uploadFileAPI(repo, tempItem.path, content);
          }
          const { sha } = await fetchFileContentAPI(repo, tempItem.path);
          setFiles(prev =>
            prev.map(f =>
              f.path === tempItem.path ? { ...f, sha, _isTemp: false } : f
            )
          );
          successCount++;
        } catch (error) {
          console.error("Error uploading file:", error);
          setFiles(prev => prev.filter(f => f.path !== tempItem.path));
        }
      }

      if (successCount === 0) {
        setStatus("error");
      } else {
        setStatus("uploaded");
        setTimeout(() => setStatus("ready"), 2000);
      }
    }

    setIsUploading(false);
    return true;
  }, [isConfigured, fetchContents]);

  const refreshContents = useCallback(async () => {
    if (isConfigured && selectedRepo) await fetchContents(currentPath, selectedRepo, false);
  }, [isConfigured, selectedRepo, currentPath, fetchContents]);

  useEffect(() => { if (isConfigured) fetchReposData(); }, [isConfigured, fetchReposData]);
  useEffect(() => {
    if (isConfigured && selectedRepo) fetchContents(currentPath, selectedRepo);
    else if (isConfigured) { setFiles([]); setIsLoading(false); }
  }, [isConfigured, selectedRepo, currentPath, fetchContents]);

  return {
    isAuthLoading, isConfigured, showAuthModal, isFirebaseReady,
    saveCredentials, clearCredentials, closeAuthModal, openAuthModal,
    repos, selectedRepo, currentPath, files, editingFile, status, activeId, isLoading, isClearing,
    setSelectedRepo, setCurrentPath, setEditingFile, setStatus, setActiveId,
    fetchRepos: fetchReposData, fetchContents, handleFileClick, handleSave, handleClear,
    handleCreateRepo, handleCreateItem, handleDeleteItem, handleDeleteRepo, handleRenameItem, handleUploadFiles, refreshContents,
    isLoadingState: isLoading, isCreatingState: isCreating, isDeletingState: isDeleting, isRenamingState: isRenaming, isUploadingState: isUploading,
    setIsCreating, setIsDeleting, setIsRenaming, setIsUploading,
  };
};

export type { GithubItem, ItemTarget };