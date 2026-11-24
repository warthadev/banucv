import { getAuth } from "./firebase";
import { AI_AGENT_API_BASE } from "./api";
import { extractAgentModels, type AgentModel } from "./agentmodels";

export interface OpenRouterCredentials {
  provider: "openrouter";
  apiKey: string;
  migrationRequired: boolean;
}

interface AgentKeyRecord {
  provider: string;
  enabled?: boolean;
  apiKey?: string;
  migrationRequired?: boolean;
}

interface AgentKeysResponse {
  keys?: AgentKeyRecord[];
  configured?: boolean;
  apiKey?: string;
  migrationRequired?: boolean;
  freeModelCount?: number;
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

export const saveOpenRouterCredentials = async (apiKey: string): Promise<OpenRouterCredentials> => {
  const normalizedKey = apiKey.trim();
  const { idToken } = await getAuthenticatedUser();
  const body: Record<string, string> = { provider: "openrouter" };
  // Empty means verify and migrate this account's existing saved key.
  if (normalizedKey) body.api_key = normalizedKey;
  const data = await requestAgent(idToken, "/agent/keys", "PUT", body);
  if (typeof data.apiKey !== "string" || !data.apiKey) {
    throw new Error("The authenticated account's OpenRouter key was not returned for Settings.");
  }
  return { provider: "openrouter", apiKey: data.apiKey, migrationRequired: false };
};

export const loadOpenRouterCredentials = async (): Promise<OpenRouterCredentials | null> => {
  const { idToken } = await getAuthenticatedUser();
  const data = await requestAgent(idToken, "/agent/keys", "GET");
  const records = Array.isArray(data.keys) ? data.keys : [];
  const credential = records.find((item) => item.provider?.toLowerCase() === "openrouter" && item.enabled !== false);
  if (!credential) return null;
  if (typeof credential.apiKey !== "string" || !credential.apiKey) {
    throw new Error("This account's OpenRouter key could not be loaded.");
  }
  return {
    provider: "openrouter",
    apiKey: credential.apiKey,
    migrationRequired: credential.migrationRequired === true,
  };
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
