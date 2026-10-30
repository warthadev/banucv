// src/react/feature/cloudmodalhfsrch.tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Loader2, User, Folder, Lock, ChevronRight, AlertCircle } from "lucide-react";
import { modalVariants, overlayVariants } from "@animation/githubeditor";

export interface HFSearchRepo {
  id: string;
  name: string;
  full_name: string;
  type: "dataset" | "model" | "space";
  private: boolean;
  likes?: number;
  downloads?: number;
}

export interface HFSearchUser {
  id: string;
  username: string;
  fullname?: string;
  avatarUrl?: string;
  isOrg?: boolean;
}

interface CloudModalHFSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRepo: (repo: HFSearchRepo) => void;
  token?: string;
}

const HF_API_BASE = "https://huggingface.co/api";

const REPO_TYPE_ORDER: Record<string, number> = {
  dataset: 0,
  model: 1,
  space: 2,
};

const sanitizeText = (text: string | undefined | null): string => {
  if (!text) return "";
  const el = document.createElement("div");
  el.textContent = text;
  return el.textContent || "";
};

const buildAvatarUrl = (name: string, avatar?: string): string => {
  if (avatar && avatar.length > 0) return avatar;
  return `https://huggingface.co/api/avatars/${encodeURIComponent(name)}`;
};

const buildHeaders = (token?: string): HeadersInit => {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token && token.trim().length > 0) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
};

