import { useState, useCallback, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getAuth } from "@config/firebase";
import { clearRouterCredentials, loadRouterCredentials, saveRouterCredentials } from "@config/routerhelper";
import { AI_AGENT_API_BASE } from "@config/api";
import { LOCAL_AGENT_MODEL } from "@config/agentrouting";
import { extractAgentModelIds } from "@config/agentmodels";
export const ROUTER_ENDPOINT = "https://20128-agq2firibhstlf6sr7k3ydjoim.instabox.tech/v1";
export { LOCAL_AGENT_MODEL };
export const ROUTER_CREDENTIAL_UPDATED_EVENT = "routerCredentialUpdated";
const fetchAgentModels = async (idToken: string): Promise<string[]> => {
  const response = await fetch(`${AI_AGENT_API_BASE}/agent/models`, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store",
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data && typeof data === "object" && "detail" in data
      ? (data as { detail?: unknown }).detail
      : undefined;
    throw new Error(typeof detail === "string" ? detail : `Agent models request failed: ${response.status}`);
  }
  return extractAgentModelIds(data);
};
export const useAgentModels = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [routerModels, setRouterModels] = useState<string[]>([]);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);
  useEffect(() => {
    let unsubscribe = () => {};
    let disposed = false;
    getAuth().then((firebaseAuth) => {
      if (disposed) return;
      unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        const requestId = ++requestIdRef.current;
        if (!mountedRef.current) return;
        if (!user) {
          setRouterModels([]);
          setIsConfigured(false);
          setShowAuthModal(false);
          setIsLoading(false);
          return;
        }
        setIsLoading(true);
        setRouterModels([]);
        try {
          const idToken = await user.getIdToken(true);
          const credentials = await loadRouterCredentials();
          let models: string[] = [];
          try {
            models = await fetchAgentModels(idToken);
          } catch (error) {
            console.warn("Agent model list unavailable; no live models can be shown", error);
          }
          if (!mountedRef.current || requestId !== requestIdRef.current) return;
          const isConfiguredForAccount = Boolean(credentials) || models.length > 0;
          setRouterModels(models);
          setIsConfigured(isConfiguredForAccount);
          setShowAuthModal(!isConfiguredForAccount);
        } catch (error) {
          console.error("Failed to initialize AI Agent credentials:", error);
          if (mountedRef.current && requestId === requestIdRef.current) {
            setRouterModels([]);
            setIsConfigured(false);
            setShowAuthModal(true);
          }
        } finally {
          if (mountedRef.current && requestId === requestIdRef.current) setIsLoading(false);
        }
      });
    }).catch((error) => {
      console.error("Failed to initialize auth:", error);
      if (mountedRef.current) {
        setRouterModels([]);
        setIsConfigured(false);
        setShowAuthModal(true);
        setIsLoading(false);
      }
    });
    return () => {
      disposed = true;
      requestIdRef.current += 1;
      unsubscribe();
    };
  }, []);
  const saveApiKey = useCallback(async (apiKey: string) => {
    await saveRouterCredentials(apiKey);
    const firebaseAuth = await getAuth();
    const firebaseUser = firebaseAuth.currentUser;
    if (!firebaseUser) throw new Error("Please sign in before saving 9Router credentials");
    const requestId = ++requestIdRef.current;
    const idToken = await firebaseUser.getIdToken(true);
    let models: string[] = [];
    try {
      models = await fetchAgentModels(idToken);
    } catch (error) {
      console.warn("Agent model list unavailable after saving credentials", error);
    }
    if (mountedRef.current && requestId === requestIdRef.current) {
      setRouterModels(models);
      setIsConfigured(true);
      setShowAuthModal(false);
    }
    window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
  }, []);
  const clearApiKey = useCallback(async () => {
    requestIdRef.current += 1;
    await clearRouterCredentials();
    setRouterModels([]);
    setIsConfigured(false);
    setShowAuthModal(true);
    window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
  }, []);
  const openModal = useCallback(() => setShowAuthModal(true), []);
  const closeModal = useCallback(() => setShowAuthModal(false), []);
  return { isLoading, isConfigured, showAuthModal, saveApiKey, clearApiKey, openModal, closeModal, routerModels };
};
export default useAgentModels;
