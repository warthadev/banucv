import { useState, useCallback, useEffect, useRef } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getAuth } from "@config/firebase";
import { loadOpenRouterCredentials, loadOpenRouterModelCatalog } from "@config/routerhelper";
import type { AgentModel } from "@config/agentmodels";

export const ROUTER_CREDENTIAL_UPDATED_EVENT = "openRouterCredentialUpdated";

export const useAgentModels = () => {
  const [isLoading, setIsLoading] = useState(true);
  // `isLoading` = login Firebase belum beres (halaman masih <Loading />).
  // `checking` = cek akun Cloud manual sedang berjalan (popover tetap tampil).
  const [checking, setChecking] = useState(false);
  // Akun Cloud TIDAK pernah dicek otomatis: login / buka halaman tidak menyentuh
  // apa-apa. Cek hanya saat pengguna menekan "Check Cloud account", atau saat
  // key baru disimpan (RouterAuthModal / Settings).
  const [checked, setChecked] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [routerModels, setRouterModels] = useState<AgentModel[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const userRef = useRef<User | null>(null);

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
      setHasSavedKey(false);
      setProvider(null);
      setCatalogError(null);
      setConfigurationError(null);
      setChecked(false);
      setIsLoading(false);
      return;
    }

    setChecking(true);
    setRouterModels([]);
    setCatalogError(null);
    setConfigurationError(null);
    try {
      const credentials = await loadOpenRouterCredentials();
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      const ready = Boolean(credentials);
      setHasSavedKey(Boolean(credentials));
      setIsConfigured(ready);
      setProvider(credentials?.provider ?? null);

      if (!credentials) {
        setRouterModels([]);
        return;
      }
      try {
        const models = await loadOpenRouterModelCatalog();
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setRouterModels(models);
      } catch (error) {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setCatalogError(error instanceof Error ? error.message : "Unable to load OpenRouter's free-model catalog.");
      }
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setConfigurationError(error instanceof Error ? error.message : "Unable to load OpenRouter settings.");
      setIsConfigured(false);
      setHasSavedKey(false);
      setProvider(null);
      setRouterModels([]);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setIsLoading(false);
        setChecking(false);
        setChecked(true);
      }
    }
  }, []);

  // Cek akun Cloud secara manual: hanya ini yang boleh memanggil refreshAccount
  // dari UI (tombol "Check Cloud account" di popover). Simpan key baru juga
  // memicu refreshAccount lewat event di bawah.
  const checkAccount = useCallback(() => {
    void refreshAccount(userRef.current);
  }, [refreshAccount]);

  useEffect(() => {
    let unsubscribe = () => {};
    let disposed = false;
    const handleCredentialUpdated = () => {
      void getAuth().then((firebaseAuth) => refreshAccount(firebaseAuth.currentUser));
    };
    window.addEventListener(ROUTER_CREDENTIAL_UPDATED_EVENT, handleCredentialUpdated);

    getAuth().then((firebaseAuth) => {
      if (disposed) return;
      // Login saja tidak mengecek akun Cloud: catat user-nya, kosongkan hasil
      // cek lama, lalu selesai loading. Halaman agent tampil tanpa tahu
      // status Cloud sampai pengguna mengecek manual.
      unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        userRef.current = user;
        if (!mountedRef.current) return;
        setChecked(false);
        setRouterModels([]);
        setIsConfigured(false);
        setHasSavedKey(false);
        setProvider(null);
        setCatalogError(null);
        setConfigurationError(null);
        setIsLoading(false);
      });
    }).catch((error: unknown) => {
      if (!mountedRef.current) return;
      setRouterModels([]);
      setIsConfigured(false);
      setHasSavedKey(false);
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
    checking,
    checked,
    checkAccount,
    isConfigured,
    hasSavedKey,
    provider,
    routerModels,
    routerModelIds: routerModels.map((model) => model.id),
    catalogError,
    configurationError,
  };
};

export default useAgentModels;
