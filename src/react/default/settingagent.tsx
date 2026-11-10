import React, { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { AlertCircle, CheckCircle, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { getAuth } from "@config/firebase";
import { clearRouterCredentials, loadRouterCredentials, loadRouterModelCatalog, saveRouterCredentials, type RouterCredentials } from "@config/routerhelper";
import { ROUTER_CREDENTIAL_UPDATED_EVENT } from "@hook/useagentmodels";

const SettingAgent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [credentials, setCredentials] = useState<RouterCredentials | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async (user: User | null) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setCatalogError(null);
    if (!user) {
      setCredentials(null);
      setModels([]);
      setLoading(false);
      return;
    }
    try {
      const saved = await loadRouterCredentials();
      if (requestId !== requestIdRef.current) return;
      setCredentials(saved);
      if (!saved) {
        setModels([]);
        return;
      }
      try {
        const availableModels = await loadRouterModelCatalog();
        if (requestId === requestIdRef.current) setModels(availableModels);
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setModels([]);
          setCatalogError(error instanceof Error ? error.message : "Katalog model tidak dapat dimuat.");
        }
      }
    } catch (error) {
      if (requestId === requestIdRef.current) {
        setCredentials(null);
        setModels([]);
        setCatalogError(error instanceof Error ? error.message : "Status kunci tidak dapat dimuat.");
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
        void refresh(user);
      });
    }).catch((error: unknown) => {
      setAuthReady(true);
      setLoading(false);
      setCatalogError(error instanceof Error ? error.message : "Autentikasi Firebase tidak tersedia.");
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
      setMessage({ type: "success", text: "Kunci 9Router tersimpan aman untuk akun ini." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Kunci 9Router gagal disimpan." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUser || deleting) return;
    if (!window.confirm("Hapus kunci 9Router dari akun ini? Anda perlu memasukkannya lagi untuk memakai AI Agent.")) return;
    setDeleting(true);
    setMessage(null);
    try {
      await clearRouterCredentials();
      setApiKey("");
      await refresh(currentUser);
      window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
      setMessage({ type: "success", text: "Kunci 9Router telah dihapus dari akun ini." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Kunci 9Router gagal dihapus." });
    } finally {
      setDeleting(false);
    }
  };

  if (!authReady || loading) {
    return (
      <section className="stack-item setting-agent-card" aria-busy="true">
        <div className="setting-agent-loading"><LoaderCircle size={18} className="setting-agent-spinner" /> Memuat pengaturan 9Router…</div>
      </section>
    );
  }

  return (
    <section className="stack-item setting-agent-card" aria-labelledby="setting-agent-title">
      <div className="section-header">
        <KeyRound size={19} aria-hidden="true" />
        <span className="section-label" id="setting-agent-title">AI Agent · 9Router</span>
        {credentials && <span className="setting-agent-status"><CheckCircle size={14} /> Terhubung</span>}
      </div>
      <p className="setting-agent-description">
        Setiap akun Firebase memakai kunci dan katalog modelnya sendiri. Kunci disimpan terenkripsi di server; halaman ini hanya menampilkan status aman, bukan nilai kuncinya.
      </p>

      {!currentUser ? (
        <p className="setting-agent-note" role="status">Masuk ke akun Firebase untuk mengatur kunci 9Router.</p>
      ) : (
        <>
          <p className="setting-agent-account">Akun aktif: <strong>{currentUser.email || currentUser.uid}</strong></p>
          {catalogError && !credentials && (
            <p className="setting-agent-error" role="alert"><AlertCircle size={15} /> Status kunci tidak dapat dimuat: {catalogError}</p>
          )}
          {credentials && (
            <div className="setting-agent-safe-status">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                Kunci tersimpan untuk akun ini
                {credentials.fingerprint ? <small>Sidik jari aman: {credentials.fingerprint}</small> : null}
              </span>
            </div>
          )}

          <form className="setting-agent-form" onSubmit={handleSave}>
            <label className="setting-agent-label" htmlFor="setting-9router-key">
              {credentials ? "Ganti kunci API 9Router" : "Kunci API 9Router"}
            </label>
            <input
              id="setting-9router-key"
              className="setting-agent-input"
              type="password"
              name="nine-router-api-key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={credentials ? "Tempel kunci baru untuk mengganti" : "Tempel kunci API 9Router"}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              required
            />
            <div className="setting-agent-actions">
              <button className="setting-agent-primary" type="submit" disabled={saving || !apiKey.trim()}>
                {saving ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <ShieldCheck size={16} />}
                {saving ? "Menyimpan…" : credentials ? "Simpan kunci baru" : "Simpan kunci"}
              </button>
              <button className="setting-agent-secondary" type="button" onClick={() => void refresh(currentUser)} disabled={loading}>
                <RefreshCw size={15} className={loading ? "setting-agent-spinner" : ""} /> Segarkan status
              </button>
              {credentials && (
                <button className="setting-agent-danger" type="button" onClick={() => void handleDelete()} disabled={deleting}>
                  {deleting ? <LoaderCircle size={15} className="setting-agent-spinner" /> : <Trash2 size={15} />}
                  Hapus kunci
                </button>
              )}
            </div>
          </form>

          {credentials && (
            <div className="setting-agent-catalog" role="status">
              <strong>{models.length} model tersedia</strong>
              {models.length === 0 && !catalogError && <span>Katalog akun ini kosong; model global tidak ditampilkan.</span>}
              {catalogError && <span className="setting-agent-error-text">Katalog model gagal dimuat: {catalogError}</span>}
            </div>
          )}
          {message && (
            <p className={message.type === "success" ? "setting-agent-success" : "setting-agent-error"} role="status">
              {message.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              {message.text}
            </p>
          )}
          <p className="setting-agent-footnote">Kunci tidak disimpan di localStorage atau ditampilkan kembali. Jika kunci ditolak 9Router, masukkan kunci yang valid di sini.</p>
        </>
      )}
    </section>
  );
};

export default SettingAgent;
