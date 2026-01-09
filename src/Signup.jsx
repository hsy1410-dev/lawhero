import { useState } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function Signup({ goLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwCheck, setPwCheck] = useState("");
  const [error, setError] = useState("");

  const isValidPassword =
    pw.length >= 8 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /\d/.test(pw) &&
    /[@$!%*?&^#()\-_=+[\]{};:'",.<>/\\|`~]/.test(pw);

  const handleSignup = async () => {
    if (!name.trim()) return setError("이름을 입력해주세요.");
    if (!email.trim()) return setError("이메일을 입력해주세요.");
    if (pw !== pwCheck) return setError("비밀번호가 일치하지 않습니다.");
    if (!isValidPassword) return setError("비밀번호 형식이 올바르지 않습니다.");

    try {
      setError("");

      const cleanEmail = email.trim().toLowerCase();

      // 1) Auth 생성
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pw);
      const uid = cred.user.uid;

      // 2) Firestore users 문서 생성 (규칙에 맞게)
      await setDoc(
        doc(db, "users", uid),
        {
          name: name.trim(),
          email: cleanEmail,
          role: "pending",
          createdAt: serverTimestamp(),
          hasInitialized: true,
        },
        { merge: true }
      );

      // 여기서 원하는 화면 이동이 있으면 추가 (예: goLogin())
      // goLogin?.();

    } catch (err) {
      console.error(err);
      setError("이미 존재하는 계정이거나 입력 형식이 올바르지 않습니다.");
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gray-100 dark:bg-black">
      <div className="bg-white dark:bg-neutral-900 p-8 rounded-xl shadow-lg w-80">
        <h1 className="text-xl font-semibold mb-4 dark:text-white text-center">
          회원가입
        </h1>

        <input
          type="text"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 border rounded mb-3 dark:bg-neutral-800 dark:text-white"
        />

        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 border rounded mb-3 dark:bg-neutral-800 dark:text-white"
        />

        <input
          type="password"
          placeholder="비밀번호 (8자 이상, 대/소문자·숫자·특수문자 포함)"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full p-3 border rounded mb-3 dark:bg-neutral-800 dark:text-white"
        />

        <input
          type="password"
          placeholder="비밀번호 확인"
          value={pwCheck}
          onChange={(e) => setPwCheck(e.target.value)}
          className="w-full p-3 border rounded mb-3 dark:bg-neutral-800 dark:text-white"
        />

        {error && <p className="text-red-500 text-sm mb-2 text-center">{error}</p>}

        <button
          onClick={handleSignup}
          className="
            w-full p-3 rounded-lg text-white
            bg-gradient-to-r from-sky-400 to-pink-400
            hover:from-sky-500 hover:to-pink-500
            transition
          "
        >
          회원가입
        </button>

        <p className="text-center mt-4 text-sm dark:text-gray-300">
          이미 계정이 있나요?{" "}
          <span
            onClick={goLogin}
            className="text-sky-600 dark:text-sky-400 cursor-pointer"
          >
            로그인
          </span>
        </p>
      </div>
    </div>
  );
}
