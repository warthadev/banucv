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
  const [baseUrl, setBaseUrl] = useState("");
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
      setBaseUrl("");
      setLoading(false);
      return;
    }
    try {
      const saved = await loadRouterCredentials();
      if (requestId !== requestIdRef.current) return;
      setCredentials(saved);
      setBaseUrl(saved?.baseUrl || "");
    } catch (error) {
      if (requestId === requestIdRef.current) {
        setCredentials(null);
        setSettingsError(error instanceof Error ? error.message : "Unable to load 9Router settings.");
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
        setBaseUrl("");
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
    if (!currentUser || !baseUrl.trim() || (!apiKey.trim() && !credentials) || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveRouterCredentials(baseUrl, apiKey);
      setApiKey("");
      await refresh(currentUser);
      window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
      setMessage({ type: "success", text: apiKey.trim()
        ? "This account's 9Router URL and encrypted key were saved."
        : "This account's 9Router URL was updated; the saved key was kept." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save this account's 9Router settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUser || deleting) return;
    if (!window.confirm("Remove this account's 9Router URL and key? You will need to enter them again to use the AI Agent.")) return;
    setDeleting(true);
    setMessage(null);
    try {
      await clearRouterCredentials();
      setApiKey("");
      setBaseUrl("");
      await refresh(currentUser);
      window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
      setMessage({ type: "success", text: "This account's 9Router URL and key were removed." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to remove this account's 9Router settings." });
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
        {credentials && (credentials.baseUrl
          ? <span className="setting-agent-status"><CheckCircle size={14} /> Configured</span>
          : <span className="setting-agent-status"><AlertCircle size={14} /> URL needed</span>)}
      </div>
      <p className="setting-agent-description">
        Save this account&apos;s own public HTTPS 9Router URL and API key. The URL is stored on its user record, and the key is encrypted. The catalog and chat use this same pair.
      </p>

      {!currentUser ? (
        <p className="setting-agent-note" role="status">Sign in to your Firebase account to manage its 9Router settings.</p>
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
                9Router key saved for this account
                {credentials.fingerprint ? <small>Secure fingerprint: {credentials.fingerprint}</small> : null}
              </span>
            </div>
          )}

          <form className="setting-agent-form" onSubmit={handleSave}>
            <label className="setting-agent-label" htmlFor="setting-9router-url">This account&apos;s 9Router base URL</label>
            <input
              id="setting-9router-url"
              className="setting-agent-input"
              type="url"
              name="nine-router-base-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://your-9router.example/v1"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <label className="setting-agent-label" htmlFor="setting-9router-key">
              {credentials ? "Replace 9Router API key (optional)" : "9Router API key"}
            </label>
            <input
              id="setting-9router-key"
              className="setting-agent-input"
              type="password"
              name="nine-router-api-key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={credentials ? "Leave blank to keep the saved key" : "Paste this account's 9Router API key"}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              required={!credentials}
            />
            <div className="setting-agent-actions">
              <button className="setting-agent-primary" type="submit" disabled={saving || !baseUrl.trim() || (!apiKey.trim() && !credentials)}>
                {saving ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <ShieldCheck size={16} />}
                {saving ? "Saving…" : credentials ? "Save URL / key" : "Save URL & key"}
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
                  Delete URL & key
                </button>
              )}
            </div>
          </form>

          <p className="setting-agent-footnote">
            For separate provider connections, each account must use a different 9Router instance. Accounts that use the same URL share that instance&apos;s provider configuration; a restricted key may still limit the visible model catalog.
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
