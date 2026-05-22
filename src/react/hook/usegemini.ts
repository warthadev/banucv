// src/react/hook/usegemini.ts
import { useState, useCallback, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@config/firebase";
import { getGeminiApiKey, saveGeminiApiKey, clearGeminiApiKey, hasGeminiToken } from "@config/geminihelper";

export const useGemini = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);
      if (user) {
        // Cek token dari Firestore atau localStorage
        const key = await getGeminiApiKey();
        if (key) {
          setIsConfigured(true);
          setShowAuthModal(false);
        } else {
          setIsConfigured(false);
          setShowAuthModal(true);
        }
      } else {
        setIsConfigured(false);
        setShowAuthModal(false);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const saveApiKey = useCallback(async (apiKey: string) => {
    setIsLoading(true);
    try {
      await saveGeminiApiKey(apiKey);
      setIsConfigured(true);
      setShowAuthModal(false);
      return true;
    } catch (error) {
      console.error("Error saving Gemini API key:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearApiKey = useCallback(() => {
    clearGeminiApiKey();
    setIsConfigured(false);
    setShowAuthModal(true);
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