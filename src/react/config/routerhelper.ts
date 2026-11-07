import { getAuth, getDb } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface RouterCredentials { apiKey: string; }
const userDoc = async () => { const auth = await getAuth(); const user = auth.currentUser; if (!user) throw new Error("User not authenticated"); const db = await getDb(); return doc(db, "users", user.uid); };
export const saveRouterCredentials = async (apiKey: string): Promise<void> => { await setDoc(await userDoc(), { nineRouterApiKey: apiKey.trim() }, { merge: true }); };
export const loadRouterCredentials = async (): Promise<RouterCredentials | null> => { const auth = await getAuth(); const user = auth.currentUser; if (!user) return null; const db = await getDb(); const snapshot = await getDoc(doc(db, "users", user.uid)); if (!snapshot.exists()) return null; const data = snapshot.data(); const apiKey = typeof data.nineRouterApiKey === "string" ? data.nineRouterApiKey.trim() : ""; return apiKey ? { apiKey } : null; };
export const clearRouterCredentials = async (): Promise<void> => { await setDoc(await userDoc(), { nineRouterApiKey: null, nineRouterModel: null }, { merge: true }); };
