// src/react/feature/apiaichecking.tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { heroVariants } from "@/react/animation/home";
import { Play, AlertCircle, Loader2, Cpu, Copy, Check, Key, Globe, Eye, EyeOff, Terminal } from "lucide-react";
import { getAuth } from "@config/firebase";
import { AGENT_API_BASE, AI_AGENT_API_BASE } from "@config/api";

const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.05 }
  }
};

const listItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, y: 0,
    transition: { duration: 0.25, ease: "easeOut" }
  }
};

interface ModelInfo {
  id?: string;
  name?: string;
  description?: string;
  supported_generation_methods?: string[];
}

const AICheck: React.FC = () => {
  const [systemModels, setSystemModels] = useState<ModelInfo[]>([]);
  const [customModels, setCustomModels] = useState<ModelInfo[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [authMode, setAuthMode] = useState<"system" | "custom">("system");
  const [customKey, setCustomKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const currentModels = authMode === "system" ? systemModels : customModels;

  const fetchModels = async () => {
    setStatus("loading");
    setErrorMessage("");
    setCopied(false);
    setIsFetching(true);

    try {
      let models: ModelInfo[] = [];

      let response: Response;
      if (authMode === "system") {
        const firebaseAuth = await getAuth();
        const user = firebaseAuth.currentUser;
        if (!user) throw new Error("Sign in to check system models.");
        const idToken = await user.getIdToken(true);
        response = await fetch(`${AI_AGENT_API_BASE}/agent/models`, { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" });
      } else {
        const token = customKey.trim();
        if (!token) throw new Error("Enter a personal API key first.");
        response = await fetch(`${AGENT_API_BASE}/router/models`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || data?.error?.message || `Error ${response.status}`);
      const entries = (data.data || data.models || []) as ModelInfo[];
      models = entries.map((model) => ({ ...model, name: model.name || model.id || "Unknown model" }));
      if (authMode === "system") setSystemModels(models); else setCustomModels(models);

      setStatus("idle");
    } catch (err: unknown) {
      const message = typeof err === "object" && err !== null && "message" in err && typeof err.message === "string"
        ? err.message
        : String(err);
      setErrorMessage(message);
      setStatus("error");
    } finally {
      setIsFetching(false);
    }
  };

  const handleCopy = () => {
    const textToCopy = currentModels.map(m => {
      const name = m.name?.replace('models/', '') || '';
      const methods = m.supported_generation_methods?.join(', ') || 'No methods';
      return `${name} [${methods}]`;
    }).join('\n');

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="home-container">
      <main className="home-hero">
        <motion.div
          variants={heroVariants}
          initial="initial"
          animate="animate"
          className="aic-hero-wrapper"
        >
          <h1 className="home-title">9router Model Check</h1>
          <p className="home-subtitle">Verify 9router connectivity and available models.</p>

          <div className="aic-controls">
            
            <div className="aic-tabs">
              <button 
                onClick={() => { setAuthMode("system"); setErrorMessage(""); }} 
                className={`aic-tab ${authMode === "system" ? "active" : ""}`}
              >
                {authMode === "system" && <motion.div layoutId="activeTab" className="aic-tab-active" />}
                <span className="aic-tab-content"><Globe size={14} /> System</span>
              </button>
              <button 
                onClick={() => { setAuthMode("custom"); setErrorMessage(""); }} 
                className={`aic-tab ${authMode === "custom" ? "active" : ""}`}
              >
                {authMode === "custom" && <motion.div layoutId="activeTab" className="aic-tab-active" />}
                <span className="aic-tab-content"><Key size={14} /> Personal</span>
              </button>
            </div>

            <div className={`aic-key-input-wrapper ${authMode === "custom" ? "aic-key-input-expanded" : ""}`}>
              <div className="aic-key-input-inner">
                <AnimatePresence mode="wait">
                  {authMode === "custom" && (
                    <motion.div
                      key="input-manual"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="aic-key-input-container"
                    >
                      <input 
                        type={showKey ? "text" : "password"}
                        placeholder="Paste your API key..."
                        value={customKey}
                        onChange={(e) => setCustomKey(e.target.value)}
                        className="aic-key-input"
                      />
                      <button 
                        onClick={() => setShowKey(!showKey)} 
                        className="aic-key-eye-btn"
                      >
                        {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="aic-actions">
              <motion.button 
                onClick={fetchModels} 
                disabled={status === "loading" || isFetching} 
                className={`aic-fetch-btn ${status === "loading" || isFetching ? "loading" : ""}`}
                whileTap={{ scale: 0.98 }}
              >
                <AnimatePresence mode="wait">
                  {status === "loading" || isFetching ? (
                    <motion.div
                      key="loading"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      className="aic-fetch-content"
                    >
                      <Loader2 className="animate-spin" size={18} />
                      <motion.span
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        Connecting...
                      </motion.span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="idle"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      className="aic-fetch-content"
                    >
                      <Play size={18} />
                      <span>Fetch Models</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {currentModels.length > 0 && (
                <motion.button 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopy} 
                  className={`aic-copy-btn ${copied ? "copied" : ""}`}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copied ? "Done" : "Copy"}</span>
                </motion.button>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {status === "error" && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95 }} 
                className="home-card aic-error-card"
              >
                <div className="card-header">
                  <AlertCircle color="#ff4d4d" size={20} />
                  <h3 className="home-card-title" style={{ color: '#ff4d4d' }}>Failed</h3>
                </div>
                <p className="home-card-text">{errorMessage}</p>
              </motion.div>
            )}

            {currentModels.length > 0 && (
              <motion.div 
                key={authMode} 
                variants={listContainerVariants}
                initial="hidden"
                animate="visible"
                className="home-grid"
              >
                {currentModels.map((model) => (
                  <motion.div key={model.name} variants={listItemVariants} className="home-card">
                    <div className="card-header">
                      <div className="card-icon-wrapper"><Cpu size={20} /></div>
                      <h3 className="home-card-title">{model.name?.replace('models/', '') || ''}</h3>
                    </div>
                    <p className="home-card-text aic-model-desc">{model.description}</p>
                    
                    <div className="aic-methods">
                      {model.supported_generation_methods?.map((method: string) => (
                        <span key={method} className="aic-method-chip">
                          <Terminal size={10} />
                          {method}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
};

export default AICheck;
