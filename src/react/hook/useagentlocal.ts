import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getAuth } from "@config/firebase";
import { AI_AGENT_API_BASE } from "@config/api";
import { loadKaggleCredentials } from "@config/kagglecredentials";

export type AgentLocalStatus =
  | "checking-credentials"
  | "needs-credentials"
  | "disconnected"
  | "offline"
  | "connecting"
  | "booting"
  | "ready"
  | "error";

interface AgentLocalStatusResponse {
  connected?: boolean;
  session_id?: string;
  status?: "booting" | "ready" | "error" | "offline";
  model_id?: string | null;
  error?: string | null;
  alive?: boolean;
  kaggle_state?: string | null;
  resumable?: boolean;
}

const BOOT_POLL_MS = 4000;
const READY_WATCH_MS = 20000;
// Boot GPU + load model normalnya 1-3 menit. Lewat ini dianggap gagal, jangan muter selamanya.
const BOOT_MAX_MS = 9 * 60 * 1000;

const authedFetch = async (path: string, init?: RequestInit) => {
  const firebaseAuth = await getAuth();
  let user = firebaseAuth.currentUser;
  if (!user) {
    user = await new Promise<User | null>((resolve) => {
      let unsubscribe = () => {};
      unsubscribe = onAuthStateChanged(firebaseAuth, (resolvedUser) => {
        unsubscribe();
        resolve(resolvedUser);
      });
    });
  }
  if (!user) throw new Error("Sign in to use AI Local.");
  const idToken = await user.getIdToken();
  const response = await fetch(`${AI_AGENT_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${idToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : `AI Local request failed (${response.status})`;
    throw new Error(detail);
  }
  return data;
};

export const useAgentLocal = () => {
  const [status, setStatus] = useState<AgentLocalStatus>("checking-credentials");
  const [modelId, setModelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kaggleState, setKaggleState] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const bootStartedAtRef = useRef<number | null>(null);
  const statusRef = useRef<AgentLocalStatus>("checking-credentials");
  const setStatusTracked = useCallback((next: AgentLocalStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    stopPolling();
    try {
      const data = (await authedFetch("/agent/local/status?deep=1")) as AgentLocalStatusResponse;
      if (!mountedRef.current) return;
      setKaggleState(data.kaggle_state ?? null);

      if (data.status === "ready" && data.model_id) {
        bootStartedAtRef.current = null;
        setStatusTracked("ready");
        setModelId(data.model_id);
        setError(null);
        // Tetap dipantau: kalau Kaggle sleep/berhenti, UI harus tahu dan menawarkan "Jalankan ulang".
        pollRef.current = window.setTimeout(() => { void refreshStatus(); }, READY_WATCH_MS);
        return;
      }
      setModelId(null);

      if (data.status === "error") {
        bootStartedAtRef.current = null;
        setStatusTracked("error");
        setError(data.error || "AI Local worker gagal berjalan");
        return;
      }

      if (data.status === "booting" && data.connected) {
        if (bootStartedAtRef.current === null) bootStartedAtRef.current = Date.now();
        if (Date.now() - bootStartedAtRef.current > BOOT_MAX_MS) {
          bootStartedAtRef.current = null;
          setStatusTracked("error");
          setError("Worker Kaggle terlalu lama memuat (lebih dari 9 menit). Coba jalankan ulang.");
          return;
        }
        setStatusTracked("booting");
        pollRef.current = window.setTimeout(() => { void refreshStatus(); }, BOOT_POLL_MS);
        return;
      }

      // offline: worker mati (Kaggle sleep/idle/berhenti) atau belum pernah dijalankan.
      bootStartedAtRef.current = null;
      if (data.error || data.resumable) {
        setStatusTracked("offline");
        setError(data.error || "Worker Kaggle sedang mati.");
      } else {
        setStatusTracked("disconnected");
        setError(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      bootStartedAtRef.current = null;
      setStatusTracked("error");
      setError(err instanceof Error ? err.message : "Gagal memeriksa status AI Local");
    }
  }, [stopPolling, setStatusTracked]);

  const checkCredentials = useCallback(async () => {
    setStatusTracked("checking-credentials");
    try {
      const credentials = await loadKaggleCredentials();
      if (!mountedRef.current) return;
      if (!credentials) {
        setStatusTracked("needs-credentials");
        return;
      }
      await refreshStatus();
    } catch (err) {
      if (!mountedRef.current) return;
      setStatusTracked("error");
      setError(err instanceof Error ? err.message : "Gagal memeriksa kredensial Kaggle");
    }
  }, [refreshStatus]);

  useEffect(() => {
    void checkCredentials();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kembali ke tab/aplikasi setelah lama ditinggal -> langsung cek ulang, jangan nunggu timer.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (["ready", "booting", "offline", "disconnected"].includes(statusRef.current)) void refreshStatus();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshStatus]);

  const connect = useCallback(async () => {
    stopPolling();
    setStatusTracked("connecting");
    setError(null);
    bootStartedAtRef.current = Date.now();
    try {
      await authedFetch("/agent/local/connect", { method: "POST", body: JSON.stringify({}) });
      if (!mountedRef.current) return;
      setStatusTracked("booting");
      pollRef.current = window.setTimeout(() => { void refreshStatus(); }, 1500);
    } catch (err) {
      if (!mountedRef.current) return;
      setStatusTracked("error");
      setError(err instanceof Error ? err.message : "Gagal menyambungkan AI Local");
    }
  }, [refreshStatus, stopPolling, setStatusTracked]);

  const sendLocalChat = useCallback(async (prompt: string, images: { mimeType: string; data: string }[]) => {
    try {
      const data = await authedFetch("/agent/local/chat", {
        method: "POST",
        body: JSON.stringify({ prompt, images: images.map((img) => ({ mime_type: img.mimeType, data: img.data })) }),
      });
      const content = data?.data?.result?.content;
      if (typeof content !== "string" || !content) throw new Error("AI Local returned an empty response");
      return content as string;
    } catch (err) {
      // 409/503/504 biasanya berarti worker Kaggle sudah mati -> perbarui UI supaya muncul tombol "Jalankan ulang".
      void refreshStatus();
      throw err;
    }
  }, [refreshStatus]);

  const uploadLocalFile = useCallback(async (file: File, name = file.name) => {
    if (file.size > 20 * 1024 * 1024) throw new Error(`${name} melebihi batas 20 MB`);
    const contentBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Tidak bisa membaca ${name}`));
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.readAsDataURL(file);
    });
    if (!contentBase64) throw new Error(`${name} kosong`);
    try {
      const data = await authedFetch("/agent/local/upload", {
        method: "POST",
        body: JSON.stringify({
          name,
          content_base64: contentBase64,
          mime_type: file.type || "application/octet-stream",
        }),
      });
      const path = data?.data?.path;
      if (typeof path !== "string" || !path.startsWith("/kaggle/working/uploads/")) {
        throw new Error(`Upload ${name} ke Kaggle gagal`);
      }
      return path;
    } catch (err) {
      void refreshStatus();
      throw err;
    }
  }, [refreshStatus]);

  return { status, modelId, error, kaggleState, checkCredentials, connect, refreshStatus, sendLocalChat, uploadLocalFile };
};

export default useAgentLocal;
