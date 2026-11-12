import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore/lite';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every(Boolean);
const existingApp = getApps().length ? getApp() : null;
const app = firebaseConfigured ? existingApp ?? initializeApp(config) : null;

export const auth = app
  ? existingApp ? getAuth(app) : initializeAuth(app, { persistence: inMemoryPersistence })
  : null;
export const db = app ? getFirestore(app) : null;
