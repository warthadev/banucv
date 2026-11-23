import { getActiveBase } from "./api";
import { getAuth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

export interface KaggleCredentials {
  username: string;
  apiToken: string;
}

interface KaggleCredentialsResponse {
  configured?: boolean;
  success?: boolean;
  credentials?: KaggleCredentials | null;
  detail?: string;
}

export const getKaggleAuthHeaders = async (): Promise<Record<string, string>> => {
  const firebaseAuth = await getAuth();
  let user = firebaseAuth.currentUser;
  if (!user) {
    user = await new Promise((resolve) => {
      let unsubscribe = () => {};
      unsubscribe = onAuthStateChanged(firebaseAuth, (resolvedUser) => {
        unsubscribe();
        resolve(resolvedUser);
      });
    });
  }
  if (!user) throw new Error("Sign in to use the Downloader with your Kaggle account.");
  return { Authorization: `Bearer ${await user.getIdToken()}` };
};

const requestCredentials = async (
  method: "GET" | "PUT" | "DELETE",
  body?: KaggleCredentials,
): Promise<KaggleCredentialsResponse> => {
  const base = getActiveBase().replace(/\/+$/, "");
  if (!base) throw new Error("Downloader backend is not configured.");
  const authHeaders = await getKaggleAuthHeaders();
  const response = await fetch(`${base}/kaggle/settings/credentials`, {
    method,
    headers: {
      ...authHeaders,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify({ username: body.username, api_token: body.apiToken }) } : {}),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as KaggleCredentialsResponse;
  if (!response.ok) throw new Error(data.detail || `Kaggle settings request failed (${response.status})`);
  return data;
};

export const loadKaggleCredentials = async (): Promise<KaggleCredentials | null> => {
  const data = await requestCredentials("GET");
  if (!data.configured || !data.credentials) return null;
  if (!data.credentials.username || !data.credentials.apiToken) {
    throw new Error("This account's Kaggle credentials could not be loaded.");
  }
  return data.credentials;
};

export const saveKaggleCredentials = async (username: string, apiToken: string): Promise<KaggleCredentials> => {
  const normalized = { username: username.trim(), apiToken: apiToken.trim() };
  if (!normalized.username || !normalized.apiToken) throw new Error("Enter both the Kaggle username and API token.");
  const data = await requestCredentials("PUT", normalized);
  if (!data.configured || !data.credentials) throw new Error("The saved Kaggle credentials could not be verified.");
  return data.credentials;
};

export const deleteKaggleCredentials = async (): Promise<void> => {
  await requestCredentials("DELETE");
};
