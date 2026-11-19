const normalize = (value: string) => value.replace(/\/+$/, "");

const configuredBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_API_FALLBACKS as string | undefined)?.split(",")[0]?.trim() || "";

export const API_BASE = normalize(configuredBase);

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

type AppConfig = { firebase: FirebaseConfig };
let cachedConfig: AppConfig | null = null;

export const initActiveBase = async () => API_BASE;

export const getFirebaseConfig = async (): Promise<FirebaseConfig> => {
  if (cachedConfig) return cachedConfig.firebase;
  if (!API_BASE) throw new Error("No API base configured.");
  const response = await fetch(`${API_BASE}/config`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load application configuration.");
  const config = await response.json() as AppConfig;
  if (!config.firebase) throw new Error("Firebase configuration is missing.");
  cachedConfig = config;
  return config.firebase;
};
