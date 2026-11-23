import { getActiveBase } from "./api";
import { getKaggleAuthHeaders } from "./kagglecredentials";

export type LocalAgentWorkerStatus = "booting" | "ready" | "error" | "offline";

export interface LocalAgentStatus {
  connected: boolean;
  status: LocalAgentWorkerStatus;
  modelId: string | null;
  error: string | null;
  alive: boolean;
  sessionId: string | null;
}

export interface LocalAgentPollHandle {
  promise: Promise<LocalAgentStatus>;
  cancel: () => void;
}

const localApiBase = (): string => getActiveBase().replace(/\/+$/, "");

const parseStatus = (data: unknown, fallbackStatus: LocalAgentWorkerStatus = "offline"): LocalAgentStatus => {
  const payload = (data || {}) as Record<string, unknown>;
  return {
    connected: Boolean(payload.connected),
    status: (payload.status as LocalAgentWorkerStatus) || fallbackStatus,
    modelId: (payload.model_id as string | null) || null,
    error: (payload.error as string | null) || null,
    alive: Boolean(payload.alive),
    sessionId: (payload.session_id as string | null) || null,
  };
};

/** GET /agent/local/status — koneksinya masih hidup, booting, atau mati? */
export const fetchLocalAgentStatus = async (): Promise<LocalAgentStatus> => {
  const headers = await getKaggleAuthHeaders();
  const response = await fetch(`${localApiBase()}/agent/local/status`, {
    headers,
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = (data as { detail?: string } | null)?.detail;
    throw new Error(detail || `AI Local status request failed (${response.status})`);
  }
  return parseStatus(data);
};

/** POST /agent/local/connect — push worker GPU Kaggle atau reuse yang sudah hidup. */
export const connectLocalAgent = async (): Promise<LocalAgentStatus> => {
  const headers = await getKaggleAuthHeaders();
  const response = await fetch(`${localApiBase()}/agent/local/connect`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = (data as { detail?: string } | null)?.detail;
    throw new Error(detail || `Failed to connect AI Local (${response.status})`);
  }
  return parseStatus(data, "booting");
};

/**
 * Poll status sampai ready/error. Boot GPU + load GGUF bisa 1-3 menit,
 * jadi timeout default 5 menit lalu resolve dengan pesan error.
 */
export const pollLocalAgentUntilReady = (
  onTick: (status: LocalAgentStatus | null, error: unknown) => void,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): LocalAgentPollHandle => {
  const intervalMs = options.intervalMs ?? 5000;
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolveFn: ((value: LocalAgentStatus) => void) | null = null;
  const startedAt = Date.now();
  const finish = (value: LocalAgentStatus) => {
    if (!resolveFn) return;
    resolveFn(value);
    resolveFn = null;
  };
  const tick = async () => {
    if (cancelled) return;
    try {
      const status = await fetchLocalAgentStatus();
      onTick(status, null);
      if (status.status === "ready" || status.status === "error") {
        finish(status);
        return;
      }
    } catch (error) {
      onTick(null, error);
    }
    if (Date.now() - startedAt >= timeoutMs) {
      finish({
        connected: false,
        status: "error",
        modelId: null,
        error: "Connecting to AI Local timed out. Retry from the Local tab.",
        alive: false,
        sessionId: null,
      });
      return;
    }
    timer = setTimeout(() => void tick(), intervalMs);
  };
  return {
    promise: new Promise<LocalAgentStatus>((resolve) => {
      resolveFn = resolve;
      void tick();
    }),
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
};
