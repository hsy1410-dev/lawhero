import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { HexColorPicker } from "react-colorful";
import { signOut } from "firebase/auth";
import { auth, db } from "./firebase";

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  getDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

import TypingText from "./TypingText";

import img1 from "../src/img/1.png";
import moon from "../src/img/moon.png";
import sun from "../src/img/sun.png";
import p from "../src/img/p.png";
import book from "../src/img/book.png";
/* ---------------------------------------------------------
   ■ 프로젝트 편집 모달
--------------------------------------------------------- */
function ProjectModal({ open, onClose, project, onSave, onDelete }) {
  const [name, setName] = useState(project?.name || "");
  const [color, setColor] = useState(project?.color || "#6366f1");

  useEffect(() => {
    if (open && project) {
      setName(project.name || "");
      setColor(project.color || "#6366f1");
    }
  }, [open, project]);

  if (!open || !project) return null;

  return (
    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-30 flex items-center justify-center">
      <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl shadow-xl w-[380px]">
        <h2 className="text-lg font-semibold dark:text-white mb-4">
          프로젝트 설정
        </h2>

        <div className="mb-4">
          <label className="text-sm text-gray-500 dark:text-gray-400">
            프로젝트 이름
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg border dark:border-neutral-600 dark:bg-neutral-700 dark:text-white"
          />
        </div>

        <div className="mb-4">
          <label className="text-sm text-gray-500 dark:text-gray-400">
            프로젝트 색상
          </label>
          <div className="mt-2 flex gap-3 items-center">
            <HexColorPicker color={color} onChange={setColor} />
            <div
              className="w-12 h-12 rounded-lg border dark:border-neutral-600"
              style={{ background: color }}
            />
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={() => onDelete(project.id)}
            className="px-4 py-2 text-sm text-red-500"
          >
            프로젝트 삭제
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700 dark:text-white text-sm"
            >
              취소
            </button>
            <button
              onClick={() =>
                onSave(project.id, name.trim() || project.name, color)
              }
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ■ Tone Modal
--------------------------------------------------------- */
function ToneModal({ open, onSelect, toneOptions }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center">
      <div className="bg-white dark:bg-neutral-800 p-8 rounded-2xl w-[420px] shadow-xl">
        <h2 className="text-xl font-bold mb-4 dark:text-white">
          블로그 작성 톤을 선택해주세요 ✍️
        </h2>

        <div className="space-y-3 max-h-[260px] overflow-y-auto">
          {toneOptions.map((t) => (
            <button
              key={t.name}
              onClick={() => onSelect(t.key)}
              className="w-full p-4 text-left bg-indigo-600 dark:bg-neutral-700 text-white rounded-xl"
            >
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm opacity-80">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SidebarToggleButton({ collapsed, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex h-10 w-10 items-center justify-center rounded-xl border
        border-[#d1d5db] bg-white text-gray-600 shadow-sm transition hover:bg-gray-100
        dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-gray-200 dark:hover:bg-[#222]
        ${className}
      `}
      aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
      title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <path d="M9 4.5v15" />
        {collapsed ? (
          <>
            <path d="M13 12h4" />
            <path d="m15 10 2 2-2 2" />
          </>
        ) : (
          <>
            <path d="M17 12h-4" />
            <path d="m15 10-2 2 2 2" />
          </>
        )}
      </svg>
    </button>
  );
}

/* ---------------------------------------------------------
   ■ 메인
--------------------------------------------------------- */
export default function ChatPage({ user,goAdmin, isAdmin }) {
  const textareaRef = useRef(null);
  const chatRef = useRef(null);

  const [role, setRole] = useState(null);  // ✅ 추가
  const [roleLoading, setRoleLoading] = useState(true); // ✅ 추가

  // ✅ 내 users 문서 구독해서 role 가져오기
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        if (snap.exists()) {
          setRole(snap.data()?.role ?? "pending");
        } else {
          // users 문서가 아직 없으면 안전하게 pending 처리
          setRole("pending");
        }
        setRoleLoading(false);
      },
      () => {
        setRole("pending");
        setRoleLoading(false);
      }
    );

    return () => unsub();
  }, []);
  /* ---------------- State ---------------- */
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toneModal, setToneModal] = useState(false);
const isComposingRef = useRef(false);
  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectEditing, setProjectEditing] = useState(null);
const [globalEnabled, setGlobalEnabled] = useState(true);

  const [conversations, setConversations] = useState([]); // 메타데이터만
  const [currentId, setCurrentId] = useState(null);

  const [messages, setMessages] = useState([]); // ✅ 선택된 상담의 메시지들만
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState(null);

  const [loading, setLoading] = useState(false);
const addChatConversation = async () => {
  if (!user?.uid) return;

  const uid = user.uid;
  const newId = Date.now().toString();

  await setDoc(doc(db, "users", uid, "conversations", newId), {
    title: "법률 상담",
    type: currentProjectId ? "blog" : "chat", // ⭐ 중요
    projectId: currentProjectId || null,
    tone: null,
    systemPrompt: "",
    createdAt: serverTimestamp(),
  });

  setCurrentId(newId);
};
const buildMessagesForApi = () => {
  return (messages || []).map((m) => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text,
  }));
};

  // 첫 인트로 타이핑
  const [showIntroTyping, setShowIntroTyping] = useState(false);
  const [introTargetConvId, setIntroTargetConvId] = useState(null);
const filteredConversations = useMemo(() => {
  if (!currentProjectId) return conversations || [];
  return (conversations || []).filter(
    (c) => c.projectId === currentProjectId
  );
}, [conversations, currentProjectId]);
  const currentConv = useMemo(
    () => conversations.find((c) => c.id === currentId) || null,
    [conversations, currentId]
  );
  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) || null,
    [projects, currentProjectId]
  );

 const toneOptions = useMemo(
  () => [
    {
      key: "expert",
      name: "전문가 시점(법률 분석)",
      desc: "법률·판례 기반의 전문 분석.",
    },
    {
      key: "warning",
      name: "경고형 톤",
      desc: "위험과 주의 메시지를 강조.",
    },
    {
      key: "friendly",
      name: "친절한 설명형",
      desc: "초보도 쉽게 이해할 수 있는 말투.",
    },
    {
      key: "news",
      name: "뉴스 기사형",
      desc: "객관적 보도 스타일.",
    },
    {
      key: "firm",
      name: "단호한 대응형",
      desc: "명확하고 강한 어조.",
    },
    {
      key: "comfort",
      name: "부드러운 위로형",
      desc: "감정 공감 & 위로 중심.",
    },
  ],
  []
);
  const currentToneLabel = useMemo(() => {
    if (!currentConv) return "";
    if (currentConv.type !== "blog") return "일반 채팅";

    return (
      toneOptions.find((tone) => tone.key === currentConv.tone)?.name ||
      "미선택"
    );
  }, [currentConv, toneOptions]);


  /* ---------------- Utils ---------------- */
  const resetTextareaHeight = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
  };
useEffect(() => {
  if (!currentConv) return;

  // 블로그 상담 + 톤 미선택 → 톤 모달 강제 오픈
  if (currentConv.type === "blog" && !currentConv.tone) {
    setToneModal(true);
  } else {
    setToneModal(false);
  }
}, [currentConv]);

  /* ---------------- Dark Mode ---------------- */
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  /* ---------------- Auto Scroll ---------------- */
  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading, showIntroTyping]);
useEffect(() => {
  // role 로딩 중이면 대기
  if (roleLoading) return;

  // pending이면 globalAccess를 읽지 말고 바로 차단될 거니까 기본값 아무거나 둬도 됨
  if (role === "pending" && !isAdmin) return;

  const ref = doc(db, "system", "globalAccess");

  const unsub = onSnapshot(
    ref,
    (snap) => {
      setGlobalEnabled(snap.exists() ? !!snap.data()?.enabled : true);
    },
    (err) => {
      console.error("globalAccess snapshot error:", err);
      // 권한 에러면 안전하게 막는 값으로 두는 게 좋음
      setGlobalEnabled(false);
    }
  );

  return () => unsub();
}, [roleLoading, role, isAdmin]);

useEffect(() => {
  if (!user?.uid) {
    setProfile(null);
    return;
  }

  const ref = doc(db, "users", user.uid);

  const unsub = onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      setProfile(snap.data());
    } else {
      setProfile(null);
    }
  });

  return () => unsub();
}, [user?.uid]);

  /* ---------------- Projects ---------------- */
  useEffect(() => {
    if (!user?.uid) return;

    const unsub = onSnapshot(
      collection(db, "users", user.uid, "projects"),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort(
            (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
          );
        setProjects(list);
        if (!list.length) setCurrentProjectId(null);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  /* ---------------- Conversations (메타만) ---------------- */
  useEffect(() => {
    if (!user?.uid) return;


    const base = collection(db, "users", user.uid, "conversations");
    const ref = currentProjectId
      ? query(base, where("projectId", "==", currentProjectId))
      : base;

    const unsub = onSnapshot(ref, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
      setConversations(list);
      if (!list.length) setCurrentId(null);
      else if (!currentId) setCurrentId(list[0].id);
      else if (!list.find((c) => c.id === currentId)) setCurrentId(list[0].id);
    });

    return () => unsub();
  }, [user?.uid, currentProjectId, currentId]);

  /* ---------------- Messages (선택된 상담만!) ---------------- */
  useEffect(() => {
    if (!user?.uid || !currentId) {
      setMessages([]);
      return;
    }

    const ref = query(
      collection(db, "users", user.uid, "conversations", currentId, "messages"),
      orderBy("createdAt", "asc"),
      limit(500)
    );

    const unsub = onSnapshot(ref, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);
    });

    return () => unsub();
  }, [user?.uid, currentId]);

  /* ---------------- Auto create conversation ---------------- */
  useEffect(() => {
  if (!user?.uid) return;
  if (conversations.length !== 0) return;

  const init = async () => {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    // 🔥 이미 초기화된 유저면 아무 것도 안 함
    if (snap.exists() && snap.data()?.hasInitialized) return;

    // ⭐ 최초 1회만 새 상담 생성
    await addConversation();

    // ✅ 다시는 자동 생성 안 되게 플래그 저장
    await setDoc(
      userRef,
      { hasInitialized: true },
      { merge: true }
    );
  };

  init();
}, [user?.uid, conversations.length]);


  /* ---------------- CRUD ---------------- */
  const addProject = async () => {
    const name = window.prompt("프로젝트 이름을 입력해주세요!");
    if (!name?.trim()) return;
    const id = Date.now().toString();
    await setDoc(doc(db, "users", user.uid, "projects", id), {
      name: name.trim(),
      color: "#6366f1",
      createdAt: serverTimestamp(),
    });
    setCurrentProjectId(id);
  };

  const saveProjectEdit = async (projectId, name, color) => {
    await updateDoc(doc(db, "users", user.uid, "projects", projectId), {
      name,
      color,
    });
    const snap = await getDocs(
      query(
        collection(db, "users", user.uid, "conversations"),
        where("projectId", "==", projectId)
      )
    );
    for (let c of snap.docs) {
      await updateDoc(doc(db, "users", user.uid, "conversations", c.id), {
        color,
      });
    }
    setProjectModalOpen(false);
    setProjectEditing(null);
  };

  const deleteProject = async (projectId) => {
    if (!window.confirm("정말 이 프로젝트를 삭제할까요?")) return;
    const snap = await getDocs(
      query(
        collection(db, "users", user.uid, "conversations"),
        where("projectId", "==", projectId)
      )
    );
    for (let c of snap.docs) {
      await updateDoc(doc(db, "users", user.uid, "conversations", c.id), {
        projectId: null,
        color: null,
      });
    }
    await deleteDoc(doc(db, "users", user.uid, "projects", projectId));
    if (currentProjectId === projectId) setCurrentProjectId(null);
  };

  const addConversation = async () => {
  const uid = user.uid;
  const newId = Date.now().toString();

  await setDoc(doc(db, "users", uid, "conversations", newId), {
    title: "새 상담",
    type: "blog",
    projectId: currentProjectId || null,
    tone: null,
    createdAt: serverTimestamp(),
  });

  setCurrentId(newId);
  setToneModal(true);
};


  const deleteConversation = async (convId) => {
    if (!window.confirm("이 상담을 삭제할까요?")) return;
    const snap = await getDocs(
      collection(db, "users", user.uid, "conversations", convId, "messages")
    );
    for (let m of snap.docs) {
      await deleteDoc(
        doc(db, "users", user.uid, "conversations", convId, "messages", m.id)
      );
    }
    await deleteDoc(doc(db, "users", user.uid, "conversations", convId));
    if (currentId === convId) setCurrentId(null);
  };

  const saveMessage = async (sender, text) => {
    if (!currentId) return;
    await setDoc(
      doc(
        db,
        "users",
        user.uid,
        "conversations",
        currentId,
        "messages",
        Date.now().toString()
      ),
      {
        sender,
        text,
        createdAt: serverTimestamp(),
        clientTime: Date.now() / 1000,
      }
    );
  };
   const generateConversationTitle = useCallback(async () => {
  if (!user?.uid || !currentId) return;
  if (!currentConv) return;
  if (!messages || messages.length < 2) return;

  // 채팅이면 서버 안 부르고 간단 제목(원하면 삭제 가능)
  if (currentConv.type !== "blog") {
    const firstUserMsg =
      messages.find((m) => m.sender === "user")?.text?.trim() || "법률 채팅";
    const title =
      firstUserMsg.length > 18 ? firstUserMsg.slice(0, 18) + "…" : firstUserMsg;

    try {
      await updateDoc(doc(db, "users", user.uid, "conversations", currentId), {
        title,
      });
    } catch (e) {
      console.error("❌ 채팅 제목 업데이트 실패:", e);
    }
    return;
  }

  try {
    const res = await fetch("/api/law/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "블로그",
        tone: currentConv?.tone ?? "expert",
        messages: messages.map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
        })),
        // mode: "title", // 서버가 지원하면 켜기
      }),
    });

    const raw = await res.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      console.error("❌ title api status:", res.status);
      console.error("❌ title api raw:", raw);
      return;
    }

    if (!data?.title) return;

    await updateDoc(doc(db, "users", user.uid, "conversations", currentId), {
      title: data.title,
    });
  } catch (e) {
    console.error("❌ generateConversationTitle 실패:", e);
  }
}, [user?.uid, currentId, messages, currentConv?.type, currentConv?.tone]);

  /* ---------------- GPT ---------------- */
 const requestGpt = async (msgs, type) => {
  const last = msgs[msgs.length - 1]?.content?.trim();

  // 📝 블로그 전용
  if (type === "blog") {
    // 시작 트리거
    if (last === "시작") {
      const r = await fetch("/api/law/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });

      const raw = await r.text();
      let data = null;
      try { data = JSON.parse(raw); } catch {}

      if (!r.ok) {
        console.error("❌ /law/start status:", r.status);
        console.error("❌ /law/start raw:", raw);
        return "❌ 블로그 작성을 시작할 수 없습니다.";
      }

      return data?.reply ?? "❌ 응답 형식 오류";
    }

    // 필수 입력 체크
    const filled =
      /✅키워드:\s*\S+/i.test(last) ||
      /✅사기내용:\s*\S+/i.test(last) ||
      /✅구성선택:\s*[1-7]/i.test(last);

    if (filled) {
      const r = await fetch("/api/law/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs,
          category: "블로그 상담",
          tone: currentConv?.tone ?? "expert",
        }),
      });

      const raw = await r.text();
      let d = null;
      try { d = JSON.parse(raw); } catch {}

      if (!r.ok) {
        console.error("❌ /law/blog status:", r.status);
        console.error("❌ /law/blog raw:", raw);
        return "❌ 글 생성에 실패했습니다. 서버 오류(500).";
      }

      if (!d?.title || !d?.body) {
        console.error("❌ invalid blog response:", d);
        return "❌ 생성된 글 형식이 올바르지 않습니다.";
      }

      return [
        `# ${d.title}`,
        d.intro && `## 도입부\n${d.intro}`,
        d.body && `## 본문\n${d.body}`,
        d.conclusion && `## 결론\n${d.conclusion}`,
        d.summary_table && `## 요약표\n${d.summary_table}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    }

    // filled 아닐 때는 그냥 안내
    return "✅ 아래 형식으로 입력해주세요:\n✅키워드:\n✅사기내용:\n✅구성선택:";
  }

  // 💬 일반 채팅
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: msgs,
      tone: currentConv?.tone ?? "friendly",
    }),
  });

  const raw = await r.text();
  let data = null;
  try { data = JSON.parse(raw); } catch {}

  if (!r.ok) {
    console.error("❌ /chat status:", r.status);
    console.error("❌ /chat raw:", raw);
    return "❌ 응답을 불러오지 못했습니다.";
  }

  return data?.reply ?? "❌ 응답 형식 오류";
};

  
  /* ---------------- Send ---------------- */
 const sendMessage = async (text) => {
  if (!text.trim() || loading) return;

  const trimmed = text.trim();
  const isBlog = currentConv?.type === "blog";
  const isChat = currentConv?.type === "chat";

  // ❌ 블로그인데 톤 안 고르면 차단
  if (isBlog && !currentConv?.tone) return;

  /* ===============================
     1️⃣ 유저 메시지 저장
     =============================== */
  await saveMessage("user", trimmed);

  /* ===============================
     2️⃣ 블로그 + "시작" → 템플릿
     =============================== */
  if (isBlog && trimmed === "시작") {
    const template =
      "✅키워드:\n" +
      "✅사기내용:\n" +
      "✅구성선택:\n\n" +
      "① 사기 개연성을 중심으로 한 글\n" +
      "② 주의해야할 위험요소에 대해 디테일하게 분석한 글\n" +
      "③ 실제로 드러난 정황을 바탕으로 경고형 분석한 글\n" +
      "④ 피해예방과 도움이 되는 내용을 중점으로 쓴 글\n" +
      "⑤ 법적 지식과 판례에 관해 전문가의 시점으로 쓴 글\n" +
      "⑥ 웹사이트 검색 기반으로 실제 뉴스와 실제 사례들을 토대로 한 글\n" +
      "⑦ 실제 피해 사례를 중점으로 한 글";

    await saveMessage("bot", template);
    return; // ⭐ GPT 호출 안 함
  }

/* ===============================
   3️⃣ GPT 호출
=============================== */
setLoading(true);
try {
  const reply = await requestGpt(
    [
      ...buildMessagesForApi(),
      { role: "user", content: trimmed },
    ],
    currentConv.type
  );

  await saveMessage("bot", reply);

  // 🔥 여기 추가 (조건부)
  if (!currentConv?.title || currentConv.title === "새 상담") {
    setTimeout(() => {
      generateConversationTitle();
    }, 300);
  }

} finally {
  setLoading(false);
}

};

  /* ---------------- Tone ---------------- */
 const selectTone = async (toneKey) => {
  await updateDoc(
    doc(db, "users", user.uid, "conversations", currentId),
    { tone: toneKey }
  );
  setToneModal(false);

  if (messages.length === 0) {
    await saveMessage(
      "bot",
      `좋습니다! 블로그 톤 선택이 완료되었습니다.\n"시작"이라고 입력하면 템플릿을 안내해드릴게요.`
    );
  }
};


const openProjectModal = (project) => {
  setProjectEditing(project);
  setProjectModalOpen(true);
};

if ((!globalEnabled || role === "pending") && !isAdmin) {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black text-white">
      ⛔ 서비스 점검 중입니다
    </div>
  );
}



  /* ---------------- UI ---------------- */
  return (
    
    <div className="w-screen h-screen flex overflow-hidden relative">
      {toneModal && <div className="absolute inset-0 bg-black/20 z-20" />}
      <ToneModal open={toneModal} onSelect={selectTone} toneOptions={toneOptions} />

      {sidebarCollapsed && (
        <SidebarToggleButton
          collapsed
          onClick={() => setSidebarCollapsed(false)}
          className="absolute left-4 top-4 z-10"
        />
      )}

      <div className="flex flex-1 min-w-0">
        {/* Sidebar (생략 없이 기존과 동일한 구조 사용 가능) */}
        <div
          className="relative shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
          style={{ width: sidebarCollapsed ? "0rem" : "18rem" }}
          aria-hidden={sidebarCollapsed}
        >
          <aside
            className="
              h-full border-r flex flex-col overflow-hidden
              bg-[#f8f9fa] text-[#111] border-[#e5e7eb]
              dark:bg-[#111] dark:text-gray-200 dark:border-[#2a2a2a]
            "
          >
            <>
                <div
                  className="
                    p-4 pb-3 border-b sticky top-0 z-10
                    bg-[#f8f9fa] border-[#e5e7eb]
                    dark:bg-[#111] dark:border-[#2a2a2a]
                  "
                >
                  <div className="mb-4 flex items-center gap-2">
                    <SidebarToggleButton
                      collapsed={false}
                      onClick={() => setSidebarCollapsed(true)}
                      className="shrink-0"
                    />
                    <button
                      onClick={() => setDarkMode(!darkMode)}
                      className="
                        flex-1 px-4 py-2 rounded-lg
                        flex items-center justify-center gap-2
                        bg-[#e5e7eb] text-[#111] hover:bg-[#dcdfe3]
                        dark:bg-[#2a2a2a] dark:text-gray-200 dark:hover:bg-[#333]
                      "
                    >
                      <img
                        src={darkMode ? sun : moon}
                        alt="theme"
                        className="w-5 h-5"
                      />
                      <span>{darkMode ? "라이트 모드" : "다크 모드"}</span>
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      <span>프로젝트</span>
                      <button
                        onClick={addProject}
                        className="
                          text-[11px] px-2 py-1 rounded border
                          bg-[#f0f0f0] text-[#444] border-[#ddd]
                          dark:bg-[#1f1f1f] dark:text-gray-300 dark:border-[#3a3a3a]
                        "
                      >
                        + 새 프로젝트
                      </button>
                    </div>

                    <button
                      onClick={() => setCurrentProjectId(null)}
                      className={`
                        w-full text-left text-xs px-3 py-2 mb-1 rounded-lg border transition
                        flex items-center gap-2
                        ${
                          currentProjectId === null
                            ? `
                              bg-[#e5e7eb] border-[#cbd5e1] text-[#111]
                              dark:bg-[#2a2a2a] dark:border-[#555] dark:text-white
                            `
                            : `
                              bg-[#ffffff] border-[#e5e7eb] text-gray-600 hover:bg-[#f3f3f3]
                              dark:bg-[#1a1a1a] dark:border-[#2f2f2f] dark:text-gray-300
                              dark:hover:bg-[#222]
                            `
                        }
                      `}
                    >
                      <img src={book} alt="all" className="w-4 h-4 shrink-0" />
                      <span>전체 상담 보기</span>
                    </button>

                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 mt-1">
                      {projects.map((pjt) => {
                        const selected = pjt.id === currentProjectId;
                        const color = pjt.color || "#6366f1";

                        return (
                          <div key={pjt.id} className="group relative">
                            <button
                              onClick={() => setCurrentProjectId(pjt.id)}
                              className="
                                w-full flex items-center gap-2 p-3 rounded-lg border transition text-left
                                bg-[#ffffff] text-[#111] hover:bg-[#f3f3f3]
                                dark:bg-[#1a1a1a] dark:text-gray-300 dark:hover:bg-[#222]
                              "
                              style={{
                                borderColor: selected ? color : "transparent",
                              }}
                            >
                              <img
                                src={img1}
                                alt="proj"
                                className="w-4 h-4 shrink-0"
                              />
                              <span className="font-semibold text-sm truncate">
                                {pjt.name}
                              </span>
                            </button>

                            <div
                              className="
                                absolute right-2 top-1/2 -translate-y-1/2
                                flex gap-1 opacity-0 group-hover:opacity-100 transition
                              "
                            >
                              <button
                                onClick={() => openProjectModal(pjt)}
                                className="
                                  text-[10px] px-2 py-1 rounded border
                                  bg-white text-gray-700 border-gray-300
                                  dark:bg-[#1f1f1f] dark:text-gray-300 dark:border-[#3a3a3a]
                                "
                              >
                                수정
                              </button>
                              <button
                                onClick={() => deleteProject(pjt.id)}
                                className="
                                  text-[10px] px-2 py-1 rounded border
                                  bg-red-100 text-red-700 border-red-300
                                  dark:bg-red-900/40 dark:text-red-300 dark:border-red-900/60
                                "
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 pt-3">
                  {/* ===============================
    📝 상담 (블로그)
=============================== */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      <span>상담</span>
                      <button
                        onClick={addConversation}
                        className="text-[11px] px-2 py-1 rounded border bg-[#e5e7eb] dark:bg-[#333]"
                      >
                        + 새 상담
                      </button>
                    </div>

                    {filteredConversations
                      .filter((c) => c.type === "blog")
                      .map((conv) => (
                        <div key={conv.id} className="flex items-center gap-2 mb-1">
                          <div
                            onClick={() => setCurrentId(conv.id)}
                            className={`flex-1 p-3 rounded-lg border cursor-pointer
                              ${
                                currentId === conv.id
                                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                                  : "bg-white dark:bg-[#1a1a1a]"
                              }`}
                          >
                            <div className="font-semibold truncate">
                              {conv.title}
                            </div>
                          </div>

                          {/* ❌ 삭제 */}
                          <button
                            onClick={() => deleteConversation(conv.id)}
                            className="text-[10px] px-2 py-1 rounded border
                              bg-red-100 text-red-700 border-red-300
                              dark:bg-red-900/40 dark:text-red-300 dark:border-red-900/60"
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                  </div>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      <span>채팅</span>
                      <button
                        onClick={addChatConversation}
                        className="text-[11px] px-2 py-1 rounded border bg-[#e5e7eb] dark:bg-[#333]"
                      >
                        + 새 채팅
                      </button>
                    </div>

                    {filteredConversations
                      .filter((c) => c.type === "chat")
                      .map((conv) => (
                        <div key={conv.id} className="flex items-center gap-2 mb-1">
                          <div
                            onClick={() => setCurrentId(conv.id)}
                            className={`flex-1 p-3 rounded-lg border cursor-pointer
                              ${
                                currentId === conv.id
                                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30"
                                  : "bg-white dark:bg-[#1a1a1a]"
                              }`}
                          >
                            <div className="font-semibold truncate">
                              {conv.title || "법률 채팅"}
                            </div>
                          </div>

                          {/* ❌ 삭제 */}
                          <button
                            onClick={() => deleteConversation(conv.id)}
                            className="text-[10px] px-2 py-1 rounded border
                              bg-red-100 text-red-700 border-red-300
                              dark:bg-red-900/40 dark:text-red-300 dark:border-red-900/60"
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                  </div>

                  <div className="mt-6 border-t pt-4 border-[#e5e7eb] dark:border-[#2a2a2a]">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="
                          w-9 h-9 rounded-full flex items-center justify-center
                          bg-[#e5e7eb] text-[#111]
                          dark:bg-[#2a2a2a] dark:text-gray-200
                        "
                      >
                        <img src={p} alt="profile" className="w-5 h-5" />
                      </div>

                      <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                        {profile?.name || user?.email || "사용자"}
                      </p>
                    </div>
                    {goAdmin && (
                      <button
                        onClick={goAdmin}
                        className="w-full mb-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
                      >
                        🛠 관리자 페이지
                      </button>
                    )}

                    <button
                      onClick={() => signOut(auth)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                    >
                      로그아웃
                    </button>
                  </div>
                </div>
              </>
          </aside>
        </div>

        {/* … 필요 시 이전 답변의 사이드바 JSX 그대로 붙여도 됩니다 … */}
      {/* 오른쪽 메인 */}
      {!currentConv ? (
        <main className="flex-1 min-w-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-black text-center px-4">
          <h2 className="text-2xl font-semibold dark:text-white mb-3">
            상담을 선택하거나 새로 만들어주세요
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            좌측에서 <strong>프로젝트</strong>를 선택해 필터링하거나,
            <br />
            <strong>“+ 새 상담”</strong>을 눌러 새로운 상담을 시작할 수 있습니다.
          </p>
        </main>
      ) : (
        <main className="flex-1 min-w-0 flex flex-col bg-gray-50 dark:bg-black">
          <header className="border-b bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <div
              className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
                sidebarCollapsed ? "pl-16 sm:pl-20" : ""
              }`}
            >
              <div className="min-w-0">
                <h1 className="text-xl font-semibold dark:text-white">
                  LAW HERO
                </h1>
                <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                  {user?.email || "사용자"} 님
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 dark:bg-neutral-800 dark:text-gray-300">
                  {currentProject
                    ? `프로젝트 ${currentProject.name}`
                    : "프로젝트 없음"}
                </span>
                <span className="max-w-full rounded-full bg-gray-100 px-3 py-1 text-gray-600 dark:bg-neutral-800 dark:text-gray-300">
                  <span className="block max-w-[220px] truncate">
                    상담 {currentConv.title}
                  </span>
                </span>
                <span
                  className={`rounded-full px-3 py-1 ${
                    currentConv?.type === "blog"
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  }`}
                >
                  {currentConv?.type === "blog"
                    ? `톤 ${currentToneLabel}`
                    : `모드 ${currentToneLabel}`}
                </span>
              </div>
            </div>
          </header>

          {/* Messages */}
          <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* ✅ 톤 선택 직후 1회 인트로 타이핑 */}
            {showIntroTyping && introTargetConvId === currentId && (
              <div className="flex justify-start">
                <div className="max-w-[70%] px-4 py-3 rounded-2xl shadow bg-white dark:bg-neutral-800 dark:text-gray-200">
                  
                </div>
              </div>
            )}

            {/* 기존 메시지 */}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[70%] px-4 py-3 rounded-2xl shadow  ${
                    m.sender === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-neutral-800 dark:text-gray-200"
                  }`}
                >
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkBreaks]}
  components={{
    h1: ({ children }) => (
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "12px 0" }}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "10px 0" }}>
        {children}
      </h2>
    ),
    p: ({ children }) => (
      <p style={{ margin: "4px 0", lineHeight: 1.6 }}>{children}</p>
    ),
    ul: ({ children }) => (
      <ul style={{ paddingLeft: "1.2rem", listStyleType: "disc" }}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol style={{ paddingLeft: "1.2rem", listStyleType: "decimal" }}>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li style={{ margin: "2px 0" }}>{children}</li>
    ),
    blockquote: ({ children }) => (
      <blockquote
        style={{
          borderLeft: "4px solid #6366f1",
          paddingLeft: "8px",
          margin: "8px 0",
          opacity: 0.85,
        }}
      >
        {children}
      </blockquote>
    ),
    code: ({ inline, children }) =>
      inline ? (
        <code
          style={{
            background: "#e5e7eb",
            padding: "2px 4px",
            borderRadius: "4px",
            fontSize: "0.85em",
          }}
        >
          {children}
        </code>
      ) : (
        <pre
          style={{
            background: "#0f172a",
            color: "#e5e7eb",
            padding: "12px",
            borderRadius: "8px",
            overflowX: "auto",
            fontSize: "0.8em",
          }}
        >
          <code>{children}</code>
        </pre>
      ),
    table: ({ children }) => (
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          margin: "8px 0",
          fontSize: "0.8em",
        }}
      >
        {children}
      </table>
    ),
    th: ({ children }) => (
      <th
        style={{
          border: "1px solid #d1d5db",
          padding: "4px",
          background: "#f3f4f6",
        }}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        style={{
          border: "1px solid #d1d5db",
          padding: "4px",
        }}
      >
        {children}
      </td>
    ),
  }}
>
  {m.text}
</ReactMarkdown>




                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl bg-white dark:bg-neutral-800 shadow">
                  챗봇이 입력 중입니다…
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t dark:border-neutral-700 bg-white dark:bg-neutral-900 flex gap-2">
            <textarea
  ref={textareaRef}
  value={input}
  disabled={currentConv?.type === "blog" && !currentConv?.tone}
  onCompositionStart={() => {
    isComposingRef.current = true;
  }}
  onCompositionEnd={() => {
    isComposingRef.current = false;
  }}
  onChange={(e) => {
    setInput(e.target.value);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }}
  onKeyDown={(e) => {
    // ⭐ macOS / iOS 한글 입력기 완전 대응
    if (isComposingRef.current) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      const text = input.trim();
      setInput("");

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // 🔒 '작' 같은 찌꺼기 전송 방지
      if (text.length <= 1) return;

      sendMessage(text);
    }
  }}
  className={`flex-1 border px-4 py-2 rounded-xl resize-none overflow-hidden leading-relaxed dark:border-neutral-600 ${
    currentConv?.type === "blog" && !currentConv?.tone
      ? "bg-gray-300 dark:bg-neutral-700 cursor-not-allowed"
      : "bg-white dark:bg-neutral-800 dark:text-white"
  }`}
  placeholder={
    currentConv?.type === "chat"
      ? "법률에 대해 궁금한 점을 자유롭게 질문해보세요"
      : currentConv?.tone
      ? "Shift + Enter = 줄바꿈 / Enter = 전송"
      : "먼저 블로그 톤을 선택해주세요"
  }
/>



            <button
              onClick={() => sendMessage(input)}
              disabled={!currentConv?.tone}
              className="px-5 py-2 rounded-xl bg-indigo-600 dark:bg-neutral-700 text-white disabled:opacity-40"
            >
              전송
            </button>
          </div>
        </main>
      )}
    </div>
  </div>
);}
