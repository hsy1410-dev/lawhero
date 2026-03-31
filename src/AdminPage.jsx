import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { db } from "./firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  getDoc,
  addDoc,
  collection,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const DELETE_USER_URL =
  import.meta.env.PROD
    ? "/api/admin/deleteUser"
    : import.meta.env.VITE_DELETE_USER_URL?.trim() ||
      "https://us-central1-lawhero-35bd7.cloudfunctions.net/deleteUser";

export default function AdminPage({ goMain }) {
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [enabled, setEnabled] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  /* ===============================
     🔐 Auth 준비 완료 대기
     =============================== */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthReady(true);
      } else {
        setAuthReady(false);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  /* ===============================
     👑 관리자 여부 확인
     =============================== */
  useEffect(() => {
    if (!authReady) return;

    const checkRole = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        const snap = await getDoc(doc(db, "users", user.uid));
        setIsAdmin(snap.exists() && snap.data()?.role === "admin");
      } catch (e) {
        console.error("🔥 admin check error:", e);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [authReady]);

  /* ===============================
     🌍 전역 접근 스위치 구독
     =============================== */
  useEffect(() => {
    if (!authReady || !isAdmin) return;

    const ref = doc(db, "system", "globalAccess");

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setEnabled(snap.data().enabled);
      }
    });

    return () => unsub();
  }, [authReady, isAdmin]);

  /* ===============================
     👥 사용자 목록 구독
     =============================== */
  useEffect(() => {
    if (!authReady || !isAdmin) return;

    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // 관리자 제외
      setUsers(list.filter((u) => u.role !== "admin"));
    });

    return () => unsub();
  }, [authReady, isAdmin]);

  /* ===============================
     🔘 전역 접근 토글
     =============================== */
  const toggleGlobal = async () => {
    try {
      const ref = doc(db, "system", "globalAccess");

      await updateDoc(ref, {
        enabled: !enabled,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "adminLogs"), {
        adminUid: auth.currentUser.uid,
        adminEmail: auth.currentUser.email,
        action: "GLOBAL_ACCESS_TOGGLE",
        before: enabled,
        after: !enabled,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("🔥 toggle error:", e);
      alert("전역 스위치 변경 실패");
    }
  };

  /* ===============================
     ✅ 사용자 승인 (pending → active)
     =============================== */
  const approveUser = async (uid) => {
    if (!window.confirm("이 사용자를 승인하시겠습니까?")) return;

    try {
      await updateDoc(doc(db, "users", uid), {
        role: "active",
        approvedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "adminLogs"), {
        adminUid: auth.currentUser.uid,
        adminEmail: auth.currentUser.email,
        action: "USER_APPROVE",
        targetUid: uid,
        createdAt: serverTimestamp(),
      });

      alert("✅ 사용자 승인 완료");
    } catch (e) {
      console.error("🔥 approve error:", e);
      alert("승인 실패");
    }
  };

  /* ===============================
     ❌ 사용자 삭제
     =============================== */
  const deleteUser = async (uid) => {
    if (!window.confirm("정말 이 사용자를 삭제할까요?")) return;

    try {
      const token = await auth.currentUser.getIdToken();

      const res = await fetch(DELETE_USER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid }),
      });

      const raw = await res.text();
      let payload = null;

      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        throw new Error(
          payload?.error || `삭제 API 실패 (${res.status})`
        );
      }

      alert("사용자 삭제 완료");
    } catch (e) {
      console.error("🔥 delete user error:", e);
      alert(`삭제 실패: ${e.message}`);
    }
  };

  /* ===============================
     ⛔ 접근 제어
     =============================== */
  if (loading || !authReady) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        인증 확인 중…
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
      <div className="bg-white p-8 rounded-2xl shadow-xl w-[420px] text-center">
        <h1 className="text-2xl font-bold mb-4">🛠 관리자 패널</h1>

        {/* 전역 접근 */}
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

          <ul className="space-y-2 max-h-56 overflow-y-auto">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex justify-between items-center bg-gray-100 px-3 py-2 rounded"
              >
                <div>
                  <p className="text-sm font-semibold">{u.email}</p>
                  <p className="text-xs text-gray-500">
                    상태: {u.role}
                  </p>
                </div>

                <div className="flex gap-2">
                  {u.role === "pending" && (
                    <button
                      onClick={() => approveUser(u.id)}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                    >
                      승인
                    </button>
                  )}

                  <button
                    onClick={() => deleteUser(u.id)}
                    className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  >
                    삭제
                  </button>
                </div>
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
