// src/react/config/geminihelper.ts
import { getDb, getAuth } from "./firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

export interface GeminiCredentials {
  apiKey: string;
  updatedAt?: Date;
  uid?: string;
}

export const saveGeminiApiKey = async (apiKey: string) => {
  const auth = await getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  
  const db = await getDb();
  await setDoc(doc(db, "users", user.uid), { geminiApiKey: apiKey }, { merge: true });
};

export const loadGeminiApiKey = async (): Promise<string | null> => {
  const auth = await getAuth();
  const user = auth.currentUser;
  if (!user) return null;
  
  const db = await getDb();
  const docRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists() && docSnap.data().geminiApiKey) {
    return docSnap.data().geminiApiKey;
  }
  return null;
};

export const getGeminiApiKey = async (): Promise<string | null> => {
  const auth = await getAuth();
  const user = auth.currentUser;
  if (!user) return null;
  
  const firestoreKey = await loadGeminiApiKey();
  if (firestoreKey) return firestoreKey;
  
  return null;
};

export const hasGeminiToken = (): boolean => {
  return false;
};

export const clearGeminiApiKey = async (): Promise<void> => {
  const auth = await getAuth();
  const user = auth.currentUser;
  if (user) {
    try {
      const db = await getDb();
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { geminiApiKey: null });
    } catch (error) {
      console.error("Failed to clear Gemini API key:", error);
    }
  }
};