import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getAuth } from "./react/config/firebase";
import { API_BASE } from "./react/config/api";
import "./chat.css";

type ChatMessage = { role: "user" | "assistant"; content: string };
type CredentialStatus = { configured: boolean; model: string; fingerprint: string };
type Model = { id: string };
const DEFAULT_CHAT_MODEL = "openrouter/openrouter/free";

const historyKey = (uid: string) => `banucv_chat_history:${uid}`;

const readHistory = (uid: string): ChatMessage[] => {
  try {
    const saved = localStorage.getItem(historyKey(uid));
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is ChatMessage =>
      item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string",
    ) : [];
  } catch {
    return [];
  }
};

const apiRequest = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
  const auth = await getAuth();
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Request failed. Please try again.");
  return body as T;
};

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (providerName: "google" | "github") => {
    setLoading(true);
    setError("");
    try {
      const auth = await getAuth();
      const provider = providerName === "google" ? new GoogleAuthProvider() : new GithubAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (reason) {
      const code = typeof reason === "object" && reason !== null && "code" in reason ? String(reason.code) : "";
      if (!code.includes("popup-closed") && !code.includes("cancelled-popup")) setError("Sign-in could not be completed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">B</div>
        <p className="eyebrow">BANU CV</p>
        <h1 id="login-title">A quieter way to chat</h1>
        <p className="muted">Sign in to use your private AI credentials and continue your conversations.</p>
        <div className="auth-actions">
          <button className="button button-primary" onClick={() => void login("google")} disabled={loading}>Continue with Google</button>
          <button className="button button-secondary" onClick={() => void login("github")} disabled={loading}>Continue with GitHub</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="fine-print">Your credentials are stored securely for your account.</p>
      </section>
    </main>
  );
};

const Settings = ({ status, model, setModel, apiKey, setApiKey, onSave, onDelete, saving }: {
  status: CredentialStatus | null; model: string; setModel: (value: string) => void; apiKey: string; setApiKey: (value: string) => void;
  onSave: () => void; onDelete: () => void; saving: boolean;
}) => (
  <section className="settings-panel" aria-labelledby="settings-title">
    <div className="settings-heading"><div><p className="eyebrow">SETUP</p><h2 id="settings-title">Your chat credentials</h2></div><span className={`status-dot ${status?.configured ? "active" : ""}`}>{status?.configured ? "Configured" : "Not configured"}</span></div>
    <p className="muted">Add an API key for your account. It is encrypted by the service and never shared with other users.</p>
    <label className="field-label" htmlFor="model">Model</label>
    <input id="model" className="text-input" value={model} onChange={(event) => setModel(event.target.value)} placeholder="model-name" autoComplete="off" />
    <label className="field-label" htmlFor="api-key">API key {status?.configured && <span className="field-hint">({status.fingerprint})</span>}</label>
    <input id="api-key" className="text-input" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={status?.configured ? "Enter a new key to replace it" : "Paste your API key"} autoComplete="off" />
    <div className="settings-actions"><button className="button button-primary" onClick={onSave} disabled={saving || !model.trim() || !apiKey.trim()}>{saving ? "Saving…" : "Save credentials"}</button>{status?.configured && <button className="button button-danger" onClick={onDelete} disabled={saving}>Remove credentials</button>}</div>
  </section>
);

const Chat = ({ user, onLogout }: { user: User; onLogout: () => void }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => readHistory(user.uid));
  const [input, setInput] = useState("");
  const [model, setModel] = useState(DEFAULT_CHAT_MODEL);
  const [models, setModels] = useState<Model[]>([]);
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(historyKey(user.uid), JSON.stringify(messages)); endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, user.uid]);
  useEffect(() => {
    void (async () => {
      try {
        const credentials = await apiRequest<CredentialStatus>("/chat/credentials");
        setStatus(credentials);
        if (!credentials.configured) setSetupOpen(true);
        let availableModels: Model[] = [];
        try {
          const catalog = await apiRequest<{ configured: boolean; models: Model[] }>("/chat/models");
          availableModels = catalog.models ?? [];
          setModels(availableModels);
        } catch {
          setModels([]);
        }
        const savedModel = credentials.model || DEFAULT_CHAT_MODEL;
        setModel(availableModels.some((item) => item.id === savedModel) ? savedModel : availableModels[0]?.id || savedModel);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load credentials.");
      }
    })();
  }, []);

  const selectedModel = useMemo(() => model || models[0]?.id || "", [model, models]);
  const saveCredentials = async () => {
    setSaving(true);
    setError("");
    try {
      const data = await apiRequest<{ success: true; model: string; fingerprint: string }>("/chat/credentials", { method: "PUT", body: JSON.stringify({ api_key: apiKey, model: selectedModel }) });
      setStatus({ configured: true, model: data.model, fingerprint: data.fingerprint });
      setModel(data.model);
      setApiKey("");
      setSetupOpen(false);
      try {
        const catalog = await apiRequest<{ models?: Model[] }>("/chat/models");
        const availableModels = catalog.models ?? [];
        setModels(availableModels);
        if (availableModels.length && !availableModels.some((item) => item.id === data.model)) setModel(availableModels[0].id);
      } catch {
        setModels([]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save credentials.");
    } finally {
      setSaving(false);
    }
  };
  const deleteCredentials = async () => { setSaving(true); try { await apiRequest<{ success: true }>("/chat/credentials", { method: "DELETE" }); setStatus({ configured: false, model: "", fingerprint: "" }); setApiKey(""); setSetupOpen(true); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove credentials."); } finally { setSaving(false); } };
  const sendMessage = async () => {
    const content = input.trim();
    if (!content || busy || !selectedModel) return;
    const next = [...messages, { role: "user" as const, content }]; setMessages(next); setInput(""); setBusy(true); setError("");
    try { const response = await apiRequest<{ choices?: Array<{ message?: { content?: string } }> }>("/chat/completions", { method: "POST", body: JSON.stringify({ model: selectedModel, messages: next, stream: false }) }); const answer = response.choices?.[0]?.message?.content?.trim() || "I did not receive a response."; setMessages([...next, { role: "assistant", content: answer }]); } catch (reason) { setMessages(next); setError(reason instanceof Error ? reason.message : "The message could not be sent."); } finally { setBusy(false); }
  };
  const clearChat = () => { setMessages([]); localStorage.removeItem(historyKey(user.uid)); };

  return <main className="chat-page">
    <header className="topbar"><div className="topbar-brand"><div className="brand-mark small" aria-hidden="true">B</div><span>Banu CV</span></div><div className="topbar-actions"><span className="user-name">{user.displayName || user.email || "Signed in"}</span><button className="text-button" onClick={() => setSetupOpen((open) => !open)}>{setupOpen ? "Close setup" : "Settings"}</button><button className="text-button" onClick={onLogout}>Sign out</button></div></header>
    <div className="chat-layout"><section className="chat-shell" aria-label="Chat"><div className="chat-header"><div><p className="eyebrow">PRIVATE CHAT</p><h1>What would you like to explore?</h1></div><button className="text-button" onClick={clearChat} disabled={!messages.length}>Clear chat</button></div><div className="messages" aria-live="polite">{messages.length === 0 && <div className="empty-state"><div className="empty-icon" aria-hidden="true">✦</div><h2>Start a conversation</h2><p>Ask a question, brainstorm an idea, or work through something step by step.</p></div>}{messages.map((message, index) => <article className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="message-label">{message.role === "user" ? "You" : "Assistant"}</div><div className="message-content">{message.role === "assistant" ? <ReactMarkdown>{message.content}</ReactMarkdown> : <p>{message.content}</p>}</div></article>)}{busy && <div className="message assistant"><div className="message-label">Assistant</div><div className="typing" aria-label="Assistant is typing"><i /><i /><i /></div></div>}<div ref={endRef} /></div>{error && <p className="inline-error" role="alert">{error}</p>}<form className="composer" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={status?.configured ? "Write a message…" : "Set up credentials to start chatting"} disabled={busy || !status?.configured} rows={1} aria-label="Message" /><button className="send-button" type="submit" disabled={busy || !input.trim() || !status?.configured} aria-label="Send message">↑</button><div className="composer-footer"><label htmlFor="model-select">Model</label><select id="model-select" value={selectedModel} onChange={(event) => setModel(event.target.value)} disabled={!models.length}>{models.length ? models.map((item) => <option key={item.id} value={item.id}>{item.id}</option>) : <option>{selectedModel || "No models available"}</option>}</select><span>Enter to send · Shift + Enter for a new line</span></div></form></section>{setupOpen && <Settings status={status} model={selectedModel} setModel={setModel} apiKey={apiKey} setApiKey={setApiKey} onSave={() => void saveCredentials()} onDelete={() => void deleteCredentials()} saving={saving} />}</div>
  </main>;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { let unsubscribe = () => undefined; void getAuth().then((auth) => { unsubscribe = onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setReady(true); }); }).catch(() => setReady(true)); return () => unsubscribe(); }, []);
  if (!ready) return <main className="loading-page"><div className="spinner" aria-label="Loading" /></main>;
  return user ? <Chat user={user} onLogout={() => void getAuth().then((auth) => signOut(auth))} /> : <Login />;
}
