// src/react/feature/cloudmodalhf.tsx
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, User, AlertCircle, Eye, EyeOff, X } from "lucide-react";
import { modalVariants, overlayVariants } from "@animation/githubeditor";
import { auth, db } from "@config/firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { HuggingFaceIcon } from "@control/icon";

interface CloudModalHFProps {
  isOpen: boolean;
  onSave: (username: string, token: string) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

const saveHFToFirestore = async (username: string, token: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const userRef = doc(db, "users", user.uid);

  try {
    await updateDoc(userRef, {
      hfUsernames: arrayUnion(username),
      hfTokens: arrayUnion(token),
    });
  } catch (error: any) {
    throw error;
  }
};

export const CloudModalHF: React.FC<CloudModalHFProps> = ({
  isOpen,
  onSave,
  onClose,
  isLoading = false,
}) => {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const resetForm = useCallback(() => {
    setUsername("");
    setToken("");
    setError("");
    setSaveSuccess(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    if (!token.trim()) {
      setError("API token is required");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      try {
        await saveHFToFirestore(username.trim(), token.trim());
      } catch (saveError: any) {
        setError("Failed to save credentials: " + (saveError.message || "Unknown error"));
        setIsSaving(false);
        return;
      }

      try {
        await onSave(username.trim(), token.trim());
      } catch (onSaveErr) {}

      setSaveSuccess(true);
      resetForm();
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setError(err.message || "Failed to save credentials");
    } finally {
      setIsSaving(false);
    }
  }, [username, token, onSave, onClose, resetForm]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="github-modal-overlay"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <motion.div
            className="github-modal cva-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="cva-modal-header">
              <div style={{ marginLeft: 'auto' }}>
                <button
                  className="cva-modal-close"
                  onClick={handleClose}
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="cva-header">
              <div className="cva-icon-wrapper">
                <HuggingFaceIcon size={32} />
              </div>
              <h3 className="cva-title">Hugging Face</h3>
              <p className="cva-desc">Enter your credentials to connect</p>
            </div>

            {saveSuccess && (
              <div style={{
                padding: "12px",
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid #10b981",
                borderRadius: "10px",
                marginBottom: "16px",
                textAlign: "center",
                color: "#10b981"
              }}>
                Credentials saved successfully!
              </div>
            )}

            <div className="cva-manual-container">
              <div className="cva-input-wrap">
                <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="github-modal-input cva-session-input"
                  style={{ paddingLeft: '40px' }}
                  autoFocus
                />
              </div>

              <div className="cva-input-wrap">
                <Key size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                <input
                  type={showToken ? "text" : "password"}
                  placeholder="API Token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="github-modal-input cva-session-input"
                  style={{ paddingLeft: '40px', paddingRight: '48px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="cva-eye-btn"
                  aria-label={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSaving || isLoading}
                className="cva-btn"
              >
                {isSaving || isLoading ? "Saving..." : "Save Credentials"}
              </button>

              <div style={{
                marginTop: '16px',
                textAlign: 'center',
                fontSize: '13px',
                color: 'var(--text-sub)'
              }}>
                <span>Don't have an API token? </span>
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Click here to create one
                </a>
              </div>
            </div>

            {error && (
              <div className="cva-error">
                <AlertCircle size={14} /> {error}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};