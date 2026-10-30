// src/react/config/firebase.ts
import { initializeApp } from "firebase/app";
import { 
  getAuth as firebaseGetAuth, 
  setPersistence, 
  browserLocalPersistence,
  onAuthStateChanged 
} from "firebase/auth";
import { getFirestore as firebaseGetFirestore } from "firebase/firestore";
import { getFirebaseConfig } from "./api";

let appInitialized = false;
let authInstance: any = null;
let dbInstance: any = null;

export const initializeFirebase = async () => {
  if (appInitialized) {
    return { auth: authInstance, db: dbInstance };
  }

  try {
    const config = await getFirebaseConfig();
    
    const firebaseConfig = {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
      measurementId: config.measurementId,
    };

    const app = initializeApp(firebaseConfig);
    authInstance = firebaseGetAuth(app);
    dbInstance = firebaseGetFirestore(app);

    await setPersistence(authInstance, browserLocalPersistence);

    appInitialized = true;
    return { auth: authInstance, db: dbInstance };
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
  }
};

export const getAuth = async () => {
  if (!appInitialized) {
    await initializeFirebase();
  }
  return authInstance;
};

export const getDb = async () => {
  if (!appInitialized) {
    await initializeFirebase();
  }
  return dbInstance;
};

export const waitForAuth = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const checkAuth = async () => {
      try {
        const auth = await getAuth();
        if (auth.currentUser) {
          resolve(true);
          return;
        }
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          unsubscribe();
          resolve(!!user);
        });
      } catch (error) {
        resolve(false);
      }
    };
    checkAuth();
  });
};

export { authInstance as auth, dbInstance as db };