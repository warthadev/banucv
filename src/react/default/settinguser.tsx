// src/react/default/settinguser.tsx
import React, { useEffect, useState, useCallback } from "react";
import { auth, db } from "@config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { 
  User as UserIcon, Key, AlertCircle, CheckCircle, 
  Mail, Calendar, MapPin, Smartphone, Globe, Clock, 
  Activity, Monitor, Phone, Cpu, Navigation, Wifi,
  Cloud, Copy, Eye, EyeOff
} from "lucide-react";
import { GithubIcon } from "@/react/control/icon";
import { formatTimestamp } from "@config/userstorage";
import { GEMINI_KEY_UPDATED_EVENT } from "@hook/usegemini";

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providers: string[];
  createdAt?: any;
  lastLoginAt?: any;
  lastSeen?: any;
  loginCount?: number;
  geminiApiKey?: string;
  githubUsername?: string;
  githubToken?: string;
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
    timestamp: any;
  };
  lastDevice?: {
    userAgent: string;
    platform: string;
    isMobile: boolean;
  };
}

const getDateOnly = (timestamp: any): string => {
  if (!timestamp) return "Unknown";
  const formatted = formatTimestamp(timestamp);
  return formatted.split(" at ")[0] || formatted;
};

const getTimeOnly = (timestamp: any): string => {
  if (!timestamp) return "Unknown";
  const formatted = formatTimestamp(timestamp);
  const parts = formatted.split(" at ");
  return parts.length > 1 ? parts[1] : formatted;
};

