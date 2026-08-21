import { useState } from "react";
import { auth } from "./firebase";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="w-screen h-screen relative overflow-hidden">
      {/* 배경 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/back.png')" }}
      />

      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <AnimatePresence>
          <motion.div
            key="login-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4 }}
            className="
              relative p-[1px] rounded-2xl
              bg-gradient-to-br
              from-sky-400/60 via-indigo-400/40 to-pink-400/60
              shadow-xl
            "
          >
            <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl w-80">
             <h2 className="text-lg font-semibold mb-4 text-center text-sky-300">
  LAWHERE
</h2>

              <form onSubmit={handleAuth}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                    if (message) setMessage("");
                  }}
                  className="w-full p-2 border rounded mb-3"
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value);
                    if (error) setError("");
                  }}
                  className="w-full p-2 border rounded mb-3"
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
                  className="w-full mb-3 text-sm text-right text-sky-600 hover:text-sky-700"
                >
                  {resetOpen ? "비밀번호 찾기 닫기" : "비밀번호를 잊으셨나요?"}
                </button>

                <AnimatePresence initial={false}>
                  {resetOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-sky-800">
                        <p className="mb-2">
                          입력한 이메일로 비밀번호 재설정 링크를 보내드릴게요.
                        </p>
                        <button
                          type="button"
                          onClick={handlePasswordReset}
                          disabled={resetLoading}
                          className="w-full rounded-lg bg-white px-3 py-2 font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {resetLoading
                            ? "재설정 메일 보내는 중..."
                            : "재설정 메일 보내기"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading || resetLoading}
                  className="
            w-full p-3 rounded-lg text-white
            bg-gradient-to-r from-sky-400 to-pink-400
            hover:from-sky-500 hover:to-pink-500
            transition disabled:opacity-60 disabled:cursor-not-allowed
          "
                >
                  로그인
                </button>
              </form>

              <p
                onClick={goSignup}
                className="text-sm text-center mt-3 cursor-pointer text-sky-600"
              >
                회원가입하기
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
