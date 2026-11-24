import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getAuth } from "@config/firebase";
import { AI_AGENT_API_BASE } from "@config/api";
import { loadKaggleCredentials } from "@config/kagglecredentials";

export type AgentLocalStatus =
  | "checking-credentials"
  | "needs-credentials"
  | "disconnected"
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
}

const BOOT_POLL_MS = 4000;

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
  const pollRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

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
    try {
      const data = (await authedFetch("/agent/local/status")) as AgentLocalStatusResponse;
      if (!mountedRef.current) return;
      if (!data.connected) {
        setStatus("disconnected");
        setModelId(null);
        return;
      }
      if (data.status === "ready" && data.model_id) {
        setStatus("ready");
        setModelId(data.model_id);
        setError(null);
        stopPolling();
        return;
      }
      if (data.status === "error") {
        setStatus("error");
        setError(data.error || "AI Local worker gagal berjalan");
        stopPolling();
        return;
      }
      // booting / offline-but-recently-pushed: keep polling
      setStatus("booting");
      pollRef.current = window.setTimeout(() => { void refreshStatus(); }, BOOT_POLL_MS);
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "Gagal memeriksa status AI Local");
    }
  }, [stopPolling]);

  const checkCredentials = useCallback(async () => {
    setStatus("checking-credentials");
    try {
      const credentials = await loadKaggleCredentials();
      if (!mountedRef.current) return;
      if (!credentials) {
        setStatus("needs-credentials");
        return;
      }
      await refreshStatus();
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "Gagal memeriksa kredensial Kaggle");
    }
  }, [refreshStatus]);

  useEffect(() => {
    void checkCredentials();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      await authedFetch("/agent/local/connect", { method: "POST", body: JSON.stringify({}) });
      if (!mountedRef.current) return;
      setStatus("booting");
      pollRef.current = window.setTimeout(() => { void refreshStatus(); }, 1500);
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "Gagal menyambungkan AI Local");
    }
  }, [refreshStatus]);

  const sendLocalChat = useCallback(async (prompt: string, images: { mimeType: string; data: string }[]) => {
    const data = await authedFetch("/agent/local/chat", {
      method: "POST",
      body: JSON.stringify({ prompt, images: images.map((img) => ({ mime_type: img.mimeType, data: img.data })) }),
    });
    const content = data?.data?.result?.content;
    if (typeof content !== "string" || !content) throw new Error("AI Local returned an empty response");
    return content as string;
  }, []);

  return { status, modelId, error, checkCredentials, connect, refreshStatus, sendLocalChat };
};

export default useAgentLocal;