export const CloudModalHFSearch: React.FC<CloudModalHFSearchProps> = ({
  isOpen,
  onClose,
  onSelectRepo,
  token,
}) => {
  const [mode, setMode] = useState<"users" | "repos">("users");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<HFSearchUser[]>([]);
  const [repos, setRepos] = useState<HFSearchRepo[]>([]);
  const [selectedUser, setSelectedUser] = useState<HFSearchUser | null>(null);
  const [userRepos, setUserRepos] = useState<HFSearchRepo[]>([]);
  const [loadingUserRepos, setLoadingUserRepos] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resetState = useCallback(() => {
    setMode("users");
    setQuery("");
    setLoading(false);
    setError(null);
    setUsers([]);
    setRepos([]);
    setSelectedUser(null);
    setUserRepos([]);
    setLoadingUserRepos(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, resetState]);

  const searchUsers = useCallback(async (q: string, signal: AbortSignal) => {
    const safeFetch = async (url: string): Promise<any[]> => {
      try {
        const res = await fetch(url, { signal, headers: buildHeaders(token), cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : [];
      } catch {
        return [];
      }
    };

    const [datasets, models, spaces] = await Promise.all([
      safeFetch(`${HF_API_BASE}/datasets?search=${encodeURIComponent(q)}&limit=30`),
      safeFetch(`${HF_API_BASE}/models?search=${encodeURIComponent(q)}&limit=30`),
      safeFetch(`${HF_API_BASE}/spaces?search=${encodeURIComponent(q)}&limit=20`),
    ]);

    const all = [...datasets, ...models, ...spaces];
    const seen = new Map<string, HFSearchUser>();

    for (const item of all) {
      const id = item.id || item.modelId || "";
      if (!id) continue;
      const owner = id.split("/")[0];
      if (!owner) continue;
      if (seen.has(owner)) continue;
      seen.set(owner, {
        id: owner,
        username: owner,
        fullname: "",
        avatarUrl: buildAvatarUrl(owner),
        isOrg: false,
      });
    }

    return Array.from(seen.values()).slice(0, 40);
  }, [token]);

  const searchRepos = useCallback(async (q: string, signal: AbortSignal) => {
    const safeFetch = async (url: string): Promise<any[]> => {
      try {
        const res = await fetch(url, { signal, headers: buildHeaders(token), cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : [];
      } catch {
        return [];
      }
    };

    const [datasets, models, spaces] = await Promise.all([
      safeFetch(`${HF_API_BASE}/datasets?search=${encodeURIComponent(q)}&limit=15&sort=downloads&direction=-1`),
      safeFetch(`${HF_API_BASE}/models?search=${encodeURIComponent(q)}&limit=15&sort=downloads&direction=-1`),
      safeFetch(`${HF_API_BASE}/spaces?search=${encodeURIComponent(q)}&limit=10&sort=likes&direction=-1`),
    ]);

    const merged: HFSearchRepo[] = [];
    const push = (arr: any[], type: "dataset" | "model" | "space") => {
      for (const item of arr) {
        const id = item.id || item.modelId || "";
        if (!id) continue;
        merged.push({
          id,
          name: id.split("/")[1] || id,
          full_name: id,
          type,
          private: !!item.private,
          likes: item.likes || 0,
          downloads: item.downloads || 0,
        });
      }
    };
    push(datasets, "dataset");
    push(models, "model");
    push(spaces, "space");

    merged.sort((a, b) => {
      const t = (REPO_TYPE_ORDER[a.type] ?? 99) - (REPO_TYPE_ORDER[b.type] ?? 99);
      if (t !== 0) return t;
      return (b.downloads || 0) - (a.downloads || 0);
    });

    return merged.slice(0, 40);
  }, [token]);

  const listUserRepos = useCallback(async (username: string, signal: AbortSignal) => {
    const safeFetch = async (url: string): Promise<any[]> => {
      try {
        const res = await fetch(url, { signal, headers: buildHeaders(token), cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : [];
      } catch {
        return [];
      }
    };

    const [datasets, models, spaces] = await Promise.all([
      safeFetch(`${HF_API_BASE}/datasets?author=${encodeURIComponent(username)}&limit=100`),
      safeFetch(`${HF_API_BASE}/models?author=${encodeURIComponent(username)}&limit=100`),
      safeFetch(`${HF_API_BASE}/spaces?author=${encodeURIComponent(username)}&limit=100`),
    ]);

    const merged: HFSearchRepo[] = [];
    const push = (arr: any[], type: "dataset" | "model" | "space") => {
      for (const item of arr) {
        const id = item.id || item.modelId || "";
        if (!id) continue;
        merged.push({
          id,
          name: id.split("/")[1] || id,
          full_name: id,
          type,
          private: !!item.private,
          likes: item.likes || 0,
          downloads: item.downloads || 0,
        });
      }
    };
    push(datasets, "dataset");
    push(models, "model");
    push(spaces, "space");

    merged.sort((a, b) => {
      const t = (REPO_TYPE_ORDER[a.type] ?? 99) - (REPO_TYPE_ORDER[b.type] ?? 99);
      if (t !== 0) return t;
      return a.name.localeCompare(b.name);
    });

    return merged;
  }, [token]);

  const runSearch = useCallback(async (q: string, currentMode: "users" | "repos") => {
    if (!q.trim()) {
      setUsers([]);
      setRepos([]);
      setLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      if (currentMode === "users") {
        const u = await searchUsers(q.trim(), controller.signal);
        if (!controller.signal.aborted) setUsers(u);
      } else {
        const r = await searchRepos(q.trim(), controller.signal);
        if (!controller.signal.aborted) setRepos(r);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "Search failed");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [searchUsers, searchRepos]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectedUser) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query, mode);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode, isOpen, selectedUser, runSearch]);

  const handleSelectUser = useCallback(async (user: HFSearchUser) => {
    setSelectedUser(user);
    setLoadingUserRepos(true);
    setError(null);
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const r = await listUserRepos(user.username, controller.signal);
      if (!controller.signal.aborted) setUserRepos(r);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "Failed to load repositories");
    } finally {
      if (!controller.signal.aborted) setLoadingUserRepos(false);
    }
  }, [listUserRepos]);

  const handleBackToUsers = useCallback(() => {
    setSelectedUser(null);
    setUserRepos([]);
  }, []);

  const handleSelectRepo = useCallback((repo: HFSearchRepo) => {
    onSelectRepo(repo);
    onClose();
  }, [onSelectRepo, onClose]);

  const handleClose = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    onClose();
  }, [onClose]);

  const handleQueryChange = useCallback((v: string) => {
    setQuery(v);
  }, []);

  const renderUserItem = (user: HFSearchUser) => (
    <button
      key={user.username}
      type="button"
      onClick={() => handleSelectUser(user)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 12px",
        background: "none",
        border: "none",
        borderRadius: "12px",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.12s",
        color: "var(--text)",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--primary-alpha)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: "var(--primary-alpha)",
          color: "var(--primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={sanitizeText(user.username)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <User size={18} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sanitizeText(user.username)}
        </span>
        {user.fullname && (
          <span
            style={{
              display: "block",
              fontSize: "11px",
              color: "var(--text-muted)",
              marginTop: "1px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sanitizeText(user.fullname)}
          </span>
        )}
      </div>
      <ChevronRight size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
    </button>
  );

  const renderRepoItem = (repo: HFSearchRepo) => {
    const typeLabel = repo.type === "dataset" ? "Dataset" : repo.type === "model" ? "Model" : "Space";
    return (
      <button
        key={repo.full_name}
        type="button"
        onClick={() => handleSelectRepo(repo)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 12px",
          background: "none",
          border: "none",
          borderRadius: "12px",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.12s",
          color: "var(--text)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--primary-alpha)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "var(--primary-alpha)",
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Folder size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sanitizeText(repo.full_name)}
          </span>
          <span
            style={{
              display: "block",
              fontSize: "11px",
              color: "var(--text-muted)",
              marginTop: "1px",
            }}
          >
            {typeLabel}
          </span>
        </div>
        {repo.private && <Lock size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
        <ChevronRight size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      </button>
    );
  };

  const renderContent = () => {
    if (selectedUser) {
      return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 14px 12px",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={handleBackToUsers}
              title="Back to users"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "var(--primary-alpha)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              {selectedUser.avatarUrl ? (
                <img
                  src={selectedUser.avatarUrl}
                  alt={sanitizeText(selectedUser.username)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <User size={18} />
              )}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {sanitizeText(selectedUser.username)}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {userRepos.length} repositor{userRepos.length === 1 ? "y" : "ies"}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              title="Close"
              style={{
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                borderRadius: "50%",
                color: "var(--text)",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--primary-alpha)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <X size={18} style={{ color: "var(--text)" }} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "0 10px 10px" }}>
            {loadingUserRepos ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  minHeight: "100%",
                  padding: "40px 20px",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              >
                <Loader2 size={24} className="spin" />
                <span>Loading repositories...</span>
              </div>
            ) : userRepos.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  minHeight: "100%",
                  padding: "40px 20px",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              >
                <Folder size={32} style={{ opacity: 0.5 }} />
                <span>No public repositories</span>
              </div>
            ) : (
              userRepos.map(renderRepoItem)
            )}
          </div>
        </div>
      );
    }

    const list = mode === "users" ? users : repos;
    const showEmpty = !loading && query.trim() && list.length === 0;
    const showIdle = !loading && !query.trim();

    return (
      <>
        <div style={{ padding: "0 14px 12px", flexShrink: 0 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
            <input
              ref={inputRef}
              type="text"
              className="github-modal-input"
              placeholder={mode === "users" ? "Search users..." : "Search repositories..."}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              style={{
                paddingLeft: "38px",
                paddingRight: query ? "76px" : "44px",
                width: "100%",
                height: "42px",
                margin: 0,
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => handleQueryChange("")}
                className="cva-eye-btn"
                title="Clear"
                aria-label="Clear search"
              >
                <X size={16} style={{ color: "var(--text)" }} />
              </button>
            )}
            {!query && (
              <button
                type="button"
                onClick={handleClose}
                title="Close"
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  borderRadius: "50%",
                  color: "var(--text)",
                  cursor: "pointer",
                  padding: 0,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--primary-alpha)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <X size={16} style={{ color: "var(--text)" }} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={() => setMode("users")}
              className={`cva-tab ${mode === "users" ? "active" : ""}`}
              style={{ flex: 1, padding: "8px 12px", minHeight: "36px", fontSize: "13px" }}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => setMode("repos")}
              className={`cva-tab ${mode === "repos" ? "active" : ""}`}
              style={{ flex: 1, padding: "8px 12px", minHeight: "36px", fontSize: "13px" }}
            >
              Repositories
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "0 10px 10px", display: "flex", flexDirection: "column" }}>
          {loading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                flex: 1,
                padding: "40px 20px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              <Loader2 size={24} className="spin" />
              <span>Searching...</span>
            </div>
          ) : error ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                flex: 1,
                padding: "40px 20px",
                color: "#ef4444",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              <AlertCircle size={24} />
              <span>{error}</span>
            </div>
          ) : showIdle ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                flex: 1,
                padding: "40px 20px",
                color: "var(--text-muted)",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              <Search size={32} style={{ opacity: 0.5 }} />
              <span>{mode === "users" ? "Type a username to search" : "Type a keyword to search repositories"}</span>
            </div>
          ) : showEmpty ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                flex: 1,
                padding: "40px 20px",
                color: "var(--text-muted)",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              <Search size={32} style={{ opacity: 0.5 }} />
              <span>No results found</span>
            </div>
          ) : mode === "users" ? (
            users.map(renderUserItem)
          ) : (
            repos.map(renderRepoItem)
          )}
        </div>
      </>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="github-modal-overlay"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={handleClose}
        >
          <motion.div
            className="cloudview-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              flexDirection: "column",
              width: "90%",
              maxWidth: "480px",
              maxHeight: "min(640px, calc(100dvh - 40px))",
              height: "min(640px, calc(100dvh - 40px))",
              overflow: "hidden",
              padding: "16px 0 0",
            }}
          >
            {renderContent()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CloudModalHFSearch;