import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getAuth } from "@config/firebase";
import { AI_AGENT_API_BASE } from "@config/api";
import { loadKaggleCredentials } from "@config/kagglecredentials";
import { detectAgentLanguage, detectUserContext } from "@config/agentlanguage";

export type AgentLocalStatus =
  | "checking-credentials"
  | "needs-credentials"
  | "blocked"
  | "disconnected"
  | "offline"
  | "connecting"
  | "booting"
  | "ready"
  | "stopping"
  | "error";

export interface AgentLocalStep {
  id: string;
  label: string;
  state: "done" | "active" | "pending" | "error";
  detail?: string;
}

export interface AgentProcessStep {
  id: string;
  kind: "thinking" | "tool" | "info";
  title: string;
  status: "running" | "done" | "error";
  tool?: string;
  detail?: string;
  output?: string;
}

const normalizeProcessSteps = (raw: unknown): AgentProcessStep[] => {
  if (!Array.isArray(raw)) return [];
  const result: AgentProcessStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id.slice(0, 24) : "";
    if (!id) continue;
    const kind = entry.kind === "tool" || entry.kind === "thinking" ? entry.kind : "info";
    const status = entry.status === "done" || entry.status === "error" ? entry.status : "running";
    const text = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.slice(0, max) : undefined);
    result.push({
      id, kind, status,
      title: text(entry.title, 160) ?? "",
      tool: text(entry.tool, 40),
      detail: text(entry.detail, 200),
      output: text(entry.output, 1500),
    });
  }
  return result;
};

export interface AgentLocalCheck {
  id: string;
  label: string;
  ok: boolean;
  detail?: string | null;
}

export interface AgentLocalAttachment {
  name: string;
  path: string;
  mimeType: string;
  size?: number;
  dataUrl?: string; // small files sent inline by the worker (base64)
  url?: string; // large files: direct https link (Hugging Face), downloaded by the browser without touching our server
}

// Direct links are only trusted when they point at Hugging Face, so a compromised worker cannot plant arbitrary links in the chat.
const DOWNLOAD_HOSTS = ["huggingface.co", "hf.co"];
const MIME_PATTERN = /^[\w.+-]+\/[\w.+-]+$/;

const isTrustedDownloadUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && DOWNLOAD_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
};

const normalizeLocalAttachments = (raw: unknown): AgentLocalAttachment[] => {
  if (!Array.isArray(raw)) return [];
  const result: AgentLocalAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const name = typeof entry.name === "string" ? entry.name.replace(/[\\/]/g, "_").slice(0, 200).trim() : "";
    if (!name) continue;
    const mimeRaw = String(entry.mime_type ?? entry.mimeType ?? "");
    const mimeType = MIME_PATTERN.test(mimeRaw) ? mimeRaw : "application/octet-stream";
    const size = typeof entry.size === "number" && entry.size >= 0 ? entry.size : undefined;
    const path = typeof entry.path === "string" ? entry.path : "";
    const base64 = typeof entry.data_base64 === "string" ? entry.data_base64 : "";
    const link = typeof entry.url === "string" ? entry.url : "";
    if (link && isTrustedDownloadUrl(link)) {
      const url = link.includes("download=") ? link : `${link}${link.includes("?") ? "&" : "?"}download=true`;
      result.push({ name, path, mimeType, size, url });
    } else if (base64 && /^[A-Za-z0-9+/=\s]+$/.test(base64)) {
      result.push({ name, path, mimeType, size, dataUrl: `data:${mimeType};base64,${base64.replace(/\s+/g, "")}` });
    }
  }
  return result;
};

interface AgentLocalPreflightResponse {
  can_start?: boolean;
  blocker?: string | null;
  message?: string | null;
  kernel_exists?: boolean;
  checks?: AgentLocalCheck[];
}

interface AgentLocalStatusResponse {
  activity?: string | null;
  steps?: AgentLocalStep[];
  boot_elapsed?: number | null;
  connected?: boolean;
  session_id?: string;
  status?: "booting" | "ready" | "stopping" | "error" | "offline";
  model_id?: string | null;
  error?: string | null;
  alive?: boolean;
  kaggle_state?: string | null;
  resumable?: boolean;
}

