// src/react/hook/usetelegramauth.ts
import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@config/firebase";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";

export const useTelegramAuth = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionString, setSessionString] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (user) {
        loadSession(user.uid);
      } else {
        setIsLoading(false);
        setSessionString(null);
        setShowAuthModal(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadSession = useCallback(async (uid: string) => {
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        const sessions = data.telegramSessions || [];
        const session = sessions.length > 0 ? sessions[0] : null;
        if (session) {
          setSessionString(session);
          setShowAuthModal(false);
        } else {
          setSessionString(null);
          setShowAuthModal(true);
        }
      } else {
        setSessionString(null);
        setShowAuthModal(true);
      }
    } catch (error) {
      setSessionString(null);
      setShowAuthModal(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSession = useCallback(async (session: string, accountName?: string) => {
    if (!authReady) {
      await new Promise((resolve) => {
        const checkAuth = setInterval(() => {
          if (authReady) {
            clearInterval(checkAuth);
            resolve(null);
          }
        }, 100);
      });
    }

    const user = auth.currentUser;

    if (!user) {
      throw new Error("User not authenticated");
    }

    const userRef = doc(db, "users", user.uid);
    const name = accountName || "Telegram Account";

    try {
      await updateDoc(userRef, {
        telegramSessions: arrayUnion(session),
        telegramAccountNames: arrayUnion(name),
      });
    } catch (error: any) {
      throw error;
    }

    setSessionString(session);
    setShowAuthModal(false);
  }, [authReady]);

  const clearSession = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { 
          telegramSessions: null,
          telegramAccountNames: null,
        });
      } catch (error) {
        // Silently fail
      }
    }
    setSessionString(null);
    setShowAuthModal(true);
  }, []);

  const clearAllTelegramSessions = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { 
          telegramSessions: null,
          telegramAccountNames: null,
        });
      } catch (error) {
        // Silently fail
      }
    }
    setSessionString(null);
    setShowAuthModal(true);
  }, []);

  return {
    isLoading,
    sessionString,
    showAuthModal,
    saveSession,
    clearSession,
    clearAllTelegramSessions,
    closeModal: () => setShowAuthModal(false),
  };
};