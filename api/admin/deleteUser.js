import admin from "firebase-admin";

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
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) return res.status(401).end();

    const decoded = await admin.auth().verifyIdToken(token);

    // 🔐 관리자 확인
    const snap = await admin
      .firestore()
      .doc(`users/${decoded.uid}`)
      .get();

    if (snap.data()?.role !== "admin") {
      return res.status(403).json({ error: "관리자 아님" });
    }

    const { uid } = req.body;

    // 1️⃣ Auth 계정 삭제
    await admin.auth().deleteUser(uid);

    // 2️⃣ Firestore 문서 삭제
    await admin.firestore().doc(`users/${uid}`).delete();

    // 3️⃣ 로그
    await admin.firestore().collection("adminLogs").add({
      adminUid: decoded.uid,
      action: "DELETE_USER",
      targetUid: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
