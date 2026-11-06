// src/react/hook/usegemini.ts
import { useState, useCallback, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@config/firebase";

export const ROUTER_ENDPOINT = "https://20128-agq2firibhstlf6sr7k3ydjoim.instabox.tech/v1";
const TOKEN_KEY = "9router_api_token";
const MODEL_KEY = "9router_model";
let cachedApiKey: string | null = null;
let cachedModel = localStorage.getItem(MODEL_KEY) || "openrouter/openrouter/free";

export const getCachedGeminiKey = (): string | null => cachedApiKey || localStorage.getItem(TOKEN_KEY);
export const getCachedRouterModel = (): string => cachedModel || "openrouter/openrouter/free";
export const setCachedGeminiKey = (key: string | null, _uid: string | null) => { cachedApiKey = key; };
export const invalidateGeminiCache = () => { cachedApiKey = null; };
export const GEMINI_KEY_UPDATED_EVENT = "routerCredentialUpdated";

export const useGemini = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));
  const [showAuthModal, setShowAuthModal] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      if (!mountedRef.current) return;
      setIsConfigured(Boolean(localStorage.getItem(TOKEN_KEY)));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    const update = () => { if (mountedRef.current) setIsConfigured(Boolean(localStorage.getItem(TOKEN_KEY))); };
    window.addEventListener(GEMINI_KEY_UPDATED_EVENT, update);
    return () => window.removeEventListener(GEMINI_KEY_UPDATED_EVENT, update);
  }, []);

  const saveApiKey = useCallback(async (apiKey: string, model = "openrouter/openrouter/free") => {
    localStorage.setItem(TOKEN_KEY, apiKey.trim());
    localStorage.setItem(MODEL_KEY, model.trim() || "openrouter/openrouter/free");
    cachedApiKey = apiKey.trim();
    cachedModel = model.trim() || "openrouter/openrouter/free";
    setIsConfigured(true);
    setShowAuthModal(false);
    window.dispatchEvent(new Event(GEMINI_KEY_UPDATED_EVENT));
  }, []);
  const clearApiKey = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(MODEL_KEY);
    invalidateGeminiCache();
    setIsConfigured(false);
    setShowAuthModal(true);
    window.dispatchEvent(new Event(GEMINI_KEY_UPDATED_EVENT));
  }, []);
  const closeModal = useCallback(() => setShowAuthModal(false), []);
  return { isLoading, isConfigured, showAuthModal, saveApiKey, clearApiKey, closeModal };
};
export default useGemini;
