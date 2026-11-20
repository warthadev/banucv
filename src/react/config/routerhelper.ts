import { getAuth } from "./firebase";
import { AI_AGENT_API_BASE } from "./api";
import { extractAgentModels, type AgentModel } from "./agentmodels";

export interface RouterCredentials {
  provider: "9router";
  fingerprint: string;
}

interface AgentKeyRecord {
  provider: string;
  enabled?: boolean;
  fingerprint?: string;
}

interface AgentKeysResponse {
  keys?: AgentKeyRecord[];
  configured?: boolean;
  detail?: string;
}

const getAuthenticatedUser = async () => {
  const firebaseAuth = await getAuth();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Sign in to manage this account's 9Router key.");
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
  if (!response.ok) throw new Error(data.detail || `9Router key request failed (${response.status})`);
  return data;
};

export const saveRouterCredentials = async (apiKey: string): Promise<void> => {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) throw new Error("A 9Router API key is required.");
  const { idToken } = await getAuthenticatedUser();
  await requestAgentKeys(idToken, "PUT", {
    provider: "9router",
    api_key: normalizedKey,
  });
};

export const loadRouterCredentials = async (): Promise<RouterCredentials | null> => {
  const { idToken } = await getAuthenticatedUser();
  const data = await requestAgentKeys(idToken, "GET");
  const records = Array.isArray(data.keys) ? data.keys : [];
  const credential = records.find((item) => item.provider?.toLowerCase() === "9router" && item.enabled !== false);
  if (!credential) return null;
  return {
    provider: "9router",
    fingerprint: credential.fingerprint || "",
  };
};

export const loadRouterModelCatalog = async (): Promise<AgentModel[]> => {
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
    throw new Error(typeof detail === "string" ? detail : `Failed to load this key's model catalog (${response.status})`);
  }
  return extractAgentModels(data);
};

export const clearRouterCredentials = async (): Promise<void> => {
  const { idToken } = await getAuthenticatedUser();
  await requestAgentKeys(idToken, "DELETE");
};
