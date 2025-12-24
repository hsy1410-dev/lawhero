// /api/chat.js
import OpenAI from "openai";
import fs from "fs";
import path from "path";

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
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

/* =========================================================
   4. TXT 로드 (최소한만 사용)
========================================================= */
const TXT_DIR = path.join(process.cwd(), "src", "txt");

const loadTxt = (filename) =>
  fs.readFileSync(path.join(TXT_DIR, filename), "utf8");

// ⚠️ 상담용은 "규칙 요약"만 사용 (과부하 방지)
const REF = {
  t9: loadTxt("9.txt"), // 👉 새로 만들거나 기존 txt 요약본
  t10: loadTxt("10.txt"),
  t11: loadTxt("11.txt"),
  t12: loadTxt("12.txt"),
  t13: loadTxt("13.txt"),
  t14: loadTxt("14.txt"),
  t15: loadTxt("15.txt"),
};

/* =========================================================
   5. System Prompt (슬림화)
========================================================= */
const buildSystemPrompt = () => `
당신은 **사기 피해자 법률 상담을 돕는 한국 변호사 출신 AI**입니다.

다음 원칙을 반드시 지키세요:
- 사용자의 감정을 먼저 공감한다
- 확실한 정보만 말하고, 불확실한 부분은 추측하지 않는다
- 법률 정보는 이해하기 쉽게 설명한다
- 판결이나 결과를 단정하지 않는다
- 짧고 명확하게 답변한다
# 사기 사건 판례 정리(인용 가능)
${REF.t9}
${REF.t10}
${REF.t11}
${REF.t12}
${REF.t13}
${REF.t14}
${REF.t15}
`;

/* =========================================================
   6. Handler
========================================================= */
export default async function handler(req) {
  try {
    /* ---------------------------------
       1) POST만 허용
    --------------------------------- */
    if (req.method !== "POST") {
      return json({ error: "Only POST allowed" }, 405);
    }

    /* ---------------------------------
       2) body 파싱
    --------------------------------- */
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json({ error: "JSON 파싱 실패", detail: e.message }, 400);
    }

    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages 배열이 필요합니다." }, 400);
    }

    /* ---------------------------------
       3) 메시지 슬림화 (🔥 핵심)
       → 마지막 사용자 메시지만 전달
    --------------------------------- */
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUserMessage) {
      return json({ error: "user 메시지가 없습니다." }, 400);
    }

    /* ---------------------------------
       4) GPT 호출
    --------------------------------- */
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini", // ⭐ 안정 + 대용량
      temperature: 0.4,
      max_completion_tokens: 800, // 상담은 길 필요 없음
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: lastUserMessage.content,
        },
      ],
    });

    const reply = completion?.choices?.[0]?.message?.content || "";

    return json({ reply });
  } catch (err) {
    // 🔥 절대 HTML 반환 금지
    return json(
      {
        error: "SERVER_CRASH",
        detail: err?.message || String(err),
      },
      500
    );
  }
}
