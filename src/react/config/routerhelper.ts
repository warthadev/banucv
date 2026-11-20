import { getAuth } from "./firebase";
import { AI_AGENT_API_BASE } from "./api";
import { extractAgentModels, type AgentModel } from "./agentmodels";

export interface OpenRouterCredentials {
  provider: "openrouter";
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
  if (!user) throw new Error("Sign in to manage this account's OpenRouter settings.");
  return { user, idToken: await user.getIdToken(true) };
};

const requestAgent = async (
  idToken: string,
  path: string,
  method: "GET" | "PUT" | "POST" | "DELETE",
  body?: Record<string, string>,
): Promise<AgentKeysResponse> => {
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
  if (!response.ok) throw new Error(data.detail || `OpenRouter request failed (${response.status})`);
  return data;
};

export const saveOpenRouterCredentials = async (apiKey: string): Promise<void> => {
  const normalizedKey = apiKey.trim();
  const { idToken } = await getAuthenticatedUser();
  const body: Record<string, string> = { provider: "openrouter" };
  // Empty means keep this account's already-saved encrypted key.
  if (normalizedKey) body.api_key = normalizedKey;
  await requestAgent(idToken, "/agent/keys", "PUT", body);
  // Old 9Router fields are removed server-side only after this account's key passes a live API check.
  await requestAgent(idToken, "/agent/keys/openrouter/verify", "POST");
};

export const loadOpenRouterCredentials = async (): Promise<OpenRouterCredentials | null> => {
  const { idToken } = await getAuthenticatedUser();
  const data = await requestAgent(idToken, "/agent/keys", "GET");
  const records = Array.isArray(data.keys) ? data.keys : [];
  const credential = records.find((item) => item.provider?.toLowerCase() === "openrouter" && item.enabled !== false);
  if (!credential) return null;
  return { provider: "openrouter", fingerprint: credential.fingerprint || "" };
};

export const loadOpenRouterModelCatalog = async (): Promise<AgentModel[]> => {
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
    throw new Error(typeof detail === "string" ? detail : `Failed to load this account's OpenRouter free-model catalog (${response.status})`);
  }
  return extractAgentModels(data);
};

export const clearOpenRouterCredentials = async (): Promise<void> => {
  const { idToken } = await getAuthenticatedUser();
  await requestAgent(idToken, "/agent/keys/openrouter", "DELETE");
};
