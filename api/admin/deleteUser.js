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

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "3600");
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  try {
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

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

    if (uid === decoded.uid) {
      return res.status(400).json({ error: "자기 자신은 삭제할 수 없습니다." });
    }

    // Auth 계정이 이미 없더라도 Firestore 정리는 계속 진행한다.
    try {
      await admin.auth().deleteUser(uid);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") {
        throw error;
      }
    }

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
