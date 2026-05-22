// src/react/system/gateauth.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../redux/store";

interface GateAuthProps {
  children: React.ReactNode;
}

// path GateAuth: komponen penjaga rute yang memerlukan autentikasi
const GateAuth: React.FC<GateAuthProps> = ({ children }) => {
  const location = useLocation();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default GateAuth;