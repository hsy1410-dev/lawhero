import { useState } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";

export default function Login({ goSignup, onFinishLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (loading) return;

    try {
      setError("");
      setLoading(true);

      // 🔐 로그인
      await signInWithEmailAndPassword(auth, email, pw);

      // ⭐ 여기서 App에게 “로그인 끝났다”만 알림
      onFinishLogin();
    } catch (err) {
      console.error(err);
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
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
  LAW HERO
</h2>

              <form onSubmit={handleAuth}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 border rounded mb-3"
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="w-full p-2 border rounded mb-3"
                />

                {error && (
                  <p className="text-red-500 text-sm mb-2 text-center">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full p-2 rounded text-white bg-indigo-600 disabled:opacity-50"
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
