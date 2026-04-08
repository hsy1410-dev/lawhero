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
  "title": "string (H1 제목, 제목 형식은 반드시 5.txt의 규칙을 따른다)",
  "intro": "string (도입부 3~5문장. 제목 작성 후 반드시 도입부를 작성하며, 도입부에는 키워드를 포함하지 않는다. 도입부는 다음 5가지 형식 중 하나를 자동 선택해 작성한다: 1. 표 형식 도입부 2. 대화체 도입부 3. 체크리스트 도입부 4. 뉴스 인용 도입부 5. FAQ 도입부)",
  "body": "string (markdown, H2/H3 구조 포함, 최소 3개의 소제목 포함, 전체 문체는 구성 선택 번호에 맞게 작성하고 글마다 구성과 문단 순서가 완전히 달라야 하며 1,500자 이상 1,800자 이하)",
  "conclusion": "string (결론은 요약 -> 공감 문장 -> 클릭 유도 문장 순으로 구성)",
  "summary_table": "string (markdown table, 글 전체 요약, 글마다 각기 다른 구성의 표)"
}
`;

const STRUCTURED_INPUT_PATTERN = /✅키워드:|✅사기내용:|✅구성선택:/i;
const MAX_GENERATION_ATTEMPTS = 3;

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
const buildSystemPrompt = (REF, category, toneKey) => `
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
- body는 H2/H3 구조 + 1,500자 이상 1,800자 이하
- conclusion은 2~3문장
- summary_table은 markdown table
- 글 구성은 매번 완전히 다르게
- 글 전체 글자수 2,100자 넘지않게 강조
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

const parseJsonSafely = (raw) => {
  try {
    return {
      parsed: JSON.parse(unwrapJsonText(raw)),
      parseError: null,
    };
  } catch (error) {
    return {
      parsed: null,
      parseError: error,
    };
  }
};

const inspectGenerationResult = ({ raw, parsed, parseError, responseMeta }) => {
  const text = unwrapJsonText(raw);
  const missingKeys = OUTPUT_KEYS.filter(
    (key) => typeof parsed?.[key] !== "string" || !parsed[key].trim()
  );
  const parseMessage = parseError?.message || null;
  const incompleteReason = responseMeta?.incompleteDetails?.reason || null;
  const appearsTruncated =
    incompleteReason === "max_output_tokens" ||
    /Unexpected end of JSON input|Unterminated string/i.test(parseMessage || "") ||
    (!!text && !text.trim().endsWith("}") && !parsed);

  return {
    valid: !!parsed && missingKeys.length === 0,
    missingKeys,
    parseMessage,
    rawLength: text.length,
    appearsTruncated,
    responseStatus: responseMeta?.status || null,
    incompleteReason,
  };
};

const buildRetryInstruction = (inspection) => {
  const reasons = [];

  if (inspection.appearsTruncated) {
    reasons.push("직전 응답이 JSON 중간에서 끊겼습니다");
  }

  if (inspection.parseMessage) {
    reasons.push(`파싱 오류: ${inspection.parseMessage}`);
  }

  if (inspection.missingKeys.length) {
    reasons.push(`누락 키: ${inspection.missingKeys.join(", ")}`);
  }

  if (!reasons.length) {
    reasons.push("직전 응답이 스키마 검증을 통과하지 못했습니다");
  }

  return [
    `이전 응답은 ${reasons.join(" / ")}.`,
    "이전 응답은 폐기하고, JSON 객체 전체를 처음부터 다시 작성하세요.",
    "반드시 title, intro, body, conclusion, summary_table 다섯 개 키만 포함하세요.",
    "반드시 마지막 중괄호까지 닫힌 완전한 JSON만 출력하세요.",
    inspection.appearsTruncated || inspection.incompleteReason === "max_output_tokens"
      ? "출력이 다시 잘리지 않도록 body는 1,500자 이상 1,700자 이하로, summary_table은 짧고 간결하게 작성하세요."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
};

/* =========================================================
   8. GPT 호출
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
      format: {
        type: "json_object",
      },
    },
    max_output_tokens: 8000,
  });

  return {
    raw: res.output_text || "",
    status: res.status || null,
    incompleteDetails: res.incomplete_details || null,
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
    const systemPrompt = buildSystemPrompt(REF, category, tone);
    const relevantMessages = pickRelevantMessages(messages);

    if (!relevantMessages.length) {
      return res.status(400).json({ error: "유효한 메시지가 없습니다." });
    }

    let parsed = null;
    let raw = "";
    let lastInspection = null;
    let attemptMessages = relevantMessages;

    for (let i = 0; i < MAX_GENERATION_ATTEMPTS; i++) {
      const responseMeta = await requestGPT(attemptMessages, systemPrompt);
      raw = responseMeta.raw;

      const { parsed: candidate, parseError } = parseJsonSafely(raw);
      const inspection = inspectGenerationResult({
        raw,
        parsed: candidate,
        parseError,
        responseMeta,
      });

      lastInspection = {
        attempt: i + 1,
        ...inspection,
      };

      if (inspection.valid && isValidOutput(candidate)) {
        parsed = candidate;
        break;
      }

      if (i < MAX_GENERATION_ATTEMPTS - 1) {
        attemptMessages = [
          ...relevantMessages,
          {
            role: "user",
            content: buildRetryInstruction(inspection),
          },
        ];
      }
    }

    if (!isValidOutput(parsed)) {
      console.error("/api/law/blog validation failed", {
        ...lastInspection,
        preview: unwrapJsonText(raw).slice(0, 200),
        tail: unwrapJsonText(raw).slice(-200),
      });

      return res.status(500).json({
        error: "GPT 출력 검증 실패",
        debug_preview: unwrapJsonText(raw).slice(0, 500),
        debug_tail: unwrapJsonText(raw).slice(-200),
        debug_meta: {
          attempts: lastInspection?.attempt || 0,
          raw_length: lastInspection?.rawLength || 0,
          parse_error: lastInspection?.parseMessage || null,
          appears_truncated: !!lastInspection?.appearsTruncated,
          response_status: lastInspection?.responseStatus || null,
          incomplete_reason: lastInspection?.incompleteReason || null,
          missing_keys: lastInspection?.missingKeys || [],
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
