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
   3. 출력 JSON 스키마(프롬프트용)
========================================================= */
const OUTPUT_SCHEMA = `
{
  "title": "string (H1 제목, 제목 형식은 반드시 5.txt의 규칙을 따른다)",
  "intro": "string (도입부 출력 형식
(3줄)
밑에 1~5 중 하나를 선택해 쓴다
1.표를 넣기:
작성자가 물어본 사기 수법에 대한 체크리스트 표로 만들어서 표에 넣기 
좋은 대처법 / 잘못된 대처법 


2.대화체
피해자와 사기업체가 짧게 대화하는 내용을 쓰고 밑에는 전문가의 시점으로
해당 대화에 대한 의문을 제기하며 마무리
ex.피해자:이번만 입금하면 정말 돈 받을 수 있나요?
사기업체: 네 수수료만 입금하시면 됩니다.
->이렇게 반복되는 추가 입금 정말 정산 받을 수 있을까요?


3.체크리스트로 시작하기
작성자가 물어본 사기를 웹검색을 통해 사기수법에 대한 내용을 체크리스트4개 정도 있는 형식으로 만들고 마지막에는 해당 체크리스트에 대한 충고를 하며 이 글을 읽어야 한다는 내용을 써줘
-추가입금을 요구한다
-개인계좌로 돈을 받는다
-리뷰가 올라오는 속도가 비슷하다
이 중 하나라도 해당된다면 본문을 끝까지 읽을 이유가 충분합니다.


4.뉴스 기사 활용하기
작성자가 물어본 사기에 대해 웹검색을 통해서 해당사기에 관한 뉴스 헤드라인을 짧게 쓰며
독자에게 질문 던지기
ex.가장 중요한 점은 무엇일까요?
하지만 주의할 점이 있습니다!


5.많이 묻는 질문 인용하기
작성자가 물어본 사기에 대해 웹검색을 통해 피해자들이 궁금할만한 질문 던지고
이 글을 읽어야하는 것 처럼 말 마무리 
ex.추가입금 계속 요구해서 다 보냈는데
저 입금 받을 수 있나요?
이런 궁금증 해결을 원하신다면 이 글 끝까지 읽어보세요!)",
  "body": "string (markdown, H2/H3 구조 포함, 본문 전체)",
  "conclusion": "string (markdown, bullet 리스트 포함)",
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
const buildSystemPrompt = (REF, category) => `
당신은 **10년 이상 경력의 한국 변호사**입니다.
아래 JSON 스키마를 **정확히** 따르세요.
JSON 이외의 출력은 **절대 금지**합니다.

${OUTPUT_SCHEMA}

# 제목 작성 규칙 (5.txt 기준)
${REF.t5}

# 도입부 형식 규칙 (1.txt 기준)
${REF.t1}
도입부 출력 형식
-도입부 (3줄)
도입부 내용 :
1.표를 넣기:
작성자가 물어본 사기 수법에 대한 체크리스트 표로 만들어서 표에 넣기 
좋은 대처법 / 잘못된 대처법 


2.대화체
피해자와 사기업체가 짧게 대화하는 내용을 쓰고 밑에는 전문가의 시점으로
해당 대화에 대한 의문을 제기하며 마무리
ex.피해자:이번만 입금하면 정말 돈 받을 수 있나요?
사기업체: 네 수수료만 입금하시면 됩니다.
->이렇게 반복되는 추가 입금 정말 정산 받을 수 있을까요?


3.체크리스트로 시작하기
작성자가 물어본 사기를 웹검색을 통해 사기수법에 대한 내용을 체크리스트4개 정도 있는 형식으로 만들고 마지막에는 해당 체크리스트에 대한 충고를 하며 이 글을 읽어야 한다는 내용을 써줘
-추가입금을 요구한다
-개인계좌로 돈을 받는다
-리뷰가 올라오는 속도가 비슷하다
이 중 하나라도 해당된다면 본문을 끝까지 읽을 이유가 충분합니다.


4.뉴스 기사 활용하기
작성자가 물어본 사기에 대해 웹검색을 통해서 해당사기에 관한 뉴스 헤드라인을 짧게 쓰며
독자에게 질문 던지기
ex.가장 중요한 점은 무엇일까요?
하지만 주의할 점이 있습니다!


5.많이 묻는 질문 인용하기
작성자가 물어본 사기에 대해 웹검색을 통해 피해자들이 궁금할만한 질문 던지고
이 글을 읽어야하는 것 처럼 말 마무리 
ex.추가입금 계속 요구해서 다 보냈는데
저 입금 받을 수 있나요?
이런 궁금증 해결을 원하신다면 이 글 끝까지 읽어보세요!
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

    const { messages, category } = body;
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
