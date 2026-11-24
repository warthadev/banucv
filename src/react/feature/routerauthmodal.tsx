import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Eye, EyeOff, Key, Sparkles } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { modalVariants, overlayVariants } from "@animation/githubeditor";

interface RouterAuthModalProps {
  isOpen: boolean;
  onSave: (apiKey: string) => Promise<void>;
  onClose: () => void;
  hasSavedKey?: boolean;
  isLoading?: boolean;
}

export const RouterAuthModal: React.FC<RouterAuthModalProps> = ({
  isOpen,
  onSave,
  onClose,
  hasSavedKey = false,
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
    if (!normalizedKey && !hasSavedKey) {
      setError("Enter this account's OpenRouter API key.");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await onSave(normalizedKey);
      setApiKey("");
      setShowKey(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to verify this account's OpenRouter key.");
    } finally {
      setIsSaving(false);
    }
  };

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
            className="github-modal global-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aiagent-openrouter-key-title"
          >
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div className="github-auth-icon-wrapper" aria-hidden="true"><Sparkles size={32} /></div>
              <h3 id="aiagent-openrouter-key-title" style={{ margin: "16px 0 8px 0", fontSize: "var(--global-font-size-1-5rem)" }}>
                Connect OpenRouter
              </h3>
              <p style={{ fontSize: "var(--global-font-size-0-85rem)", color: "var(--global-color-text-secondary)", margin: 0 }}>
                Add this account&apos;s key to discover its available free models.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "20px" }}>
                <label className="github-modal-label" htmlFor="aiagent-openrouter-key">
                  <Key size={12} /> OPENROUTER API KEY{hasSavedKey ? " (OPTIONAL)" : ""}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="aiagent-openrouter-key"
                    name="openrouter-api-key"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={hasSavedKey ? "Leave blank to verify the saved key" : "Paste this account's OpenRouter API key"}
                    className="github-modal-input"
                    style={{ paddingRight: "48px" }}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    required={!hasSavedKey}
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
                <button type="submit" disabled={isLoading || isSaving || (!apiKey.trim() && !hasSavedKey)} className="github-modal-confirm">
                  {isLoading || isSaving ? "Saving & verifying…" : "Save & continue"}
                </button>
              </div>
            </form>

            <div className="github-modal-footer">
              <p>The catalog is fetched from OpenRouter&apos;s live API. Only models whose input and output pricing are both zero or that use the official free variant are shown. The backend verifies the key before activating it for this account.</p>
              <RouterLink className="aiagent-settings-link" to="/setting">
                Manage this account&apos;s OpenRouter key in Settings
              </RouterLink>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
