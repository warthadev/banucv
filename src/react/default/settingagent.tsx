import React, { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { AlertCircle, CheckCircle, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { getAuth } from "@config/firebase";
import { clearOpenRouterCredentials, loadOpenRouterCredentials, saveOpenRouterCredentials, type OpenRouterCredentials } from "@config/routerhelper";
import useAgentModels, { ROUTER_CREDENTIAL_UPDATED_EVENT } from "@hook/useagentmodels";
import AgentModelCatalog from "./agentmodelcatalog";

const SettingAgent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [credentials, setCredentials] = useState<OpenRouterCredentials | null>(null);
  const { routerModels: models, isLoading: modelsLoading, catalogError: modelCatalogError } = useAgentModels();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async (user: User | null) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setSettingsError(null);
    if (!user) {
      setCredentials(null);
      setLoading(false);
      return;
    }
    try {
      const saved = await loadOpenRouterCredentials();
      if (requestId !== requestIdRef.current) return;
      setCredentials(saved);
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
        setCurrentUser(user);
        setAuthReady(true);
        setApiKey("");
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
  }, [refresh]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || (!apiKey.trim() && !credentials) || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveOpenRouterCredentials(apiKey);
      setApiKey("");
      await refresh(currentUser);
      window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
      setMessage({ type: "success", text: "OpenRouter key verified. This account's old 9Router settings, if any, were removed." });
    } catch (error) {
      await refresh(currentUser);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not verify this account's OpenRouter key." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUser || deleting) return;
    if (!window.confirm("Remove this account's encrypted OpenRouter API key?")) return;
    setDeleting(true);
    setMessage(null);
    try {
      await clearOpenRouterCredentials();
      setApiKey("");
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
        {credentials && <span className="setting-agent-status"><CheckCircle size={14} /> Configured</span>}
      </div>
      <p className="setting-agent-description">
        Add this account&apos;s OpenRouter API key. The backend encrypts it in this account&apos;s existing user record, fetches the live model catalog, and offers only models marked free or priced at zero for both input and output.
      </p>

      {!currentUser ? (
        <p className="setting-agent-note" role="status">Sign in to your Firebase account to manage its OpenRouter settings.</p>
      ) : (
        <>
          <p className="setting-agent-account">Active account: <strong>{currentUser.email || currentUser.uid}</strong></p>
          {settingsError && !credentials && (
            <p className="setting-agent-error" role="alert"><AlertCircle size={15} /> Unable to load settings: {settingsError}</p>
          )}
          {credentials && (
            <div className="setting-agent-safe-status">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                OpenRouter key saved for this account
                {credentials.fingerprint ? <small>Secure fingerprint: {credentials.fingerprint}</small> : null}
              </span>
            </div>
          )}

          <form className="setting-agent-form" onSubmit={handleSave}>
            <label className="setting-agent-label" htmlFor="setting-openrouter-key">
              {credentials ? "Replace or re-verify OpenRouter API key" : "OpenRouter API key"}
            </label>
            <input
              id="setting-openrouter-key"
              className="setting-agent-input"
              type="password"
              name="openrouter-api-key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={credentials ? "Leave blank to verify the saved key" : "Paste this account's OpenRouter API key"}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              required={!credentials}
            />
            <div className="setting-agent-actions">
              <button className="setting-agent-primary" type="submit" disabled={saving || (!apiKey.trim() && !credentials)}>
                {saving ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <ShieldCheck size={16} />}
                {saving ? "Saving & verifying…" : credentials ? "Save / verify key" : "Save & verify key"}
              </button>
              <button className="setting-agent-secondary" type="button" onClick={() => {
                void refresh(currentUser);
                window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
              }} disabled={loading || modelsLoading}>
                <RefreshCw size={15} className={loading ? "setting-agent-spinner" : ""} /> Refresh status
              </button>
              {credentials && (
                <button className="setting-agent-danger" type="button" onClick={() => void handleDelete()} disabled={deleting}>
                  {deleting ? <LoaderCircle size={15} className="setting-agent-spinner" /> : <Trash2 size={15} />}
                  Delete key
                </button>
              )}
            </div>
          </form>

          <p className="setting-agent-footnote">
            OpenRouter&apos;s live catalog is checked whenever models are loaded; chat requests are rejected unless the selected model is still listed as free. The API key is never returned to this browser after saving.
          </p>
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
