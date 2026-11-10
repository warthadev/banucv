// src/react/feature/routerauthmodal.tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Eye, EyeOff, AlertCircle, Sparkles, ExternalLink } from "lucide-react";
import { modalVariants, overlayVariants } from "@animation/githubeditor";

const ROUTER_DASHBOARD_URL = "https://20128-agq2firibhstlf6sr7k3ydjoim.instabox.tech";
interface RouterAuthModalProps {
  isOpen: boolean;
  onSave: (apiKey: string) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export const RouterAuthModal: React.FC<RouterAuthModalProps> = ({ isOpen, onSave, onClose, isLoading = false }) => {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) { setError("A 9Router token is required."); return; }
    setError(""); setIsSaving(true);
    try { await onSave(apiKey.trim()); setApiKey(""); } catch { setError("Failed to save 9Router credentials."); } finally { setIsSaving(false); }
  };
  return <AnimatePresence>{isOpen && <motion.div className="github-modal-overlay" variants={overlayVariants} initial="initial" animate="animate" exit="exit"><motion.div className="github-modal" variants={modalVariants} initial="hidden" animate="visible" exit="exit">
    <div style={{ textAlign: "center", marginBottom: "24px" }}><div className="github-auth-icon-wrapper"><Sparkles size={32} /></div><h3 style={{ margin: "16px 0 8px 0", fontSize: "1.5rem" }}>9Router AI Agent</h3><p style={{ fontSize: "0.85rem", color: "var(--text-sub)", margin: 0 }}>Connect your token to enable AI Agent</p></div>
    <form onSubmit={handleSubmit}><div style={{ marginBottom: "20px" }}><label className="github-modal-label"><Key size={12} /> TOKEN 9ROUTER</label><div style={{ position: "relative" }}><input type={showKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Paste 9router token" className="github-modal-input" style={{ paddingRight: "48px" }} autoFocus /><button type="button" onClick={() => setShowKey(!showKey)} className="github-modal-eye-btn" aria-label={showKey ? "Hide" : "Show"}>{showKey ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
    <div style={{ marginBottom: "16px", fontSize: "0.75rem", color: "var(--text-sub)", wordBreak: "break-all" }}>Endpoint: https://20128-agq2firibhstlf6sr7k3ydjoim.instabox.tech/v1</div>
    <a href={ROUTER_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="github-modal-cancel" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", boxSizing: "border-box", marginBottom: "12px", textDecoration: "none" }}>
      <ExternalLink size={15} /> Open the 9Router dashboard for an API key
    </a>
    <p style={{ margin: "0 0 18px", fontSize: "0.75rem", color: "var(--text-sub)", lineHeight: 1.5 }}>
      This dashboard is a shared instance. Its password is for administrators only; do not share it with app users. Any API key you save is encrypted and tied to your account.
    </p>
    {error && <div className="github-modal-error"><AlertCircle size={14} /><span>{error}</span></div>}
    <div className="github-modal-actions"><button type="button" onClick={onClose} className="github-modal-cancel">Cancel</button><button type="submit" disabled={isLoading || isSaving} className="github-modal-confirm">{isLoading || isSaving ? "Saving..." : "Save & Continue"}</button></div></form>
  </motion.div></motion.div>}</AnimatePresence>;
};
