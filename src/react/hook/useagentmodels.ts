import { useState, useCallback, useEffect, useRef } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getAuth } from "@config/firebase";
import { loadRouterCredentials, loadRouterModelCatalog } from "@config/routerhelper";
import type { AgentModel } from "@config/agentmodels";

export const ROUTER_CREDENTIAL_UPDATED_EVENT = "routerCredentialUpdated";

export const useAgentModels = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [routerModels, setRouterModels] = useState<AgentModel[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const refreshAccount = useCallback(async (user: User | null) => {
    const requestId = ++requestIdRef.current;
    if (!mountedRef.current) return;
    if (!user) {
      setRouterModels([]);
      setIsConfigured(false);
      setCatalogError(null);
      setConfigurationError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setRouterModels([]);
    setCatalogError(null);
    setConfigurationError(null);
    try {
      const credentials = await loadRouterCredentials();
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setIsConfigured(Boolean(credentials));

      try {
        const models = await loadRouterModelCatalog();
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setRouterModels(models);
      } catch (error) {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setCatalogError(error instanceof Error ? error.message : "Unable to load the model catalog.");
      }
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setConfigurationError(error instanceof Error ? error.message : "Unable to load 9Router key status.");
      setIsConfigured(false);
      setRouterModels([]);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    let disposed = false;
    const handleCredentialUpdated = () => {
      void getAuth().then((firebaseAuth) => refreshAccount(firebaseAuth.currentUser));
    };
    window.addEventListener(ROUTER_CREDENTIAL_UPDATED_EVENT, handleCredentialUpdated);

    getAuth().then((firebaseAuth) => {
      if (disposed) return;
      unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        void refreshAccount(user);
      });
    }).catch((error: unknown) => {
      if (!mountedRef.current) return;
      setRouterModels([]);
      setIsConfigured(false);
      setConfigurationError(error instanceof Error ? error.message : "Firebase authentication is unavailable.");
      setIsLoading(false);
    });

    return () => {
      disposed = true;
      requestIdRef.current += 1;
      unsubscribe();
      window.removeEventListener(ROUTER_CREDENTIAL_UPDATED_EVENT, handleCredentialUpdated);
    };
  }, [refreshAccount]);

  return {
    isLoading,
    isConfigured,
    routerModels,
    routerModelIds: routerModels.map((model) => model.id),
    catalogError,
    configurationError,
  };
};

export default useAgentModels;
