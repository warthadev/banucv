import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Download, FileText, Folder, PackagePlus, RefreshCw, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { getAuth } from "@config/firebase";
import {
  deleteWorkspaceFile,
  getWorkspaceInfo,
  listAdminPackageRequests,
  listLocalModelInventory,
  listWorkspaceFiles,
  listWorkspacePackages,
  moveWorkspaceFile,
  readWorkspaceFile,
  requestWorkspacePackage,
  reviewAdminPackageRequest,
  updateLocalModelInventory,
  writeWorkspaceFile,
  type PackageRecord,
  type WorkspaceEntry,
  type WorkspaceFile,
  type WorkspaceInfo,
} from "@config/agentworkspace";

const panelStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 1300,
  right: 14,
  bottom: 82,
  width: "min(620px, calc(100vw - 28px))",
  maxHeight: "min(76vh, 760px)",
  display: "flex",
  flexDirection: "column",
  color: "var(--text, #e8eaf0)",
  background: "var(--surface, #171a21)",
  border: "1px solid var(--border, #373b45)",
  borderRadius: 14,
  boxShadow: "0 14px 48px rgba(0,0,0,.38)",
  overflow: "hidden",
};

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 34,
  padding: "6px 10px",
  color: "inherit",
  background: "var(--surface-raised, rgba(255,255,255,.07))",
  border: "1px solid var(--border, #373b45)",
  borderRadius: 8,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "8px 10px",
  color: "inherit",
  background: "var(--background, #101217)",
  border: "1px solid var(--border, #373b45)",
  borderRadius: 7,
};

const formatSize = (size: number): string => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const packageStatus = (status: string): string => {
  if (status === "available") return "Tersedia di image bersama";
  if (status === "approved_for_image_build") return "Disetujui untuk alur build image; belum terpasang";
  if (status === "rejected") return "Ditolak";
  return "Menunggu review owner";
};

