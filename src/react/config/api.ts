// src/react/config/api.ts
export const API_FALLBACKS: string[] = (() => {
  const raw = (import.meta.env.VITE_API_FALLBACKS as string | undefined)?.trim();
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
})();

const STORAGE_KEY = 'wartha_active_api_base';
const HEALTH_TIMEOUT_MS = 6000;
const CONFIG_TIMEOUT_MS = 8000;

const normalize = (url: string): string => url.replace(/\/+$/, '');

const readCachedBase = (): string | null => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    return normalize(saved);
  } catch {
    return null;
  }
};

const writeCachedBase = (url: string) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, normalize(url));
  } catch {
    void 0;
  }
};

const clearCachedBase = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    void 0;
  }
};

type HealthResult = {
  base: string;
  ok: boolean;
  via: 'json' | 'none';
};

const checkHealth = async (base: string, timeoutMs: number = HEALTH_TIMEOUT_MS): Promise<HealthResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${normalize(base)}/health`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      mode: 'cors',
    });
    if (!res.ok) {
      return { base, ok: false, via: 'none' };
    }
    try {
      const data = await res.json();
      if (data && typeof data === 'object' && ('status' in data || 'modules' in data)) {
        return { base, ok: true, via: 'json' };
      }
      return { base, ok: false, via: 'none' };
    } catch {
      return { base, ok: false, via: 'none' };
    }
  } catch {
    return { base, ok: false, via: 'none' };
  } finally {
    clearTimeout(timer);
  }
};

const tryFetchConfig = async (base: string): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
  try {
    const res = await fetch(`${normalize(base)}/config`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      mode: 'cors',
    });
    if (!res.ok) return false;
    const text = await res.text();
    const trimmed = text.trimStart();
    if (trimmed.startsWith('<')) return false;
    JSON.parse(text);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

const envBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const initialBase: string = envBase && envBase.length > 0
  ? normalize(envBase)
  : normalize(API_FALLBACKS[0] || '');

export let API_BASE: string = initialBase;

export const getActiveBase = (): string => API_BASE;

const buildCandidates = (): string[] => {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const pushUnique = (url: string) => {
    if (!url) return;
    const n = normalize(url);
    if (!n) return;
    if (!seen.has(n)) {
      seen.add(n);
      candidates.push(n);
    }
  };
  pushUnique(initialBase);
  for (const url of API_FALLBACKS) pushUnique(url);
  return candidates;
};

export const initActiveBase = async (): Promise<string> => {
  const candidates = buildCandidates();

  if (candidates.length === 0) {
    API_BASE = '';
    return API_BASE;
  }

  const cached = readCachedBase();
  if (cached) {
    const cachedIsUsable = await tryFetchConfig(cached);
    if (cachedIsUsable) {
      API_BASE = cached;
      return API_BASE;
    }
    clearCachedBase();
  }

  const healthResults = await Promise.all(
    candidates.map(async (base) => await checkHealth(base))
  );

  const aliveCandidates = healthResults.filter(r => r.ok);

  for (const result of aliveCandidates) {
    const configOk = await tryFetchConfig(result.base);
    if (configOk) {
      API_BASE = result.base;
      writeCachedBase(result.base);
      return API_BASE;
    }
  }

  for (const candidate of candidates) {
    const configOk = await tryFetchConfig(candidate);
    if (configOk) {
      API_BASE = candidate;
      writeCachedBase(candidate);
      return API_BASE;
    }
  }

  API_BASE = candidates[0];
  return API_BASE;
};

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

export interface FeaturesConfig {
  telegram: boolean;
  gemini: boolean;
}

export interface AppConfig {
  firebase: FirebaseConfig;
  features: FeaturesConfig;
}

let cachedConfig: AppConfig | null = null;
let configLoading: Promise<AppConfig> | null = null;

const fetchConfigFrom = async (base: string): Promise<AppConfig> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
  try {
    const response = await fetch(`${normalize(base)}/config`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      mode: 'cors',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status}`);
    }
    const text = await response.text();
    const trimmed = text.trimStart();
    if (trimmed.startsWith('<')) {
      throw new Error('Config endpoint returned HTML, not JSON');
    }
    return JSON.parse(text) as AppConfig;
  } finally {
    clearTimeout(timer);
  }
};

export const fetchAppConfig = async (): Promise<AppConfig> => {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (configLoading) {
    return configLoading;
  }

  configLoading = (async () => {
    const candidates = buildCandidates();
    const ordered: string[] = [];
    const seen = new Set<string>();
    const pushUnique = (url: string) => {
      if (!url) return;
      const n = normalize(url);
      if (!n) return;
      if (!seen.has(n)) {
        seen.add(n);
        ordered.push(n);
      }
    };
    pushUnique(API_BASE);
    for (const c of candidates) pushUnique(c);

    if (ordered.length === 0) {
      throw new Error('No API base configured');
    }

    let lastError: Error | null = null;

    for (const base of ordered) {
      try {
        const data = await fetchConfigFrom(base);
        if (data && data.firebase && data.features) {
          API_BASE = base;
          writeCachedBase(base);
          cachedConfig = data;
          return data;
        }
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError || new Error('Failed to fetch config from any backend');
  })();

  try {
    return await configLoading;
  } finally {
    configLoading = null;
  }
};

export const getFirebaseConfig = async (): Promise<FirebaseConfig> => {
  const config = await fetchAppConfig();
  return config.firebase;
};

export const getFeaturesConfig = async (): Promise<FeaturesConfig> => {
  const config = await fetchAppConfig();
  return config.features;
};

export const isTelegramEnabled = async (): Promise<boolean> => {
  const features = await getFeaturesConfig();
  return features.telegram;
};

export const isGeminiEnabled = async (): Promise<boolean> => {
  const features = await getFeaturesConfig();
  return features.gemini;
};

export const resetConfigCache = () => {
  cachedConfig = null;
  configLoading = null;
  clearCachedBase();
};