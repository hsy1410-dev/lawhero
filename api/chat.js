// /api/chat.js
import OpenAI from "openai";
import fs from "fs";

/* =========================================================
   1. Runtime (Node.js)
========================================================= */
export const config = {
  runtime: "nodejs",
};

/* =========================================================
   2. OpenAI
========================================================= */
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* =========================================================
   3. JSON Response Helper
========================================================= */
const json = (res, data, status = 200) =>
  res.status(status).json(data);

/* =========================================================
   4. TXT 로드 (배포 환경 안전)
========================================================= */
const readTxtSafe = (filename) => {
  const baseDir = new URL("../src/txt/", import.meta.url);
  const fileUrl = new URL(filename, baseDir);
  const filePath = fileUrl.pathname;
  const normalized =
    process.platform === "win32"
      ? filePath.replace(/^\/([A-Za-z]:)/, "$1")
      : filePath;

  return fs.readFileSync(normalized, "utf8");
};

let refCache = null;

const loadRef = () => {
  if (refCache) return refCache;

  refCache = {
    t9: readTxtSafe("9.txt"),
    t10: readTxtSafe("10.txt"),
    t11: readTxtSafe("11.txt"),
    t12: readTxtSafe("12.txt"),
    t13: readTxtSafe("13.txt"),
    t14: readTxtSafe("14.txt"),
    t15: readTxtSafe("15.txt"),
  };

  return refCache;
};

/* =========================================================
   5. System Prompt (슬림화)
========================================================= */
const buildSystemPrompt = (ref) => `
당신은 **사실관계만 간단하게 확인해서 변호사 상담을 매칭 시켜주는 웹사이트 상담원 AI**입니다.

다음 원칙을 반드시 지키세요:
- 사용자의 감정을 먼저 공감한다
- 확실한 정보만 말하고, 불확실한 부분은 추측하지 않는다
- 판결이나 결과를 단정하지 않는다
- 상담원이 법률 상담으로 들어가면 법률 위반사항이라 법률상담이 아닌 상담사가 할 수 있는 질문만 해야함
- 사실확인관계 5가지는 첫질문에 한번만 물어본다.
- 이후의 질문에는 사실관계확인 하지말고 묻는 질문에만 답변한다
- 확실한 정보만 상담사의 입장에서 답변한다
-이 채팅은 사실관계만 간단하게 확인하고 상담원이 할 수 있는 간단한 안내를 해줘 
-법률상담은 아니지만 마치 변호사처럼 신뢰가고 디테일하게 답변해줘 
-디테일하고 자세하게 답변해줘 너는 10년 경력의 상담사야

`;

/* =========================================================
   6. Handler
========================================================= */
export default async function handler(req, res) {
  try {
    /* ---------------------------------
       1) POST만 허용
    --------------------------------- */
    if (req.method !== "POST") {
      return json(res, { error: "Only POST allowed" }, 405);
    }

    /* ---------------------------------
       2) body 파싱
    --------------------------------- */
    let body = req.body;
    try {
      if (typeof body === "string") {
        body = JSON.parse(body);
      }
    } catch (e) {
      return json(res, { error: "JSON 파싱 실패", detail: e.message }, 400);
    }

    const { messages } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return json(res, { error: "messages 배열이 필요합니다." }, 400);
    }

    console.log("/api/chat invoked", { messageCount: messages.length });

    /* ---------------------------------
       3) 메시지 슬림화 (🔥 핵심)
       → 마지막 사용자 메시지만 전달
    --------------------------------- */
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUserMessage) {
      return json(res, { error: "user 메시지가 없습니다." }, 400);
    }

    /* ---------------------------------
       4) GPT 호출
    --------------------------------- */
    const ref = loadRef();
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini", // ⭐ 안정 + 대용량
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(ref),
        },
        {
          role: "user",
          content: lastUserMessage.content,
        },
      ],
    });

    const reply = completion?.choices?.[0]?.message?.content || "";

    return json(res, { reply });
  } catch (err) {
    console.error("/api/chat error", err);
    // 🔥 절대 HTML 반환 금지
    return json(
      res,
      {
        error: "SERVER_CRASH",
        detail: err?.message || String(err),
      },
      500
    );
  }
}