const downloadWorkspaceFile = (file: WorkspaceFile) => {
  const raw = window.atob(file.dataBase64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  const blob = new Blob([bytes.buffer], { type: file.mimeType || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
};

const AgentWorkspace: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [path, setPath] = useState(".");
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [selectedFileOwnerUid, setSelectedFileOwnerUid] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [moveDestination, setMoveDestination] = useState("");
  const [tab, setTab] = useState<"files" | "packages" | "admin">("files");
  const [packageName, setPackageName] = useState("");
  const [packageRequests, setPackageRequests] = useState<PackageRecord[]>([]);
  const [sharedPackages, setSharedPackages] = useState<string[]>([]);
  const [adminRequests, setAdminRequests] = useState<PackageRecord[]>([]);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [localModelName, setLocalModelName] = useState("");
  const activeUidRef = useRef<string | null>(null);
  const visibleTabs: Array<"files" | "packages" | "admin"> = info?.owner ? ["files", "packages", "admin"] : ["files", "packages"];

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    void getAuth().then((auth) => {
      if (!active) return;
      unsubscribe = onAuthStateChanged(auth, (user) => {
        const nextUid = user?.uid || null;
        if (activeUidRef.current === nextUid) return;
        activeUidRef.current = nextUid;
        setOpen(false);
        setInfo(null);
        setPath(".");
        setEntries([]);
        setSelectedFile(null);
        setSelectedFileOwnerUid(null);
        setDraft("");
        setMoveDestination("");
        setPackageName("");
        setPackageRequests([]);
        setSharedPackages([]);
        setAdminRequests([]);
        setLocalModels([]);
        setTab("files");
        setError("");
        setNotice("");
      });
    }).catch(() => undefined);
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const loadWorkspace = useCallback(async (folder = path) => {
    setBusy(true);
    setError("");
    try {
      const expectedUid = activeUidRef.current;
      if (!expectedUid) throw new Error("Sign in to access this workspace");
      const currentInfo = await getWorkspaceInfo(expectedUid);
      if (activeUidRef.current !== expectedUid || currentInfo.uid !== expectedUid) return;
      const listing = await listWorkspaceFiles(folder, expectedUid);
      const packages = await listWorkspacePackages(expectedUid);
      if (activeUidRef.current !== expectedUid) return;
      setInfo(currentInfo);
      setEntries(listing.entries);
      setPath(listing.path);
      setPackageRequests(packages.requests || []);
      setSharedPackages(packages.sharedPackages || []);
      if (currentInfo.owner) {
        const [adminData, modelData] = await Promise.all([listAdminPackageRequests(expectedUid), listLocalModelInventory(expectedUid)]);
        if (activeUidRef.current !== expectedUid) return;
        setAdminRequests(adminData.requests || []);
        setLocalModels(modelData.models || []);
      } else {
        setAdminRequests([]);
        setLocalModels([]);
        if (tab === "admin") setTab("files");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setBusy(false);
    }
  }, [path, tab]);

  const openEntry = async (entry: WorkspaceEntry) => {
    if (entry.type === "directory") {
      setSelectedFile(null);
      setSelectedFileOwnerUid(null);
      setDraft("");
      await loadWorkspace(entry.path);
      return;
    }
    if (entry.type !== "file") return;
    setBusy(true);
    setError("");
    try {
      const expectedUid = activeUidRef.current;
      if (!expectedUid) return;
      const file = await readWorkspaceFile(entry.path, expectedUid);
      if (activeUidRef.current !== expectedUid) return;
      setSelectedFile(file);
      setSelectedFileOwnerUid(expectedUid);
      setDraft(file.text || "");
      setMoveDestination("");
      setNotice(file.isText ? "File dibuka untuk diedit atau diunduh." : "File biner siap diunduh; editor teks tidak tersedia.");
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : String(readError));
    } finally {
      setBusy(false);
    }
  };

  const saveFile = async () => {
    if (!selectedFile || !selectedFile.isText || !selectedFileOwnerUid || selectedFileOwnerUid !== activeUidRef.current) return;
    setBusy(true);
    setError("");
    try {
      await writeWorkspaceFile(selectedFile.path, draft, selectedFileOwnerUid);
      if (activeUidRef.current !== selectedFileOwnerUid) return;
      setNotice(`Disimpan: ${selectedFile.path}`);
      await loadWorkspace(path);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setBusy(false);
    }
  };

  const moveFile = async () => {
    if (!selectedFile || !selectedFileOwnerUid || selectedFileOwnerUid !== activeUidRef.current || !moveDestination.trim()) return;
    const destination = moveDestination.trim();
    if (!window.confirm(`Pindahkan ${selectedFile.path} ke ${destination}?`)) return;
    setBusy(true);
    setError("");
    try {
      await moveWorkspaceFile(selectedFile.path, destination, selectedFileOwnerUid);
      if (activeUidRef.current !== selectedFileOwnerUid) return;
      setSelectedFile(null);
      setSelectedFileOwnerUid(null);
      setDraft("");
      setNotice(`Dipindahkan ke ${destination}`);
      await loadWorkspace(path);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : String(moveError));
    } finally {
      setBusy(false);
    }
  };

  const deleteFile = async () => {
    if (!selectedFile || !selectedFileOwnerUid || selectedFileOwnerUid !== activeUidRef.current) return;
    if (!window.confirm(`Hapus ${selectedFile.path}? Penghapusan tidak dapat dibatalkan.`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteWorkspaceFile(selectedFile.path, selectedFileOwnerUid);
      if (activeUidRef.current !== selectedFileOwnerUid) return;
      setSelectedFile(null);
      setSelectedFileOwnerUid(null);
      setDraft("");
      setNotice(`Dihapus: ${selectedFile.path}`);
      await loadWorkspace(path);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setBusy(false);
    }
  };

  const submitPackage = async () => {
    if (!packageName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const expectedUid = activeUidRef.current;
      if (!expectedUid) throw new Error("Sign in to access this workspace");
      const result = await requestWorkspacePackage(packageName.trim(), expectedUid);
      if (activeUidRef.current !== expectedUid) return;
      setPackageName("");
      setNotice(`${result.request.package}: ${packageStatus(result.request.status)}`);
      const packages = await listWorkspacePackages(expectedUid);
      if (activeUidRef.current !== expectedUid) return;
      setPackageRequests(packages.requests || []);
      setSharedPackages(packages.sharedPackages || []);
    } catch (packageError) {
      setError(packageError instanceof Error ? packageError.message : String(packageError));
    } finally {
      setBusy(false);
    }
  };

  const reviewPackage = async (request: PackageRecord, decision: "approve" | "reject") => {
    const expectedUid = activeUidRef.current;
    if (!request.uid || !expectedUid || !info?.owner || info.uid !== expectedUid) return;
    setBusy(true);
    setError("");
    try {
      await reviewAdminPackageRequest(request.uid, request.id, decision, expectedUid);
      if (activeUidRef.current !== expectedUid) return;
      setNotice(decision === "approve"
        ? `${request.package} disetujui untuk proses build image bersama; image belum berubah.`
        : `${request.package} ditolak.`);
      const data = await listAdminPackageRequests(expectedUid);
      if (activeUidRef.current !== expectedUid) return;
      setAdminRequests(data.requests || []);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : String(reviewError));
    } finally {
      setBusy(false);
    }
  };

  const updateLocalModel = async (model: string, action: "add" | "remove") => {
    const expectedUid = activeUidRef.current;
    if (!expectedUid || !info?.owner || info.uid !== expectedUid) return;
    setBusy(true);
    setError("");
    try {
      const result = await updateLocalModelInventory(model, action, expectedUid);
      if (activeUidRef.current !== expectedUid) return;
      setLocalModels(result.models || []);
      setNotice(action === "add"
        ? `${model} terdaftar. Registrasi hanya berhasil jika model sudah tersedia di Ollama.`
        : `${model} dihapus dari inventaris; data model Ollama tidak dihapus.`);
      setLocalModelName("");
    } catch (modelError) {
      setError(modelError instanceof Error ? modelError.message : String(modelError));
    } finally {
      setBusy(false);
    }
  };

  const goUp = () => {
    if (path === ".") return;
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    void loadWorkspace(parts.join("/") || ".");
  };

  const close = () => {
    setOpen(false);
    setSelectedFile(null);
    setSelectedFileOwnerUid(null);
    setDraft("");
    setError("");
    setNotice("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) void loadWorkspace(".");
        }}
        title="Workspace files and packages"
        aria-label="Open workspace files and packages"
        style={buttonStyle}
      >
        <Folder size={19} />
      </button>
      {open && (
        <section style={panelStyle} aria-label="Per-user workspace">
          <header style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderBottom: "1px solid var(--border, #373b45)" }}>
            <Folder size={19} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>Workspace</strong>
              <div style={{ fontSize: 11, opacity: 0.72, overflowWrap: "anywhere" }}>
                {info?.owner ? "Owner admin" : "Folder kerja privat per akun"}{info?.uid ? ` · UID ${info.uid}` : ""}
              </div>
            </div>
            <button type="button" style={buttonStyle} onClick={() => void loadWorkspace(path)} disabled={busy} aria-label="Refresh workspace"><RefreshCw size={15} /></button>
            <button type="button" style={buttonStyle} onClick={close} aria-label="Close workspace"><X size={16} /></button>
          </header>
          <nav style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: "1px solid var(--border, #373b45)" }}>
            {visibleTabs.map((item) => (
              <button key={item} type="button" style={{ ...buttonStyle, minHeight: 30, background: tab === item ? "var(--accent, #3156d3)" : buttonStyle.background }} onClick={() => setTab(item)}>
                {item === "files" ? "Files" : item === "packages" ? "Packages" : "Owner admin"}
              </button>
            ))}
          </nav>
          {error && <div role="alert" style={{ padding: "8px 12px", color: "#ff8989", fontSize: 12 }}>{error}</div>}
          {notice && <div role="status" style={{ padding: "8px 12px", color: "var(--text-muted, #aaa)", fontSize: 12 }}>{notice}</div>}
          <div style={{ padding: 12, overflow: "auto", minHeight: 150 }}>
            {tab === "files" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <button type="button" style={buttonStyle} onClick={goUp} disabled={path === "." || busy} aria-label="Parent folder"><ArrowUp size={15} /></button>
                  <code style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{path}</code>
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  {entries.map((entry) => (
                    <button key={entry.path} type="button" onClick={() => void openEntry(entry)} disabled={busy || entry.type === "symlink" || entry.type === "other"} style={{ display: "flex", textAlign: "left", alignItems: "center", gap: 9, padding: "8px 9px", color: "inherit", background: selectedFile?.path === entry.path ? "var(--surface-raised, rgba(255,255,255,.09))" : "transparent", border: "1px solid var(--border, #373b45)", borderRadius: 7, cursor: "pointer" }}>
                      {entry.type === "directory" ? <Folder size={16} /> : <FileText size={16} />}
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
                      <small style={{ opacity: 0.65 }}>{entry.type === "directory" ? "folder" : formatSize(entry.size)}</small>
                    </button>
                  ))}
                  {!entries.length && <div style={{ padding: 10, opacity: 0.7 }}>Folder kosong.</div>}
                </div>
                {selectedFile && (
                  <div style={{ display: "grid", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border, #373b45)" }}>
                    <strong style={{ overflowWrap: "anywhere" }}>{selectedFile.path}</strong>
                    {selectedFile.isText ? (
                      <textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="File content" style={{ ...inputStyle, minHeight: 180, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
                    ) : <div style={{ fontSize: 12, opacity: 0.75 }}>File biner · {formatSize(selectedFile.size)}</div>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selectedFile.isText && <button type="button" style={buttonStyle} onClick={() => void saveFile()} disabled={busy}><Save size={15} /> Simpan</button>}
                      <button type="button" style={buttonStyle} onClick={() => downloadWorkspaceFile(selectedFile)}><Download size={15} /> Unduh</button>
                      <button type="button" style={buttonStyle} onClick={() => void deleteFile()} disabled={busy}><Trash2 size={15} /> Hapus</button>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input value={moveDestination} onChange={(event) => setMoveDestination(event.target.value)} placeholder="path tujuan baru" style={inputStyle} />
                      <button type="button" style={buttonStyle} onClick={() => void moveFile()} disabled={busy || !moveDestination.trim()}>Pindah</button>
                    </div>
                  </div>
                )}
              </>
            )}
            {tab === "packages" && (
              <div style={{ display: "grid", gap: 10 }}>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.82 }}>Paket yang sudah ada di image bersama dicatat sebagai tersedia. Paket baru hanya masuk antrean review/build image; pengguna tidak memasang paket langsung di host atau Ollama.</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={packageName} onChange={(event) => setPackageName(event.target.value)} placeholder="nama paket atau versi" style={inputStyle} />
                  <button type="button" style={buttonStyle} onClick={() => void submitPackage()} disabled={busy || !packageName.trim()}><PackagePlus size={15} /> Minta</button>
                </div>
                {packageRequests.map((request) => <div key={request.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 9px", border: "1px solid var(--border, #373b45)", borderRadius: 7 }}><strong>{request.package}</strong><span style={{ fontSize: 12, opacity: 0.72 }}>{packageStatus(request.status)}</span></div>)}
                {!packageRequests.length && <div style={{ opacity: 0.7 }}>Belum ada permintaan paket.</div>}
                {!!sharedPackages.length && <small style={{ opacity: 0.6 }}>Indeks paket image tersedia: {sharedPackages.join(", ")}</small>}
              </div>
            )}
            {tab === "admin" && info?.owner && (
              <div style={{ display: "grid", gap: 18 }}>
                <section style={{ display: "grid", gap: 8 }}>
                  <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7 }}><ShieldCheck size={16} /> Permintaan paket bersama</h4>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>Persetujuan hanya menandai paket untuk workflow build image. Ini tidak memasang paket dan tidak mengubah image aktif.</p>
                  {adminRequests.map((request) => (
                    <div key={`${request.uid}-${request.id}`} style={{ display: "grid", gap: 6, padding: 8, border: "1px solid var(--border, #373b45)", borderRadius: 7 }}>
                      <div><strong>{request.package}</strong><small style={{ display: "block", opacity: 0.65 }}>UID {request.uid} · {packageStatus(request.status)}</small></div>
                      {request.status === "pending" && <div style={{ display: "flex", gap: 6 }}><button type="button" style={buttonStyle} onClick={() => void reviewPackage(request, "approve")} disabled={busy}><Check size={14} /> Setujui untuk build</button><button type="button" style={buttonStyle} onClick={() => void reviewPackage(request, "reject")} disabled={busy}>Tolak</button></div>}
                    </div>
                  ))}
                  {!adminRequests.length && <div style={{ opacity: 0.7 }}>Tidak ada permintaan paket.</div>}
                </section>
                <section style={{ display: "grid", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border, #373b45)" }}>
                  <h4 style={{ margin: 0 }}>Inventaris model lokal global</h4>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>Hanya owner dapat mendaftarkan model yang sudah terpasang di Ollama. Tidak ada tombol pull/install; Mimo yang ada tetap tersedia bagi semua akun.</p>
                  <div style={{ display: "flex", gap: 6 }}><input value={localModelName} onChange={(event) => setLocalModelName(event.target.value)} placeholder="model ID Ollama yang sudah ada" style={inputStyle} /><button type="button" style={buttonStyle} onClick={() => void updateLocalModel(localModelName.trim(), "add")} disabled={busy || !localModelName.trim()}>Daftarkan</button></div>
                  {localModels.map((model) => <div key={model} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 9px", border: "1px solid var(--border, #373b45)", borderRadius: 7 }}><code>{model}</code><button type="button" style={buttonStyle} onClick={() => void updateLocalModel(model, "remove")} disabled={busy || model === "mimo-v2.6:latest"} title={model === "mimo-v2.6:latest" ? "Model Mimo default tetap tersedia" : "Remove from local model inventory"}><Trash2 size={14} /> Hapus dari daftar</button></div>)}
                </section>
              </div>
            )}
          </div>
          {busy && <div style={{ padding: "7px 12px", fontSize: 11, opacity: 0.65 }}>Memproses…</div>}
        </section>
      )}
    </>
  );
};

export default AgentWorkspace;
