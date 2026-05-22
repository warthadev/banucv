// src/react/config/geminihelper.ts
import { db, auth } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface GeminiCredentials {
  apiKey: string;
  updatedAt?: Date;
  uid?: string;
}

// Simpan API Key ke Firestore + localStorage
export const saveGeminiApiKey = async (apiKey: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  await setDoc(doc(db, "users", user.uid), { geminiApiKey: apiKey }, { merge: true });
  localStorage.setItem("gemini_api_key", apiKey);
};

// Load dari Firestore
export const loadGeminiApiKey = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  const docRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data().geminiApiKey) {
    const key = docSnap.data().geminiApiKey;
    localStorage.setItem("gemini_api_key", key);
    return key;
  }
  return null;
};

// Cek token dari Firestore atau localStorage
export const getGeminiApiKey = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  
  // Prioritas: Firestore dulu, baru localStorage
  const firestoreKey = await loadGeminiApiKey();
  if (firestoreKey) return firestoreKey;
  
  const localKey = localStorage.getItem("gemini_api_key");
  if (localKey) return localKey;
  
  return null;
};

// Cek apakah token sudah tersedia (sync)
export const hasGeminiToken = (): boolean => {
  return !!localStorage.getItem("gemini_api_key");
};

// Hapus token
export const clearGeminiApiKey = () => {
  localStorage.removeItem("gemini_api_key");
};