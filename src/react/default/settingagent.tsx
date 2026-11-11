import React, { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { AlertCircle, CheckCircle, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { getAuth } from "@config/firebase";
import { clearRouterCredentials, loadRouterCredentials, saveRouterCredentials, type RouterCredentials } from "@config/routerhelper";
import useAgentModels, { ROUTER_CREDENTIAL_UPDATED_EVENT } from "@hook/useagentmodels";
import AgentModelCatalog from "./agentmodelcatalog";

const SettingAgent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [credentials, setCredentials] = useState<RouterCredentials | null>(null);
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
      const saved = await loadRouterCredentials();
      if (requestId !== requestIdRef.current) return;
      setCredentials(saved);
    } catch (error) {
      if (requestId === requestIdRef.current) {
        setCredentials(null);
        setSettingsError(error instanceof Error ? error.message : "Unable to load key status.");
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
    if (!currentUser || !apiKey.trim() || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveRouterCredentials(apiKey);
      setApiKey("");
      await refresh(currentUser);
      window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
      setMessage({ type: "success", text: "The 9Router key was saved securely for this account." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save the 9Router key." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUser || deleting) return;
    if (!window.confirm("Remove the 9Router key from this account? You will need to enter it again to use the AI Agent.")) return;
    setDeleting(true);
    setMessage(null);
    try {
      await clearRouterCredentials();
      setApiKey("");
      await refresh(currentUser);
      window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
      setMessage({ type: "success", text: "The 9Router key was removed from this account." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to remove the 9Router key." });
    } finally {
      setDeleting(false);
    }
  };

  if (!authReady || loading) {
    return (
      <section className="stack-item setting-agent-card" aria-busy="true">
        <div className="setting-agent-loading"><LoaderCircle size={18} className="setting-agent-spinner" /> Loading 9Router settings…</div>
      </section>
    );
  }

  return (
    <section className="stack-item setting-agent-card" aria-labelledby="setting-agent-title">
      <div className="section-header">
        <KeyRound size={19} aria-hidden="true" />
        <span className="section-label" id="setting-agent-title">AI Agent · 9Router</span>
        {credentials && <span className="setting-agent-status"><CheckCircle size={14} /> Connected</span>}
      </div>
      <p className="setting-agent-description">
        Each Firebase account has its own key and model catalog. The key is encrypted on the server; this page shows only its secure status, never its value.
      </p>

      {!currentUser ? (
        <p className="setting-agent-note" role="status">Sign in to your Firebase account to manage the 9Router key.</p>
      ) : (
        <>
          <p className="setting-agent-account">Active account: <strong>{currentUser.email || currentUser.uid}</strong></p>
          {settingsError && !credentials && (
            <p className="setting-agent-error" role="alert"><AlertCircle size={15} /> Unable to load key status: {settingsError}</p>
          )}
          {credentials && (
            <div className="setting-agent-safe-status">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                Key saved for this account
                {credentials.fingerprint ? <small>Secure fingerprint: {credentials.fingerprint}</small> : null}
              </span>
            </div>
          )}

          <form className="setting-agent-form" onSubmit={handleSave}>
            <label className="setting-agent-label" htmlFor="setting-9router-key">
              {credentials ? "Replace 9Router API key" : "9Router API key"}
            </label>
            <input
              id="setting-9router-key"
              className="setting-agent-input"
              type="password"
              name="nine-router-api-key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={credentials ? "Paste a new key to replace the current one" : "Paste your 9Router API key"}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              required
            />
            <div className="setting-agent-actions">
              <button className="setting-agent-primary" type="submit" disabled={saving || !apiKey.trim()}>
                {saving ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <ShieldCheck size={16} />}
                {saving ? "Saving…" : credentials ? "Save new key" : "Save key"}
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

          {credentials && (
            <AgentModelCatalog models={models} isLoading={modelsLoading} error={modelCatalogError} />
          )}
          {message && (
            <p className={message.type === "success" ? "setting-agent-success" : "setting-agent-error"} role="status">
              {message.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              {message.text}
            </p>
          )}
          <p className="setting-agent-footnote">The key is not stored in localStorage or shown again. If 9Router rejects it, enter a valid key here.</p>
        </>
      )}
    </section>
  );
};

export default SettingAgent;
