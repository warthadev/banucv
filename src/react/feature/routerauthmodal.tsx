import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Eye, EyeOff, Key, Sparkles } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { modalVariants, overlayVariants } from "@animation/githubeditor";

interface RouterAuthModalProps {
  isOpen: boolean;
  onSave: (apiKey: string) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export const RouterAuthModal: React.FC<RouterAuthModalProps> = ({
  isOpen,
  onSave,
  onClose,
  isLoading = false,
}) => {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => {
    setApiKey("");
    setShowKey(false);
    setError("");
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedKey = apiKey.trim();
    if (!normalizedKey) {
      setError("A 9Router API key is required.");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await onSave(normalizedKey);
      setApiKey("");
      setShowKey(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save the 9Router API key.");
    } finally {
      setIsSaving(false);
    }
  };

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
            className="github-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aiagent-router-key-title"
          >
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div className="github-auth-icon-wrapper" aria-hidden="true">
                <Sparkles size={32} />
              </div>
              <h3 id="aiagent-router-key-title" style={{ margin: "16px 0 8px 0", fontSize: "1.5rem" }}>
                Use API Key
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-sub)", margin: 0 }}>
                Enter a 9Router API key to connect this account and enable AI Agent.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "20px" }}>
                <label className="github-modal-label" htmlFor="aiagent-9router-key">
                  <Key size={12} /> API KEY
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="aiagent-9router-key"
                    name="nine-router-api-key"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="Paste your 9Router API key"
                    className="github-modal-input"
                    style={{ paddingRight: "48px" }}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="github-modal-eye-btn"
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                    aria-pressed={showKey}
                  >
                    {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="github-modal-error" role="alert">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <div className="github-modal-actions">
                <button type="button" onClick={handleClose} className="github-modal-cancel" disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" disabled={isLoading || isSaving} className="github-modal-confirm">
                  {isLoading || isSaving ? "Saving..." : "Save & Continue"}
                </button>
              </div>
            </form>

            <div className="github-modal-footer">
              <p>Don&apos;t have a key? Use one from a 9Router instance you administer.</p>
              <RouterLink className="aiagent-settings-link" to="/setting">
                Manage the 9Router key in Settings
              </RouterLink>
              <p className="github-modal-footer-note">
                Do not use a shared admin dashboard. Keys entered here are encrypted and stored for this signed-in account.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
