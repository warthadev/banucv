// src/react/config/userstorage.ts
import { getDb, getAuth } from "./firebase";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, increment } from "firebase/firestore";
import { formatTimestamp } from "./utils";

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

export { formatTimestamp };

const fetchPublicIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
};

const fetchGeoLocationFromIP = async () => {
  try {
    const response = await fetch('https://ip-api.com/json/');
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
    return null;
  }
};

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
        resolve(null);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
};

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
    return { city: 'Unknown', country: 'Unknown' };
  }
};

const fetchGeoLocation = async () => {
  try {
    const accurateLocation = await fetchAccurateLocation();
    
    if (accurateLocation && accurateLocation.accuracy < 500) {
      const { city, country } = await reverseGeocode(accurateLocation.lat, accurateLocation.lon);
      const publicIP = await fetchPublicIP();
      
      return {
        city: city,
        country: country,
        lat: accurateLocation.lat,
        lon: accurateLocation.lon,
        ip: publicIP,
        source: 'gps',
        accuracy: accurateLocation.accuracy
      };
    }
    
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
    return null;
  }
};

const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform || 'Unknown';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
  return { userAgent, platform, isMobile };
};

export const saveUserOnLogin = async (user: any, provider: string, emailOverride?: string | null) => {
  if (!user || !user.uid) return;
  
  const db = await getDb();
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  
  const geoData = await fetchGeoLocation();
  const deviceData = getDeviceInfo();
  
  let email = emailOverride || user.email;
  
  if (!email && user.providerData && user.providerData.length > 0) {
    for (const prov of user.providerData) {
      if (prov.email) {
        email = prov.email;
        break;
      }
    }
  }
  
  if (!email && user.providerData && user.providerData.length > 0) {
    for (const prov of user.providerData) {
      if (prov.providerId === 'google.com' && prov.email) {
        email = prov.email;
        break;
      }
    }
  }
  
  if (!email && user.reload) {
    try {
      await user.reload();
      const reloadedUser = user;
      if (reloadedUser) {
        email = reloadedUser.email || email;
      }
    } catch (e) {}
  }
  
  if (!email) {
    try {
      const userSnapCheck = await getDoc(userRef);
      if (userSnapCheck.exists()) {
        const existingData = userSnapCheck.data();
        if (existingData.email) {
          email = existingData.email;
        }
      }
    } catch (e) {}
  }
  
  if (!email) {
    try {
      const idTokenResult = await user.getIdTokenResult();
      if (idTokenResult.claims && idTokenResult.claims.email) {
        email = idTokenResult.claims.email;
      }
    } catch (e) {}
  }
  
  if (!email) {
    email = null;
  }
  
  let displayName = user.displayName;
  if (!displayName && email) {
    displayName = email.split('@')[0];
  }
  if (!displayName) {
    displayName = 'User';
  }
  
  const photoURL = user.photoURL || null;
  
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
  }
};

export const updateLastSeen = async (uid: string) => {
  if (!uid) return;
  const db = await getDb();
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    lastSeen: serverTimestamp(),
  });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  if (!uid) return null;
  const db = await getDb();
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  return null;
};