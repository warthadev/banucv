// src/react/default/settinguser.tsx
import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { auth, db } from "@config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  AlertCircle, CheckCircle, LoaderCircle, Save,
  Mail, Calendar, MapPin, Smartphone, Globe, Clock, 
  Activity, Monitor, Phone, Cpu, Navigation, Wifi,
  Cloud, Copy, Eye, EyeOff, Check, KeyRound, ShieldCheck
} from "lucide-react";
import { GithubIcon } from "@/react/control/icon";
import { formatTimestamp } from "@config/userstorage";
import { deleteKaggleCredentials, loadKaggleCredentials, saveKaggleCredentials, type KaggleCredentials } from "@config/kagglecredentials";
import type { SettingsSaveResult } from "./settingssave";
import SettingAgent from "./settingagent";

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

const areStringArraysEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

interface SettingUserProps {
  onLoadingChange: (isLoading: boolean) => void;
}

const SettingUser: React.FC<SettingUserProps> = ({ onLoadingChange }) => {
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
  const [githubSaving, setGithubSaving] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SettingsSaveResult | null>(null);
  const [cloudSaveResult, setCloudSaveResult] = useState<SettingsSaveResult | null>(null);

  const [kaggleCredentials, setKaggleCredentials] = useState<KaggleCredentials | null>(null);
  const [kaggleUsername, setKaggleUsername] = useState("");
  const [kaggleApiToken, setKaggleApiToken] = useState("");
  const [showKaggleToken, setShowKaggleToken] = useState(false);
  const [kaggleLoading, setKaggleLoading] = useState(true);
  const [kaggleSaving, setKaggleSaving] = useState(false);
  const [kaggleError, setKaggleError] = useState<string | null>(null);
  const [kaggleMessage, setKaggleMessage] = useState<string | null>(null);
  const kaggleRequestId = useRef(0);
  
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
      kaggleRequestId.current += 1;
      setLoading(true);
      setCurrentUser(user);
      setSaveResult(null);
      setCloudSaveResult(null);
      setShowGithubToken(false);
      setShowCloudTokens({});
      setCopyFeedback({});
      setKaggleCredentials(null);
      setKaggleUsername("");
      setKaggleApiToken("");
      setShowKaggleToken(false);
      setKaggleLoading(Boolean(user));
      setKaggleError(null);
      setKaggleMessage(null);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const requestId = ++kaggleRequestId.current;
    if (!currentUser) return;

    let cancelled = false;
    void loadKaggleCredentials().then((saved) => {
      if (cancelled || requestId !== kaggleRequestId.current) return;
      setKaggleCredentials(saved);
      setKaggleUsername(saved?.username || "");
      setKaggleApiToken(saved?.apiToken || "");
      setShowKaggleToken(false);
    }).catch((loadError: unknown) => {
      if (cancelled || requestId !== kaggleRequestId.current) return;
      setKaggleCredentials(null);
      setKaggleError(loadError instanceof Error ? loadError.message : "Unable to load this account’s Kaggle settings.");
    }).finally(() => {
      if (!cancelled && requestId === kaggleRequestId.current) setKaggleLoading(false);
    });

    return () => {
      cancelled = true;
      kaggleRequestId.current += 1;
    };
  }, [authReady, currentUser]);

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

  const saveGithubSettings = async (): Promise<SettingsSaveResult> => {
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
      const changedFields = [
        ...(Object.hasOwn(updateData, "githubUsername") ? ["username"] : []),
        ...(Object.hasOwn(updateData, "githubToken") ? ["personal access token"] : []),
      ];
      return { sectionId, sectionName, status: "saved", message: `${changedFields.join(" and ")} updated.` };
    } catch (err: unknown) {
      return {
        sectionId,
        sectionName,
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save GitHub credentials.",
      };
    }
  };

  const saveCloudManagerSettings = async (): Promise<SettingsSaveResult> => {
    const sectionId = "cloudmanager" as const;
    const sectionName = "Cloud Manager";
    if (!authReady || loading) {
      return { sectionId, sectionName, status: "error", message: "Cloud Manager settings are still loading." };
    }
    if (!currentUser) {
      return { sectionId, sectionName, status: "error", message: "Sign in before saving Cloud Manager settings." };
    }
    if (error || !profile) {
      return { sectionId, sectionName, status: "error", message: error || "Profile settings are unavailable." };
    }
    if (cloudSaving) {
      return { sectionId, sectionName, status: "error", message: "Settings are already being saved." };
    }

    const telegramEntries = telegramSessions
      .map((session, index) => ({
        session: session.trim(),
        name: (telegramAccountNames[index] || `Account ${index + 1}`).trim() || `Account ${index + 1}`,
      }))
      .filter((entry) => entry.session);
    const hfEntries = hfUsernames.map((username, index) => ({
      username: username.trim(),
      token: (hfTokens[index] || "").trim(),
    }));
    if (hfEntries.some((entry) => Boolean(entry.username) !== Boolean(entry.token))) {
      return {
        sectionId,
        sectionName,
        status: "error",
        message: "Each Hugging Face account needs both a username and token; clear both fields to remove an account.",
      };
    }

    const nextTelegramSessions = telegramEntries.map((entry) => entry.session);
    const nextTelegramAccountNames = telegramEntries.map((entry) => entry.name);
    const activeHfEntries = hfEntries.filter((entry) => entry.username && entry.token);
    const nextHfUsernames = activeHfEntries.map((entry) => entry.username);
    const nextHfTokens = activeHfEntries.map((entry) => entry.token);
    const updateData: Partial<Pick<UserProfile, "telegramSessions" | "telegramAccountNames" | "hfUsernames" | "hfTokens">> = {};

    if (!areStringArraysEqual(nextTelegramSessions, profile.telegramSessions || [])) updateData.telegramSessions = nextTelegramSessions;
    if (!areStringArraysEqual(nextTelegramAccountNames, profile.telegramAccountNames || [])) updateData.telegramAccountNames = nextTelegramAccountNames;
    if (!areStringArraysEqual(nextHfUsernames, profile.hfUsernames || [])) updateData.hfUsernames = nextHfUsernames;
    if (!areStringArraysEqual(nextHfTokens, profile.hfTokens || [])) updateData.hfTokens = nextHfTokens;

    if (Object.keys(updateData).length === 0) {
      return { sectionId, sectionName, status: "unchanged", message: "No changes to save." };
    }

    setCloudSaving(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, updateData, { merge: true });
      setProfile((current) => current ? { ...current, ...updateData } : current);
      setTelegramSessions(nextTelegramSessions);
      setTelegramAccountNames(nextTelegramAccountNames);
      setHfUsernames(nextHfUsernames);
      setHfTokens(nextHfTokens);
      return { sectionId, sectionName, status: "saved", message: "Cloud Manager settings saved." };
    } catch (err: unknown) {
      return {
        sectionId,
        sectionName,
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save Cloud Manager settings.",
      };
    } finally {
      setCloudSaving(false);
    }
  };

  const handleSaveKaggle = async () => {
    setKaggleMessage(null);
    setKaggleError(null);
    if (!authReady || kaggleLoading) {
      setKaggleError("Kaggle settings are still loading.");
      return;
    }
    if (!currentUser) {
      setKaggleError("Sign in to save Kaggle credentials for this account.");
      return;
    }

    const normalizedUsername = kaggleUsername.trim();
    const normalizedToken = kaggleApiToken.trim();
    if (!normalizedUsername && !normalizedToken) {
      if (!kaggleCredentials) {
        setKaggleMessage("No changes to save.");
        return;
      }
      setKaggleSaving(true);
      try {
        await deleteKaggleCredentials();
        setKaggleCredentials(null);
        setKaggleUsername("");
        setKaggleApiToken("");
        setShowKaggleToken(false);
        setKaggleMessage("Kaggle credentials removed.");
      } catch (deleteError: unknown) {
        setKaggleError(deleteError instanceof Error ? deleteError.message : "Could not remove this account’s Kaggle credentials.");
      } finally {
        setKaggleSaving(false);
      }
      return;
    }
    if (!normalizedUsername || !normalizedToken) {
      setKaggleError("Enter both fields, or clear both to remove Kaggle credentials.");
      return;
    }
    if (kaggleCredentials && normalizedUsername === kaggleCredentials.username.trim() && normalizedToken === kaggleCredentials.apiToken.trim()) {
      setKaggleMessage("No changes to save.");
      return;
    }

    setKaggleSaving(true);
    try {
      const saved = await saveKaggleCredentials(normalizedUsername, normalizedToken);
      setKaggleCredentials(saved);
      setKaggleUsername(saved.username);
      setKaggleApiToken(saved.apiToken);
      setShowKaggleToken(false);
      setKaggleMessage(kaggleCredentials ? "Kaggle credentials updated for this account." : "Kaggle credentials saved for this account.");
    } catch (saveError: unknown) {
      setKaggleError(saveError instanceof Error ? saveError.message : "Could not save this account’s Kaggle credentials.");
    } finally {
      setKaggleSaving(false);
    }
  };

  const handleSave = async () => {
    setSaveResult(null);
    setGithubSaving(true);
    try {
      setSaveResult(await saveGithubSettings());
    } finally {
      setGithubSaving(false);
    }
  };

  const handleSaveCloudManager = async () => {
    setCloudSaveResult(null);
    setCloudSaveResult(await saveCloudManagerSettings());
  };

  if (loading) {
    return (
      <>
        <section className="stack-item settings-bundle-section global-card global-section global-card--padded">
          <div className="su-loading-container">
            <div className="status-spinner" />
          </div>
        </section>
      </>
    );
  }

  if (error) {
    return (
      <>
        <section className="stack-item settings-bundle-section global-card global-section global-card--padded">
          <div className="su-error-container">
            <AlertCircle size={24} className="su-error-icon" />
            <div className="su-error-text">Failed to load profile</div>
            <div className="su-error-detail">{error}</div>
            <button onClick={fetchUserData} className="su-retry-btn">
              Retry
            </button>
          </div>
        </section>
      </>
    );
  }

  const displayEmail = profile?.email || currentUser?.email || "No email";
  const providerNames = (profile?.providers || []).join(", ");
  const githubConfigured = Boolean(profile?.githubUsername?.trim() && profile?.githubToken?.trim());
  const cloudAccountCount = telegramSessions.length + hfUsernames.length;
  const cloudHasUnsavedChanges = !areStringArraysEqual(telegramSessions, profile?.telegramSessions || [])
    || !areStringArraysEqual(telegramAccountNames, profile?.telegramAccountNames || [])
    || !areStringArraysEqual(hfUsernames, profile?.hfUsernames || [])
    || !areStringArraysEqual(hfTokens, profile?.hfTokens || []);

  return (
    <>
      <section className="stack-item settings-bundle-section global-card global-section global-card--padded" aria-label="User Profile">
        <div className="su-profile-card">
          <div className="su-profile-header">
            {profile?.photoURL && (
              <img src={profile.photoURL} alt="avatar" className="su-avatar" />
            )}
            <div className="su-profile-info">
              <div className="su-display-name">{profile?.displayName || currentUser?.displayName || "User"}</div>
              <div className="su-email">
                <Mail size={12} color="var(--global-color-text-muted)" />
                <span>{displayEmail}</span>
              </div>
              <div className="su-meta-info">
                <span>Login: {profile?.loginCount || 1}x</span>
                <span className="su-meta-sep">•</span>
                <span>Provider: {providerNames || "?"}</span>
              </div>
              <div className="su-last-login">
                <Calendar size={10} color="var(--global-color-text-muted)" className="su-last-login-icon" />
                Last login: {profile?.lastLoginAt ? getDateOnly(profile.lastLoginAt) : "Unknown"}
              </div>
            </div>
          </div>
        </div>

        <div className="su-stats-grid global-responsive-grid global-responsive-grid--two">
          <div className="su-stat-card">
            <div className="su-stat-header">
              <Calendar size={16} color="var(--global-color-accent)" />
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
              <Activity size={16} color="var(--global-color-accent)" />
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
              <MapPin size={16} color="var(--global-color-accent)" />
              <span className="su-location-title">Last Known Location</span>
            </div>
            <div className={`su-location-grid global-responsive-grid global-responsive-grid--two ${isMobileScreen ? 'su-location-grid-mobile' : ''}`}>
              <div className="su-location-item global-inline-row global-inline-row--gap-6">
                <Globe size={12} color="var(--global-color-text-muted)" className="su-location-icon" />
                <span>{profile.lastLocation.city}, {profile.lastLocation.country}</span>
              </div>
              <div className="su-location-item global-inline-row global-inline-row--gap-6">
                <Wifi size={12} color="var(--global-color-text-muted)" className="su-location-icon" />
                <span>{profile.lastLocation.ip}</span>
              </div>
              <div className="su-location-item global-inline-row global-inline-row--gap-6">
                <Navigation size={12} color="var(--global-color-text-muted)" className="su-location-icon" />
                <span>{profile.lastLocation.lat}, {profile.lastLocation.lon}</span>
              </div>
              <div className="su-location-item global-inline-row global-inline-row--gap-6">
                <Clock size={12} color="var(--global-color-text-muted)" className="su-location-icon" />
                <span>{getTimeOnly(profile.lastLocation.timestamp)}</span>
              </div>
            </div>
          </div>
        )}

        {profile?.lastDevice && (
          <div className="su-device-card">
            <div className="su-device-header">
              <Smartphone size={16} color="var(--global-color-accent)" />
              <span className="su-device-title">Device Information</span>
            </div>
            <div className="su-device-info">
              <div className="su-device-type global-inline-row global-inline-row--gap-6">
                {profile.lastDevice.isMobile ? <Phone size={12} color="var(--global-color-text-muted)" className="su-device-icon" /> : <Monitor size={12} color="var(--global-color-text-muted)" className="su-device-icon" />}
                <span>{profile.lastDevice.isMobile ? "Mobile Device" : "Desktop"}</span>
              </div>
              <div className="su-device-platform global-inline-row global-inline-row--gap-6">
                <Cpu size={12} color="var(--global-color-text-muted)" className="su-device-icon" />
                <span>{profile.lastDevice.platform}</span>
              </div>
              <div className="su-device-ua">
                User Agent: {profile.lastDevice.userAgent}
              </div>
            </div>
          </div>
        )}
      </section>

    <section className="stack-item settings-service-section global-card global-section global-card--padded" aria-label="GitHub">
      <div className="su-profile-card setting-agent-safe-status global-inline-row global-inline-row--gap-8">
        <GithubIcon />
        <span>
          GitHub credentials are {githubConfigured ? "configured" : "not configured"}.
          <small>Status reflects the saved username and personal access token.</small>
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
            setSaveResult(null);
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
              setSaveResult(null);
            }}
            placeholder="Token Access"
            className="setting-agent-input setting-sensitive-input"
          />
          <button
            type="button"
            className="setting-eye-btn setting-agent-reveal-btn global-icon-button"
            onClick={() => setShowGithubToken(!showGithubToken)}
            aria-label={showGithubToken ? "Hide GitHub personal access token" : "Reveal GitHub personal access token"}
            aria-pressed={showGithubToken}
          >
            {showGithubToken ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            type="button"
            className="su-copy-btn setting-agent-copy-btn settings-token-copy-button global-icon-button"
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

      <div className="settings-section-actions">
        <button
          className="setting-agent-primary settings-section-save-btn"
          type="button"
          onClick={() => void handleSave()}
          disabled={githubSaving || loading || !currentUser}
        >
          {githubSaving ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <Save size={16} aria-hidden="true" />}
          {githubSaving ? "Saving…" : "Save"}
        </button>
        {saveResult && (
          <p
            className={`settings-save-feedback${saveResult.status === "error" ? " is-error" : ""}`}
            role={saveResult.status === "error" ? "alert" : "status"}
            aria-live={saveResult.status === "error" ? "assertive" : "polite"}
          >
            {saveResult.status === "error"
              ? <AlertCircle size={15} aria-hidden="true" />
              : <CheckCircle size={15} aria-hidden="true" />}
            <span>{saveResult.message}</span>
          </p>
        )}
      </div>

    </section>

    <SettingAgent />

    <section className="stack-item settings-service-section global-card global-section global-card--padded" aria-label="Kaggle">
      <div className="su-profile-card setting-agent-safe-status global-inline-row global-inline-row--gap-8">
        {kaggleCredentials ? <ShieldCheck size={17} aria-hidden="true" /> : <KeyRound size={17} aria-hidden="true" />}
        <span>
          {kaggleLoading || !authReady
            ? "Loading Kaggle settings…"
            : kaggleCredentials
              ? `Kaggle connected as ${kaggleCredentials.username}`
              : "Kaggle credentials are not configured."}
          <small>Credentials apply only to this signed-in account and are stored by the Downloader backend.</small>
        </span>
      </div>

      {!currentUser && authReady ? (
        <p className="setting-agent-note" role="status">Sign in to manage this account’s Kaggle settings.</p>
      ) : (
        <>
          <div className="su-input-group">
            <label className="su-input-label" htmlFor="setting-kaggle-username">KAGGLE USERNAME</label>
            <input
              id="setting-kaggle-username"
              className="setting-agent-input setting-plain-input"
              type="text"
              name="kaggle-username"
              value={kaggleUsername}
              onChange={(event) => { setKaggleUsername(event.target.value); setKaggleMessage(null); setKaggleError(null); }}
              placeholder="Your Kaggle username"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              disabled={kaggleSaving || kaggleLoading || !authReady}
            />
          </div>

          <div className="su-input-group">
            <label className="su-input-label" htmlFor="setting-kaggle-token">KAGGLE API TOKEN</label>
            <div className="su-list-item setting-agent-key-control">
              <input
                id="setting-kaggle-token"
                className="setting-agent-input setting-agent-key-input"
                type={showKaggleToken ? "text" : "password"}
                name="kaggle-api-token"
                value={kaggleApiToken}
                onChange={(event) => { setKaggleApiToken(event.target.value); setKaggleMessage(null); setKaggleError(null); }}
                placeholder={kaggleCredentials ? "Enter a token to replace the saved token" : "Paste your Kaggle API token"}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                disabled={kaggleSaving || kaggleLoading || !authReady}
              />
              <button
                className="setting-agent-reveal-btn global-icon-button"
                type="button"
                onClick={() => setShowKaggleToken((visible) => !visible)}
                aria-label={showKaggleToken ? "Hide Kaggle API token" : "Reveal Kaggle API token"}
                aria-pressed={showKaggleToken}
                disabled={!kaggleApiToken || kaggleSaving}
              >
                {showKaggleToken ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {kaggleError && <p className="setting-agent-error global-inline-row global-inline-row--gap-8" role="alert"><AlertCircle size={15} />{kaggleError}</p>}
          <div className="settings-section-actions">
            <button className="setting-agent-primary settings-section-save-btn" type="button" onClick={() => void handleSaveKaggle()} disabled={kaggleSaving || kaggleLoading || !authReady || !currentUser}>
              {kaggleSaving ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <Save size={16} aria-hidden="true" />}
              {kaggleSaving ? "Saving…" : "Save"}
            </button>
            {kaggleMessage && <p className="settings-save-feedback" role="status"><CheckCircle size={15} aria-hidden="true" /><span>{kaggleMessage}</span></p>}
          </div>
        </>
      )}
    </section>

    <section className="stack-item settings-service-section global-card global-section global-card--padded" aria-label="Cloud Manager">
      <div className="su-profile-card setting-agent-safe-status global-inline-row global-inline-row--gap-8">
        <Cloud size={17} aria-hidden="true" />
        <span>
          {cloudHasUnsavedChanges
            ? "Cloud Manager edits are not saved yet."
            : cloudAccountCount > 0
              ? "Cloud Manager entries are saved in this profile."
              : "No Cloud Manager entries are saved in this profile."}
          <small>Telegram: {telegramSessions.length} · Hugging Face: {hfUsernames.length}</small>
          <small>Clear a Telegram session or both Hugging Face fields, then save to remove an account.</small>
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
                  <label className="su-input-label" htmlFor={`${tokenId}-name-input`}>Account name</label>
                  <input
                    id={`${tokenId}-name-input`}
                    type="text"
                    value={accountName}
                    onChange={(event) => {
                      const next = [...telegramAccountNames];
                      while (next.length <= index) next.push("");
                      next[index] = event.target.value;
                      setTelegramAccountNames(next);
                      setCloudSaveResult(null);
                    }}
                    aria-label={`${accountName} Telegram account name`}
                    className="setting-agent-input setting-plain-input"
                  />
                  <label className="su-input-label" htmlFor={`${tokenId}-input`}>Telegram session</label>
                  <div className="su-input-wrapper settings-token-input-wrapper">
                    <input
                      id={`${tokenId}-input`}
                      type={isVisible ? "text" : "password"}
                      value={session}
                      onChange={(event) => {
                        const next = [...telegramSessions];
                        next[index] = event.target.value;
                        setTelegramSessions(next);
                        setCloudSaveResult(null);
                      }}
                      aria-label={`${accountName} Telegram session token`}
                      className="setting-agent-input setting-sensitive-input"
                    />
                    <button
                      type="button"
                      className="setting-eye-btn setting-agent-reveal-btn global-icon-button"
                      onClick={() => setShowCloudTokens((current) => ({ ...current, [tokenId]: !current[tokenId] }))}
                      aria-label={`${isVisible ? "Hide" : "Show"} Telegram session for ${accountName}`}
                      aria-pressed={isVisible}
                      disabled={!session}
                    >
                      {isVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className="su-copy-btn setting-agent-copy-btn settings-token-copy-button global-icon-button"
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
                  <label className="su-input-label" htmlFor={`${tokenId}-username-input`}>Hugging Face username</label>
                  <input
                    id={`${tokenId}-username-input`}
                    type="text"
                    value={username}
                    onChange={(event) => {
                      const next = [...hfUsernames];
                      next[index] = event.target.value;
                      setHfUsernames(next);
                      setCloudSaveResult(null);
                    }}
                    className="setting-agent-input setting-plain-input"
                  />
                  <label className="su-input-label" htmlFor={`${tokenId}-input`}>Hugging Face token</label>
                  <div className="su-input-wrapper settings-token-input-wrapper">
                    <input
                      id={`${tokenId}-input`}
                      type={isVisible ? "text" : "password"}
                      value={token}
                      onChange={(event) => {
                        const next = [...hfTokens];
                        while (next.length <= index) next.push("");
                        next[index] = event.target.value;
                        setHfTokens(next);
                        setCloudSaveResult(null);
                      }}
                      aria-label={`${username} Hugging Face token`}
                      className="setting-agent-input setting-sensitive-input"
                    />
                    <button
                      type="button"
                      className="setting-eye-btn setting-agent-reveal-btn global-icon-button"
                      onClick={() => setShowCloudTokens((current) => ({ ...current, [tokenId]: !current[tokenId] }))}
                      aria-label={`${isVisible ? "Hide" : "Show"} Hugging Face token for ${username}`}
                      aria-pressed={isVisible}
                      disabled={!token}
                    >
                      {isVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className="su-copy-btn setting-agent-copy-btn settings-token-copy-button global-icon-button"
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

      <div className="settings-section-actions">
        <button
          className="setting-agent-primary settings-section-save-btn"
          type="button"
          onClick={() => void handleSaveCloudManager()}
          disabled={cloudSaving || loading || !currentUser || Boolean(error)}
        >
          {cloudSaving ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <Save size={16} aria-hidden="true" />}
          {cloudSaving ? "Saving…" : "Save"}
        </button>
        {cloudSaveResult && (
          <p
            className={`settings-save-feedback${cloudSaveResult.status === "error" ? " is-error" : ""}`}
            role={cloudSaveResult.status === "error" ? "alert" : "status"}
            aria-live={cloudSaveResult.status === "error" ? "assertive" : "polite"}
          >
            {cloudSaveResult.status === "error"
              ? <AlertCircle size={15} aria-hidden="true" />
              : <CheckCircle size={15} aria-hidden="true" />}
            <span>{cloudSaveResult.message}</span>
          </p>
        )}
      </div>

    </section>
    </>
  );
};

export default SettingUser;
