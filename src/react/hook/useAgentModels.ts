import { useState, useCallback, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getAuth } from "@config/firebase";
import { clearRouterCredentials, loadRouterCredentials, saveRouterCredentials } from "@config/routerhelper";
import { AGENT_API_BASE } from "@config/api";

export const ROUTER_ENDPOINT = "https://20128-agq2firibhstlf6sr7k3ydjoim.instabox.tech/v1";
export const LOCAL_AGENT_MODEL = "mimo-v2.6:latest";
export const AUTOMATIC_AGENT_MODEL = LOCAL_AGENT_MODEL;
const DEFAULT_ROUTER_MODEL = "openrouter/openrouter/free";
const FALLBACK_MODELS = [LOCAL_AGENT_MODEL, DEFAULT_ROUTER_MODEL];
let cachedModels: string[] = FALLBACK_MODELS;
export const getCachedRouterModels = (): string[] => cachedModels;
export const getCachedRouterModel = (): string => cachedModels[0] || AUTOMATIC_AGENT_MODEL;
export const invalidateAgentCache = () => { cachedModels = FALLBACK_MODELS; };
export const ROUTER_CREDENTIAL_UPDATED_EVENT = "routerCredentialUpdated";

const fetchAgentModels = async (idToken: string): Promise<string[]> => {
  const response = await fetch(`${AGENT_API_BASE}/agent/models`, { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.detail || `Agent models request failed: ${response.status}`);
  const models = Array.isArray(data.data) ? data.data.map((item: { id?: string; name?: string }) => item.id || item.name).filter(Boolean) : [];
  return models.length ? models : FALLBACK_MODELS;
};

export const useAgentModels = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [routerModels, setRouterModels] = useState<string[]>(cachedModels);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    getAuth().then((firebaseAuth) => {
      unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (!mountedRef.current) return;
        if (!user) {
          invalidateAgentCache();
          setIsConfigured(false);
          setShowAuthModal(false);
          setIsLoading(false);
          return;
        }
        setIsLoading(true);
        try {
          const idToken = await user.getIdToken(true);
          const credentials = await loadRouterCredentials();
          let models = FALLBACK_MODELS;
          try {
            models = await fetchAgentModels(idToken);
          } catch (error) {
            console.warn("Agent model list unavailable; local model remains available", error);
          }
          cachedModels = models;
          const localModelAvailable = models.some((model) => model.trim().toLowerCase() === LOCAL_AGENT_MODEL.toLowerCase());
          if (mountedRef.current) {
            setRouterModels(models);
            setIsConfigured(Boolean(credentials) || localModelAvailable);
            setShowAuthModal(!credentials && !localModelAvailable);
          }
        } catch (error) {
          console.error("Failed to initialize AI Agent credentials:", error);
          if (mountedRef.current) {
            setIsConfigured(false);
            setShowAuthModal(true);
          }
        } finally {
          if (mountedRef.current) setIsLoading(false);
        }
      });
    }).catch((error) => {
      console.error("Failed to initialize auth:", error);
      if (mountedRef.current) {
        setIsConfigured(false);
        setShowAuthModal(true);
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const saveApiKey = useCallback(async (apiKey: string) => {
    await saveRouterCredentials(apiKey);
    const firebaseAuth = await getAuth();
    const firebaseUser = firebaseAuth.currentUser;
    if (!firebaseUser) throw new Error("Please sign in before saving 9Router credentials");
    const idToken = await firebaseUser.getIdToken(true);
    let models = FALLBACK_MODELS;
    try {
      models = await fetchAgentModels(idToken);
    } catch (error) {
      console.warn("Agent model list unavailable after saving credentials", error);
    }
    cachedModels = models;
    setRouterModels(models);
    setIsConfigured(true);
    setShowAuthModal(false);
    window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
  }, []);

  const clearApiKey = useCallback(async () => {
    await clearRouterCredentials();
    invalidateAgentCache();
    setRouterModels(FALLBACK_MODELS);
    setIsConfigured(false);
    setShowAuthModal(true);
    window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
  }, []);

  const openModal = useCallback(() => setShowAuthModal(true), []);
  const closeModal = useCallback(() => setShowAuthModal(false), []);
  return { isLoading, isConfigured, showAuthModal, saveApiKey, clearApiKey, openModal, closeModal, routerModels };
};

export default useAgentModels;
