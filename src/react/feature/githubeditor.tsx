// src/react/feature/githubeditor.tsx
import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";

import GithubEditorPack from "./githubeditorpack";
import { CreateModal, RenameModal, DeleteModal, GithubAuthModal } from "./githubeditormodal";

import { useGithubEditor, type ItemTarget } from "@hook/usegithubeditor";

// CSS sudah di import di main.tsx

const GithubEditor: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const {
    isAuthLoading,
    isConfigured,
    showAuthModal,
    saveCredentials,
    clearCredentials,
    closeAuthModal,
    
    repos,
    selectedRepo,
    currentPath,
    files,
    editingFile,
    status,
    activeId,
    isLoading,
    isClearing,
    setSelectedRepo,
    setCurrentPath,
    setEditingFile,
    setStatus,
    setActiveId,
    handleFileClick,
    handleSave,
    handleClear,
    handleCreateRepo,
    handleCreateItem,
    handleDeleteItem,
    handleDeleteRepo,
    handleRenameItem,
    handleUploadFiles,
    isCreatingState,
    isDeletingState,
    isRenamingState,
    isUploadingState,
    setIsCreating,
    setIsDeleting,
    setIsRenaming,
    setIsUploading,
  } = useGithubEditor();

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newItemName, setNewItemName] = React.useState("");
  const [newRepoDesc, setNewRepoDesc] = React.useState("");
  const [newItemType, setNewItemType] = React.useState<"file" | "folder">("file");
  const [newItemContent, setNewItemContent] = React.useState("");
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ItemTarget | null>(null);
  const [showRenameModal, setShowRenameModal] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<ItemTarget | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleRepoClick = (name: string, id: number) => {
    setActiveId(id);
    setSelectedRepo(name);
    setCurrentPath("");
    setEditingFile(null);
  };

  const handleUpDir = () => {
    if (currentPath === "") {
      setSelectedRepo(null);
      setActiveId("");
      setEditingFile(null);
    } else {
      const newPath = currentPath.split("/").slice(0, -1).join("/");
      setCurrentPath(newPath);
      setEditingFile(null);
    }
  };

  const handleSaveWrapper = async () => {
    if (!editingFile || !selectedRepo) return;
    const result = await handleSave(selectedRepo, editingFile.path, editingFile.content, editingFile.sha);
    if (result && result.success) {
      setEditingFile((prev: any) => prev ? { ...prev, content: result.newContent, sha: result.newSha } : null);
    }
  };

  const handleClearWrapper = () => {
    handleClear(() => setEditingFile((prev: any) => prev ? { ...prev, content: "" } : null));
  };

  const handleCopy = () => {
    if (editingFile) {
      navigator.clipboard.writeText(editingFile.content);
      setStatus("copied");
      setTimeout(() => setStatus("ready"), 2000);
    }
  };

  const openCreateModal = (type: "file" | "folder") => {
    setNewItemType(type);
    setNewItemName("");
    setNewItemContent("");
    setShowCreateModal(true);
  };

  const handleCreateRepoWrapper = async () => {
    if (!newItemName.trim()) return;
    const name = newItemName.toLowerCase().replace(/\s/g, "-");
    const success = await handleCreateRepo(name, newRepoDesc);
    if (success) {
      setShowCreateModal(false);
      setNewItemName("");
      setNewRepoDesc("");
    }
  };

  const handleCreateItemWrapper = async () => {
    if (!newItemName.trim() || !selectedRepo) return;
    const success = await handleCreateItem(newItemType, newItemName, newItemContent, selectedRepo, currentPath);
    if (success) {
      setShowCreateModal(false);
      setNewItemName("");
      setNewItemContent("");
    }
  };

  const openDeleteModal = (type: "repo" | "file" | "folder", name: string, path?: string, sha?: string) => {
    setDeleteTarget({ type, name, path, sha });
    setShowDeleteModal(true);
  };

  const handleDeleteWrapper = async () => {
    if (!deleteTarget) return;
    let success = false;
    if (deleteTarget.type === "repo") {
      success = await handleDeleteRepo(deleteTarget.name);
    } else {
      if (!selectedRepo) return;
      success = await handleDeleteItem(deleteTarget, selectedRepo, currentPath);
    }
    if (success) {
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  const openRenameModal = (target: ItemTarget) => {
    setRenameTarget(target);
    setRenameValue(target.name);
    setShowRenameModal(true);
  };

  const handleRenameWrapper = async () => {
    if (!renameTarget || !renameValue.trim()) {
      setShowRenameModal(false);
      setRenameTarget(null);
      return;
    }
    if (renameValue === renameTarget.name) {
      setShowRenameModal(false);
      setRenameTarget(null);
      return;
    }
    const repo = selectedRepo || renameTarget.name;
    const success = await handleRenameItem(renameTarget, renameValue, repo);
    if (success) {
      setShowRenameModal(false);
      setRenameTarget(null);
      setRenameValue("");
    }
  };

  const handleUploadClick = (type: "file" | "folder") => {
    if (type === "file") fileInputRef.current?.click();
    else folderInputRef.current?.click();
  };

  // Upload file biasa (isFolderUpload = false)
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && selectedRepo) {
      await handleUploadFiles(e.target.files, selectedRepo, currentPath, false);
      e.target.value = "";
    }
  };

  // Upload folder (isFolderUpload = true) - hanya menampilkan folder di sidebar
  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && selectedRepo) {
      await handleUploadFiles(e.target.files, selectedRepo, currentPath, true);
      e.target.value = "";
    }
  };

  return (
    <>
      <GithubAuthModal
        isOpen={showAuthModal}
        onSave={saveCredentials}
        onClose={() => { closeAuthModal(); navigate("/dashboard"); }}
        isLoading={isAuthLoading}
      />

      {isConfigured && (
        <div className="github-editor-container">
          <GithubEditorPack
            repos={repos}
            selectedRepo={selectedRepo}
            currentPath={currentPath}
            files={files}
            editingFile={editingFile}
            status={status}
            activeId={activeId}
            isLoading={isLoading}
            isClearing={isClearing}
            isUploading={isUploadingState}
            isDeleting={isDeletingState}
            isCreating={isCreatingState}
            isRenaming={isRenamingState}
            isMobile={isMobile}
            isSidebarOpen={isSidebarOpen}
            fileInputRef={fileInputRef}
            folderInputRef={folderInputRef}
            onSetSidebarOpen={setIsSidebarOpen}
            onNavigateBack={() => navigate(-1)}
            onRepoClick={handleRepoClick}
            onFileClick={(file) => handleFileClick(file, selectedRepo!)}
            onUpDir={handleUpDir}
            onSave={handleSaveWrapper}
            onClear={handleClearWrapper}
            onCopy={handleCopy}
            onDeleteClick={openDeleteModal}
            onCloseEditor={() => setEditingFile(null)}
            onCreateClick={openCreateModal}
            onUploadClick={handleUploadClick}
            onRenameClick={openRenameModal}
            onEditingFileChange={(content) => setEditingFile((prev: any) => prev ? { ...prev, content } : null)}
          />

          <CreateModal
            isOpen={showCreateModal}
            selectedRepo={selectedRepo}
            itemType={newItemType}
            itemName={newItemName}
            itemContent={newItemContent}
            repoName={newItemName}
            repoDesc={newRepoDesc}
            isCreating={isCreatingState}
            onItemTypeChange={setNewItemType}
            onItemNameChange={setNewItemName}
            onItemContentChange={setNewItemContent}
            onRepoNameChange={setNewItemName}
            onRepoDescChange={setNewRepoDesc}
            onCreateRepo={handleCreateRepoWrapper}
            onCreateItem={handleCreateItemWrapper}
            onClose={() => { setShowCreateModal(false); setNewItemName(""); setNewItemContent(""); setNewRepoDesc(""); }}
          />

          <RenameModal
            isOpen={showRenameModal}
            targetType={renameTarget?.type || ""}
            renameValue={renameValue}
            isRenaming={isRenamingState}
            onRenameValueChange={setRenameValue}
            onRename={handleRenameWrapper}
            onClose={() => { setShowRenameModal(false); setRenameTarget(null); setRenameValue(""); }}
          />

          <DeleteModal
            isOpen={showDeleteModal}
            deleteTarget={deleteTarget}
            isDeleting={isDeletingState}
            onDelete={handleDeleteWrapper}
            onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
          />

          {/* Input untuk upload file biasa */}
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={handleFileInputChange}
            multiple
          />

          {/* Input untuk upload folder (mempertahankan struktur) */}
          <input
            ref={folderInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={handleFolderInputChange}
            multiple
            // @ts-ignore - webkitdirectory adalah properti non-standar tapi didukung browser
            webkitdirectory=""
            directory=""
          />
        </div>
      )}
    </>
  );
};

export default GithubEditor;