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
  // Akun Cloud dicek OTOMATIS saat login Firebase (auth): halaman tetap tampil,
  // hasil cek muncul di popover (Checking… lalu daftar model / Connect OpenRouter).
  // Tombol "Check Cloud account" di popover hanya untuk cek ulang manual.
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

  // Cek ulang akun Cloud secara manual (tombol "Check Cloud account" di popover).
  // Cek otomatisnya terjadi saat login lewat effect auth di bawah; simpan key
  // baru juga memicu refreshAccount lewat event di bawah.
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
      // Login langsung mengecek akun Cloud secara otomatis: catat user-nya,
      // tampilkan halaman (loading selesai), lalu jalankan refreshAccount.
      // Halaman agent tetap tampil walau Cloud belum terkonfigurasi, supaya
      // Local tetap bisa dipakai tanpa OpenRouter key.
      unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        userRef.current = user;
        if (!mountedRef.current) return;
        setIsLoading(false);
        void refreshAccount(user);
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
