// 🔥 반드시 Node runtime 강제
export const config = {
  runtime: "nodejs",
};

import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// 🔥 Admin SDK 초기화 (1회)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // 🔐 토큰 확인
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "No token" });
    }

    const decoded = await admin.auth().verifyIdToken(token);

    // 🔐 관리자 확인
    const adminSnap = await admin
      .firestore()
      .doc(`users/${decoded.uid}`)
      .get();

    if (!adminSnap.exists || adminSnap.data()?.role !== "admin") {
      return res.status(403).json({ error: "관리자 아님" });
    }

    // 🔥 body 안전 파싱
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { uid } = body || {};
    if (!uid) {
      return res.status(400).json({ error: "uid missing" });
    }

    // 1️⃣ Auth 계정 삭제
    await admin.auth().deleteUser(uid);

    // 2️⃣ Firestore 문서 삭제
    await admin.firestore().doc(`users/${uid}`).delete();

    // 3️⃣ 로그
    await admin.firestore().collection("adminLogs").add({
      adminUid: decoded.uid,
      action: "DELETE_USER",
      targetUid: uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("🔥 deleteUser fatal error:", e);
    return res.status(500).json({
      error: e.message,
      stack: e.stack, // 🔥 로컬 디버깅용
    });
  }
}
