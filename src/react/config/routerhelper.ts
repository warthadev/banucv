import { getAuth } from "./firebase";
import { AI_AGENT_API_BASE } from "./api";
import { extractAgentModels, type AgentModel } from "./agentmodels";

export interface AgentProviderOption {
  id: string;
  name: string;
}

export const AGENT_PROVIDER_OPTIONS: AgentProviderOption[] = [
  { id: "openai", name: "OpenAI" },
  { id: "openrouter", name: "OpenRouter" },
  { id: "deepseek", name: "DeepSeek" },
];

export interface RouterCredentials {
  provider: string;
  fingerprint: string;
}

interface AgentKeyRecord {
  provider: string;
  enabled?: boolean;
  fingerprint?: string;
  gateway?: boolean;
}

interface AgentKeysResponse {
  keys?: AgentKeyRecord[];
  configured?: boolean;
  detail?: string;
}

const getAuthenticatedUser = async () => {
  const firebaseAuth = await getAuth();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Sign in to manage your provider connection.");
  return { user, idToken: await user.getIdToken(true) };
};

const requestAgentKeys = async (
  idToken: string,
  method: "GET" | "PUT" | "DELETE",
  body?: Record<string, string>,
): Promise<AgentKeysResponse> => {
  const path = method === "DELETE" ? "/agent/keys/gateway" : "/agent/keys";
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
  if (!response.ok) throw new Error(data.detail || `Provider connection request failed (${response.status})`);
  return data;
};

export const saveRouterCredentials = async (apiKey: string, provider: string): Promise<void> => {
  const normalizedKey = apiKey.trim();
  const selectedProvider = provider.trim().toLowerCase();
  if (!AGENT_PROVIDER_OPTIONS.some((option) => option.id === selectedProvider)) {
    throw new Error("Choose a supported provider.");
  }
  if (!normalizedKey) throw new Error("A provider API key is required.");
  const { idToken } = await getAuthenticatedUser();
  await requestAgentKeys(idToken, "PUT", {
    provider: selectedProvider,
    api_key: normalizedKey,
  });
};

export const loadRouterCredentials = async (): Promise<RouterCredentials | null> => {
  const { idToken } = await getAuthenticatedUser();
  const data = await requestAgentKeys(idToken, "GET");
  const records = Array.isArray(data.keys) ? data.keys : [];
  const credential = records.find((item) => item.gateway === true && item.enabled !== false);
  if (!credential || !AGENT_PROVIDER_OPTIONS.some((option) => option.id === credential.provider)) return null;
  return {
    provider: credential.provider,
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
    throw new Error(typeof detail === "string" ? detail : `Failed to load this account's model catalog (${response.status})`);
  }
  return extractAgentModels(data);
};

export const clearRouterCredentials = async (): Promise<void> => {
  const { idToken } = await getAuthenticatedUser();
  await requestAgentKeys(idToken, "DELETE");
};
