// src/App.tsx
import React, { Suspense, lazy, useState, useEffect, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import ThemeProvider from "./react/control/themeprovider";
import Loading from "./react/control/loading";
import Navbar from "./react/default/navbar";
import GateAuth from "./react/system/gateauth";
import GateVisit from "./react/system/gatevisit";
import PlayerFloatMusic from "./react/system/playerfloatmusic";
import Quick from "./react/system/quick";
import AudioPlayer from "./react/system/audioplayer";
import CloudPlaylist, { type PlaylistTrack } from "./react/feature/cloudplaylist";
import { useAudio } from "./react/hook/useaudio";
import CollectPhoto from "./react/feature/collectphoto";
import CloudView from "./react/feature/cloudview";

const Home = lazy(() => import("./react/default/home"));
const Login = lazy(() => import("./react/default/login"));
const Setting = lazy(() => import("./react/default/setting"));
const AICheck = lazy(() => import("./react/feature/apiaichecking"));
const AIChat = lazy(() => import("./react/feature/aichat"));
const Download = lazy(() => import("./react/feature/downloader"));
const GithubEditor = lazy(() => import("./react/feature/githubeditor"));
const Barcode = lazy(() => import("./react/feature/barcode"));

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return null;
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const [hasVisited, setHasVisited] = useState(() => localStorage.getItem("hasVisitedBefore") === "true");
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([]);
  const [playlistStartIndex, setPlaylistStartIndex] = useState(0);
  const { pauseBackgroundMusic, resumeBackgroundMusic } = useAudio();

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

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ tracks?: PlaylistTrack[]; initialIndex?: number }>).detail;
      if (!detail?.tracks?.length) return;
      pauseBackgroundMusic();
      setPlaylistTracks(detail.tracks);
      setPlaylistStartIndex(detail.initialIndex || 0);
      setPlaylistOpen(true);
    };

    window.addEventListener("playlist:open", handleOpen);
    return () => window.removeEventListener("playlist:open", handleOpen);
  }, [pauseBackgroundMusic]);

  const closePlaylist = useCallback(() => {
    setPlaylistOpen(false);
    setPlaylistTracks([]);
    setPlaylistStartIndex(0);
    resumeBackgroundMusic();
  }, [resumeBackgroundMusic]);

  const isDashboard = location.pathname === "/dashboard";
  const isLoginPage = location.pathname === "/login";
  
  const hideGlobalUI = isLoginPage || (isDashboard && !hasVisited);

  return (
    <ThemeProvider>
      <ScrollToTop />

      {!hideGlobalUI && <Navbar />}
      {!hideGlobalUI && <Quick />}
      
      {!hideGlobalUI && !playlistOpen && <PlayerFloatMusic />}

      <CloudPlaylist
        isOpen={playlistOpen}
        tracks={playlistTracks}
        initialIndex={playlistStartIndex}
        onClose={closePlaylist}
      />

      <AudioPlayer />

      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          
          <Route path="/ai-check" element={<GateAuth><AICheck /></GateAuth>} />
          <Route path="/ai-chat" element={<GateAuth><AIChat /></GateAuth>} />
          <Route path="/downloader" element={<GateAuth><Download /></GateAuth>} />
          <Route path="/setting" element={<GateAuth><Setting /></GateAuth>} />
          <Route path="/github-editor" element={<GateAuth><GithubEditor /></GateAuth>} />
          <Route path="/barcode" element={<GateAuth><Barcode /></GateAuth>} />
          <Route path="/loading" element={<GateAuth><Loading /></GateAuth>} />
          <Route path="/collect-photo" element={<GateAuth><CollectPhoto /></GateAuth>} />
          <Route path="/cloudview" element={<GateAuth><CloudView /></GateAuth>} />
          
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

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
