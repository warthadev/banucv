// src/react/default/settinguser.tsx
import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { auth, db } from "@config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  User as UserIcon, AlertCircle, CheckCircle,
  Mail, Calendar, MapPin, Smartphone, Globe, Clock, 
  Activity, Monitor, Phone, Cpu, Navigation, Wifi,
  Cloud, Copy, Eye, EyeOff, Check
} from "lucide-react";
import { GithubIcon } from "@/react/control/icon";
import { formatTimestamp } from "@config/userstorage";
import type { RegisterSettingsSaveHandler, SettingsSaveHandler, SettingsSaveResult } from "./settingssave";

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providers: string[];
  createdAt?: unknown;
  lastLoginAt?: unknown;
  lastSeen?: unknown;
  loginCount?: number;
  githubUsername?: string | null;
  githubToken?: string | null;
  telegramSessions?: string[];
  telegramAccountNames?: string[];
  hfUsernames?: string[];
  hfTokens?: string[];
  lastLocation?: {
    city: string;
    country: string;
    lat: number;
    lon: number;
    ip: string;
    timestamp: unknown;
  };
  lastDevice?: {
    userAgent: string;
    platform: string;
    isMobile: boolean;
  };
}

const getDateOnly = (timestamp: unknown): string => {
  if (!timestamp) return "Unknown";
  const formatted = formatTimestamp(timestamp);
  return formatted.split(" at ")[0] || formatted;
};

const getTimeOnly = (timestamp: unknown): string => {
  if (!timestamp) return "Unknown";
  const formatted = formatTimestamp(timestamp);
  const parts = formatted.split(" at ");
  return parts.length > 1 ? parts[1] : formatted;
};

interface SettingUserProps {
  registerSaveHandler: RegisterSettingsSaveHandler;
  onSettingsChanged: () => void;
  onLoadingChange: (isLoading: boolean) => void;
}

