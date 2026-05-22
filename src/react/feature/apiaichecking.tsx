import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { heroVariants } from "@/react/animation/home";
import { Play, AlertCircle, Loader2, Cpu, Copy, Check, Key, Globe, Eye, EyeOff, Terminal } from "lucide-react";

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

const AICheck: React.FC = () => {
  const [systemModels, setSystemModels] = useState<any[]>([]);
  const [customModels, setCustomModels] = useState<any[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [authMode, setAuthMode] = useState<"system" | "custom">("system");
  const [customKey, setCustomKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const currentModels = authMode === "system" ? systemModels : customModels;

  const fetchModels = async () => {
    setStatus("loading");
    setErrorMessage("");
    setCopied(false);
    try {
      const apiKey = authMode === "system" ? import.meta.env.VITE_GEMINI_API_KEY : customKey;
      if (!apiKey) throw new Error(authMode === "system" ? "System Key missing." : "Enter API Key.");
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error?.message || `Error ${response.status}`);
      
      const models = data.models || [];
      authMode === "system" ? setSystemModels(models) : setCustomModels(models);
      setStatus("idle");
    } catch (err: any) {
      setErrorMessage(err.message);
      setStatus("error");
    }
  };

  const handleCopy = () => {
    const textToCopy = currentModels.map(m => {
      const name = m.name.replace('models/', '');
      const methods = m.supportedGenerationMethods?.join(', ') || 'No methods';
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
          style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h1 className="home-title">API Explorer</h1>
          <p className="home-subtitle">Verify connectivity and available models.</p>

          <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
            
            {/* Tabs */}
            <div style={{ display: 'flex', backgroundColor: 'var(--card-bg)', padding: '5px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <button onClick={() => { setAuthMode("system"); setErrorMessage(""); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', position: 'relative', cursor: 'pointer', border: 'none', background: 'none', color: authMode === "system" ? '#fff' : 'var(--text-sub)' }}>
                {authMode === "system" && <motion.div layoutId="activeTab" style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--primary)', borderRadius: '8px', zIndex: 0 }} />}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Globe size={14} /> System</span>
              </button>
              <button onClick={() => { setAuthMode("custom"); setErrorMessage(""); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', position: 'relative', cursor: 'pointer', border: 'none', background: 'none', color: authMode === "custom" ? '#fff' : 'var(--text-sub)' }}>
                {authMode === "custom" && <motion.div layoutId="activeTab" style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--primary)', borderRadius: '8px', zIndex: 0 }} />}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Key size={14} /> Personal</span>
              </button>
            </div>

            {/* Manual Key Input */}
            <div style={{ 
              display: 'grid', 
              gridTemplateRows: authMode === "custom" ? "1fr" : "0fr", 
              transition: "grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              overflow: "hidden" 
            }}>
              <div style={{ minHeight: "0px" }}>
                <AnimatePresence mode="wait">
                  {authMode === "custom" && (
                    <motion.div
                      key="input-manual"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ position: 'relative', paddingBottom: '20px' }}
                    >
                      <input 
                        type={showKey ? "text" : "password"}
                        placeholder="Paste your API key..."
                        value={customKey}
                        onChange={(e) => setCustomKey(e.target.value)}
                        style={{ width: '100%', padding: '15px 45px 15px 15px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', color: 'var(--text-main)', outline: 'none' }}
                      />
                      <button onClick={() => setShowKey(!showKey)} style={{ position: 'absolute', right: '15px', top: '27px', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-sub)' }}>
                        {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <motion.button 
                onClick={fetchModels} 
                disabled={status === "loading"} 
                className="btn" 
                whileTap={{ scale: 0.98 }}
                style={{ 
                  flex: 2, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px',
                  backgroundColor: status === "loading" ? 'var(--border-color)' : 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  cursor: status === "loading" ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <AnimatePresence mode="wait">
                  {status === "loading" ? (
                    <motion.div
                      key="loading"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
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
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
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
                  className="btn" 
                  style={{ 
                    flex: 1, 
                    backgroundColor: copied ? '#10b981' : 'var(--card-bg)', 
                    color: copied ? '#ffffff' : 'var(--text-main)', 
                    border: '1px solid var(--border-color)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px' 
                  }}
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
                className="home-card" 
                style={{ border: '1px solid #ff4d4d', marginBottom: '20px' }}
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
                      <h3 className="home-card-title">{model.name.split('/').pop()}</h3>
                    </div>
                    <p className="home-card-text" style={{ marginBottom: '12px' }}>{model.description}</p>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto' }}>
                      {model.supportedGenerationMethods?.map((method: string) => (
                        <span key={method} style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--border-color)', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
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
