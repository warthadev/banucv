import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "@config/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Calendar, MapPin, Smartphone, Shield,
  Download, Search, AlertCircle, Loader2, Camera, RefreshCw, ArrowLeft, Maximize2, X
} from "lucide-react";
import { Carousel } from 'react-responsive-carousel';
import 'react-responsive-carousel/lib/styles/carousel.min.css';

interface SelfieData {
  image: string;
  timestamp: any;
}

interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastLoginAt?: any;
  lastLocation?: {
    city: string;
    country: string;
    ip: string;
  };
  lastDevice?: {
    isMobile: boolean;
    platform: string;
  };
  firstSelfie?: SelfieData;
  latestSelfie?: SelfieData;
}

const ALLOWED_ADMINS = ["warthadev@gmail.com"];

const CollectPhoto: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(true);
  const [viewMode, setViewMode] = useState<"first" | "latest">("latest");
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const [togglePosition, setTogglePosition] = useState({ left: 0, width: 0 });
  const toggleContainerRef = useRef<HTMLDivElement>(null);
  const firstBtnRef = useRef<HTMLButtonElement>(null);
  const latestBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      setIsAuthorizing(true);
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user && ALLOWED_ADMINS.includes(user.email || "")) {
          setIsAdmin(true);
          await fetchAllUsers();
        } else {
          setIsAdmin(false);
          setError("Access denied. Admin only.");
          setLoading(false);
        }
        setIsAuthorizing(false);
      });
      return () => unsubscribe();
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    const updatePosition = () => {
      const activeBtn = viewMode === "first" ? firstBtnRef.current : latestBtnRef.current;
      if (activeBtn && toggleContainerRef.current) {
        const containerRect = toggleContainerRef.current.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        setTogglePosition({
          left: btnRect.left - containerRect.left,
          width: btnRect.width,
        });
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [viewMode]);

  const fetchAllUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const usersData: UserData[] = [];
      for (const userDoc of usersSnapshot.docs) {
        const user = userDoc.data() as UserData;
        user.uid = userDoc.id;
        const firstSelfieRef = doc(db, "users", userDoc.id, "selfie", "first");
        const firstSelfieSnap = await getDoc(firstSelfieRef);
        if (firstSelfieSnap.exists()) user.firstSelfie = firstSelfieSnap.data() as SelfieData;
        const latestSelfieRef = doc(db, "users", userDoc.id, "selfie", "latest");
        const latestSelfieSnap = await getDoc(latestSelfieRef);
        if (latestSelfieSnap.exists()) user.latestSelfie = latestSelfieSnap.data() as SelfieData;
        usersData.push(user);
      }
      usersData.sort((a, b) => {
        const dateA = a.lastLoginAt?.toDate?.() || new Date(0);
        const dateB = b.lastLoginAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(user =>
        user.displayName?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.uid.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "Unknown";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return "Unknown"; }
  };

  const downloadSelfie = (imageData: string, username: string, type: string) => {
    const link = document.createElement("a");
    link.href = imageData;
    link.download = `selfie_${type}_${username}_${Date.now()}.jpg`;
    link.click();
  };

  const getCurrentSelfie = (user: UserData): SelfieData | undefined => {
    return viewMode === "first" ? user.firstSelfie : user.latestSelfie;
  };

  if (isAuthorizing) return <div className="collectphoto-loading"><Loader2 className="spin" size={40} /><p>Authorizing...</p></div>;
  if (!isAdmin) return <div className="collectphoto-error"><Shield size={48} /><h2>Access Denied</h2><p>You don't have permission to view this page.</p></div>;

  return (
    <div className="collectphoto-container">
      <header className="collectphoto-header">
        <h1>Selfie Collection</h1>
        <p>{filteredUsers.length} users • {users.filter(u => u.firstSelfie).length} first • {users.filter(u => u.latestSelfie).length} latest</p>
        <div className="collectphoto-controls">
          <div className="collectphoto-search">
            <Search size={18} />
            <input type="text" placeholder="Search by name, email, or UID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="collectphoto-toggle" ref={toggleContainerRef}>
            <motion.div className="toggle-bg" animate={{ left: togglePosition.left, width: togglePosition.width }} transition={{ type: "spring", stiffness: 500, damping: 35 }} />
            <button ref={firstBtnRef} className={`toggle-btn ${viewMode === "first" ? "active" : ""}`} onClick={() => setViewMode("first")}><Camera size={16} /><span>First Selfie</span></button>
            <button ref={latestBtnRef} className={`toggle-btn ${viewMode === "latest" ? "active" : ""}`} onClick={() => setViewMode("latest")}><RefreshCw size={16} /><span>Latest Selfie</span></button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="collectphoto-loading"><Loader2 className="spin" size={40} /><p>Loading...</p></div>
      ) : error ? (
        <div className="collectphoto-error"><AlertCircle size={48} /><p>{error}</p><button onClick={fetchAllUsers}>Retry</button></div>
      ) : (
        <div className="collectphoto-grid">
          {filteredUsers.map((user) => {
            const current = getCurrentSelfie(user);
            return (
              <motion.div key={`${user.uid}-${viewMode}`} className="collectphoto-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} onClick={() => setSelectedUser(user)}>
                <div className="collectphoto-card-image">
                  {current ? <img src={current.image} alt={user.displayName || "User"} /> : <div className="no-selfie"><User size={48} /><span>No {viewMode} selfie</span></div>}
                </div>
                <div className="collectphoto-card-info">
                  <h3>{user.displayName || "Anonymous"}</h3>
                  <p>{user.email || "No email"}</p>
                  <div className="collectphoto-card-meta">
                    <span><Calendar size={12} />{current?.timestamp ? formatDate(current.timestamp).split(",")[0] : "Never"}</span>
                    {user.lastDevice && <span><Smartphone size={12} />{user.lastDevice.isMobile ? "Mobile" : "Desktop"}</span>}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filteredUsers.length === 0 && <div className="collectphoto-empty"><User size={64} /><p>No users found</p><p className="collectphoto-empty-sub">Try a different search term</p></div>}
        </div>
      )}

      <AnimatePresence>
        {selectedUser && (
          <motion.div className="collectphoto-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedUser(null)}>
            <motion.div className="collectphoto-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedUser(null)}><ArrowLeft size={20} /></button>
              <div className="modal-content">
                <div className="modal-photo-section">
                  {/* Carousel - Hanya untuk gambar, tanpa indicator */}
                  <Carousel 
                    showThumbs={false} 
                    showStatus={false} 
                    showArrows={true} 
                    showIndicators={false}
                    swipeable={true} 
                    emulateTouch={true} 
                    dynamicHeight={false}
                    onChange={(index) => setCurrentSlide(index)}
                  >
                    <div>
                      <div className="carousel-frame" onClick={() => selectedUser.firstSelfie && setFullscreenImage(selectedUser.firstSelfie.image)}>
                        {selectedUser.firstSelfie ? (
                          <img src={selectedUser.firstSelfie.image} alt="First Selfie" />
                        ) : (
                          <div className="no-selfie-carousel"><Camera size={48} /><p>No first selfie</p></div>
                        )}
                        {selectedUser.firstSelfie && (
                          <div className="carousel-overlay">
                            <div className="carousel-overlay-top">
                              <button className="carousel-fullscreen-btn" onClick={(e) => { e.stopPropagation(); setFullscreenImage(selectedUser.firstSelfie!.image); }}><Maximize2 size={16} /></button>
                            </div>
                            <div className="carousel-overlay-bottom">
                              <span className="carousel-date">{formatDate(selectedUser.firstSelfie.timestamp)}</span>
                              <button className="carousel-download-btn" onClick={(e) => { e.stopPropagation(); downloadSelfie(selectedUser.firstSelfie!.image, selectedUser.displayName || "user", "first"); }}><Download size={14} /> Download</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="carousel-frame" onClick={() => selectedUser.latestSelfie && setFullscreenImage(selectedUser.latestSelfie.image)}>
                        {selectedUser.latestSelfie ? (
                          <img src={selectedUser.latestSelfie.image} alt="Latest Selfie" />
                        ) : (
                          <div className="no-selfie-carousel"><Camera size={48} /><p>No latest selfie</p></div>
                        )}
                        {selectedUser.latestSelfie && (
                          <div className="carousel-overlay">
                            <div className="carousel-overlay-top">
                              <button className="carousel-fullscreen-btn" onClick={(e) => { e.stopPropagation(); setFullscreenImage(selectedUser.latestSelfie!.image); }}><Maximize2 size={16} /></button>
                            </div>
                            <div className="carousel-overlay-bottom">
                              <span className="carousel-date">{formatDate(selectedUser.latestSelfie.timestamp)}</span>
                              <button className="carousel-download-btn" onClick={(e) => { e.stopPropagation(); downloadSelfie(selectedUser.latestSelfie!.image, selectedUser.displayName || "user", "latest"); }}><Download size={14} /> Download</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Carousel>

                  {/* Custom Indicator di luar carousel */}
                  <div className="custom-dots">
                    <button 
                      className={`custom-dot ${currentSlide === 0 ? "active" : ""}`}
                      onClick={() => setCurrentSlide(0)}
                    />
                    <button 
                      className={`custom-dot ${currentSlide === 1 ? "active" : ""}`}
                      onClick={() => setCurrentSlide(1)}
                    />
                  </div>
                </div>
                <div className="modal-details-container">
                  <div className="modal-user-header">
                    <h2>{selectedUser.displayName || "Anonymous User"}</h2>
                    <p className="modal-email">{selectedUser.email || "No email"}</p>
                  </div>
                  <div className="detail-section">
                    <h4>Account Info</h4>
                    <div className="detail-row"><span>UID:</span><code>{selectedUser.uid}</code></div>
                    <div className="detail-row"><span>Last Login:</span><span>{selectedUser.lastLoginAt ? formatDate(selectedUser.lastLoginAt) : "Unknown"}</span></div>
                  </div>
                  {selectedUser.lastLocation && (
                    <div className="detail-section">
                      <h4>Location</h4>
                      <div className="detail-row"><span>City/Country:</span><span>{selectedUser.lastLocation.city}, {selectedUser.lastLocation.country}</span></div>
                      <div className="detail-row"><span>IP Address:</span><span>{selectedUser.lastLocation.ip}</span></div>
                    </div>
                  )}
                  {selectedUser.lastDevice && (
                    <div className="detail-section">
                      <h4>Device</h4>
                      <div className="detail-row"><span>Type:</span><span>{selectedUser.lastDevice.isMobile ? "Mobile" : "Desktop"}</span></div>
                      <div className="detail-row"><span>Platform:</span><span>{selectedUser.lastDevice.platform}</span></div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fullscreenImage && (
          <motion.div className="fullscreen-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFullscreenImage(null)}>
            <button className="fullscreen-close" onClick={() => setFullscreenImage(null)}><X size={24} /></button>
            <img src={fullscreenImage} alt="Fullscreen selfie" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollectPhoto;