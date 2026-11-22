import React, { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { AlertCircle, CheckCircle, Eye, EyeOff, KeyRound, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { getAuth } from "@config/firebase";
import { deleteKaggleCredentials, loadKaggleCredentials, saveKaggleCredentials, type KaggleCredentials } from "@config/kagglecredentials";

const SettingKaggle: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [credentials, setCredentials] = useState<KaggleCredentials | null>(null);
  const [username, setUsername] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async (user: User | null) => {
    const requestId = ++requestIdRef.current;
    setLoading(Boolean(user));
    setError(null);
    if (!user) {
      setCredentials(null);
      setUsername("");
      setApiToken("");
      setLoading(false);
      return;
    }
    try {
      const saved = await loadKaggleCredentials();
      if (requestId !== requestIdRef.current) return;
      setCredentials(saved);
      setUsername(saved?.username || "");
      setApiToken(saved?.apiToken || "");
      setShowToken(false);
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setCredentials(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load this account’s Kaggle settings.");
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
        setMessage(null);
        setError(null);
        setApiToken("");
        void refresh(user);
      });
    }).catch((authError: unknown) => {
      setAuthReady(true);
      setLoading(false);
      setError(authError instanceof Error ? authError.message : "Firebase authentication is unavailable.");
    });
    return () => {
      disposed = true;
      requestIdRef.current += 1;
      unsubscribe();
    };
  }, [refresh]);

  const handleSave = async () => {
    setMessage(null);
    setError(null);
    if (!currentUser) {
      setError("Sign in to save Kaggle credentials for this account.");
      return;
    }
    const normalizedUsername = username.trim();
    const normalizedToken = apiToken.trim();
    if (!normalizedUsername && !normalizedToken) {
      if (!credentials) {
        setMessage("No changes to save.");
        return;
      }
      setSaving(true);
      try {
        await deleteKaggleCredentials();
        setCredentials(null);
        setUsername("");
        setApiToken("");
        setShowToken(false);
        setMessage("Kaggle credentials removed.");
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Could not remove this account’s Kaggle credentials.");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!normalizedUsername || !normalizedToken) {
      setError("Enter both fields, or clear both to remove Kaggle credentials.");
      return;
    }
    if (credentials && normalizedUsername === credentials.username.trim() && normalizedToken === credentials.apiToken.trim()) {
      setMessage("No changes to save.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveKaggleCredentials(normalizedUsername, normalizedToken);
      setCredentials(saved);
      setUsername(saved.username);
      setApiToken(saved.apiToken);
      setShowToken(false);
      setMessage(credentials ? "Kaggle credentials updated for this account." : "Kaggle credentials saved for this account.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this account’s Kaggle credentials.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="stack-item settings-service-section global-card global-section global-card--padded" aria-label="Kaggle">
      <div className="su-profile-card setting-agent-safe-status global-inline-row global-inline-row--gap-8">
        {credentials ? <ShieldCheck size={17} aria-hidden="true" /> : <KeyRound size={17} aria-hidden="true" />}
        <span>
          {loading || !authReady
            ? "Loading Kaggle settings…"
            : credentials
              ? `Kaggle connected as ${credentials.username}`
              : "Kaggle credentials are not configured."}
          <small>Credentials apply only to this signed-in account and are stored by the Downloader backend.</small>
        </span>
      </div>

      {!currentUser && authReady ? (
        <p className="setting-agent-note" role="status">Sign in to manage this account’s Kaggle settings.</p>
      ) : (
        <>
          <div className="su-input-group">
            <label className="su-input-label" htmlFor="setting-kaggle-username">KAGGLE USERNAME</label>
            <input
              id="setting-kaggle-username"
              className="setting-agent-input setting-plain-input"
              type="text"
              name="kaggle-username"
              value={username}
              onChange={(event) => { setUsername(event.target.value); setMessage(null); setError(null); }}
              placeholder="Your Kaggle username"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              disabled={saving || loading || !authReady}
            />
          </div>

          <div className="su-input-group">
            <label className="su-input-label" htmlFor="setting-kaggle-token">KAGGLE API TOKEN</label>
            <div className="su-list-item setting-agent-key-control">
              <input
                id="setting-kaggle-token"
                className="setting-agent-input setting-agent-key-input"
                type={showToken ? "text" : "password"}
                name="kaggle-api-token"
                value={apiToken}
                onChange={(event) => { setApiToken(event.target.value); setMessage(null); setError(null); }}
                placeholder={credentials ? "Enter a token to replace the saved token" : "Paste your Kaggle API token"}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                disabled={saving || loading || !authReady}
              />
              <button
                className="setting-agent-reveal-btn global-icon-button"
                type="button"
                onClick={() => setShowToken((visible) => !visible)}
                aria-label={showToken ? "Hide Kaggle API token" : "Reveal Kaggle API token"}
                aria-pressed={showToken}
                disabled={!apiToken || saving}
              >
                {showToken ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && <p className="setting-agent-error global-inline-row global-inline-row--gap-8" role="alert"><AlertCircle size={15} />{error}</p>}
          <div className="settings-section-actions">
            <button className="setting-agent-primary settings-section-save-btn" type="button" onClick={() => void handleSave()} disabled={saving || loading || !authReady || !currentUser}>
              {saving ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <Save size={16} aria-hidden="true" />}
              {saving ? "Saving…" : "Save"}
            </button>
            {message && <p className="settings-save-feedback" role="status"><CheckCircle size={15} aria-hidden="true" /><span>{message}</span></p>}
          </div>
        </>
      )}
    </section>
  );
};

export default SettingKaggle;
