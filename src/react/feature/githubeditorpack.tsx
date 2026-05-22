// src/react/feature/githubeditorpack.tsx
import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder,
  FileText,
  ChevronLeft,
  Copy,
  X,
  Save,
  ArrowUpLeft,
  Eraser,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  Upload,
  Check,
  GitBranch,
  Pencil,
} from "lucide-react";
import { type GithubItem, type ItemTarget } from "@hook/usegithubeditor";

// Animation variants
const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.16, ease: "easeOut" } },
  exit: { opacity: 0, x: -8, transition: { duration: 0.12 } },
};

const sidebarDesktopVariants = {
  open: {
    width: 290,
    opacity: 1,
    transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
  },
  closed: {
    width: 0,
    opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
  },
};

const toggleButtonVariants = {
  initial: { opacity: 0, x: -6 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.15 } },
  exit: { opacity: 0, x: -6, transition: { duration: 0.15 } },
};

const emptyStateVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.14 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

interface GithubEditorPackProps {
  // Data
  repos: any[];
  selectedRepo: string | null;
  currentPath: string;
  files: GithubItem[];
  editingFile: { path: string; content: string; sha: string } | null;
  status: string;
  activeId: string | number;
  
  // Loading states
  isLoading: boolean;
  isClearing: boolean;
  isUploading: boolean;
  isDeleting: boolean;
  isCreating: boolean;
  isRenaming: boolean;
  
  // UI states
  isMobile: boolean;
  isSidebarOpen: boolean;
  
  // Refs
  fileInputRef: React.RefObject<HTMLInputElement>;
  folderInputRef: React.RefObject<HTMLInputElement>;
  
  // Callbacks
  onSetSidebarOpen: (open: boolean) => void;
  onNavigateBack: () => void;
  onRepoClick: (name: string, id: number) => void;
  onFileClick: (file: GithubItem) => void;
  onUpDir: () => void;
  onSave: () => void;
  onClear: () => void;
  onCopy: () => void;
  onDeleteClick: (type: "repo" | "file" | "folder", name: string, path?: string, sha?: string) => void;
  onCloseEditor: () => void;
  onCreateClick: (type: "file" | "folder") => void;
  onUploadClick: (type: "file" | "folder") => void;
  onRenameClick: (target: ItemTarget) => void;
  onEditingFileChange: (content: string) => void;
}