const SettingUser: React.FC<SettingUserProps> = ({ registerSaveHandler, onSettingsChanged, onLoadingChange }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [githubUser, setGithubUser] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [showCloudTokens, setShowCloudTokens] = useState<Record<string, boolean>>({});
  const [copyFeedback, setCopyFeedback] = useState<Record<string, "copied" | "error">>({});
  const [telegramSessions, setTelegramSessions] = useState<string[]>([]);
  const [telegramAccountNames, setTelegramAccountNames] = useState<string[]>([]);
  const [hfUsernames, setHfUsernames] = useState<string[]>([]);
  const [hfTokens, setHfTokens] = useState<string[]>([]);
  
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const saveHandlerRef = useRef<SettingsSaveHandler | null>(null);
  
  const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth <= 768);

  useLayoutEffect(() => {
    onLoadingChange(!authReady || loading);
  }, [authReady, loading, onLoadingChange]);
  
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      onSettingsChanged();
      setLoading(true);
      setCurrentUser(user);
      setShowGithubToken(false);
      setShowCloudTokens({});
      setCopyFeedback({});
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [onSettingsChanged]);

  const copyToken = useCallback(async (tokenId: string, token: string) => {
    if (!token) return;

    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
        copied = true;
      }
    } catch {
      // Use the local fallback below when clipboard permission is unavailable.
    }

    if (!copied) {
      const textArea = document.createElement("textarea");
      textArea.value = token;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      textArea.setAttribute("aria-hidden", "true");
      document.body.appendChild(textArea);
      textArea.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      } finally {
        document.body.removeChild(textArea);
      }
    }

    const status = copied ? "copied" : "error";
    setCopyFeedback((current) => ({ ...current, [tokenId]: status }));
    window.setTimeout(() => {
      setCopyFeedback((current) => {
        if (current[tokenId] !== status) return current;
        const next = { ...current };
        delete next[tokenId];
        return next;
      });
    }, 2500);
  }, []);

  const fetchUserData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        setProfile(data);
        setGithubUser(data.githubUsername || "");
        setGithubToken(data.githubToken || "");
        
        setTelegramSessions(data.telegramSessions || []);
        setTelegramAccountNames(data.telegramAccountNames || []);
        setHfUsernames(data.hfUsernames || []);
        setHfTokens(data.hfTokens || []);
      } else {
        const minimalProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          providers: [],
          loginCount: 0,
        };
        setProfile(minimalProfile);
      }
    } catch (err: unknown) {
      console.error("Error fetching user data:", err);
      setError(err instanceof Error ? err.message : "Failed to load user data");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (currentUser) {
        void fetchUserData();
      } else {
        setLoading(false);
        setError("Not logged in");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, currentUser, fetchUserData]);

  const handleSaveAll = async (): Promise<SettingsSaveResult> => {
    const sectionId = "github" as const;
    const sectionName = "GitHub";
    if (!authReady || loading) {
      return { sectionId, sectionName, status: "error", message: "Profile settings are still loading." };
    }
    if (!currentUser) {
      return { sectionId, sectionName, status: "error", message: "Sign in before saving GitHub settings." };
    }
    if (error || !profile) {
      return { sectionId, sectionName, status: "error", message: error || "Profile settings are unavailable." };
    }

    const updateData: Partial<Pick<UserProfile, "githubUsername" | "githubToken">> = {};
    const nextGithubUser = githubUser.trim();
    const currentGithubUser = profile.githubUsername?.trim() || "";
    const nextGithubToken = githubToken.trim();
    const currentGithubToken = profile.githubToken?.trim() || "";

    if (nextGithubUser !== currentGithubUser) updateData.githubUsername = nextGithubUser || null;
    if (nextGithubToken !== currentGithubToken) updateData.githubToken = nextGithubToken || null;

    if (Object.keys(updateData).length === 0) {
      return { sectionId, sectionName, status: "unchanged", message: "No changes to save." };
    }

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, updateData, { merge: true });
      setProfile((current) => current ? { ...current, ...updateData } : current);
      try {
        const updatedSnap = await getDoc(userRef);
        if (updatedSnap.exists()) setProfile(updatedSnap.data() as UserProfile);
      } catch {
        // The write succeeded; keep the locally merged profile if refresh fails.
      }
      return { sectionId, sectionName, status: "saved", message: "Changed credentials saved." };
    } catch (err: unknown) {
      return {
        sectionId,
        sectionName,
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save GitHub credentials.",
      };
    }
  };

  useEffect(() => {
    saveHandlerRef.current = handleSaveAll;
  });
  useEffect(() => {
    const handler: SettingsSaveHandler = () => saveHandlerRef.current
      ? saveHandlerRef.current()
      : Promise.resolve({ sectionId: "github", sectionName: "GitHub", status: "error", message: "GitHub settings are unavailable." });
    registerSaveHandler("github", handler);
    return () => registerSaveHandler("github", null);
  }, [registerSaveHandler]);

  if (loading) {
    return (
      <section className="settings-bundle-section">
        <div className="section-header">
          <UserIcon size={18} color="var(--primary)" />
          <span className="section-label">User Profile</span>
        </div>
        <div className="su-loading-container">
          <div className="status-spinner" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="settings-bundle-section setting-user-profile-section">
        <div className="section-header">
          <UserIcon size={18} color="var(--primary)" />
          <span className="section-label">User Profile</span>
        </div>
        <div className="su-error-container">
          <AlertCircle size={24} className="su-error-icon" />
          <div className="su-error-text">Failed to load profile</div>
          <div className="su-error-detail">{error}</div>
          <button onClick={fetchUserData} className="su-retry-btn">
            Retry
          </button>
        </div>
      </section>
    );
  }

  const displayEmail = profile?.email || currentUser?.email || "No email";
  const providerNames = (profile?.providers || []).join(", ");
  const githubConfigured = Boolean(profile?.githubUsername?.trim() && profile?.githubToken?.trim());
  const cloudAccountCount = telegramSessions.length + hfUsernames.length;

  return (
    <>
    <section className="settings-bundle-section setting-user-profile-section" aria-labelledby="setting-user-profile-title">
      <div className="section-header">
        <UserIcon size={18} color="var(--primary)" />
        <span className="section-label" id="setting-user-profile-title">User Profile</span>
        <span className="setting-agent-status"><CheckCircle size={14} /> Signed in</span>
      </div>

      <div className="su-profile-card">
        <div className="su-profile-header">
          {profile?.photoURL && (
            <img src={profile.photoURL} alt="avatar" className="su-avatar" />
          )}
          <div className="su-profile-info">
            <div className="su-display-name">{profile?.displayName || currentUser?.displayName || "User"}</div>
            <div className="su-email">
              <Mail size={12} color="var(--text-muted)" />
              <span>{displayEmail}</span>
            </div>
            <div className="su-meta-info">
              <span>Login: {profile?.loginCount || 1}x</span>
              <span className="su-meta-sep">•</span>
              <span>Provider: {providerNames || "?"}</span>
            </div>
            <div className="su-last-login">
              <Calendar size={10} color="var(--text-muted)" className="su-last-login-icon" />
              Last login: {profile?.lastLoginAt ? getDateOnly(profile.lastLoginAt) : "Unknown"}
            </div>
          </div>
        </div>
      </div>

      <div className="su-stats-grid">
        <div className="su-stat-card">
          <div className="su-stat-header">
            <Calendar size={16} color="var(--primary)" />
            <span className="su-stat-label">REGISTERED</span>
          </div>
          <div className="su-stat-value">
            {profile?.createdAt 
              ? getDateOnly(profile.createdAt) 
              : (profile?.lastLoginAt ? getDateOnly(profile.lastLoginAt) : "Not recorded")}
          </div>
        </div>
        <div className="su-stat-card">
          <div className="su-stat-header">
            <Activity size={16} color="var(--primary)" />
            <span className="su-stat-label">LAST SEEN</span>
          </div>
          <div className="su-stat-value">
            {profile?.lastSeen ? getDateOnly(profile.lastSeen) : "Unknown"}
          </div>
        </div>
      </div>

      {profile?.lastLocation && (
        <div className="su-location-card">
          <div className="su-location-header">
            <MapPin size={16} color="var(--primary)" />
            <span className="su-location-title">Last Known Location</span>
          </div>
          <div className={`su-location-grid ${isMobileScreen ? 'su-location-grid-mobile' : ''}`}>
            <div className="su-location-item">
              <Globe size={12} color="var(--text-muted)" className="su-location-icon" />
              <span>{profile.lastLocation.city}, {profile.lastLocation.country}</span>
            </div>
            <div className="su-location-item">
              <Wifi size={12} color="var(--text-muted)" className="su-location-icon" />
              <span>{profile.lastLocation.ip}</span>
            </div>
            <div className="su-location-item">
              <Navigation size={12} color="var(--text-muted)" className="su-location-icon" />
              <span>{profile.lastLocation.lat}, {profile.lastLocation.lon}</span>
            </div>
            <div className="su-location-item">
              <Clock size={12} color="var(--text-muted)" className="su-location-icon" />
              <span>{getTimeOnly(profile.lastLocation.timestamp)}</span>
            </div>
          </div>
        </div>
      )}

      {profile?.lastDevice && (
        <div className="su-device-card">
          <div className="su-device-header">
            <Smartphone size={16} color="var(--primary)" />
            <span className="su-device-title">Device Information</span>
          </div>
          <div className="su-device-info">
            <div className="su-device-type">
              {profile.lastDevice.isMobile ? <Phone size={12} color="var(--text-muted)" className="su-device-icon" /> : <Monitor size={12} color="var(--text-muted)" className="su-device-icon" />}
              <span>{profile.lastDevice.isMobile ? "Mobile Device" : "Desktop"}</span>
            </div>
            <div className="su-device-platform">
              <Cpu size={12} color="var(--text-muted)" className="su-device-icon" />
              <span>{profile.lastDevice.platform}</span>
            </div>
            <div className="su-device-ua">
              User Agent: {profile.lastDevice.userAgent}
            </div>
          </div>
        </div>
      )}

    </section>

    <section className="settings-bundle-section" aria-labelledby="setting-github-title">
      <div className="section-header">
        <GithubIcon />
        <span className="section-label" id="setting-github-title">GitHub</span>
        <span className={`setting-agent-status ${githubConfigured ? "" : "setting-agent-status-muted"}`}>
          {githubConfigured && <CheckCircle size={14} />}
          {githubConfigured ? "Configured" : "Not configured"}
        </span>
      </div>

      <div className="su-input-group">
        <label className="su-input-label">
          GITHUB USERNAME
        </label>
        <input
          type="text"
          value={githubUser}
          onChange={(e) => {
            setGithubUser(e.target.value);
            onSettingsChanged();
          }}
          placeholder="Username"
          className="setting-agent-input setting-plain-input"
        />
      </div>

      <div className="su-input-group">
        <label className="su-input-label">
          GITHUB PERSONAL ACCESS TOKEN
        </label>
        <div className="su-input-wrapper settings-token-input-wrapper">
          <input
            type={showGithubToken ? "text" : "password"}
            value={githubToken}
            onChange={(e) => {
              setGithubToken(e.target.value);
              onSettingsChanged();
            }}
            placeholder="Token Access"
            className="setting-agent-input setting-sensitive-input"
          />
          <button
            type="button"
            className="setting-eye-btn setting-agent-reveal-btn"
            onClick={() => setShowGithubToken(!showGithubToken)}
            aria-label={showGithubToken ? "Hide GitHub personal access token" : "Reveal GitHub personal access token"}
            aria-pressed={showGithubToken}
          >
            {showGithubToken ? <EyeOff size={16} color="var(--primary)" /> : <Eye size={16} color="var(--primary)" />}
          </button>
          <button
            type="button"
            className="su-copy-btn setting-agent-copy-btn settings-token-copy-button"
            onClick={() => void copyToken("github", githubToken)}
            aria-label={copyFeedback.github === "copied" ? "GitHub token copied to clipboard" : "Copy GitHub personal access token"}
            disabled={!githubToken}
          >
            {copyFeedback.github === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          </button>
        </div>
        {copyFeedback.github && (
          <span className="setting-agent-copy-feedback" role={copyFeedback.github === "error" ? "alert" : "status"} aria-live={copyFeedback.github === "error" ? "assertive" : "polite"}>
            {copyFeedback.github === "copied" ? "Copied to clipboard" : "Could not copy token"}
          </span>
        )}
      </div>

    </section>

    <section className="settings-bundle-section" aria-labelledby="setting-cloud-manager-title">
      <div className="section-header">
        <Cloud size={18} color="var(--primary)" />
        <span className="section-label" id="setting-cloud-manager-title">Cloud Manager</span>
        <span className={`setting-agent-status ${cloudAccountCount ? "" : "setting-agent-status-muted"}`}>
          {cloudAccountCount > 0 && <CheckCircle size={14} />}
          {cloudAccountCount === 1 ? "1 account" : `${cloudAccountCount} accounts`}
        </span>
      </div>

      <div className="su-input-group su-input-group-lg">
        <div className="su-input-header-row">
          <label className="su-input-label">
            TELEGRAM ACCOUNTS ({telegramSessions.length})
          </label>
        </div>

        {telegramSessions.length === 0 ? (
          <div className="su-empty-box">
            No Telegram accounts connected
          </div>
        ) : (
          <div className="su-list-container">
            {telegramSessions.map((session, index) => {
              const tokenId = `telegram-${index}`;
              const accountName = telegramAccountNames[index] || `Account ${index + 1}`;
              const isVisible = Boolean(showCloudTokens[tokenId]);
              const feedback = copyFeedback[tokenId];
              return (
                <div key={tokenId} className="settings-cloud-token-group">
                  <label className="su-input-label" htmlFor={`${tokenId}-input`}>{accountName}</label>
                  <div className="su-input-wrapper settings-token-input-wrapper">
                    <input
                      id={`${tokenId}-input`}
                      type={isVisible ? "text" : "password"}
                      value={session}
                      readOnly
                      aria-label={`${accountName} Telegram session token`}
                      className="setting-agent-input setting-sensitive-input"
                    />
                    <button
                      type="button"
                      className="setting-eye-btn setting-agent-reveal-btn"
                      onClick={() => setShowCloudTokens((current) => ({ ...current, [tokenId]: !current[tokenId] }))}
                      aria-label={`${isVisible ? "Hide" : "Show"} Telegram session for ${accountName}`}
                      aria-pressed={isVisible}
                      disabled={!session}
                    >
                      {isVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className="su-copy-btn setting-agent-copy-btn settings-token-copy-button"
                      onClick={() => void copyToken(tokenId, session)}
                      aria-label={feedback === "copied" ? `Telegram session for ${accountName} copied to clipboard` : `Copy Telegram session for ${accountName}`}
                      disabled={!session}
                    >
                      {feedback === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                    </button>
                  </div>
                  {feedback && (
                    <span className="settings-token-copy-feedback" role={feedback === "error" ? "alert" : "status"} aria-live={feedback === "error" ? "assertive" : "polite"}>
                      {feedback === "copied" ? "Session copied to clipboard" : "Could not copy session"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="su-input-group su-input-group-lg">
        <div className="su-input-header-row">
          <label className="su-input-label">
            HUGGING FACE ACCOUNTS ({hfUsernames.length})
          </label>
        </div>

        {hfUsernames.length === 0 ? (
          <div className="su-empty-box">
            No Hugging Face accounts connected
          </div>
        ) : (
          <div className="su-list-container">
            {hfUsernames.map((username, index) => {
              const tokenId = `huggingface-${index}`;
              const token = hfTokens[index] || "";
              const isVisible = Boolean(showCloudTokens[tokenId]);
              const feedback = copyFeedback[tokenId];
              return (
                <div key={tokenId} className="settings-cloud-token-group">
                  <label className="su-input-label" htmlFor={`${tokenId}-input`}>{username}</label>
                  <div className="su-input-wrapper settings-token-input-wrapper">
                    <input
                      id={`${tokenId}-input`}
                      type={isVisible ? "text" : "password"}
                      value={token}
                      readOnly
                      aria-label={`${username} Hugging Face token`}
                      className="setting-agent-input setting-sensitive-input"
                    />
                    <button
                      type="button"
                      className="setting-eye-btn setting-agent-reveal-btn"
                      onClick={() => setShowCloudTokens((current) => ({ ...current, [tokenId]: !current[tokenId] }))}
                      aria-label={`${isVisible ? "Hide" : "Show"} Hugging Face token for ${username}`}
                      aria-pressed={isVisible}
                      disabled={!token}
                    >
                      {isVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className="su-copy-btn setting-agent-copy-btn settings-token-copy-button"
                      onClick={() => void copyToken(tokenId, token)}
                      aria-label={feedback === "copied" ? `Hugging Face token for ${username} copied to clipboard` : `Copy Hugging Face token for ${username}`}
                      disabled={!token}
                    >
                      {feedback === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                    </button>
                  </div>
                  {feedback && (
                    <span className="settings-token-copy-feedback" role={feedback === "error" ? "alert" : "status"} aria-live={feedback === "error" ? "assertive" : "polite"}>
                      {feedback === "copied" ? "Token copied to clipboard" : "Could not copy token"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </section>
    </>
  );
};

export default SettingUser;
