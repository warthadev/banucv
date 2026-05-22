// src/react/default/settinguser.tsx (FINAL - dengan responsive location grid)
import React, { useEffect, useState } from "react";
import { auth, db } from "@config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { 
  User as UserIcon, Key, Save, AlertCircle, CheckCircle, Eye, EyeOff, 
  Mail, Calendar, MapPin, Smartphone, Globe, Clock, 
  Hash, Activity, Monitor, LogIn, Users, Award, 
  Shield, Cpu, Navigation, Wifi, Phone
} from "lucide-react";
import { GithubIcon } from "@/react/control/icon";
import { formatTimestamp } from "@config/userstorage";

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

const SettingUser: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [geminiKey, setGeminiKey] = useState("");
  const [githubUser, setGithubUser] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [showGemini, setShowGemini] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Deteksi layar mobile (≤768px)
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

  useEffect(() => {
    if (!authReady) return;
    if (currentUser) {
      fetchUserData();
    } else {
      setLoading(false);
      setError("Not logged in");
    }
  }, [authReady, currentUser]);

  const fetchUserData = async () => {
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
  };

  const handleSaveAll = async () => {
    if (!currentUser) return;
    setSaving(true);
    setMessage(null);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const updateData: any = {};
      if (geminiKey !== profile?.geminiApiKey) {
        updateData.geminiApiKey = geminiKey.trim() || null;
        if (geminiKey.trim()) localStorage.setItem("gemini_api_key", geminiKey.trim());
        else localStorage.removeItem("gemini_api_key");
      }
      if (githubUser !== profile?.githubUsername) {
        updateData.githubUsername = githubUser.trim() || null;
        if (githubUser.trim()) localStorage.setItem("github_username", githubUser.trim());
        else localStorage.removeItem("github_username");
      }
      if (githubToken !== profile?.githubToken) {
        updateData.githubToken = githubToken.trim() || null;
        if (githubToken.trim()) localStorage.setItem("github_token", githubToken.trim());
        else localStorage.removeItem("github_token");
      }
      
      if (Object.keys(updateData).length > 0) {
        await updateDoc(userRef, updateData);
        const updatedSnap = await getDoc(userRef);
        if (updatedSnap.exists()) setProfile(updatedSnap.data() as UserProfile);
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
          <UserIcon size={18} />
          <span className="section-label">User Profile</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
          <div className="status-spinner" />
        </div>
      </section>
    );
  }
  
  if (error) {
    return (
      <section className="stack-item">
        <div className="section-header">
          <UserIcon size={18} />
          <span className="section-label">User Profile</span>
        </div>
        <div style={{ padding: "16px", textAlign: "center", color: "#ef4444" }}>
          <AlertCircle size={24} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14 }}>Failed to load profile</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>{error}</div>
          <button
            onClick={fetchUserData}
            style={{ marginTop: 12, padding: "8px 16px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }
  
  const displayEmail = profile?.email || currentUser?.email || "No email";
  const providerNames = (profile?.providers || []).join(", ");
  
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
  
  return (
    <section className="stack-item">
      <div className="section-header">
        <UserIcon size={18} />
        <span className="section-label">User Profile</span>
      </div>
      
      {/* Profile Card */}
      <div style={{ marginBottom: 20, padding: "16px", background: "var(--primary-alpha)", borderRadius: "var(--radius-medium)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap" }}>
          {profile?.photoURL && (
            <img src={profile.photoURL} alt="avatar" style={{ width: 70, height: 70, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--primary)" }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{profile?.displayName || currentUser?.displayName || "User"}</div>
            <div style={{ fontSize: 13, color: "var(--text-sub)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Mail size={12} /> {displayEmail}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>Login: {profile?.loginCount || 1}x</span>
              <span>•</span>
              <span>Provider: {providerNames || "?"}</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              <Calendar size={10} style={{ display: "inline", marginRight: 2 }} />
              Last login: {profile?.lastLoginAt ? getDateOnly(profile.lastLoginAt) : "Unknown"}
            </div>
          </div>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div style={{ marginBottom: 20, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        <div style={{ padding: "14px", background: "var(--bg)", borderRadius: "var(--radius-small)", border: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Calendar size={16} color="var(--primary)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sub)" }}>REGISTERED</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginLeft: 24 }}>
            {profile?.createdAt 
              ? getDateOnly(profile.createdAt) 
              : (profile?.lastLoginAt ? getDateOnly(profile.lastLoginAt) : "Not recorded")}
          </div>
        </div>
        <div style={{ padding: "14px", background: "var(--bg)", borderRadius: "var(--radius-small)", border: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Activity size={16} color="var(--primary)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sub)" }}>LAST SEEN</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginLeft: 23 }}>
            {profile?.lastSeen ? getDateOnly(profile.lastSeen) : "Unknown"}
          </div>
        </div>
      </div>
      
      {/* Location Section - Responsive Grid (vertikal di mobile, 2 kolom di desktop) */}
      {profile?.lastLocation && (
        <div style={{ marginBottom: 16, padding: "14px", background: "var(--bg)", borderRadius: "var(--radius-small)", border: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <MapPin size={16} color="var(--primary)" />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Last Known Location</span>
          </div>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: isMobileScreen ? "1fr" : "repeat(2, 1fr)", 
            gap: 8, 
            fontSize: 12, 
            marginLeft: 23, 
            marginBottom: 0 
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Globe size={12} color="var(--text-sub)" />
              <span>{profile.lastLocation.city}, {profile.lastLocation.country}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Wifi size={12} color="var(--text-sub)" />
              <span>{profile.lastLocation.ip}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Navigation size={12} color="var(--text-sub)" />
              <span>{profile.lastLocation.lat}, {profile.lastLocation.lon}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={12} color="var(--text-sub)" />
              <span>{getTimeOnly(profile.lastLocation.timestamp)}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Device Section */}
      {profile?.lastDevice && (
        <div style={{ marginBottom: 24, padding: "14px", background: "var(--bg)", borderRadius: "var(--radius-small)", border: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Smartphone size={16} color="var(--primary)" />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Device Information</span>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 23 }}>
              {profile.lastDevice.isMobile ? <Phone size={12} color="var(--text-sub)" /> : <Monitor size={12} color="var(--text-sub)" />}
              <span>{profile.lastDevice.isMobile ? "Mobile Device" : "Desktop"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Cpu size={12} color="var(--text-sub)" />
              <span>{profile.lastDevice.platform}</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", wordBreak: "break-all", marginTop: 0 }}>
              User Agent: {profile.lastDevice.userAgent}
            </div>
          </div>
        </div>
      )}
      
      {/* Gemini API Key */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-sub)" }}>
          <Key size={14} /> GEMINI API KEY
        </label>
        <div style={{ position: "relative" }}>
          <input
            type={showGemini ? "text" : "password"}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIzaSy..."
            style={{ width: "100%", padding: "12px 40px 12px 14px", background: "var(--bg)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-small)", color: "var(--text)", fontSize: 13 }}
          />
          <button
            type="button"
            onClick={() => setShowGemini(!showGemini)}
            style={{ position: "absolute", right: 10, top: "55%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-sub)", cursor: "pointer" }}
          >
            {showGemini ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      
      {/* GitHub Username */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-sub)" }}>
          <GithubIcon /> GITHUB USERNAME
        </label>
        <input
          type="text"
          value={githubUser}
          onChange={(e) => setGithubUser(e.target.value)}
          placeholder="github username"
          style={{ width: "100%", padding: "12px 14px", background: "var(--bg)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-small)", color: "var(--text)", fontSize: 13 }}
        />
      </div>
      
      {/* GitHub Token */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-sub)" }}>
          <Key size={14} /> GITHUB PERSONAL ACCESS TOKEN
        </label>
        <div style={{ position: "relative" }}>
          <input
            type={showGithubToken ? "text" : "password"}
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_..."
            style={{ width: "100%", padding: "12px 40px 12px 14px", background: "var(--bg)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-small)", color: "var(--text)", fontSize: 13 }}
          />
          <button
            type="button"
            onClick={() => setShowGithubToken(!showGithubToken)}
            style={{ position: "absolute", right: 10, top: "55%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-sub)", cursor: "pointer" }}
          >
            {showGithubToken ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      
      {message && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: "var(--radius-small)", background: message.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", border: `1px solid ${message.type === "success" ? "#10b981" : "#ef4444"}`, display: "flex", alignItems: "center", gap: 10 }}>
          {message.type === "success" ? <CheckCircle size={16} color="#10b981" /> : <AlertCircle size={16} color="#ef4444" />}
          <span style={{ fontSize: 13, color: message.type === "success" ? "#10b981" : "#ef4444" }}>{message.text}</span>
        </div>
      )}
      
      <button
        onClick={handleSaveAll}
        disabled={saving}
        style={{ width: "100%", padding: "14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "var(--radius-button)", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {saving ? <div className="status-spinner" style={{ width: 18, height: 18 }} /> : <Save size={18} />}
        {saving ? "Saving..." : "Save Credentials"}
      </button>
    </section>
  );
};

export default SettingUser;