const BOOT_POLL_MS = 4000;
const READY_WATCH_MS = 20000;
// Boot GPU + load model normalnya 1-3 menit (antrean GPU Kaggle bisa lebih lama). Lewat ini dianggap gagal, jangan muter selamanya.
const BOOT_MAX_MS = 15 * 60 * 1000;

// While a start is in flight the UI polls faster; a stopped worker is rechecked only on demand.
const TICK_MS = 1000;

// Fetch mentah dengan token Firebase (untuk SSE: body dibaca sebagai stream).
const authedFetchRaw = async (path: string, init?: RequestInit) => {
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
  return fetch(`${AI_AGENT_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${idToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
};

const authedFetch = async (path: string, init?: RequestInit) => {
  const response = await authedFetchRaw(path, init);
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
  const [steps, setSteps] = useState<AgentLocalStep[]>([]);
  const [checks, setChecks] = useState<AgentLocalCheck[]>([]);
  const [kernelExists, setKernelExists] = useState<boolean | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activity, setActivity] = useState<string | null>(null);
  // Worker TIDAK pernah dinyalakan otomatis (F5 / buka tab / kembali ke tab hanya MEMERIKSA status).
  // Hanya klik tombol Run / Restart yang boleh menyentuh Kaggle.
  const pollRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const bootStartedAtRef = useRef<number | null>(null);
  const statusRef = useRef<AgentLocalStatus>("checking-credentials");
  const busyRef = useRef(false); // cegah klik ganda Run/Restart/Stop
  const setStatusTracked = useCallback((next: AgentLocalStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Live "elapsed" counter so a long Kaggle boot never looks frozen.
  useEffect(() => {
    if (status !== "connecting" && status !== "booting") return;
    const tick = () => {
      const startedAt = bootStartedAtRef.current;
      setElapsedSeconds(startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0);
    };
    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [status]);

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
      setSteps(Array.isArray(data.steps) ? data.steps : []);

      if (data.status === "stopping") {
        bootStartedAtRef.current = null;
        setModelId(null);
        setStatusTracked("stopping");
        setError(null);
        pollRef.current = window.setTimeout(() => { void refreshStatus(); }, 2000);
        return;
      }

      if (data.status === "ready" && data.model_id) {
        bootStartedAtRef.current = null;
        setStatusTracked("ready");
        setModelId(data.model_id);
        setError(null);
        if (typeof data.activity === "string" && data.activity.trim()) setActivity(data.activity.trim());
        else setActivity(null);
        // Keep watching: if Kaggle sleeps or stops, the UI must notice and offer "Restart Kaggle".
        pollRef.current = window.setTimeout(() => { void refreshStatus(); }, READY_WATCH_MS);
        return;
      }
      setModelId(null);

      if (data.status === "error") {
        bootStartedAtRef.current = null;
        setStatusTracked("error");
        setError(data.error || "The AI Local worker failed to run.");
        return;
      }

      if (data.status === "booting" && data.connected) {
        if (typeof data.boot_elapsed === "number") {
          // Resume the counter after a page reload instead of restarting it from zero.
          bootStartedAtRef.current = Date.now() - data.boot_elapsed * 1000;
        } else if (bootStartedAtRef.current === null) {
          bootStartedAtRef.current = Date.now();
        }
        if (Date.now() - bootStartedAtRef.current > BOOT_MAX_MS) {
          bootStartedAtRef.current = null;
          setStatusTracked("error");
          setError("The Kaggle worker took too long to load (over 15 minutes). You can stop it or restart it.");
          return;
        }
        setStatusTracked("booting");
        pollRef.current = window.setTimeout(() => { void refreshStatus(); }, BOOT_POLL_MS);
        return;
      }

      // Not running. Check what is missing BEFORE offering to start, so a new user
      // (no worker notebook yet, or no access to the model dataset) gets a clear answer.
      bootStartedAtRef.current = null;
      let preflight: AgentLocalPreflightResponse | null = null;
      try {
        preflight = (await authedFetch("/agent/local/preflight")) as AgentLocalPreflightResponse;
      } catch {
        preflight = null; // The check is best-effort; starting still reports real errors.
      }
      if (!mountedRef.current) return;
      if (preflight) {
        setChecks(Array.isArray(preflight.checks) ? preflight.checks : []);
        setKernelExists(typeof preflight.kernel_exists === "boolean" ? preflight.kernel_exists : null);
        if (preflight.can_start === false) {
          setStatusTracked("blocked");
          setError(preflight.message || "AI Local cannot start yet.");
          return;
        }
      }
      if (data.error || data.resumable) {
        setStatusTracked("offline");
        setError(data.error || "The Kaggle worker is stopped.");
      } else {
        setStatusTracked("disconnected");
        setError(null);
      }
      // Sengaja TIDAK menyalakan worker di sini: user yang menekan Run.
    } catch (err) {
      if (!mountedRef.current) return;
      bootStartedAtRef.current = null;
      setStatusTracked("error");
      setError(err instanceof Error ? err.message : "Could not check the AI Local status.");
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
      setError(err instanceof Error ? err.message : "Could not check the Kaggle credentials.");
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
      if (["ready", "booting", "stopping", "offline", "disconnected", "blocked"].includes(statusRef.current)) void refreshStatus();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshStatus]);

  // Run / Restart: satu jalur. Backend SELALU memeriksa dulu apakah worker sudah ada (di backend dan di Kaggle)
  // dan memakainya lagi; worker baru hanya dibuat kalau memang tidak ada.
  const launch = useCallback(async (path: "/agent/local/connect" | "/agent/local/restart") => {
    if (busyRef.current) return;
    busyRef.current = true;
    stopPolling();
    setStatusTracked("connecting");
    setError(null);
    setSteps([]);
    setKaggleState(null);
    bootStartedAtRef.current = Date.now();
    try {
      await authedFetch(path, { method: "POST", body: JSON.stringify({}) });
      if (!mountedRef.current) return;
      setStatusTracked("booting");
      pollRef.current = window.setTimeout(() => { void refreshStatus(); }, 1500);
    } catch (err) {
      if (!mountedRef.current) return;
      bootStartedAtRef.current = null;
      setStatusTracked("error");
      setError(err instanceof Error ? err.message : "Could not start AI Local.");
    } finally {
      busyRef.current = false;
    }
  }, [refreshStatus, stopPolling, setStatusTracked]);

  // Satu tombol Run untuk semua keadaan: worker sudah ready -> muat ulang model
  // di worker yang sama (restart); belum ada / belum ready -> pakai lagi kalau
  // ada, kalau tidak ada buat worker baru. Tidak ada lagi tombol Restart terpisah.
  const run = useCallback(() => {
    if (statusRef.current === "ready") return launch("/agent/local/restart");
    return launch("/agent/local/connect");
  }, [launch]);

  // Stop: hentikan sesi worker di Kaggle (GPU dilepas). Bisa dipakai saat booting maupun saat sudah siap.
  const stop = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    stopPolling();
    bootStartedAtRef.current = null;
    setModelId(null);
    setSteps([]);
    setError(null);
    setStatusTracked("stopping");
    try {
      const data = await authedFetch("/agent/local/stop", { method: "POST", body: JSON.stringify({}) });
      if (!mountedRef.current) return;
      if (data?.status === "offline") {
        // Kembali ke awal: tampilkan tombol Run lagi. Tidak ada refresh
        // otomatis — user yang menekan Run kalau mau jalanin worker lagi.
        setStatusTracked("disconnected");
        setError(null);
        busyRef.current = false;
        return;
      }
      pollRef.current = window.setTimeout(() => { void refreshStatus(); }, 2000);
    } catch (err) {
      if (!mountedRef.current) return;
      setStatusTracked("error");
      setError(err instanceof Error ? err.message : "Could not stop the AI Local worker.");
    } finally {
      busyRef.current = false;
    }
  }, [refreshStatus, stopPolling, setStatusTracked]);

  const sendLocalChat = useCallback(async (prompt: string, images: { mimeType: string; data: string }[], history: Array<{ role: string; content: string }> = []) => {
    try {
      const data = await authedFetch("/agent/local/chat", {
        method: "POST",
        body: JSON.stringify({ prompt, images: images.map((img) => ({ mime_type: img.mimeType, data: img.data })), language: detectAgentLanguage(), context: detectUserContext(), history }),
      });
      const content = data?.data?.result?.content;
      if (typeof content !== "string" || !content) throw new Error("AI Local returned an empty response");
      const attachments = normalizeLocalAttachments(data?.data?.result?.attachments);
      return { content: content as string, attachments };
    } catch (err) {
      // 409/503/504 biasanya berarti worker Kaggle sudah mati -> perbarui UI supaya muncul tombol "Jalankan ulang".
      void refreshStatus();
      throw err;
    }
  }, [refreshStatus]);

  // Chat live stream: token mengalir lewat SSE selagi model menulis, bukan
  // menunggu jawaban selesai. onToken(delta, segment) dipanggil per potongan;
  // segmen baru = panggilan model baru (sapaan -> jawaban akhir).
  const sendLocalChatStream = useCallback(async (
    prompt: string,
    images: { mimeType: string; data: string }[],
    onToken: (delta: string, segment: number) => void,
    history: Array<{ role: string; content: string }> = [],
  ) => {
    try {
      const response = await authedFetchRaw("/agent/local/chat-stream", {
        method: "POST",
        body: JSON.stringify({ prompt, images: images.map((img) => ({ mime_type: img.mimeType, data: img.data })), language: detectAgentLanguage(), context: detectUserContext(), history }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const detail = typeof data?.detail === "string" ? data.detail : `AI Local request failed (${response.status})`;
        throw new Error(detail);
      }
      if (!response.body) throw new Error("Streaming is not supported by this browser");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalContent = "";
      let finalAttachments: ReturnType<typeof normalizeLocalAttachments> | undefined;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const raw = trimmed.slice(5).trim();
          if (!raw) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            continue;
          }
          if (event.type === "token" && typeof event.delta === "string" && event.delta) {
            onToken(event.delta, typeof event.segment === "number" ? event.segment : 0);
          } else if (event.type === "final" && typeof event.result === "object" && event.result !== null) {
            const result = event.result as Record<string, unknown>;
            finalContent = typeof result.content === "string" ? result.content : "";
            finalAttachments = normalizeLocalAttachments(result.attachments);
          } else if (event.type === "error") {
            throw new Error(typeof event.message === "string" && event.message ? event.message : "AI Local request failed");
          }
        }
      }
      if (!finalContent) throw new Error("AI Local returned an empty response");
      return { content: finalContent as string, attachments: finalAttachments };
    } catch (err) {
      void refreshStatus();
      throw err;
    }
  }, [refreshStatus]);

  // Batalkan jawaban yang sedang berjalan tanpa mematikan worker.
  const cancelLocalChat = useCallback(async () => {
    try {
      await authedFetch("/agent/local/cancel", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // Permintaan cancel yang gagal tidak mengubah apa-apa; jawaban yang
      // sedang berjalan tetap selesai sendiri.
    }
  }, []);

  const uploadLocalFile = useCallback(async (file: File, name = file.name) => {
    if (file.size > 20 * 1024 * 1024) throw new Error(`${name} exceeds the 20 MB limit`);
    const contentBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Could not read ${name}`));
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.readAsDataURL(file);
    });
    if (!contentBase64) throw new Error(`${name} is empty`);
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
        throw new Error(`Uploading ${name} to Kaggle failed`);
      }
      return path;
    } catch (err) {
      void refreshStatus();
      throw err;
    }
  }, [refreshStatus]);

  const pollActivity = useCallback(async () => {
    try {
      const data = (await authedFetch("/agent/local/status")) as AgentLocalStatusResponse;
      if (typeof data.activity === "string" && data.activity.trim()) {
        setActivity(data.activity.trim());
        return data.activity.trim();
      }
      setActivity(null);
      return null;
    } catch {
      return null;
    }
  }, []);

  // Log langkah proses (berpikir / tool) yang sedang berjalan. `since` = seq terakhir yang sudah diterima.
  const pollProcess = useCallback(async (since: number) => {
    try {
      const data = await authedFetch(`/agent/local/activity?since=${Math.max(0, Math.floor(since))}`);
      return {
        seq: typeof data?.seq === "number" ? data.seq : 0,
        activity: typeof data?.activity === "string" && data.activity.trim() ? (data.activity as string).trim() : null,
        steps: normalizeProcessSteps(data?.steps),
        opening: typeof data?.opening === "string" && data.opening.trim() ? (data.opening as string).trim() : null,
      };
    } catch {
      return null;
    }
  }, []);

  return {
    status, modelId, error, kaggleState, steps, checks, kernelExists, elapsedSeconds, activity,
    checkCredentials, run, stop, refreshStatus, pollActivity, pollProcess, sendLocalChat, sendLocalChatStream, cancelLocalChat, uploadLocalFile,
  };
};

export default useAgentLocal;
