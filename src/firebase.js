import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
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

// 1️⃣ Firebase 초기화
const app = initializeApp(firebaseConfig);

// 2️⃣ Auth / DB 생성
export const auth = getAuth(app);
export const db = getFirestore(app);

// 3️⃣ 🔐 자동 로그인 방지 (세션 단위 유지)
setPersistence(auth, inMemoryPersistence);

// 4️⃣ 연결 확인 로그
console.log("🔥 Connected Firebase Project ID:", app.options.projectId);
