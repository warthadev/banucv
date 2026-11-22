import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { AlertCircle, Check, CheckCircle, Copy, Eye, EyeOff, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { getAuth } from "@config/firebase";
import { loadOpenRouterCredentials, saveOpenRouterCredentials, type OpenRouterCredentials } from "@config/routerhelper";
import useAgentModels, { ROUTER_CREDENTIAL_UPDATED_EVENT } from "@hook/useagentmodels";
import AgentModelCatalog from "./agentmodelcatalog";
import type { SettingsSaveResult } from "./settingssave";

interface SettingAgentProps {
  onLoadingChange?: (isLoading: boolean) => void;
}

const ignoreLoadingChange = () => {};

const SettingAgent: React.FC<SettingAgentProps> = ({ onLoadingChange = ignoreLoadingChange }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [credentials, setCredentials] = useState<OpenRouterCredentials | null>(null);
  const { routerModels: models, isLoading: modelsLoading, catalogError: modelCatalogError } = useAgentModels();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"copied" | "error" | null>(null);
  const [saveResult, setSaveResult] = useState<SettingsSaveResult | null>(null);
  const requestIdRef = useRef(0);

  useLayoutEffect(() => {
    onLoadingChange(!authReady || loading || modelsLoading);
  }, [authReady, loading, modelsLoading, onLoadingChange]);

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
        setCurrentUser(user);
        setAuthReady(true);
        setApiKey("");
        setSaveResult(null);
        setShowKey(false);
        setCopyStatus(null);
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

  const saveOpenRouterSettings = async (): Promise<SettingsSaveResult> => {
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
        status: submittedNewKey ? "saved" : "unchanged",
        message: submittedNewKey ? "API key updated." : "No changes to save.",
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

  const handleSave = async () => {
    setSaveResult(null);
    setSaveResult(await saveOpenRouterSettings());
  };

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

  if (!authReady || loading) {
    return (
      <section className="stack-item settings-service-section setting-agent-card global-card global-section global-card--padded" aria-label="AI Agent · OpenRouter" aria-busy="true">
        <div className="setting-agent-loading global-inline-row global-inline-row--gap-8" role="status" aria-label="Loading OpenRouter settings">
          <LoaderCircle size={18} className="setting-agent-spinner" />
        </div>
      </section>
    );
  }

  return (
    <section className="stack-item settings-service-section setting-agent-card global-card global-section global-card--padded" aria-label="AI Agent · OpenRouter">
      {!currentUser ? (
        <p className="setting-agent-note" role="status">Sign in to your Firebase account to manage its OpenRouter settings.</p>
      ) : (
        <>
          {settingsError && (
            <p className="setting-agent-error global-inline-row global-inline-row--gap-8" role="alert"><AlertCircle size={15} /> OpenRouter settings warning: {settingsError}</p>
          )}
          {credentials && (
            <div className="su-profile-card setting-agent-safe-status global-inline-row global-inline-row--gap-8">
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
                  setSaveResult(null);
                }}
                placeholder={credentials ? "Enter a key to replace the saved key" : "Paste this account's OpenRouter API key"}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                required={!credentials}
              />
              <button
                className="setting-agent-reveal-btn global-icon-button"
                type="button"
                onClick={() => setShowKey((current) => !current)}
                aria-label={showKey ? "Hide saved OpenRouter API key" : "Reveal saved OpenRouter API key"}
                aria-pressed={showKey}
                disabled={!apiKey}
              >
                {showKey ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
              <button
                className="su-copy-btn setting-agent-copy-btn global-icon-button"
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
          </div>

          <div className="settings-section-actions">
            <button
              className="setting-agent-primary settings-section-save-btn"
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <Save size={16} aria-hidden="true" />}
              {saving ? "Saving…" : "Save"}
            </button>
            {saveResult && (
              <p
                className={`settings-save-feedback${saveResult.status === "error" ? " is-error" : ""}`}
                role={saveResult.status === "error" ? "alert" : "status"}
                aria-live={saveResult.status === "error" ? "assertive" : "polite"}
              >
                {saveResult.status === "error"
                  ? <AlertCircle size={15} aria-hidden="true" />
                  : <CheckCircle size={15} aria-hidden="true" />}
                <span>{saveResult.message}</span>
              </p>
            )}
          </div>

          {credentials && <AgentModelCatalog models={models} isLoading={modelsLoading} error={modelCatalogError} />}
        </>
      )}
    </section>
  );
};

export default SettingAgent;
