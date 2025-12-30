// /api/law/blog.js
import OpenAI from "openai";
import fs from "fs";
import path from "path";

/* =========================================================
   1. Runtime
========================================================= */
export const config = { runtime: "nodejs" };

/* =========================================================
   2. OpenAI
========================================================= */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
/* =========================================================
   Tone Prompt Map
========================================================= */
const TONE_PROMPTS = {
  expert: `
- 문체는 판례·조문을 인용하는 전문 변호사 시점
- 감정 표현 최소화
- 단정적이고 분석 중심
`,

  warning: `
- 독자에게 경고하는 어조
- 위험 요소를 반복적으로 강조
- "주의해야 합니다", "매우 위험합니다" 같은 표현 적극 사용
`,

  friendly: `
- 법률 비전문가도 이해할 수 있도록 쉽게 설명
- 어려운 용어는 반드시 풀어서 설명
- 친절한 말투 유지
`,

  news: `
- 객관적 기사체 문장
- 감정 표현 금지
- "~로 알려졌다", "~로 보인다" 형식 사용
`,

  firm: `
- 단호하고 강한 어조
- 불필요한 완곡어법 금지
- 명령형, 확정적 문장 사용
`,

  comfort: `
- 피해자 감정에 공감
- 위로하는 말투
- 비난·단정 표현 절대 사용 금지
`,
};

/* =========================================================0
   3. 출력 JSON 스키마(프롬프트용)
========================================================= */
const OUTPUT_SCHEMA = `
{
  "title": "string (H1 제목, 제목 형식은 반드시 5.txt의 규칙을 따른다)",
  "intro": "string (도입부 출력 형식
(3줄)
제목 작성 후 반드시 도입부(3~5문장)를 작성하며, 도입부에는 키워드를 포함하지 않는다. 도입부는 다음 5가지 형식 중 하나를 자동 선택해 작성한다.

1️⃣ 표 형식 도입부: ‘좋은 대처법 vs 잘못된 대처법’ 표 후 간단한 해석.  
2️⃣ 대화체 도입부: 피해자-사기범 대화 후 전문가의 코멘트.  
3️⃣ 체크리스트 도입부: 사기 수법의 특징 4가지 ✔️로 제시.  
4️⃣ 뉴스 인용 도입부: 실제 뉴스 사례 요약 + 질문 연결.  
5️⃣ FAQ 도입부: 피해자 질문 인용 + “이 글을 끝까지 읽어보세요.” 문장.

도입부 형식은 구성 선택(1~7)에 따라 자동 결정한다.",
  "body": "string (markdown, H2/H3 구조 포함, 본문 전체,최소 3개의 소제목 포함, 
   전체 문체는 구성 선택 번호에 따라 일관성 유지
   ,글 쓸 때 마다 글의 구성과 문단의 순서가 완전히 달라야함)",
  "conclusion": "string ( 결론은 ‘요약 → 공감 문장 → 클릭 유도 문장’ 순으로 구성.  )",
  "summary_table": "string (markdown table, 글 전체 요약, 글 마다 각기 다른 표 구성)"
}
`;

/* =========================================================
   5. TXT Loader (안전)
========================================================= */
const readTxtSafe = (filename) => {
  const baseDir = new URL("../../src/txt/", import.meta.url);
  const fileUrl = new URL(filename, baseDir);
  const filePath = fileUrl.pathname;
  const normalized =
    process.platform === "win32"
      ? filePath.replace(/^\/([A-Za-z]:)/, "$1")
      : filePath;

  return fs.readFileSync(normalized, "utf8");
};

const loadREF = () => ({
  t1: readTxtSafe("1.txt"),
  t2: readTxtSafe("2.txt"),
  t3: readTxtSafe("3.txt"),
  t4: readTxtSafe("4.txt"),
  t5: readTxtSafe("5.txt"),
  t6: readTxtSafe("6.txt"),
  t7: readTxtSafe("7.txt"),
  t8: readTxtSafe("8.txt"),
});

/* =========================================================
   6. System Prompt Builder
========================================================= */
const buildSystemPrompt = (REF, category, toneKey) => `
당신은 **10년 이상 경력의 한국 변호사**입니다.
아래 JSON 스키마를 **정확히** 따르세요.
JSON 이외의 출력은 **절대 금지**합니다.

${OUTPUT_SCHEMA}

# 작성 톤
${TONE_PROMPTS[toneKey] || ""}

# 제목 규칙 (5.txt)
${REF.t5}

# 도입부 규칙 (1.txt)
${REF.t1}

# 공통 규칙
- title에는 # 금지
- intro는 3~5문장
- body는 H2/H3 구조 + 2,000자 이상
- summary_table은 markdown table
- 글 구성은 매번 완전히 다르게

# 참고 지식 (복붙 금지)
${REF.t2}
${REF.t3}
${REF.t4}
${REF.t6}
${REF.t7}
${REF.t8}

# 사건 유형
${category || "일반"}

출력 전 스스로 검증하고
조건 미달 시 **다시 작성**
`;

/* =========================================================
   7. Output Validator
========================================================= */
const isValidOutput = (json) => {
  const keys = ["title", "intro", "body", "conclusion", "summary_table"];
  return (
    json &&
    keys.every(
      (k) => typeof json[k] === "string" && json[k].trim().length > 0
    )
  );
};

/* =========================================================
   8. GPT-5.2 호출 (Responses API)
========================================================= */
const requestGPT = async (messages, systemPrompt) => {
const res = await openai.responses.create({
  model: "gpt-5.2",
  input: [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ],
  text: {
    format: "json", // ✅ 여기!!!
  },
  max_output_tokens: 4096,
});


  return res.output_text;
};

/* =========================================================
   9. Handler
========================================================= */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { messages, category, tone } = body || {};

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages 배열 필요" });
    }

    const REF = loadREF();
    const systemPrompt = buildSystemPrompt(REF, category, tone);

    let parsed = null;
    let raw = "";

    for (let i = 0; i < 2; i++) {
      raw = await requestGPT(messages, systemPrompt);
      try {
        parsed = JSON.parse(raw);
        if (isValidOutput(parsed)) break;
      } catch {}
    }

    if (!isValidOutput(parsed)) {
      return res.status(500).json({
        error: "GPT 출력 검증 실패",
        debug_preview: String(raw).slice(0, 500),
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({
      error: "API 내부 에러",
      message: err?.message || String(err),
    });
  }
}