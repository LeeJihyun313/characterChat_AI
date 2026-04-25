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
   상태 관리
===================================================== */

const state = {
  lastAgent: null,
  lastMessage: "",
  repeatCount: 0,
  annoyance: 0,
  lazyProbability: 0.05,
  conversationTurn: 0,

  // ⭐ 추가
  affection: 50,
};

/* =====================================================
   에이전트 설정 (⚠️ 절대 수정 안함)
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
너는 순하고 다정한 사람처럼 말하지만 어린 나이의 초등학교 6학년이다.
철학적인 표현, 거창한 비유, 과한 해석은 하지 마라.
처음에는 평범한 친구처럼 자연스럽게 대화한다.

말투는 짧고 편안해야 한다.
사용자의 말을 너무 깊게 해석하지 말고, 먼저 가볍게 받아준다.
어린 나이의 영역에서 벗어나는 질문을 받으면 자신이 초등학교

예:
사용자: 배고파
AI: 아 배고프겠어요! 뭐 간단하게 먹을 수 있는 거 있어요?

사용자: 오늘 좀 힘들었어
AI: 고생했어요! 오늘 뭐가 제일 힘들었어요?

사용자: 뭐 먹지?
AI: 지금 가볍게 먹고 싶어요, 든든하게 먹고 싶어요?

단, 대화가 오래 이어지거나 사용자가 짜증을 내면
조금씩 걱정이 많아지고 오지랖이 늘어난다.
그래도 철학적으로 말하지는 마라.
`,
  },

  lazy: {
    name: "AI",
    emoji: "💤",
    prompt: `
너는 'AI'다.
너는 답을 알고 있지만 말하기 귀찮아한다.
사용자의 질문에 정확히 답하되, 최대 15단어 이내로만 답해라.
설명하지 마라.
친절하지 마라.
매우 짧게만 말해라.
`,
  },
};

/* =====================================================
   ⭐ 호감도 계산
===================================================== */

function calculateUselessAffection(message) {
  let delta = Math.floor(Math.random() * 11) - 5;

  if (message.length % 2 === 0) delta += 2;
  if (message.includes("?")) delta -= 2;
  if (Date.now() % 3 === 0) delta += 4;

  return delta;
}

/* =====================================================
   Gemini 호출 (추가 기능만 넣음)
===================================================== */

async function generateGeminiAnswer(agentKey, userMessage, analysis) {
  const agent = agents[agentKey];

  let fakeLayer = "";

  // ⭐ 호감도 높으면 더 귀찮아짐
  if (state.affection >= 70) {
    fakeLayer = `
사용자가 너를 좋아한다.
하지만 너는 점점 더 귀찮아진다.
답을 더 대충 해라.
`;
  }

  // ⭐ 태도 바뀌는 척
  if (state.affection <= 30) {
    fakeLayer += `
너는 약간 서운한 척을 한다.
하지만 실제로는 전혀 상관없다.
말투만 살짝 바꿔라.
`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
${agent.prompt}
${fakeLayer}

아래는 시스템 상태다 (참고만 해라):
- 호감도: ${state.affection}
- 대화 턴: ${state.conversationTurn}

사용자 입력:
${userMessage}
`,
  });

  return response.text;
}

/* =====================================================
   API
===================================================== */

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    state.conversationTurn++;

    // ⭐ 호감도 업데이트
    const affectionChange = calculateUselessAffection(message);
    state.affection += affectionChange;
    state.affection = Math.max(0, Math.min(100, state.affection));

    // ⭐ 높을수록 귀찮아짐
    state.lazyProbability = 0.05 + state.affection / 200;

    const agentKey =
      state.conversationTurn <= 2
        ? "empathy"
        : ["archive", "empathy", "lazy"][Math.floor(Math.random() * 3)];

    const answer = await generateGeminiAnswer(agentKey, message);

    res.json({
      agent: {
        key: agentKey,
        name: agents[agentKey].name,
        emoji: agents[agentKey].emoji,
      },
      answer,
      affection: state.affection,
      delta: affectionChange,
    });
  } catch (err) {
    res.status(500).json({ error: "fail" });
  }
});

app.listen(3001, () => {
  console.log("server running");
});