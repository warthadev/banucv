// src/react/hook/usegemini.ts
import { useState, useCallback, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@config/firebase";
import { getGeminiApiKey, saveGeminiApiKey, clearGeminiApiKey } from "@config/geminihelper";

let cachedApiKey: string | null = null;
let cachedUid: string | null = null;

export const getCachedGeminiKey = (): string | null => cachedApiKey;

export const setCachedGeminiKey = (key: string | null, uid: string | null) => {
  cachedApiKey = key;
  cachedUid = uid;
};

export const invalidateGeminiCache = () => {
  cachedApiKey = null;
  cachedUid = null;
};

export const GEMINI_KEY_UPDATED_EVENT = "geminiKeyUpdated";

export const useGemini = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkKey = useCallback(async () => {
    const user = auth.currentUser;
    if (!mountedRef.current) return;
    if (!user) {
      invalidateGeminiCache();
      setIsConfigured(false);
      setShowAuthModal(false);
      setIsLoading(false);
      return;
    }

    if (cachedUid !== user.uid) {
      cachedApiKey = null;
      cachedUid = user.uid;
    }

    const key = await getGeminiApiKey();
    if (!mountedRef.current) return;

    if (key) {
      cachedApiKey = key;
      cachedUid = user.uid;
      setIsConfigured(true);
      setShowAuthModal(false);
    } else {
      cachedApiKey = null;
      cachedUid = user.uid;
      setIsConfigured(false);
      setShowAuthModal(true);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mountedRef.current) return;
      setIsLoading(true);
      if (!user) {
        invalidateGeminiCache();
        setIsConfigured(false);
        setShowAuthModal(false);
        setIsLoading(false);
        return;
      }
      await checkKey();
    });
    return () => unsubscribe();
  }, [checkKey]);

  useEffect(() => {
    const handleKeyUpdated = () => {
      invalidateGeminiCache();
      checkKey();
    };
    window.addEventListener(GEMINI_KEY_UPDATED_EVENT, handleKeyUpdated);
    return () => window.removeEventListener(GEMINI_KEY_UPDATED_EVENT, handleKeyUpdated);
  }, [checkKey]);

  const saveApiKey = useCallback(async (apiKey: string) => {
    setIsLoading(true);
    try {
      await saveGeminiApiKey(apiKey);
      const user = auth.currentUser;
      cachedApiKey = apiKey;
      cachedUid = user?.uid || null;
      setIsConfigured(true);
      setShowAuthModal(false);
      window.dispatchEvent(new Event(GEMINI_KEY_UPDATED_EVENT));
      return true;
    } catch (error) {
      console.error("Error saving Gemini API key:", error);
      throw error;
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  const clearApiKey = useCallback(async () => {
    setIsLoading(true);
    try {
      await clearGeminiApiKey();
      invalidateGeminiCache();
      setIsConfigured(false);
      setShowAuthModal(true);
      window.dispatchEvent(new Event(GEMINI_KEY_UPDATED_EVENT));
    } catch (error) {
      console.error("Error clearing Gemini API key:", error);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  const closeModal = useCallback(() => setShowAuthModal(false), []);

  return {
    isLoading,
    isConfigured,
    showAuthModal,
    saveApiKey,
    clearApiKey,
    closeModal,
  };
};

export default useGemini;