// src/App.tsx (setelah perbaikan)
import React, { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
// Hapus import Provider dan store karena sudah di main.tsx
import ThemeProvider from "./react/config/themeprovider";
import Loading from "./react/control/loading";
import Navbar from "./react/default/navbar";
import GateAuth from "./react/system/gateauth";
import GateVisit from "./react/system/gatevisit";
import PlayerFloatMusic from "./react/system/playerfloatmusic";
import Quick from "./react/system/quick";
import AudioPlayer from "./react/system/audioplayer";
// Tambah import di bagian atas
import CollectPhoto from "./react/feature/collectphoto";

// Lazy loading komponen (tetap sama)
const Home = lazy(() => import("./react/default/home"));
const Login = lazy(() => import("./react/default/login"));
const Setting = lazy(() => import("./react/default/setting"));
const AICheck = lazy(() => import("./react/feature/apiaichecking"));
const AIChat = lazy(() => import("./react/feature/aichat"));
const Download = lazy(() => import("./react/feature/ytdl"));
const GithubEditor = lazy(() => import("./react/feature/githubeditor"));
const Barcode = lazy(() => import("./react/feature/barcode"));

const AppContent: React.FC = () => {
  const location = useLocation();
  const [hasVisited, setHasVisited] = useState(() => localStorage.getItem("hasVisitedBefore") === "true");

  useEffect(() => {
    const handleStorageChange = () => {
      const status = localStorage.getItem("hasVisitedBefore") === "true";
      setHasVisited(status);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("visitUpdated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("visitUpdated", handleStorageChange);
    };
  }, []);

  const isDashboard = location.pathname === "/dashboard";
  const isLoginPage = location.pathname === "/login";
  
  const hideGlobalUI = isLoginPage || (isDashboard && !hasVisited);

  return (
    <ThemeProvider>
      {!hideGlobalUI && <Navbar />}
      {!hideGlobalUI && <Quick />}
      
      {isDashboard && hasVisited && <PlayerFloatMusic />}

      <AudioPlayer />

      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route path="/ai-check" element={<GateAuth><AICheck /></GateAuth>} />
          <Route path="/ai-chat" element={<GateAuth><AIChat /></GateAuth>} />
          <Route path="/downloader" element={<GateAuth><Download /></GateAuth>} />
          <Route path="/setting" element={<GateAuth><Setting /></GateAuth>} />
          <Route path="/github-editor" element={<GateAuth><GithubEditor /></GateAuth>} />
          <Route path="/barcode" element={<GateAuth><Barcode /></GateAuth>} />
          <Route path="/loading" element={<GateAuth><Loading /></GateAuth>} />
          <Route path="/collect-photo" element={<GateAuth><CollectPhoto /></GateAuth>} />
          
          {/* Dashboard with Tutorial Gate */}
          <Route
            path="/dashboard"
            element={
              <GateAuth>
                <GateVisit />
              </GateAuth>
            }
          />
        </Routes>
      </Suspense>
    </ThemeProvider>
  );
};

// App tidak perlu lagi membungkus dengan Provider
const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;