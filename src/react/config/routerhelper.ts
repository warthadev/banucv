import { getAuth } from "./firebase";
import { AI_AGENT_API_BASE } from "./api";
import { extractAgentModelIds } from "./agentmodels";

export interface RouterCredentials {
  model: string;
  fingerprint: string;
}

interface AgentKeyRecord {
  provider: string;
  model?: string;
  enabled?: boolean;
  fingerprint?: string;
}

interface AgentKeysResponse {
  keys?: AgentKeyRecord[];
  fingerprint?: string;
  model?: string;
  detail?: string;
}

const DEFAULT_KEY_MODEL = "openrouter/openrouter/free";

const getAuthenticatedUser = async () => {
  const firebaseAuth = await getAuth();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Sign in to manage the 9Router key.");
  return { user, idToken: await user.getIdToken(true) };
};

const requestAgentKeys = async (
  idToken: string,
  method: "GET" | "PUT" | "DELETE",
  body?: Record<string, string>,
): Promise<AgentKeysResponse> => {
  const path = method === "DELETE" ? "/agent/keys/9router" : "/agent/keys";
  const response = await fetch(`${AI_AGENT_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as AgentKeysResponse;
  if (!response.ok) throw new Error(data.detail || `Agent key request failed (${response.status})`);
  return data;
};

export const saveRouterCredentials = async (apiKey: string, model = DEFAULT_KEY_MODEL): Promise<void> => {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) throw new Error("A 9Router API key is required.");
  const { idToken } = await getAuthenticatedUser();
  await requestAgentKeys(idToken, "PUT", {
    provider: "9router",
    api_key: normalizedKey,
    model,
  });
};

export const loadRouterCredentials = async (): Promise<RouterCredentials | null> => {
  const { idToken } = await getAuthenticatedUser();
  const data = await requestAgentKeys(idToken, "GET");
  const records = Array.isArray(data.keys) ? data.keys : [];
  const credential = records.find((item) => item.provider?.toLowerCase() === "9router");
  if (!credential || credential.enabled === false) return null;
  return {
    model: credential.model || DEFAULT_KEY_MODEL,
    fingerprint: credential.fingerprint || "",
  };
};

export const loadRouterModelCatalog = async (): Promise<string[]> => {
  const { idToken } = await getAuthenticatedUser();
  const response = await fetch(`${AI_AGENT_API_BASE}/agent/models`, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store",
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data && typeof data === "object" && "detail" in data
      ? (data as { detail?: unknown }).detail
      : undefined;
    throw new Error(typeof detail === "string" ? detail : `Failed to load the model catalog (${response.status})`);
  }
  return extractAgentModelIds(data);
};

export const clearRouterCredentials = async (): Promise<void> => {
  const { idToken } = await getAuthenticatedUser();
  await requestAgentKeys(idToken, "DELETE");
};
