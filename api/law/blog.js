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

/* =========================================================
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
  "summary_table": "string (markdown table, 글 전체 요약)"
}
`;

/* =========================================================
   4. TXT 안전 로드 (요청 시점에 로드 + import.meta.url 기반)
========================================================= */
const readTxtSafe = (filename) => {
  // 이 파일(/api/law/blog.js) 기준으로 ../../src/txt 를 가리키도록 조정
  const baseDir = new URL("../../src/txt/", import.meta.url);
  const fileUrl = new URL(filename, baseDir);
  const filePath = fileUrl.pathname;

  // Windows 경로 이슈 보정
  const normalizedPath = process.platform === "win32"
    ? filePath.replace(/^\/([A-Za-z]:)/, "$1")
    : filePath;

  return fs.readFileSync(normalizedPath, "utf8");
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
  t9: readTxtSafe("9.txt"),
  t10: readTxtSafe("10.txt"),
  t11: readTxtSafe("11.txt"),
  t12: readTxtSafe("12.txt"),
  t13: readTxtSafe("13.txt"),
  t14: readTxtSafe("14.txt"),
  t15: readTxtSafe("15.txt"),
});

/* =========================================================
   5. System Prompt
========================================================= */
const buildSystemPrompt = (REF, category,toneKey) => `
당신은 **10년 이상 경력의 한국 변호사**입니다.
아래 JSON 스키마를 **정확히** 따르세요.
JSON 이외의 출력은 **절대 금지**합니다.

${OUTPUT_SCHEMA}
# 작성 톤 규칙
${TONE_PROMPTS[toneKey] || ""}

# 제목 작성 규칙 (5.txt 기준)
${REF.t5}

# 도입부 형식 규칙 (1.txt 기준)
${REF.t1}

------
# 공통 작성 규칙
- 모든 값은 markdown 문자열
- title에는 #을 쓰지 말고 제목 텍스트만 작성
- intro는 3~5문장 엄수
- intro 형식은 도입부 형식 지키기!
- body는 H2/H3 구조 필수, 2,000자 이상
- conclusion에는 반드시 bullet 리스트 포함
- summary_table은 markdown table 필수

# 참고 지식 (재작성용, 복붙 금지)
${REF.t2}
${REF.t3}
${REF.t4}
${REF.t6}
${REF.t7}
${REF.t8}

# 판례 참고하여 작성할 때 참고할 판례
${REF.t9}
${REF.t10}
${REF.t11}
${REF.t12}
${REF.t13}
${REF.t14}
${REF.t15}

# 사건 유형
${category || "일반"}

출력 전에 스스로 검증하고,
조건을 하나라도 만족하지 못하면 **다시 작성**하라.
강조**글을 작성할 때 마다 글 구성이 무조건 다르게** 하라
`;

/* =========================================================
   6. 출력 검증
========================================================= */
const isValidOutput = (json) => {
  if (!json) return false;
  const required = ["title", "intro", "body", "conclusion", "summary_table"];
  return required.every(
    (k) => typeof json[k] === "string" && json[k].trim().length > 0
  );
};

/* =========================================================
   7. GPT 호출 (JSON mode 강제)
========================================================= */
const requestGPT = async (messages, systemPrompt) => {
  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.3,
    max_completion_tokens: 4096, // Chat Completions에서 지원(권장) :contentReference[oaicite:1]{index=1}
    response_format: { type: "json_object" }, // JSON mode :contentReference[oaicite:2]{index=2}
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
  });

  return res.choices?.[0]?.message?.content ?? "";
};

/* =========================================================
   8. Handler
========================================================= */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    // ⚠️ 어떤 환경에선 req.body가 string일 수도 있어서 안전 처리
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    const { messages, category,tone } = body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages 배열 필요" });
    }

    // ✅ TXT는 요청 시점에 로드 (배포/번들/경로 문제를 여기서 바로 잡음)
    const REF = loadREF();
    const systemPrompt = buildSystemPrompt(REF, category);

    let attempt = 0;
    let parsed = null;
    let lastRaw = "";

    while (attempt < 2) {
      attempt++;
      lastRaw = await requestGPT(messages, systemPrompt);

      try {
        parsed = JSON.parse(lastRaw);
        if (isValidOutput(parsed)) break;
      } catch (e) {
        // JSON 파싱 실패 → 재시도
      }
    }

    if (!parsed || !isValidOutput(parsed)) {
      // 디버깅용: raw 일부를 같이 내려주면 “왜 파싱이 깨지는지” 바로 보임
      return res.status(500).json({
        error: "출력 형식 검증 실패 (재시도 후)",
        debug_raw_preview: String(lastRaw).slice(0, 500),
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
