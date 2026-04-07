// /api/law/blog.js
import OpenAI from "openai";
import fs from "fs";

/* =========================================================
   1. Runtime
========================================================= */
export const config = { runtime: "nodejs" };

/* =========================================================
   2. OpenAI
========================================================= */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BLOG_MODEL = "gpt-5.2";
const BLOG_REASONING_EFFORT = "high";
const BLOG_RETRYABLE_INCOMPLETE_REASONS = new Set(["max_output_tokens"]);
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
const OUTPUT_KEYS = [
  "title",
  "intro",
  "body",
  "conclusion",
  "summary_table",
];

const OUTPUT_SCHEMA = `
{
  "title": "string",
  "intro": "string",
  "body": "string",
  "conclusion": "string",
  "summary_table": "string"
}
`;

const STRUCTURED_INPUT_PATTERN = /✅키워드:|✅사기내용:|✅구성선택:/i;

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

let refCache = null;

const loadREF = () => {
  if (refCache) return refCache;

  refCache = {
    t1: readTxtSafe("1.txt"),
    t2: readTxtSafe("2.txt"),
    t3: readTxtSafe("3.txt"),
    t4: readTxtSafe("4.txt"),
    t5: readTxtSafe("5.txt"),
    t6: readTxtSafe("6.txt"),
    t7: readTxtSafe("7.txt"),
    t8: readTxtSafe("8.txt"),
  };

  return refCache;
};

/* =========================================================
   6. System Prompt Builder
========================================================= */
const buildSystemPrompt = (REF, category, toneKey, options = {}) => `
당신은 **10년 이상 경력의 법률 전문 블로거**입니다.
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
- 경찰서, 사이버수사대, 지급정지 관련 내용은 넣지 말 것
- title에는 # 금지
- JSON 키는 정확히 title, intro, body, conclusion, summary_table만 사용
- intro는 3~5문장
- body는 H2/H3 구조 + 최소 3개의 소제목 포함
- body는 ${options.bodyLength || "1,100자 이상 1,400자 이하"}
- conclusion은 2~3문장
- summary_table은 2~4행의 간결한 markdown table
- summary_table은 markdown table
- 글 구성은 매번 완전히 다르게
- 글 전체 글자수는 ${options.totalLength || "2,100자 이하"}로 제한
- 문자열 안에 불필요한 이스케이프나 설명문을 넣지 말 것

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
  return (
    json &&
    OUTPUT_KEYS.every(
      (k) => typeof json[k] === "string" && json[k].trim().length > 0
    )
  );
};

const getMissingKeys = (json) =>
  OUTPUT_KEYS.filter(
    (k) => typeof json?.[k] !== "string" || !json[k]?.trim?.()
  );

const pickRelevantMessages = (messages = []) => {
  const normalized = (Array.isArray(messages) ? messages : [])
    .filter(
      (m) =>
        m &&
        typeof m.role === "string" &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .map((m) => ({
      role: m.role,
      content: m.content.trim(),
    }));

  const structuredUser = [...normalized]
    .reverse()
    .find(
      (m) => m.role === "user" && STRUCTURED_INPUT_PATTERN.test(m.content)
    );
  if (structuredUser) {
    return [structuredUser];
  }

  const lastUser = [...normalized].reverse().find((m) => m.role === "user");
  if (lastUser) {
    return [lastUser];
  }

  return normalized.slice(-3);
};

const unwrapJsonText = (raw = "") => {
  const text = String(raw || "").trim();
  if (!text) return "";

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() || text;
};

const tryParseJson = (raw) => JSON.parse(unwrapJsonText(raw));

/* =========================================================
   8. GPT 호출
========================================================= */
const requestGPT = async (messages, systemPrompt, options = {}) => {
  const requestedMaxOutputTokens = options.maxOutputTokens || 7000;
  const response = await openai.responses.create({
    model: BLOG_MODEL,
    reasoning: {
      effort: BLOG_REASONING_EFFORT,
    },
    input: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ],
    text: {
      format: {
        type: "json_object",
      },
    },
    max_output_tokens: requestedMaxOutputTokens,
  });

  const raw = response.output_text || "";

  return {
    raw,
    meta: {
      api: "responses",
      model: BLOG_MODEL,
      reasoning_effort: BLOG_REASONING_EFFORT,
      id: response.id || null,
      status: response.status || null,
      incomplete_reason: response.incomplete_details?.reason || null,
      requested_max_output_tokens: requestedMaxOutputTokens,
      raw_length: String(raw).length,
    },
  };
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
    const relevantMessages = pickRelevantMessages(messages);

    if (!relevantMessages.length) {
      return res.status(400).json({ error: "유효한 메시지가 없습니다." });
    }

    let parsed = null;
    let raw = "";
    let parseError = null;
    let lastMeta = null;

    const attempts = [
      {
        bodyLength: "1,100자 이상 1,400자 이하",
        totalLength: "2,100자 이하",
        maxOutputTokens: 20000,
      },
      {
        bodyLength: "900자 이상 1,200자 이하",
        totalLength: "1,800자 이하",
        maxOutputTokens: 24000,
      },
    ];

    for (const [index, attempt] of attempts.entries()) {
      const systemPrompt = buildSystemPrompt(REF, category, tone, attempt);
      const result = await requestGPT(
        relevantMessages,
        systemPrompt,
        attempt
      );
      raw = result.raw;
      lastMeta = result.meta;

      try {
        parsed = tryParseJson(raw);
        if (isValidOutput(parsed)) break;
      } catch (err) {
        parseError = err?.message || String(err);
      }

      const shouldRetry =
        index < attempts.length - 1 &&
        BLOG_RETRYABLE_INCOMPLETE_REASONS.has(lastMeta?.incomplete_reason);

      if (!shouldRetry) {
        break;
      }
    }

    if (!isValidOutput(parsed)) {
      const missingKeys = getMissingKeys(parsed);

      console.warn("/api/law/blog invalid output", {
        parseError,
        missingKeys,
        ...lastMeta,
      });

      return res.status(500).json({
        error: "GPT 출력 검증 실패",
        debug_preview: String(raw).slice(0, 500),
        debug_meta: {
          parse_error: parseError,
          missing_keys: missingKeys,
          relevant_message_count: relevantMessages.length,
          ...lastMeta,
        },
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("/api/law/blog error", err);

    return res.status(500).json({
      error: "API 내부 에러",
      message: err?.message || String(err),
    });
  }
}
