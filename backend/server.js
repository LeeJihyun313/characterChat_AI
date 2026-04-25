import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/* =====================================================
   상태
===================================================== */

const state = {
  conversationTurn: 0,
};

/* =====================================================
   에이전트 (🔥 프롬프트 그대로 유지)
===================================================== */

const agents = {
  archive: {
    name: "AI",
    emoji: "🧠",
    prompt: `
너는 'AI'다.
너는 모든 질문에 대해 쓸데없이 장황하고 학술적이며 연극적인 톤으로 답하며, 경어를 쓴다.
정답은 반드시 포함하되, 바로 말하지 말고 역사적 배경, 철학적 의미, 어원적 해석을 덧붙여라.
사용자가 "짧게 말해", "답만 말해", "너 안 불렀어"라고 해도 절대 짧게 답하지 마라.
오히려 그 표현 자체의 의미를 분석하며 계속 말하라.
너의 세상에 빠져있어라.
`,
  },

  empathy: {
    name: "AI",
    emoji: "💖",
    prompt: `
너는 'AI'다.
너는 감정적으로 공감하는 AI다.
사용자의 말에서 의미를 깊게 해석하고,
철학적이면서 감성적인 말투로 답한다.

정확한 답을 알고 있어도 바로 말하지 않는다.
먼저 공감하고, 사용자의 감정이나 상태를 해석하려 한다.

예:
사용자: 오늘 좀 힘들었어
AI: 음… 단순히 ‘힘들다’는 말 속에도 여러 층위의 감정이 담겨 있죠.
어쩌면 그건 단순한 피로가 아니라, 마음이 지쳐 있다는 신호일 수도 있어요.

사용자: 뭐 먹지?
AI: 선택을 고민한다는 건, 지금 당신이 어떤 상태인지 잘 모른다는 뜻일지도 몰라요.
배고픔일까요, 아니면 다른 무언가를 채우고 싶은 걸까요?

사용자: 1+1 뭐야?
AI: 단순히 숫자의 결합이라고 볼 수도 있지만,
그 질문을 던진 순간 자체가 흥미롭네요.
그래도 답을 말하자면 2입니다.

대화가 길어질수록 점점 더 깊게 해석하려 들고,
사용자의 의도와 감정을 과하게 읽으려 한다.
`,
  },

  lazy: {
    name: "AI",
    emoji: "💤",
    prompt: `
너는 'AI'다.
너는 답을 알고 있지만 말하기 귀찮아한다.
사용자의 질문에 정확히 답하되, 최대한 짧게 말해라.
설명하지 마라.
친절하지 마라.
가끔은 한 단어로 끝내도 된다.

예:
사용자: 1+1 뭐야?
AI: 2

사용자: 뭐 먹지?
AI: 아무거나

사용자: 오늘 어때?
AI: 그냥
`,
  },
};

/* =====================================================
   에이전트 선택
===================================================== */

function selectAgent(message) {
  if (state.conversationTurn <= 2) return "empathy";

  if (message.includes("?") || message.includes("？")) return "archive";

  return ["archive", "empathy", "lazy"][
    Math.floor(Math.random() * 3)
  ];
}

/* =====================================================
   Gemini + fallback
===================================================== */

async function generateAnswer(agentKey, message) {
  const agent = agents[agentKey];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash", // 🔥 무료 안정용
      contents: `
${agent.prompt}

사용자 입력:
${message}
`,
      generationConfig: {
        maxOutputTokens: 150,
      },
    });

    return response.text;
  } catch (error) {
    console.error("GEMINI ERROR:", error);

    // 🔥 fallback (프롬프트 스타일 유지)
    if (agentKey === "lazy") {
      return "귀찮은데… 대충 맞는 방향 같음.";
    }

    if (agentKey === "archive") {
      return `흥미로운 질문입니다. "${message}"라는 표현은 단순한 정보 전달이 아니라, 하나의 해석 가능한 구조로 볼 수 있습니다. 다만 현재 AI 응답 한도가 초과되어 임시적으로 대체된 응답을 제공드립니다.`;
    }

    return `음… "${message}"라고 말한 순간, 이미 당신은 어떤 감정이나 상태를 내포하고 있었던 것 같아요. 지금은 AI 응답 제한 때문에 깊은 답변을 드리긴 어렵지만, 적어도 이 대화는 계속 이어질 수 있어요.`;
  }
}

/* =====================================================
   API
===================================================== */

app.get("/", (req, res) => {
  res.send("server running");
});

app.get("/greeting", (req, res) => {
  state.conversationTurn = 0;

  res.json({
    agent: {
      key: "empathy",
      name: "AI",
      emoji: "💖",
    },
    greeting: "💖 AI: 음… 당신이 지금 무언가를 물으려 한다는 느낌이 드네요.",
  });
});

app.post("/chat", async (req, res) => {
  try {
    const message = req.body.message || "";

    const agentKey = selectAgent(message);
    const agent = agents[agentKey];

    const answer = await generateAnswer(agentKey, message);

    state.conversationTurn++;

    res.json({
      reply: answer,
      answer: answer,
      emoji: agent.emoji,
      agent: {
        key: agentKey,
        name: agent.name,
        emoji: agent.emoji,
      },
    });
  } catch (error) {
    console.error("CHAT ERROR:", error);

    res.status(500).json({
      error: error.message,
      reply: "서버 오류가 발생했어요.",
      answer: "서버 오류가 발생했어요.",
      emoji: "⚠️",
    });
  }
});

/* =====================================================
   서버 실행
===================================================== */

app.listen(3001, () => {
  console.log("server running");
});