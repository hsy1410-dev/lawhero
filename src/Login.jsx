import { useState } from "react";
import { auth } from "./firebase";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { motion as Motion, AnimatePresence } from "framer-motion";

export default function Login({ goSignup, onFinishLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (loading) return;

    try {
      setError("");
      setMessage("");
      setLoading(true);
      const cleanEmail = email.trim().toLowerCase();

      // 🔐 로그인
      await signInWithEmailAndPassword(auth, cleanEmail, pw);

      // ⭐ 여기서 App에게 “로그인 끝났다”만 알림
      onFinishLogin();
    } catch (err) {
      console.error(err);
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessage("");
      setError("비밀번호 재설정을 위해 이메일을 입력해주세요.");
      return;
    }

    try {
      setError("");
      setMessage("");
      setResetLoading(true);

      await sendPasswordResetEmail(auth, cleanEmail);

      setMessage(
        "비밀번호 재설정 메일을 보냈습니다. 받은편지함 또는 스팸함을 확인해주세요."
      );
      setResetOpen(false);
    } catch (err) {
      console.error(err);
      setError("비밀번호 재설정 메일을 보내지 못했습니다. 이메일을 다시 확인해주세요.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#f8fbff] px-5 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-100/70 blur-3xl" />
      <div className="pointer-events-none -bottom-32 -right-20 absolute h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />

      <div className="relative z-10 flex min-h-[calc(100vh-5rem)] w-full items-center justify-center">
        <AnimatePresence>
          <Motion.div
            key="login-card"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_70px_-30px_rgba(15,60,110,0.28)]"
          >
            <div className="bg-gradient-to-br from-sky-500 to-blue-600 px-8 py-7">
              <div className="flex items-center justify-center gap-3">
                <img
                  src="/ㅇㅇ (4).png"
                  alt=""
                  aria-hidden="true"
                  className="h-11 w-11 shrink-0 object-contain"
                />
                <span className="h-7 w-px bg-white/35" aria-hidden="true" />
                <img
                  src="/ㅇㅇ (1).png"
                  alt="LAWHERE"
                  className="h-8 w-auto max-w-[190px] object-contain"
                />
              </div>
            </div>

            <div className="bg-white px-8 pb-8 pt-7">
              <div className="mb-6 text-center">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                  다시 만나 반가워요
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">
                  로히어 계정으로 로그인해 주세요.
                </p>
              </div>

              <form onSubmit={handleAuth}>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                    if (message) setMessage("");
                  }}
                  className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />

                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value);
                    if (error) setError("");
                  }}
                  className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />

                {error && (
                  <p className="text-red-500 text-sm mb-2 text-center">
                    {error}
                  </p>
                )}

                {message && (
                  <p className="text-emerald-600 text-sm mb-2 text-center">
                    {message}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setResetOpen((prev) => !prev);
                    setError("");
                    setMessage("");
                  }}
                  className="mb-4 w-full text-right text-sm font-medium text-sky-600 transition hover:text-sky-700"
                >
                  {resetOpen ? "비밀번호 찾기 닫기" : "비밀번호를 잊으셨나요?"}
                </button>

                <AnimatePresence initial={false}>
                  {resetOpen && (
                    <Motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-sky-800">
                        <p className="mb-2">
                          입력한 이메일로 비밀번호 재설정 링크를 보내드릴게요.
                        </p>
                        <button
                          type="button"
                          onClick={handlePasswordReset}
                          disabled={resetLoading}
                          className="w-full rounded-lg bg-white px-3 py-2 font-medium text-sky-700 shadow-sm transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {resetLoading
                            ? "재설정 메일 보내는 중..."
                            : "재설정 메일 보내기"}
                        </button>
                      </div>
                    </Motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading || resetLoading}
                  className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 p-3 font-semibold text-white shadow-lg shadow-sky-200/70 transition hover:from-sky-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  로그인
                </button>
              </form>

              <p
                onClick={goSignup}
                className="mt-4 cursor-pointer text-center text-sm font-medium text-sky-600 transition hover:text-sky-700"
              >
                회원가입하기
              </p>
            </div>
          </Motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
