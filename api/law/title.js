import OpenAI from "openai";

export const config = {
  runtime: "edge",
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req) {
  try {
    const { messages, category } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages 배열이 필요합니다." }), {
        status: 400,
      });
    }

    const text = messages
      .map((m) => `${m.role === "user" ? "의뢰인" : "챗봇"}: ${m.content}`)
      .join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
너는 '법무법인 나란' 상담 기록의 제목을 한 줄로 요약하는 도우미야.
- 한국어로 12자~25자 사이
- 군더더기 없이 핵심만
- "상담" 같은 단어 남발 금지
- 사건의 핵심 쟁점이 무엇인지 드러나게
          `.trim(),
        },
        {
          role: "user",
          content: `
[사건 유형]: ${category || "일반"}

아래 상담 대화를 보고, 사건 제목을 한 줄로 지어줘.

${text}
          `.trim(),
        },
      ],
    });

    const title = completion.choices[0].message.content.trim();

    return new Response(JSON.stringify({ title }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message || "제목 생성 오류" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
