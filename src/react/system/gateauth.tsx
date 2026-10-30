// src/react/system/gateauth.tsx
import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { onAuthStateChanged } from "firebase/auth";
import { getAuth } from "@config/firebase";
import type { RootState } from "../redux/store";
import Loading from "@control/loading";

interface GateAuthProps {
  children: React.ReactNode;
}

const AUTH_CACHE_KEY = "wartha_auth_cached";

const readAuthCache = (): boolean => {
  try {
    return sessionStorage.getItem(AUTH_CACHE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeAuthCache = (value: boolean) => {
  try {
    if (value) {
      sessionStorage.setItem(AUTH_CACHE_KEY, "1");
    } else {
      sessionStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {
    void 0;
  }
};

const GateAuth: React.FC<GateAuthProps> = ({ children }) => {
  const location = useLocation();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => !readAuthCache());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => readAuthCache());
  const [firebaseReady, setFirebaseReady] = useState<boolean>(() => readAuthCache());

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const initAuth = async () => {
      try {
        const auth = await getAuth();
        if (cancelled) return;

        setFirebaseReady(true);

        unsubscribe = onAuthStateChanged(auth, (user) => {
          const authed = !!user;
          setIsAuthenticated(authed);
          setIsAuthLoading(false);
          writeAuthCache(authed);
        });
      } catch (error) {
        console.error("Failed to initialize Firebase Auth:", error);
        if (cancelled) return;
        setIsAuthLoading(false);
        setIsAuthenticated(false);
        setFirebaseReady(true);
        writeAuthCache(false);
      }
    };

    initAuth();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (isAuthLoading || !firebaseReady) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default GateAuth;