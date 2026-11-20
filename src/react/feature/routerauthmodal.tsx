import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Eye, EyeOff, Key, Link2, Sparkles } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { modalVariants, overlayVariants } from "@animation/githubeditor";

interface RouterAuthModalProps {
  isOpen: boolean;
  onSave: (baseUrl: string, apiKey: string) => Promise<void>;
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
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => {
    setBaseUrl("");
    setApiKey("");
    setShowKey(false);
    setError("");
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedBaseUrl = baseUrl.trim();
    const normalizedKey = apiKey.trim();
    if (!normalizedBaseUrl || (!normalizedKey && !hasSavedKey)) {
      setError(hasSavedKey ? "Enter this account's 9Router base URL." : "Enter this account's 9Router base URL and API key.");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await onSave(normalizedBaseUrl, normalizedKey);
      setBaseUrl("");
      setApiKey("");
      setShowKey(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save this account's 9Router settings.");
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
                Connect this account&apos;s own 9Router URL and key to load its model catalog.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label className="github-modal-label" htmlFor="aiagent-9router-url">
                  <Link2 size={12} /> 9ROUTER BASE URL
                </label>
                <input
                  id="aiagent-9router-url"
                  name="nine-router-base-url"
                  type="url"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="https://your-9router.example/v1"
                  className="github-modal-input"
                  autoComplete="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  required
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label className="github-modal-label" htmlFor="aiagent-9router-key">
                  <Key size={12} /> 9ROUTER API KEY{hasSavedKey ? " (OPTIONAL)" : ""}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="aiagent-9router-key"
                    name="nine-router-api-key"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={hasSavedKey ? "Leave blank to keep the saved key" : "Paste this account's 9Router API key"}
                    className="github-modal-input"
                    style={{ paddingRight: "48px" }}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
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
                <button type="submit" disabled={isLoading || isSaving || !baseUrl.trim() || (!apiKey.trim() && !hasSavedKey)} className="github-modal-confirm">
                  {isLoading || isSaving ? "Saving..." : "Save & Continue"}
                </button>
              </div>
            </form>

            <div className="github-modal-footer">
              <p>Your 9Router instance must be reachable from the internet over HTTPS. Localhost and private-network URLs won&apos;t work from BanuCV.</p>
              <a
                className="aiagent-settings-link"
                href="https://github.com/decolua/9router#-deployment"
                target="_blank"
                rel="noopener noreferrer"
              >
                Official 9Router setup guide (deployment and API key)
              </a>
              <RouterLink className="aiagent-settings-link" to="/setting">
                Manage this account&apos;s 9Router URL and key in Settings
              </RouterLink>
              <p className="github-modal-footer-note">
                The URL and encrypted key are saved on this account&apos;s user record. If multiple accounts point to the same 9Router instance, its provider connections remain shared; use separate instances for provider separation.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
