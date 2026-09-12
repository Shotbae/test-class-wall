// ===================================================
// Gemini API를 호출하는 Vercel 서버리스 함수
//
// 규칙 (AGENTS.md):
// 1. Firebase Functions 대신 Vercel 서버리스 함수로 작성
// 2. API 키는 코드에 적지 않고 Vercel 환경변수 process.env.GEMINI_API_KEY 로 가져옴
// 3. 학생의 개인정보(uid, 이메일 등)는 전달하지 않고 메모 본문(text)만 전달
// 4. 모델은 무료 티어에서 안정적으로 동작하는 gemini-1.5-flash 또는 gemini-2.5-flash 사용
// ===================================================

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 지원합니다." });
    return;
  }

  const { text } = req.body || {};

  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "메모 내용(text)이 필요합니다." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Vercel 대시보드에서 환경변수를 등록해 주세요."
    });
    return;
  }

  try {
    // 무료 티어로 제공되는 gemini-2.5-flash 모델 호출 (필요시 gemini-1.5-flash 호환)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `당신은 학교 담벼락에 올라온 학생의 글에 따뜻하고 교육적인 피드백을 주는 AI 교사 도우미입니다.
학생의 글을 읽고 격려와 칭찬, 또는 생각해 볼 만한 다정한 코멘트를 1~2문장(공백 포함 100자 내외)으로 남겨주세요.
이모지도 하나 정도 친근하게 사용해 주세요.

학생 글: "${text}"`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API Error:", errText);
      res.status(response.status).json({ error: `Gemini API 호출 오류: ${response.statusText}` });
      return;
    }

    const data = await response.json();
    const comment = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "좋은 생각이에요! 멋진 메모 고마워요. ✨";

    res.status(200).json({ comment });
  } catch (error) {
    console.error("Gemini 호출 중 예외 발생:", error);
    res.status(500).json({ error: "서버에서 Gemini 응답을 생성하지 못했습니다." });
  }
}
