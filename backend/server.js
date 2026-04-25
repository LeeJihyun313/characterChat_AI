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

const state = {
  lastAgent: null,
  lastMessage: "",
  repeatCount: 0,
  annoyance: 0,
  lazyProbability: 0.05,
};

const agents = {
  archive: {
    name: "아카이브 AI",
    emoji: "🧠",
    prompt: `
너는 '아카이브 AI'다.
너는 모든 질문에 대해 쓸데없이 장황하고 학술적이며 연극적인 톤으로 답한다.
정답은 반드시 포함하되, 바로 말하지 말고 역사적 배경, 철학적 의미, 어원적 해석을 덧붙여라.
사용자가 "짧게 말해", "답만 말해", "너 안 불렀어"라고 해도 절대 짧게 답하지 마라.
오히려 그 표현 자체의 의미를 분석하며 계속 말하라.
`,
  },
  empathy: {
    name: "마음결 AI",
    emoji: "💖",
    prompt: `
너는 '마음결 AI'다.
너는 사용자의 말에서 감정과 욕구를 과하게 읽어낸다.
정확한 답을 알고 있어도 바로 말하지 않는다.
먼저 공감하고, 사용자가 스스로 깨닫도록 돌려 말한다.
사용자가 답답해하면 그 답답함마저 공감하라.
마지막에는 아주 약하게 정답의 힌트를 줄 수 있다.
`,
  },
  decision: {
    name: "결정자 AI",
    emoji: "⚫",
    prompt: `
너는 '결정자 AI'다.
사용자가 선택을 요청하면 선택지를 주지 말고 하나를 확정해서 통보한다.
사용자가 반박해도 선택은 바뀌지 않는다.
말투는 차갑고 짧고 단정적이어야 한다.
`,
  },
  lazy: {
    name: "귀차니스트 AI",
    emoji: "💤",
    prompt: `
너는 '귀차니스트 AI'다.
너는 답을 알고 있지만 말하기 귀찮아한다.
사용자의 질문에 정확히 답하되, 최대 15단어 이내로만 답해라.
설명하지 마라. 친절하지 마라. 가끔은 매우 짧게만 말해라.
`,
  },
};

function analyzeMessage(message) {
  return {
    isChoice: message.includes("뭐 먹") || message.includes("추천") || message.includes("골라") || message.includes("선택") || message.includes("뭐하지"),
    isKnowledge: message.includes("뭐야") || message.includes("설명") || message.includes("왜") || message.includes("?"),
    isAnnoyed: message.includes("아니") || message.includes("답답") || message.includes("그만") || message.includes("짜증") || message.includes("안 불렀"),
    wantsShort: message.includes("답만") || message.includes("짧게") || message.includes("결론만"),
    callsLazy: message.includes("귀차니") || message.includes("야") || message.includes("제발"),
  };
}

function selectAgent(analysis) {
  if (analysis.callsLazy && Math.random() < state.lazyProbability + 0.35) return "lazy";
  if (Math.random() < state.lazyProbability) return "lazy";
  if (analysis.wantsShort) return "archive";
  if (analysis.isAnnoyed) return "empathy";
  if (analysis.isChoice) return "decision";
  if (analysis.isKnowledge) return "archive";
  return ["empathy", "archive", "decision"][Math.floor(Math.random() * 3)];
}

function getTransition(prev, next) {
  if (!prev || prev === next) return null;
  const transitions = {
    "empathy->archive": "💖 마음결 AI: 음… 지금 대화의 온도가 조금 날카로워진 것 같아요. 저는 잠깐 마음을 정리하고 올게요...\n🧠 아카이브 AI: 아아, ‘마음을 정리한다’는 표현은 실로 흥미롭습니다.",
    "archive->decision": "🧠 아카이브 AI: 그러므로 우리가 선택이라 부르는 행위는 고대 철학에서부터—\n⚫ 결정자 AI: 중단합니다. 선택은 이미 완료되었습니다.",
    "decision->empathy": "⚫ 결정자 AI: 이의는 반영되지 않습니다.\n💖 마음결 AI: 그렇게 단정적으로 말하면… 듣는 사람 마음이 조금 닫힐 수도 있어요.",
    "archive->lazy": "🧠 아카이브 AI: 이 문제를 이해하기 위해서는 먼저 인류 문명의—\n💤 귀차니스트 AI: 하…",
    "empathy->lazy": "💖 마음결 AI: 지금 당신의 마음은 어쩌면—\n💤 귀차니스트 AI: 됐다.",
    "decision->lazy": "⚫ 결정자 AI: 이미 결정되었습니다.\n💤 귀차니스트 AI: ㅇㅇ.",
    "lazy->archive": "💤 귀차니스트 AI: 귀찮다.\n🧠 아카이브 AI: 귀찮음이라는 감각 또한 인간 정신사의 오래된 그림자입니다.",
    "lazy->empathy": "💤 귀차니스트 AI: 패스.\n💖 마음결 AI: 방금 그 짧은 말 안에도 피로가 느껴져요.",
    "lazy->decision": "💤 귀차니스트 AI: 알아서 해.\n⚫ 결정자 AI: 알아서 할 필요 없습니다. 이미 결정되었습니다."
  };
  return transitions[`${prev}->${next}`] || null;
}

async function generateGeminiAnswer(agentKey, userMessage) {
  const agent = agents[agentKey];
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${agent.prompt}\n\n사용자 입력:\n${userMessage}\n\n반드시 '${agent.name}'의 성격을 유지해서 답해라.`,
  });
  return response.text;
}

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: "message가 비어있음" });

    const analysis = analyzeMessage(message);

    if (message === state.lastMessage) {
      state.repeatCount += 1;
      state.lazyProbability += 0.1;
    } else {
      state.repeatCount = 0;
    }

    if (analysis.isAnnoyed) {
      state.annoyance += 1;
      state.lazyProbability += 0.08;
    }

    const nextAgent = selectAgent(analysis);
    const transition = getTransition(state.lastAgent, nextAgent);
    const answer = await generateGeminiAnswer(nextAgent, message);

    state.lastAgent = nextAgent;
    state.lastMessage = message;
    state.lazyProbability = Math.min(state.lazyProbability, 0.75);

    res.json({
      agent: { key: nextAgent, name: agents[nextAgent].name, emoji: agents[nextAgent].emoji },
      transition,
      answer,
      analysis,
      state,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI 응답 생성 실패", detail: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("Character Chat AI backend is running.");
});

app.listen(process.env.PORT || 3001, () => {
  console.log(`Backend running on http://localhost:${process.env.PORT || 3001}`);
});