const GithubEditorPack: React.FC<GithubEditorPackProps> = ({
  repos,
  selectedRepo,
  currentPath,
  files,
  editingFile,
  status,
  activeId,
  isLoading,
  isClearing,
  isUploading,
  isDeleting,
  isCreating,
  isRenaming,
  isMobile,
  isSidebarOpen,
  fileInputRef,
  folderInputRef,
  onSetSidebarOpen,
  onNavigateBack,
  onRepoClick,
  onFileClick,
  onUpDir,
  onSave,
  onClear,
  onCopy,
  onDeleteClick,
  onCloseEditor,
  onCreateClick,
  onUploadClick,
  onRenameClick,
  onEditingFileChange,
}) => {
  const sidebarRef = useRef<HTMLDivElement>(null);

  const getStatusDisplay = () => {
    if (isLoading || isUploading || isDeleting || isCreating || isRenaming) {
      return <span className="status-spinner" />;
    }
    if (status === "error") return <span className="status-error">!</span>;
    if (["saved", "deleted", "created", "uploaded", "renamed"].includes(status)) {
      return <Check size={10} />;
    }
    return <span className="status-dot" />;
  };

  // Check if save is in progress
  const isSaving = status === "saving" || isLoading;

  return (
    <>
      <AnimatePresence initial={false}>
        {(isSidebarOpen || !isMobile) && (
          <motion.aside
            ref={sidebarRef}
            key="sidebar"
            className={`github-editor-sidebar ${isMobile ? "mobile" : "desktop"}`}
            variants={!isMobile ? sidebarDesktopVariants : undefined}
            initial={!isMobile ? "closed" : { y: "100%", opacity: 0 }}
            animate={!isMobile ? (isSidebarOpen ? "open" : "closed") : { y: 0, opacity: 1 }}
            exit={!isMobile ? "closed" : { y: "100%", opacity: 0, transition: { duration: 0.18 } }}
            style={isMobile ? { height: `70%` } : {}}
          >
            <header className="github-sidebar-header">
              <div className="github-sidebar-title">
                <button
                  onClick={() => onSetSidebarOpen(false)}
                  className="github-toggle-btn"
                  aria-label="Close sidebar"
                >
                  <PanelLeftClose size={17} />
                </button>
                <h1>Repository</h1>
              </div>
              <button onClick={onNavigateBack} className="github-back-btn">
                <ChevronLeft size={17} />
              </button>
            </header>

            <div className="github-sidebar-content">
              <div className="github-sidebar-nav">
                <span className="github-sidebar-label">
                  {selectedRepo ? "Explorer" : "Repositories"}
                </span>
                <div className="github-sidebar-actions">
                  {!selectedRepo ? (
                    <button
                      onClick={() => onCreateClick("file")}
                      className="github-action-icon"
                      title="Create"
                    >
                      <Plus size={15} />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onCreateClick("file")}
                        className="github-action-icon"
                        title="Create"
                      >
                        <Plus size={15} />
                      </button>
                      <button
                        onClick={() => onUploadClick("file")}
                        className="github-action-icon"
                        title="Upload files"
                      >
                        <Upload size={14} />
                      </button>
                      <button
                        onClick={() => onUploadClick("folder")}
                        className="github-action-icon"
                        title="Upload folder"
                      >
                        <Folder size={14} />
                      </button>
                      <button onClick={onUpDir} className="github-action-icon" title="Go up">
                        <ArrowUpLeft size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <motion.div
                variants={listVariants}
                initial="hidden"
                animate="visible"
                className="github-item-list"
              >
                {!selectedRepo ? (
                  repos.length === 0 && !isLoading ? (
                    <motion.div
                      variants={emptyStateVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="github-empty-list"
                    >
                      <span className="status-spinner" style={{ margin: "0 auto" }} />
                    </motion.div>
                  ) : (
                    repos.map((repo) => (
                      <motion.div
                        key={repo.id}
                        variants={itemVariants}
                        layout
                        className={`github-item ${activeId === repo.id ? "active" : ""}`}
                      >
                        <div
                          className="github-item-main"
                          onClick={() => onRepoClick(repo.name, repo.id)}
                        >
                          <GitBranch size={13} className="github-item-icon" />
                          <span className="github-item-name">{repo.name.toLowerCase()}</span>
                        </div>
                        <div className="github-item-actions">
                          <button
                            className="github-item-action-btn rename"
                            title="Rename"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRenameClick({ type: "repo", name: repo.name });
                            }}
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            className="github-item-action-btn delete"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteClick("repo", repo.name);
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )
                ) : (
                  files.map((file) => (
                    <motion.div
                      key={file.sha}
                      variants={itemVariants}
                      layout
                      className={`github-item ${activeId === file.sha ? "active" : ""}`}
                    >
                      <div className="github-item-main" onClick={() => onFileClick(file)}>
                        {file.type === "dir" ? (
                          <Folder size={13} className="github-item-icon folder" />
                        ) : (
                          <FileText size={13} className="github-item-icon" />
                        )}
                        <span className="github-item-name">{file.name.toLowerCase()}</span>
                      </div>
                      <div className="github-item-actions">
                        <button
                          className="github-item-action-btn rename"
                          title="Rename"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRenameClick({
                              type: file.type === "dir" ? "folder" : "file",
                              name: file.name,
                              path: file.path,
                              sha: file.sha,
                            });
                          }}
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          className="github-item-action-btn delete"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClick(
                              file.type === "dir" ? "folder" : "file",
                              file.name,
                              file.path,
                              file.sha
                            );
                          }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>

              {selectedRepo && files.length === 0 && !isLoading && (
                <motion.div
                  variants={emptyStateVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="github-empty-folder"
                >
                  <p>Empty folder</p>
                  <div className="github-empty-actions">
                    <button
                      onClick={() => onCreateClick("file")}
                      className="github-create-btn-center"
                    >
                      <Plus size={12} /> Create
                    </button>
                    <button
                      onClick={() => onUploadClick("file")}
                      className="github-create-btn-center"
                    >
                      <Upload size={12} /> Upload
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            <footer className="github-sidebar-footer">{getStatusDisplay()}</footer>
          </motion.aside>
        )}
      </AnimatePresence>

      <main className="github-editor-main">
        <div className="github-editor-header">
          <div className="github-editor-info">
            <AnimatePresence>
              {!isSidebarOpen && (
                <motion.button
                  key="open-sidebar"
                  variants={toggleButtonVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  onClick={() => onSetSidebarOpen(true)}
                  className="github-toggle-btn"
                  aria-label="Open sidebar"
                >
                  <PanelLeftOpen size={17} />
                </motion.button>
              )}
            </AnimatePresence>
            <div className="github-editor-icon">
              <FileText size={13} color="var(--primary)" />
              <span className="github-editor-filename">
                {editingFile ? editingFile.path.toLowerCase() : "no file selected"}
              </span>
            </div>
          </div>

          <div className="github-editor-actions">
            {editingFile && (
              <>
                <button onClick={onClear} className="github-action-btn" title="Clear">
                  <Eraser size={16} />
                </button>
                <button onClick={onCopy} className="github-action-btn" title="Copy">
                  <Copy size={16} />
                </button>
                <button
                  onClick={() =>
                    onDeleteClick(
                      "file",
                      editingFile.path.split("/").pop() || "",
                      editingFile.path,
                      editingFile.sha
                    )
                  }
                  className="github-action-btn delete-btn"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
                <button onClick={onCloseEditor} className="github-action-btn" title="Close">
                  <X size={16} />
                </button>
                {/* SAVE BUTTON WITH CSS SPINNER */}
                <button 
                  onClick={onSave} 
                  className="github-save-btn" 
                  title="Save"
                  disabled={isSaving}
                  style={{ 
                    width: "auto", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    gap: "6px",
                    opacity: isSaving ? 0.7 : 1,
                    cursor: isSaving ? "not-allowed" : "pointer"
                  }}
                >
                  {isSaving ? (
                    <>
                      <div className="status-spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: "#ffffff", borderRightColor: "#ffffff", borderBottomColor: "#ffffff", borderLeftColor: "transparent"}} />
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="github-editor-body">
          <AnimatePresence mode="wait">
            {editingFile ? (
              <motion.textarea
                key="editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                value={editingFile.content}
                onChange={(e) => onEditingFileChange(e.target.value)}
                spellCheck={false}
                className={`github-textarea ${isClearing ? "blur" : ""}`}
                disabled={isSaving}
              />
            ) : (
              <motion.div
                key="empty"
                variants={emptyStateVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="github-empty-state"
              >
                <FileText size={52} strokeWidth={1} />
                <p className="github-empty-text">select a file to edit</p>
                {selectedRepo && (
                  <div className="github-empty-actions-center">
                    <button
                      onClick={() => onCreateClick("file")}
                      className="github-create-btn-center"
                    >
                      <Plus size={13} /> Create
                    </button>
                    <button
                      onClick={() => onUploadClick("file")}
                      className="github-create-btn-center"
                    >
                      <Upload size={13} /> Upload
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
};

export default GithubEditorPack;