const SettingUser: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [geminiKey, setGeminiKey] = useState("");
  const [showGemini, setShowGemini] = useState(false);
  const [githubUser, setGithubUser] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [telegramSessions, setTelegramSessions] = useState<string[]>([]);
  const [telegramAccountNames, setTelegramAccountNames] = useState<string[]>([]);
  const [hfUsernames, setHfUsernames] = useState<string[]>([]);
  const [hfTokens, setHfTokens] = useState<string[]>([]);
  
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
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
        setGeminiKey(data.geminiApiKey || "");
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
    } catch (err: any) {
      console.error("Error fetching user data:", err);
      setError(err.message || "Failed to load user data");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!authReady) return;
    if (currentUser) {
      fetchUserData();
    } else {
      setLoading(false);
      setError("Not logged in");
    }
  }, [authReady, currentUser, fetchUserData]);

  const handleSaveAll = async () => {
    if (!currentUser) return;
    setSaving(true);
    setMessage(null);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const updateData: any = {};
      let geminiKeyChanged = false;
      
      if (geminiKey !== profile?.geminiApiKey) {
        updateData.geminiApiKey = geminiKey.trim() || null;
        geminiKeyChanged = true;
      }
      
      if (githubUser !== profile?.githubUsername) {
        updateData.githubUsername = githubUser.trim() || null;
      }
      
      if (githubToken !== profile?.githubToken) {
        updateData.githubToken = githubToken.trim() || null;
      }
      
      if (Object.keys(updateData).length > 0) {
        await updateDoc(userRef, updateData);
        const updatedSnap = await getDoc(userRef);
        if (updatedSnap.exists()) {
          const data = updatedSnap.data() as UserProfile;
          setProfile(data);
        }
        if (geminiKeyChanged) {
          window.dispatchEvent(new Event(GEMINI_KEY_UPDATED_EVENT));
        }
        setMessage({ type: "success", text: "Credentials updated successfully" });
      } else {
        setMessage({ type: "success", text: "No changes to save" });
      }
    } catch (err: any) {
      console.error("Error saving:", err);
      setMessage({ type: "error", text: err.message || "Failed to save" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) {
    return (
      <section className="stack-item">
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
      <section className="stack-item">
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

  return (
    <section className="stack-item">
      <div className="section-header">
        <UserIcon size={18} color="var(--primary)" />
        <span className="section-label">User Profile</span>
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

      <div className="su-input-group">
        <label className="su-input-label">
          <Key size={14} color="var(--primary)" />
          GEMINI API KEY
        </label>
        <div className="su-input-wrapper">
          <input
            type={showGemini ? "text" : "password"}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="Token Access"
            className="setting-sensitive-input"
          />
          <button
            type="button"
            className="setting-eye-btn"
            onClick={() => setShowGemini(!showGemini)}
          >
            {showGemini ? <EyeOff size={16} color="var(--primary)" /> : <Eye size={16} color="var(--primary)" />}
          </button>
        </div>
      </div>

      <div className="su-input-group">
        <label className="su-input-label">
          <GithubIcon />
          GITHUB USERNAME
        </label>
        <input
          type="text"
          value={githubUser}
          onChange={(e) => setGithubUser(e.target.value)}
          placeholder="Username"
          className="setting-plain-input"
        />
      </div>

      <div className="su-input-group">
        <label className="su-input-label">
          <Key size={14} color="var(--primary)" />
          GITHUB PERSONAL ACCESS TOKEN
        </label>
        <div className="su-input-wrapper">
          <input
            type={showGithubToken ? "text" : "password"}
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="Token Access"
            className="setting-sensitive-input"
          />
          <button
            type="button"
            className="setting-eye-btn"
            onClick={() => setShowGithubToken(!showGithubToken)}
          >
            {showGithubToken ? <EyeOff size={16} color="var(--primary)" /> : <Eye size={16} color="var(--primary)" />}
          </button>
        </div>
      </div>

      <div className="su-input-group su-input-group-lg">
        <div className="su-input-header-row">
          <label className="su-input-label">
            <Cloud size={14} color="var(--primary)" />
            TELEGRAM ACCOUNTS ({telegramSessions.length})
          </label>
        </div>

        {telegramSessions.length === 0 ? (
          <div className="su-empty-box">
            No Telegram accounts connected
          </div>
        ) : (
          <div className="su-list-container">
            {telegramSessions.map((session, index) => (
              <div key={index} className="su-list-item">
                <div className="su-list-item-info">
                  <span className="su-list-item-name">
                    {telegramAccountNames[index] || `Account ${index + 1}`}
                  </span>
                  <span className="su-list-item-value">
                    {session}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(session);
                    setMessage({ type: "success", text: "Session copied to clipboard" });
                    setTimeout(() => setMessage(null), 2000);
                  }}
                  className="su-copy-btn"
                  title="Copy session"
                >
                  <Copy size={14} color="var(--primary)" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="su-input-group su-input-group-lg">
        <div className="su-input-header-row">
          <label className="su-input-label">
            <Cloud size={14} color="var(--primary)" />
            HUGGING FACE ACCOUNTS ({hfUsernames.length})
          </label>
        </div>

        {hfUsernames.length === 0 ? (
          <div className="su-empty-box">
            No Hugging Face accounts connected
          </div>
        ) : (
          <div className="su-list-container">
            {hfUsernames.map((username, index) => (
              <div key={index} className="su-list-item">
                <div className="su-list-item-info">
                  <span className="su-list-item-name">
                    {username}
                  </span>
                  <span className="su-list-item-value">
                    {hfTokens[index]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(hfTokens[index]);
                    setMessage({ type: "success", text: "Token copied to clipboard" });
                    setTimeout(() => setMessage(null), 2000);
                  }}
                  className="su-copy-btn"
                  title="Copy token"
                >
                  <Copy size={14} color="var(--primary)" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {message && (
        <div className={`su-message ${message.type === "success" ? "su-message-success" : "su-message-error"}`}>
          {message.type === "success" ? <CheckCircle size={16} color="#10b981" /> : <AlertCircle size={16} color="#ef4444" />}
          <span>{message.text}</span>
        </div>
      )}

      <button
        onClick={handleSaveAll}
        disabled={saving}
        className="su-save-btn"
      >
        {saving ? <div className="status-spinner" /> : null}
        {saving ? "Saving..." : "Save Credentials"}
      </button>
    </section>
  );
};

export default SettingUser;