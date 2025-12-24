import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { db } from "./firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp,
  getDoc,
  addDoc,
  collection,
} from "firebase/firestore";

export default function AdminPage({ goMain }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [enabled, setEnabled] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ===============================
     👑 관리자 여부 확인
     =============================== */
  useEffect(() => {
    const checkRole = async () => {
      const user = auth.currentUser;
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      setIsAdmin(snap.exists() && snap.data()?.role === "admin");
      setLoading(false);
    };

    checkRole();
  }, []);

  /* ===============================
     🌍 전역 접근 스위치 구독
     =============================== */
  useEffect(() => {
    if (!isAdmin) return;

    const ref = doc(db, "system", "globalAccess");

    // ✅ 문서 없으면 최초 생성
    getDoc(ref).then((snap) => {
      if (!snap.exists()) {
        setDoc(ref, {
          enabled: true,
          updatedAt: serverTimestamp(),
        });
      }
    });

    const unsub = onSnapshot(ref, (snap) => {
      setEnabled(snap.data()?.enabled ?? true);
    });

    return () => unsub();
  }, [isAdmin]);

  /* ===============================
     🔘 전역 스위치 토글
     =============================== */
  const toggle = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "system", "globalAccess");

    // 1️⃣ 스위치 변경
    await updateDoc(ref, {
      enabled: !enabled,
      updatedAt: serverTimestamp(),
    });

    // 2️⃣ 관리자 로그 기록
  await addDoc(collection(db, "adminLogs"), {
  adminUid: user.uid,
  adminEmail: user.email,
  action: "GLOBAL_ACCESS_TOGGLE",
  before: enabled,
  after: !enabled,
  createdAt: serverTimestamp(),
});

  };

  /* ===============================
     ⛔ 접근 제어
     =============================== */
  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        로딩 중…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <h2 className="text-xl font-bold">⛔ 관리자 전용 페이지</h2>
      </div>
    );
  }

  if (enabled === null) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        설정 불러오는 중…
      </div>
    );
  }

  /* ===============================
     ✅ UI
     =============================== */
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-[360px] text-center">
        <h1 className="text-2xl font-bold mb-4">🛠 관리자 패널</h1>

        <p className="mb-6 text-gray-600">전체 사용자 접근 상태</p>

        <button
          onClick={toggle}
          className={`w-full py-3 rounded-xl text-white font-semibold transition ${
            enabled ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {enabled ? "ACTIVE (전체 허용)" : "PENDING (전체 차단)"}
        </button>

        <p className="mt-4 text-xs text-gray-400">
          스위치 변경 시 모든 사용자에게 즉시 반영됩니다.
        </p>

        {goMain && (
          <button
            onClick={goMain}
            className="mt-6 w-full py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition"
          >
            ← 메인으로 돌아가기
          </button>
        )}
      </div>
    </div>
  );
}
