import React, { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { AlertCircle, Check, CheckCircle, Copy, Eye, EyeOff, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { getAuth } from "@config/firebase";
import { clearOpenRouterCredentials, loadOpenRouterCredentials, saveOpenRouterCredentials, type OpenRouterCredentials } from "@config/routerhelper";
import useAgentModels, { ROUTER_CREDENTIAL_UPDATED_EVENT } from "@hook/useagentmodels";
import AgentModelCatalog from "./agentmodelcatalog";
import type { RegisterSettingsSaveHandler, SettingsSaveHandler, SettingsSaveResult } from "./settingssave";

interface SettingAgentProps {
  registerSaveHandler: RegisterSettingsSaveHandler;
  onSettingsChanged: () => void;
}

const SettingAgent: React.FC<SettingAgentProps> = ({ registerSaveHandler, onSettingsChanged }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [credentials, setCredentials] = useState<OpenRouterCredentials | null>(null);
  const { routerModels: models, isLoading: modelsLoading, catalogError: modelCatalogError } = useAgentModels();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState<"copied" | "error" | null>(null);
  const requestIdRef = useRef(0);
  const saveHandlerRef = useRef<SettingsSaveHandler | null>(null);

  useEffect(() => {
    if (!copyStatus) return;
    const timeout = window.setTimeout(() => setCopyStatus(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const refresh = useCallback(async (user: User | null) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setSettingsError(null);
    if (!user) {
      setCredentials(null);
      setApiKey("");
      setShowKey(false);
      setLoading(false);
      return;
    }
    try {
      const saved = await loadOpenRouterCredentials();
      if (requestId !== requestIdRef.current) return;
      setCredentials(saved);
      setApiKey(saved?.apiKey || "");
      setShowKey(false);
    } catch (error) {
      if (requestId === requestIdRef.current) {
        setCredentials(null);
        setSettingsError(error instanceof Error ? error.message : "Unable to load OpenRouter settings.");
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    let disposed = false;
    getAuth().then((firebaseAuth) => {
      if (disposed) return;
      unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        onSettingsChanged();
        setCurrentUser(user);
        setAuthReady(true);
        setApiKey("");
        setShowKey(false);
        setCopyStatus(null);
        setMessage(null);
        void refresh(user);
      });
    }).catch((error: unknown) => {
      setAuthReady(true);
      setLoading(false);
      setSettingsError(error instanceof Error ? error.message : "Firebase authentication is unavailable.");
    });
    return () => {
      disposed = true;
      requestIdRef.current += 1;
      unsubscribe();
    };
  }, [refresh, onSettingsChanged]);

  const handleSaveAll = async (): Promise<SettingsSaveResult> => {
    const sectionId = "openrouter" as const;
    const sectionName = "AI Agent · OpenRouter";
    if (!authReady || loading) {
      return { sectionId, sectionName, status: "error", message: "OpenRouter settings are still loading." };
    }
    if (!currentUser) {
      return { sectionId, sectionName, status: "unchanged", message: "No signed-in OpenRouter settings to save." };
    }
    if (saving) {
      return { sectionId, sectionName, status: "error", message: "OpenRouter settings are already being saved." };
    }

    const normalizedKey = apiKey.trim();
    const savedKey = credentials?.apiKey.trim() || "";
    const keyChanged = normalizedKey !== savedKey;
    if (settingsError && !normalizedKey) {
      return { sectionId, sectionName, status: "error", message: `Could not load OpenRouter settings: ${settingsError}` };
    }
    const submittedNewKey = keyChanged && Boolean(normalizedKey);
    const requiresSave = keyChanged || Boolean(credentials?.migrationRequired);
    if (!requiresSave) {
      return { sectionId, sectionName, status: "unchanged", message: "No changes to save." };
    }

    setSaving(true);
    setMessage(null);
    try {
      await saveOpenRouterCredentials(submittedNewKey ? apiKey : "");
      setApiKey("");
      setShowKey(false);
      setCopyStatus(null);
      await refresh(currentUser);
      window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
      return {
        sectionId,
        sectionName,
        status: "saved",
        message: submittedNewKey
          ? "Changed key verified and saved."
          : "Existing key verified; its saved value was unchanged.",
      };
    } catch (error) {
      await refresh(currentUser);
      return {
        sectionId,
        sectionName,
        status: "error",
        message: error instanceof Error ? error.message : "Could not verify this account's OpenRouter key.",
      };
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    saveHandlerRef.current = handleSaveAll;
  });
  useEffect(() => {
    const handler: SettingsSaveHandler = () => saveHandlerRef.current
      ? saveHandlerRef.current()
      : Promise.resolve({ sectionId: "openrouter", sectionName: "AI Agent · OpenRouter", status: "error", message: "OpenRouter settings are unavailable." });
    registerSaveHandler("openrouter", handler);
    return () => registerSaveHandler("openrouter", null);
  }, [registerSaveHandler]);

  const handleCopyApiKey = async () => {
    const enteredKey = apiKey;
    if (!enteredKey) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(enteredKey);
        setCopyStatus("copied");
        return;
      }
    } catch {
      // Fall back for browsers without clipboard permission/API support.
    }

    const textarea = document.createElement("textarea");
    textarea.value = enteredKey;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    let copied = false;
    try {
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    } finally {
      textarea.remove();
    }
    setCopyStatus(copied ? "copied" : "error");
  };

  const handleDelete = async () => {
    if (!currentUser || deleting || saving) return;
    if (!window.confirm("Remove this account's OpenRouter API key?")) return;
    onSettingsChanged();
    setDeleting(true);
    setMessage(null);
    try {
      await clearOpenRouterCredentials();
      setApiKey("");
      setShowKey(false);
      setCopyStatus(null);
      await refresh(currentUser);
      window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
      setMessage({ type: "success", text: "This account's OpenRouter API key was removed." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to remove this account's OpenRouter key." });
    } finally {
      setDeleting(false);
    }
  };

  if (!authReady || loading) {
    return (
      <section className="stack-item setting-agent-card" aria-busy="true">
        <div className="setting-agent-loading"><LoaderCircle size={18} className="setting-agent-spinner" /> Loading OpenRouter settings…</div>
      </section>
    );
  }

  return (
    <section className="stack-item setting-agent-card" aria-labelledby="setting-agent-title">
      <div className="section-header">
        <KeyRound size={19} aria-hidden="true" />
        <span className="section-label" id="setting-agent-title">AI Agent · OpenRouter</span>
        {credentials && <span className="setting-agent-status"><CheckCircle size={14} /> Connected</span>}
      </div>

      {!currentUser ? (
        <p className="setting-agent-note" role="status">Sign in to your Firebase account to manage its OpenRouter settings.</p>
      ) : (
        <>
          <p className="setting-agent-account">Active account: <strong>{currentUser.email || currentUser.uid}</strong></p>
          {settingsError && (
            <p className="setting-agent-error" role="alert"><AlertCircle size={15} /> OpenRouter settings warning: {settingsError}</p>
          )}
          {credentials && (
            <div className="setting-agent-safe-status">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                OpenRouter key connected for this account
                <small>{credentials.migrationRequired
                  ? "Older key needs verification."
                  : "Stored as plain text."}</small>
              </span>
            </div>
          )}

          <div className="setting-agent-form">
            <label className="setting-agent-label" htmlFor="setting-openrouter-key">
              OpenRouter API key
            </label>
            <div className="su-list-item setting-agent-key-control">
              <input
                id="setting-openrouter-key"
                className="setting-agent-input setting-agent-key-input"
                type={showKey ? "text" : "password"}
                name="openrouter-api-key"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setCopyStatus(null);
                  setMessage(null);
                  onSettingsChanged();
                }}
                placeholder={credentials ? "Enter a key to replace the saved key" : "Paste this account's OpenRouter API key"}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                required={!credentials}
              />
              <button
                className="setting-agent-reveal-btn"
                type="button"
                onClick={() => setShowKey((current) => !current)}
                aria-label={showKey ? "Hide saved OpenRouter API key" : "Reveal saved OpenRouter API key"}
                aria-pressed={showKey}
                disabled={!apiKey}
              >
                {showKey ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
              <button
                className="su-copy-btn setting-agent-copy-btn"
                type="button"
                onClick={() => void handleCopyApiKey()}
                disabled={!apiKey}
                aria-label={copyStatus === "copied" ? "OpenRouter API key copied to clipboard" : "Copy displayed OpenRouter API key"}
                title="Copy API key"
              >
                {copyStatus === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              </button>
            </div>
            {copyStatus && (
              <p
                className={`setting-agent-copy-feedback${copyStatus === "error" ? " is-error" : ""}`}
                role={copyStatus === "error" ? "alert" : "status"}
                aria-live={copyStatus === "error" ? "assertive" : "polite"}
              >
                {copyStatus === "copied" ? "OpenRouter API key copied to clipboard." : "Could not copy the API key. Please try again."}
              </p>
            )}
            <div className="setting-agent-actions">
              <button className="setting-agent-secondary" type="button" onClick={() => {
                onSettingsChanged();
                void refresh(currentUser);
                window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
              }} disabled={loading || modelsLoading || saving}>
                <RefreshCw size={15} className={loading ? "setting-agent-spinner" : ""} /> Refresh status
              </button>
              {credentials && (
                <button className="setting-agent-danger" type="button" onClick={() => void handleDelete()} disabled={deleting || saving}>
                  {deleting ? <LoaderCircle size={15} className="setting-agent-spinner" /> : <Trash2 size={15} />}
                  Delete key
                </button>
              )}
            </div>
          </div>

          {credentials && <AgentModelCatalog models={models} isLoading={modelsLoading} error={modelCatalogError} />}
          {message && (
            <p className={message.type === "success" ? "setting-agent-success" : "setting-agent-error"} role="status">
              {message.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              {message.text}
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default SettingAgent;
