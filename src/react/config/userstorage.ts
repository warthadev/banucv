// src/react/config/userstorage.ts
import { db } from "./firebase";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, increment } from "firebase/firestore";

export interface UserProfile {
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
}

export const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) return 'Never';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  } catch (e) {
    return 'Invalid date';
  }
};

// Ambil IP asli user
const fetchPublicIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'Unknown';
  } catch (error) {
    console.warn('Failed to fetch IP:', error);
    return 'Unknown';
  }
};

// IP-based geolocation (fallback)
const fetchGeoLocationFromIP = async () => {
  try {
    const response = await fetch('http://ip-api.com/json/');
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        city: data.city || 'Unknown',
        country: data.country || 'Unknown',
        region: data.regionName || 'Unknown',
        lat: data.lat || 0,
        lon: data.lon || 0,
        ip: data.query || 'Unknown',
        isp: data.isp || 'Unknown',
        source: 'ip'
      };
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch geolocation from IP:', error);
    return null;
  }
};

// Browser GPS
const fetchAccurateLocation = (): Promise<{ lat: number; lon: number; accuracy: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        resolve(null);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
};

// Reverse geocoding
const reverseGeocode = async (lat: number, lon: number): Promise<{ city: string; country: string }> => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`);
    const data = await response.json();
    
    if (data && data.address) {
      const city = data.address.city || data.address.town || data.address.village || data.address.municipality || 'Unknown';
      const country = data.address.country || 'Unknown';
      return { city, country };
    }
    return { city: 'Unknown', country: 'Unknown' };
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    return { city: 'Unknown', country: 'Unknown' };
  }
};

// Gabungan: GPS dulu, fallback IP
const fetchGeoLocation = async () => {
  try {
    // Langkah 1: GPS
    const accurateLocation = await fetchAccurateLocation();
    
    if (accurateLocation && accurateLocation.accuracy < 500) {
      const { city, country } = await reverseGeocode(accurateLocation.lat, accurateLocation.lon);
      const publicIP = await fetchPublicIP();
      
      return {
        city: city,
        country: country,
        lat: accurateLocation.lat,
        lon: accurateLocation.lon,
        ip: publicIP,  // IP asli user
        source: 'gps',
        accuracy: accurateLocation.accuracy
      };
    }
    
    // Langkah 2: IP-based
    const ipData = await fetchGeoLocationFromIP();
    if (ipData) {
      return {
        city: ipData.city,
        country: ipData.country,
        lat: ipData.lat,
        lon: ipData.lon,
        ip: ipData.ip,
        source: 'ip',
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to fetch geolocation:', error);
    return null;
  }
};

const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform || 'Unknown';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
  return { userAgent, platform, isMobile };
};

export const saveUserOnLogin = async (user: any, provider: string) => {
  if (!user || !user.uid) return;
  
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  
  const geoData = await fetchGeoLocation();
  const deviceData = getDeviceInfo();
  
  let email = user.email;
  if (!email) {
    if (user.providerData && user.providerData.length > 0) {
      email = user.providerData[0]?.email || null;
    }
    if (!email) {
      email = null;
    }
  }
  
  let displayName = user.displayName;
  if (!displayName && email) {
    displayName = email.split('@')[0];
  }
  if (!displayName) {
    displayName = 'User';
  }
  
  const photoURL = user.photoURL || null;
  
  // Simpan juga source lokasi (opsional, untuk debug)
  const locationData = geoData ? {
    city: geoData.city,
    country: geoData.country,
    lat: geoData.lat,
    lon: geoData.lon,
    ip: geoData.ip,
    timestamp: serverTimestamp(),
  } : null;
  
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: email,
      displayName: displayName,
      photoURL: photoURL,
      providers: [provider],
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      loginCount: 1,
      lastLocation: locationData,
      lastDevice: deviceData,
    });
    console.log(`[NEW USER] Created: ${displayName} (${email || 'no email'})`);
  } else {
    const existingData = userSnap.data();
    const existingProviders = existingData.providers || [];
    if (!existingProviders.includes(provider)) {
      existingProviders.push(provider);
    }
    
    const finalEmail = email || existingData.email || null;
    const finalDisplayName = displayName || existingData.displayName || 'User';
    const finalPhotoURL = photoURL || existingData.photoURL || null;
    
    await updateDoc(userRef, {
      email: finalEmail,
      displayName: finalDisplayName,
      photoURL: finalPhotoURL,
      lastLoginAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      loginCount: increment(1),
      providers: existingProviders,
      lastLocation: locationData || existingData.lastLocation,
      lastDevice: deviceData,
    });
    console.log(`[EXISTING USER] Updated: ${finalDisplayName} (${finalEmail || 'no email'})`);
  }
};

export const updateLastSeen = async (uid: string) => {
  if (!uid) return;
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    lastSeen: serverTimestamp(),
  });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  if (!uid) return null;
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  return null;
};