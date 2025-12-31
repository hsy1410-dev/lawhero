import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  inMemoryPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MSG_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// ✅ Firebase App 싱글톤 보장 (🔥 핵심)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Auth / Firestore 동일 app 사용
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ persistence 설정 (선택)
setPersistence(auth, inMemoryPersistence);

console.log("🔥 Connected Firebase Project ID:", app.options.projectId);
