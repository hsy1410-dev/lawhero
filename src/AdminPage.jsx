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
  const [users, setUsers] = useState([]);

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

    // 문서 없으면 최초 생성
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
     👥 사용자 목록 구독
     =============================== */
  useEffect(() => {
    if (!isAdmin) return;

    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // 관리자 제외
      setUsers(list.filter((u) => u.role !== "admin"));
    });

    return () => unsub();
  }, [isAdmin]);

  /* ===============================
     🔘 전역 스위치 토글
     =============================== */
  const toggleGlobal = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "system", "globalAccess");

    await updateDoc(ref, {
      enabled: !enabled,
      updatedAt: serverTimestamp(),
    });

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
     ❌ 사용자 삭제
     =============================== */
  const deleteUser = async (uid) => {
    if (!window.confirm("정말 이 사용자를 삭제할까요?")) return;

    const token = await auth.currentUser.getIdToken();

    const res = await fetch("/api/admin/deleteUser", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uid }),
    });

    if (!res.ok) {
      alert("삭제 실패");
      return;
    }

    alert("사용자 삭제 완료");
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
      <div className="bg-white p-8 rounded-2xl shadow-xl w-[380px] text-center">
        <h1 className="text-2xl font-bold mb-4">🛠 관리자 패널</h1>

        {/* 전역 접근 스위치 */}
        <p className="mb-3 text-gray-600">전체 사용자 접근 상태</p>

        <button
          onClick={toggleGlobal}
          className={`w-full py-3 rounded-xl text-white font-semibold transition ${
            enabled ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {enabled ? "ACTIVE (전체 허용)" : "PENDING (전체 차단)"}
        </button>

        <p className="mt-3 text-xs text-gray-400">
          스위치 변경 시 모든 사용자에게 즉시 반영됩니다.
        </p>

        {/* 사용자 관리 */}
        <div className="mt-6 text-left">
          <h2 className="font-bold mb-2">👥 사용자 관리</h2>

          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex justify-between items-center bg-gray-100 px-3 py-2 rounded"
              >
                <div>
                  <p className="text-sm font-semibold">{u.email}</p>
                  <p className="text-xs text-gray-500">
                    상태: {u.role ?? "user"}
                  </p>
                </div>

                <button
                  onClick={() => deleteUser(u.id)}
                  className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </div>

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
