const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * 🔥 관리자 전용 사용자 삭제
 * POST /deleteUser
 */
exports.deleteUser = functions.https.onRequest(async (req, res) => {
  try {
    // CORS (Vite에서 호출용)
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // 🔐 토큰 추출
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "No token" });
    }

    // 🔐 토큰 검증
    const decoded = await admin.auth().verifyIdToken(token);

    // 🔐 관리자 확인
    const adminSnap = await admin
      .firestore()
      .doc(`users/${decoded.uid}`)
      .get();

    if (!adminSnap.exists || adminSnap.data().role !== "admin") {
      return res.status(403).json({ error: "관리자 아님" });
    }

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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("🔥 deleteUser error:", e);
    return res.status(500).json({ error: e.message });
  }
});
