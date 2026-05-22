import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Folder, Loader2, AlertTriangle, Key, User, Eye, EyeOff, AlertCircle } from "lucide-react";
import { GithubIcon } from "@control/icon";
import { modalVariants, overlayVariants } from "@animation/githubeditor";

interface CreateModalProps {
  isOpen: boolean;
  selectedRepo: string | null;
  itemType: "file" | "folder";
  itemName: string;
  itemContent: string;
  repoName: string;
  repoDesc: string;
  isCreating: boolean;
  onItemTypeChange: (type: "file" | "folder") => void;
  onItemNameChange: (name: string) => void;
  onItemContentChange: (content: string) => void;
  onRepoNameChange: (name: string) => void;
  onRepoDescChange: (desc: string) => void;
  onCreateRepo: () => void;
  onCreateItem: () => void;
  onClose: () => void;
}

interface RenameModalProps {
  isOpen: boolean;
  targetType: string;
  renameValue: string;
  isRenaming: boolean;
  onRenameValueChange: (value: string) => void;
  onRename: () => void;
  onClose: () => void;
}

interface DeleteModalProps {
  isOpen: boolean;
  deleteTarget: { type: string; name: string } | null;
  isDeleting: boolean;
  onDelete: () => void;
  onClose: () => void;
}

interface GithubAuthModalProps {
  isOpen: boolean;
  onSave: (username: string, token: string) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export const CreateModal: React.FC<CreateModalProps> = ({
  isOpen,
  selectedRepo,
  itemType,
  itemName,
  itemContent,
  repoName,
  repoDesc,
  isCreating,
  onItemTypeChange,
  onItemNameChange,
  onItemContentChange,
  onRepoNameChange,
  onRepoDescChange,
  onCreateRepo,
  onCreateItem,
  onClose,
}) => {
  const modalTitle = !selectedRepo ? "Create Repository" : `Create ${itemType === "file" ? "File" : "Folder"}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="github-modal-overlay" variants={overlayVariants} initial="initial" animate="animate" exit="exit">
          <motion.div className="github-modal" variants={modalVariants} initial="hidden" animate="visible" exit="exit">
            <h3 style={{ margin: "0 0 16px 0", textAlign: "center" }}>{modalTitle}</h3>

            {!selectedRepo ? (
              <>
                <input
                  autoFocus
                  type="text"
                  placeholder="Repository name"
                  value={repoName}
                  onChange={(e) => onRepoNameChange(e.target.value)}
                  className="github-modal-input"
                  onKeyDown={(e) => e.key === "Enter" && onCreateRepo()}
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={repoDesc}
                  onChange={(e) => onRepoDescChange(e.target.value)}
                  className="github-modal-input"
                />
                <div className="github-modal-actions">
                  <button onClick={onClose} className="github-modal-cancel">Cancel</button>
                  <button onClick={onCreateRepo} disabled={isCreating} className="github-modal-confirm">
                    {isCreating ? <Loader2 size={16} className="spin" /> : "Create"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="github-modal-type-selector">
                  <button className={`type-btn ${itemType === "file" ? "active" : ""}`} onClick={() => onItemTypeChange("file")}>
                    <FileText size={13} /> File
                  </button>
                  <button className={`type-btn ${itemType === "folder" ? "active" : ""}`} onClick={() => onItemTypeChange("folder")}>
                    <Folder size={13} /> Folder
                  </button>
                </div>
                <input
                  autoFocus
                  type="text"
                  placeholder={`${itemType === "file" ? "File" : "Folder"} name`}
                  value={itemName}
                  onChange={(e) => onItemNameChange(e.target.value)}
                  className="github-modal-input"
                  onKeyDown={(e) => e.key === "Enter" && onCreateItem()}
                />
                {itemType === "file" && (
                  <textarea
                    placeholder="Content (optional)"
                    value={itemContent}
                    onChange={(e) => onItemContentChange(e.target.value)}
                    className="github-modal-textarea"
                    rows={4}
                  />
                )}
                <div className="github-modal-actions">
                  <button onClick={onClose} className="github-modal-cancel">Cancel</button>
                  <button onClick={onCreateItem} disabled={isCreating} className="github-modal-confirm">
                    {isCreating ? <Loader2 size={16} className="spin" /> : "Create"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  targetType,
  renameValue,
  isRenaming,
  onRenameValueChange,
  onRename,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="github-modal-overlay" variants={overlayVariants} initial="initial" animate="animate" exit="exit">
          <motion.div className="github-modal" variants={modalVariants} initial="hidden" animate="visible" exit="exit">
            <h3 style={{ margin: "0 0 16px 0", textAlign: "center" }}>Rename {targetType}</h3>
            <input
              autoFocus
              type="text"
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
              className="github-modal-input"
              onKeyDown={(e) => { if (e.key === "Enter") onRename(); if (e.key === "Escape") onClose(); }}
            />
            <div className="github-modal-actions">
              <button onClick={onClose} className="github-modal-cancel">Cancel</button>
              <button onClick={onRename} disabled={isRenaming} className="github-modal-confirm">
                {isRenaming ? <Loader2 size={16} className="spin" /> : "Rename"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const DeleteModal: React.FC<DeleteModalProps> = ({ isOpen, deleteTarget, isDeleting, onDelete, onClose }) => {
  if (!deleteTarget) return null;
  const isRepo = deleteTarget.type === "repo";
  const warningMsg = isRepo ? "This deletes the entire repository!" : "This cannot be undone.";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="github-modal-overlay" variants={overlayVariants} initial="initial" animate="animate" exit="exit">
          <motion.div className="github-modal github-modal-danger" variants={modalVariants} initial="hidden" animate="visible" exit="exit">
            <div className="github-modal-danger-icon"><AlertTriangle size={26} /></div>
            <h3 style={{ margin: "8px 0 16px 0", textAlign: "center" }}>Delete {deleteTarget.type}</h3>
            <p style={{ textAlign: "center", marginBottom: 20 }}>Delete <strong>{deleteTarget.name}</strong>? {warningMsg}</p>
            <div className="github-modal-actions">
              <button onClick={onClose} className="github-modal-cancel">Cancel</button>
              <button onClick={onDelete} disabled={isDeleting} className="github-modal-confirm delete">
                {isDeleting ? <Loader2 size={16} className="spin" /> : "Delete"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const GithubAuthModal: React.FC<GithubAuthModalProps> = ({ isOpen, onSave, onClose, isLoading = false }) => {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError("Username is required"); return; }
    if (!token.trim()) { setError("Personal Access Token is required"); return; }
    setError("");
    setIsSaving(true);
    try {
      await onSave(username.trim(), token.trim());
      setUsername("");
      setToken("");
    } catch (err) {
      setError("Failed to save credentials. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="github-modal-overlay" variants={overlayVariants} initial="initial" animate="animate" exit="exit">
          <motion.div className="github-modal" variants={modalVariants} initial="hidden" animate="visible" exit="exit">
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div className="github-auth-icon-wrapper"><GithubIcon /></div>
              <h3 style={{ margin: "16px 0 8px 0", fontSize: "1.5rem" }}>GitHub Setup</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-sub)", margin: 0 }}>Enter your GitHub credentials to access the repository editor</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label className="github-modal-label"><User size={12} /> GITHUB USERNAME</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className="github-modal-input" autoFocus />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label className="github-modal-label"><Key size={12} /> PERSONAL ACCESS TOKEN</label>
                <div style={{ position: "relative" }}>
                  <input type={showToken ? "text" : "password"} value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxx" className="github-modal-input" style={{ paddingRight: "48px" }} />
                  <button type="button" onClick={() => setShowToken(!showToken)} className="github-modal-eye-btn">
                    {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="github-modal-error"><AlertCircle size={14} /><span>{error}</span></div>
              )}

              <div className="github-modal-actions">
                <button type="button" onClick={onClose} className="github-modal-cancel">Cancel</button>
                <button type="submit" disabled={isLoading || isSaving} className="github-modal-confirm">
                  {(isLoading || isSaving) ? "Saving..." : "Save & Continue"}
                </button>
              </div>
            </form>

            <div className="github-modal-footer">
              <p>Don't have a token? <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">Generate one here</a></p>
              <p className="github-modal-footer-note">Needs <strong>repo</strong> and <strong>delete_repo</strong> scopes</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};