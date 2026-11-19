import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth as firebaseGetAuth, setPersistence, browserLocalPersistence, type Auth } from "firebase/auth";
import { getFirebaseConfig } from "./api";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export const initializeFirebase = async (): Promise<{ auth: Auth }> => {
  if (auth) return { auth };
  const config = await getFirebaseConfig();
  app = initializeApp(config);
  auth = firebaseGetAuth(app);
  await setPersistence(auth, browserLocalPersistence);
  return { auth };
};

export const getAuth = async (): Promise<Auth> => {
  if (!auth) await initializeFirebase();
  return auth as Auth;
};
