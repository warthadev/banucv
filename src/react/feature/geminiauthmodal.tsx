// src/react/feature/geminiAuthModal.tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Eye, EyeOff, AlertCircle, Sparkles } from "lucide-react";
import { modalVariants, overlayVariants } from "@animation/githubeditor";

interface GeminiAuthModalProps {
  isOpen: boolean;
  onSave: (apiKey: string) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export const GeminiAuthModal: React.FC<GeminiAuthModalProps> = ({
  isOpen,
  onSave,
  onClose,
  isLoading = false,
}) => {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setError("API Key is required");
      return;
    }
    setError("");
    setIsSaving(true);
    try {
      await onSave(trimmedKey);
      setApiKey("");
    } catch (err) {
      setError("Failed to save API key. Please try again.");
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
          >
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div className="github-auth-icon-wrapper">
                <Sparkles size={32} />
              </div>
              <h3 style={{ margin: "16px 0 8px 0", fontSize: "1.5rem" }}>
                Gemini API Key
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-sub)", margin: 0 }}>
                Enter your Gemini API key to enable AI Chat
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "20px" }}>
                <label className="github-modal-label">
                  <Key size={12} /> API KEY
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="github-modal-input"
                    style={{ paddingRight: "48px" }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="github-modal-eye-btn"
                    aria-label={showKey ? "Hide" : "Show"}
                  >
                    {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="github-modal-error">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <div className="github-modal-actions">
                <button type="button" onClick={onClose} className="github-modal-cancel">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || isSaving}
                  className="github-modal-confirm"
                >
                  {isLoading || isSaving ? "Saving..." : "Save & Continue"}
                </button>
              </div>
            </form>

            <div className="github-modal-footer">
              <p>
                Don't have a key?{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get one here
                </a>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};