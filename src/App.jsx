import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

import Login from "./Login";
import Signup from "./Signup";
import ChatPage from "./ChatPage";
import AdminPage from "./AdminPage";
import TypingText from "./TypingText";

export default function App() {
  /* ===============================
     🔐 Auth
     =============================== */
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  /* ===============================
     👑 Role
     =============================== */
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  /* ===============================
     🌍 Global Access
     =============================== */
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [loadingGlobal, setLoadingGlobal] = useState(true);

  /* ===============================
     📄 Page
     =============================== */
  const [page, setPage] = useState("login");

  /* ===============================
     🔐 Auth 상태 구독
     =============================== */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingUser(false);

      if (!u) {
        setIsAdmin(false);
        setLoadingRole(false);
      }
    });

    return () => unsub();
  }, []);

  /* ===============================
     👑 Role 구독
     =============================== */
  useEffect(() => {
    if (!user?.uid) return;

    const ref = doc(db, "users", user.uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        setIsAdmin(snap.exists() && snap.data()?.role === "admin");
        setLoadingRole(false);
      },
      () => {
        setIsAdmin(false);
        setLoadingRole(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  /* ===============================
     🌍 Global Access 구독 (핵심)
     =============================== */
  useEffect(() => {
    if (loadingUser) return;

    if (!user?.uid) {
      setGlobalEnabled(true);
      setLoadingGlobal(false);
      return;
    }

    setLoadingGlobal(true);

    const ref = doc(db, "system", "globalAccess");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // 문서 없으면 기본 허용
          setGlobalEnabled(true);
        } else {
          setGlobalEnabled(Boolean(snap.data()?.enabled));
        }
        setLoadingGlobal(false);
      },
      (err) => {
        console.error("🔥 globalAccess error:", err);
        // ❗ 에러 나도 UX는 진행
        setGlobalEnabled(true);
        setLoadingGlobal(false);
      }
    );

    return () => unsub();
  }, [loadingUser, user?.uid]);

  /* ===============================
     ⏳ 전역 로딩
     =============================== */
  if (loadingUser || loadingRole || loadingGlobal) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        🔄 상태 확인 중…
      </div>
    );
  }

  /* ===============================
     🚫 로그인 안 됨
     =============================== */
  if (!user) {
    return page === "login" ? (
      <Login
        goSignup={() => setPage("signup")}
        onFinishLogin={() => setPage("intro")}
      />
    ) : (
      <Signup goLogin={() => setPage("login")} />
    );
  }

  /* ===============================
     ⛔ 전역 차단 (관리자 제외)
     =============================== */
  if (globalEnabled === false && !isAdmin) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">⛔ 서비스 점검 중</h2>
          <p className="text-gray-400">
            현재 관리자가 전체 접근을 제한했습니다.
          </p>
        </div>
      </div>
    );
  }

  /* ===============================
     🎬 Intro
     =============================== */
  if (page === "intro") {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <TypingText
          text="Here, Ever Reliable & Open"
          size="xl"
          onComplete={() => setPage("main")}
        />
      </div>
    );
  }

  /* ===============================
     🛠 Admin
     =============================== */
  if (page === "admin" && isAdmin) {
    return <AdminPage goMain={() => setPage("main")} />;
  }

  /* ===============================
     💬 Main
     =============================== */
  return (
    <ChatPage
  user={user}
  isAdmin={isAdmin}
  goAdmin={isAdmin ? () => setPage("admin") : null}
/>

  );
}
