import { getAuth, getDb } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { AI_AGENT_API_BASE } from "./api";

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

const DEFAULT_KEY_MODEL = "openrouter/openrouter/free";
const legacyUserDoc = (uid: string) => getDb().then((db) => doc(db, "users", uid));

const getAuthenticatedUser = async () => {
  const firebaseAuth = await getAuth();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("User not authenticated");
  return { user, idToken: await user.getIdToken(true) };
};

const requestAgentKeys = async (idToken: string, method: "GET" | "PUT" | "DELETE", body?: Record<string, string>) => {
  const response = await fetch(`${AI_AGENT_API_BASE}/agent/keys${method === "DELETE" ? "/9router" : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as { detail?: string; keys?: AgentKeyRecord[]; fingerprint?: string; model?: string };
  if (!response.ok) throw new Error(data.detail || `Agent key request failed: ${response.status}`);
  return data;
};

const clearLegacyCredential = async (uid: string): Promise<void> => {
  const reference = await legacyUserDoc(uid);
  await setDoc(reference, { nineRouterApiKey: null, nineRouterModel: null }, { merge: true });
};

const saveEncryptedCredential = async (idToken: string, apiKey: string, model = DEFAULT_KEY_MODEL): Promise<AgentKeyRecord> => {
  const data = await requestAgentKeys(idToken, "PUT", {
    provider: "9router",
    api_key: apiKey.trim(),
    model,
  });
  return { provider: "9router", enabled: true, model: data.model || model, fingerprint: data.fingerprint || "" };
};

export const saveRouterCredentials = async (apiKey: string, model = DEFAULT_KEY_MODEL): Promise<void> => {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) throw new Error("9Router API key is required");
  const { user, idToken } = await getAuthenticatedUser();
  await saveEncryptedCredential(idToken, normalizedKey, model);
  await clearLegacyCredential(user.uid);
};

export const loadRouterCredentials = async (): Promise<RouterCredentials | null> => {
  const firebaseAuth = await getAuth();
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  const idToken = await user.getIdToken(true);
  const reference = await legacyUserDoc(user.uid);
  const snapshot = await getDoc(reference);
  const legacyData = snapshot.exists() ? snapshot.data() : {};
  const legacyKey = typeof legacyData.nineRouterApiKey === "string" ? legacyData.nineRouterApiKey.trim() : "";

  const data = await requestAgentKeys(idToken, "GET");
  const records = Array.isArray(data.keys) ? data.keys : [];
  let credential = records.find((item) => item.provider.toLowerCase() === "9router");

  // Migrate any old browser-readable Firestore key to the encrypted backend store before clearing it.
  if (!credential && legacyKey) {
    credential = await saveEncryptedCredential(idToken, legacyKey, typeof legacyData.nineRouterModel === "string" && legacyData.nineRouterModel.trim() ? legacyData.nineRouterModel.trim() : DEFAULT_KEY_MODEL);
  }
  if (credential && legacyKey) await clearLegacyCredential(user.uid);
  if (!credential || credential.enabled === false) return null;
  return { model: credential.model || DEFAULT_KEY_MODEL, fingerprint: credential.fingerprint || "" };
};

export const clearRouterCredentials = async (): Promise<void> => {
  const { user, idToken } = await getAuthenticatedUser();
  await requestAgentKeys(idToken, "DELETE");
  await clearLegacyCredential(user.uid);
};
