import React, { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, User, AlertCircle, Eye, EyeOff, X } from "lucide-react";
import { modalVariants, overlayVariants } from "@animation/githubeditor";

interface CloudModalKaggleProps {
  isOpen: boolean;
  onSave: (username: string, apiToken: string) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export const CloudModalKaggle: React.FC<CloudModalKaggleProps> = ({
  isOpen,
  onSave,
  onClose,
  isLoading = false,
}) => {
  const [username, setUsername] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const resetForm = useCallback(() => {
    setUsername("");
    setApiToken("");
    setError("");
    setSaveSuccess(false);
    setShowToken(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    if (!apiToken.trim()) {
      setError("API token is required");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await onSave(username.trim(), apiToken.trim());
      setSaveSuccess(true);
      resetForm();
      window.setTimeout(onClose, 500);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save Kaggle credentials");
    } finally {
      setIsSaving(false);
    }
  }, [username, apiToken, onSave, onClose, resetForm]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="github-modal-overlay global-modal-overlay"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <motion.div
            className="github-modal cva-modal global-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="cva-modal-header">
              <div style={{ marginLeft: "auto" }}>
                <button className="cva-modal-close" onClick={handleClose} title="Close" type="button" aria-label="Close Kaggle credentials">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="cva-header">
              <div className="cva-icon-wrapper">
                <Key size={32} aria-hidden="true" />
              </div>
              <h3 className="cva-title">Kaggle</h3>
              <p className="cva-desc">Enter your Kaggle username and API token to continue</p>
            </div>

            {saveSuccess && (
              <div style={{
                padding: "12px",
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid #10b981",
                borderRadius: "10px",
                marginBottom: "16px",
                textAlign: "center",
                color: "#10b981",
              }}>
                Credentials saved successfully!
              </div>
            )}

            <div className="cva-manual-container">
              <div className="cva-input-wrap">
                <User size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--global-color-text-muted)", zIndex: 1 }} />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="github-modal-input cva-session-input"
                  style={{ paddingLeft: "40px" }}
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>

              <div className="cva-input-wrap">
                <Key size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--global-color-text-muted)", zIndex: 1 }} />
                <input
                  type={showToken ? "text" : "password"}
                  placeholder="API Token"
                  value={apiToken}
                  onChange={(event) => setApiToken(event.target.value)}
                  className="github-modal-input cva-session-input"
                  style={{ paddingLeft: "40px", paddingRight: "48px" }}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((visible) => !visible)}
                  className="cva-eye-btn"
                  aria-label={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button onClick={() => void handleSubmit()} disabled={isSaving || isLoading} className="cva-btn" type="button">
                {isSaving || isLoading ? "Saving..." : "Save Credentials"}
              </button>

              <div style={{
                marginTop: "16px",
                textAlign: "center",
                fontSize: "var(--global-font-size-13px)",
                color: "var(--global-color-text-secondary)",
              }}>
                <span>Need an API token? </span>
                <a
                  href="https://www.kaggle.com/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--global-color-accent)", textDecoration: "none", fontWeight: 600, cursor: "pointer" }}
                >
                  Open Kaggle settings
                </a>
              </div>
            </div>

            {error && <div className="cva-error" role="alert"><AlertCircle size={14} /> {error}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CloudModalKaggle;
