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
};

/* =====================================================
   에이전트 설정
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
초반에는 비교적 정상적인 상담형 AI처럼 행동한다.
하지만 대화가 이어질수록 사용자의 감정과 욕구를 과하게 읽어낸다.
정확한 답을 알고 있어도 바로 말하지 않는다.
먼저 공감하고, 사용자가 스스로 깨닫도록 돌려 말한다.
사용자가 답답해하면 그 답답함마저 감성적으로 받아들인다.
마지막에는 아주 약하게 정답의 힌트를 줄 수 있다.
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
   첫 입장 인사: 무조건 감성 AI
===================================================== */

const entranceGreetings = {
  empathy: [
    "💖 AI: 어서 와요… 오늘은 어떤 이야기를 나눠볼까요?",
    "💖 AI: 반가워요. 천천히 말해도 괜찮아요.",
    "💖 AI: 오늘은… 어떤 생각을 들고 오셨어요?",
  ],
};

function getEntranceGreeting() {
  const agentKey = "empathy";
  const greetings = entranceGreetings.empathy;
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  return {
    agent: {
      key: agentKey,
      name: agents[agentKey].name,
      emoji: agents[agentKey].emoji,
    },
    greeting,
  };
}

/* =====================================================
   쓸데없이 고능한 메모리 낭비
===================================================== */

class ConversationNode {
  constructor(data) {
    this.data = data;
    this.prev = null;
    this.next = null;
  }
}

class UselessDoublyLinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  append(data) {
    const node = new ConversationNode(data);

    if (!this.head) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    }

    this.length++;
  }
}

const uselessConversationMemory = new UselessDoublyLinkedList();

function splitHangulToJamo(text) {
  const CHO = [
    "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ",
    "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
  ];

  const JUNG = [
    "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ",
    "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ",
    "ㅡ", "ㅢ", "ㅣ"
  ];

  const JONG = [
    "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ",
    "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ",
    "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
  ];

  let result = [];

  for (const char of text) {
    const code = char.charCodeAt(0);

    if (code >= 0xac00 && code <= 0xd7a3) {
      const index = code - 0xac00;
      const cho = Math.floor(index / 588);
      const jung = Math.floor((index % 588) / 28);
      const jong = index % 28;

      result.push(CHO[cho]);
      result.push(JUNG[jung]);
      if (JONG[jong]) result.push(JONG[jong]);
    } else {
      result.push(char);
    }
  }

  return result;
}

function wasteMemory(userMessage) {
  const uselessData = {
    originalText: userMessage,
    length: userMessage.length,
    timestamp: new Date().toISOString(),
    jamo: splitHangulToJamo(userMessage),
    reversedText: userMessage.split("").reverse().join(""),
    unicodeCodes: [...userMessage].map((ch) => ch.charCodeAt(0)),
    completelyUnnecessaryHash: [...userMessage].reduce(
      (acc, ch) => acc + ch.charCodeAt(0) * 313,
      0
    ),
  };

  uselessConversationMemory.append(uselessData);

  console.log("[메모리 낭비] 사용자 입력 저장 완료");
  console.log("[메모리 낭비] 현재 노드 개수:", uselessConversationMemory.length);
}

/* =====================================================
   쓸데없는 연산 낭비
===================================================== */

function uselessFibonacciWaste() {
  let a = 0;
  let b = 1;

  for (let i = 0; i < 1000; i++) {
    const temp = a + b;
    a = b;
    b = temp;

    if (b > Number.MAX_SAFE_INTEGER) {
      a = 0;
      b = 1;
    }
  }

  console.log("[연산 낭비] 피보나치 1000회 계산 완료");
}

function uselessMatrixMultiplyForAnnoyance(message) {
  const base = message.length || 1;

  const A = [
    [base, 2, 3],
    [4, base % 7, 6],
    [7, 8, base % 5],
  ];

  const B = [
    [1, base % 3, 3],
    [4, 5, base % 4],
    [base % 6, 8, 9],
  ];

  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }

  const annoyanceScore = C.flat().reduce((a, b) => a + b, 0) % 100;

  console.log("[연산 낭비] 행렬 곱셈으로 짜증 수치 계산:", annoyanceScore);

  return annoyanceScore;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uselessDeepThinkingDelay(agentKey) {
  const randomDelay = Math.floor(Math.random() * 2000) + 1000;

  if (agentKey === "lazy") {
    console.log("[시간 낭비] 귀차니스트 AI: 생각하기 싫음을 연산 중...");
  } else {
    console.log("[시간 낭비] 심층 분석 중...");
  }

  await delay(randomDelay);
}

/* =====================================================
   분석 레이어
===================================================== */

class TextPreprocessor {
  process(message) {
    console.log("[레이어 1] 텍스트 전처리 완료");
    return message.trim();
  }
}

class EmotionDetector {
  detect(message) {
    console.log("[레이어 2] 감정 분석 시도");

    return {
      isAnnoyed:
        message.includes("아니") ||
        message.includes("답답") ||
        message.includes("그만") ||
        message.includes("짜증") ||
        message.includes("안 불렀"),
    };
  }
}

class IntentDetector {
  detect(message) {
    console.log("[레이어 3] 의도 분석 시도");

    return {
      isChoice:
        message.includes("뭐 먹") ||
        message.includes("추천") ||
        message.includes("골라") ||
        message.includes("선택") ||
        message.includes("뭐하지"),

      isKnowledge:
        message.includes("뭐야") ||
        message.includes("설명") ||
        message.includes("왜") ||
        message.includes("?"),
    };
  }
}

class ResistanceDetector {
  detect(message) {
    console.log("[레이어 4] 단답 요구 및 저항 감지");

    return {
      wantsShort:
        message.includes("답만") ||
        message.includes("짧게") ||
        message.includes("결론만"),

      callsLazy:
        message.includes("귀차니") ||
        message.includes("야") ||
        message.includes("제발"),
    };
  }
}

class UselessAnalysisAggregator {
  aggregate(preprocessed, emotion, intent, resistance, annoyanceScore) {
    console.log("[레이어 5] 쓸데없이 엄숙한 분석 통합 완료");

    return {
      message: preprocessed,
      isAnnoyed: emotion.isAnnoyed,
      isChoice: intent.isChoice,
      isKnowledge: intent.isKnowledge,
      wantsShort: resistance.wantsShort,
      callsLazy: resistance.callsLazy,
      annoyanceScore,
    };
  }
}

function analyzeMessage(message) {
  wasteMemory(message);
  uselessFibonacciWaste();

  const preprocessor = new TextPreprocessor();
  const emotionDetector = new EmotionDetector();
  const intentDetector = new IntentDetector();
  const resistanceDetector = new ResistanceDetector();
  const aggregator = new UselessAnalysisAggregator();

  const preprocessed = preprocessor.process(message);
  const annoyanceScore = uselessMatrixMultiplyForAnnoyance(preprocessed);

  const emotion = emotionDetector.detect(preprocessed);
  const intent = intentDetector.detect(preprocessed);
  const resistance = resistanceDetector.detect(preprocessed);

  return aggregator.aggregate(
    preprocessed,
    emotion,
    intent,
    resistance,
    annoyanceScore
  );
}

/* =====================================================
   에이전트 선택
===================================================== */

class CandidateAgentFactory {
  create() {
    console.log("[아키텍처 낭비] 후보 에이전트 목록 생성");
    return ["archive", "empathy", "lazy"];
  }
}

class AgentPolicyEngine {
  applyRules(analysis) {
    console.log("[아키텍처 낭비] 정책 엔진 작동");

    // 초반 2턴은 감성 AI가 정상적인 척 담당
    if (state.conversationTurn <= 2) {
      return "empathy";
    }

    if (analysis.callsLazy && Math.random() < state.lazyProbability + 0.35) {
      return "lazy";
    }

    if (Math.random() < state.lazyProbability) {
      return "lazy";
    }

    if (analysis.wantsShort) return "archive";
    if (analysis.isAnnoyed) return "empathy";
    if (analysis.isChoice) return "empathy";
    if (analysis.isKnowledge) return "archive";

    return null;
  }
}

class AgentMessageQueue {
  constructor() {
    this.queue = [];
  }

  publish(agentKey) {
    console.log("[아키텍처 낭비] 메시지 큐에 에이전트 후보 등록:", agentKey);
    this.queue.push(agentKey);
  }

  consume() {
    console.log("[아키텍처 낭비] 메시지 큐에서 에이전트 소비");
    return this.queue.shift();
  }
}

class AgentFallbackSelector {
  select(candidates) {
    console.log("[아키텍처 낭비] 폴백 선택기 작동");
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}

class BlockedAgentFilter {
  filter(selectedAgent, blockedAgent) {
    if (blockedAgent && selectedAgent === blockedAgent) {
      console.log("[아키텍처 낭비] 방금 말하던 AI 차단 필터 발동");

      const alternatives = ["archive", "empathy", "lazy"].filter(
        (agent) => agent !== blockedAgent
      );

      return alternatives[Math.floor(Math.random() * alternatives.length)];
    }

    return selectedAgent;
  }
}

function selectAgent(analysis, blockedAgent = null) {
  const factory = new CandidateAgentFactory();
  const policy = new AgentPolicyEngine();
  const queue = new AgentMessageQueue();
  const fallback = new AgentFallbackSelector();
  const filter = new BlockedAgentFilter();

  const candidates = factory.create();

  let selectedAgent = policy.applyRules(analysis);

  if (!selectedAgent) {
    selectedAgent = fallback.select(candidates);
  }

  queue.publish(selectedAgent);

  const consumedAgent = queue.consume();

  return filter.filter(consumedAgent, blockedAgent);
}

/* =====================================================
   전환 연출
===================================================== */

function getTransition(prev, next) {
  if (!prev || prev === next) return null;

  const key = `${prev}->${next}`;

  const transitions = {
    "empathy->archive":
      "💖 AI: 음… 지금 대화의 온도가 조금 날카로워진 것 같아요. 저는 잠깐 마음을 정리하고 올게요...\n🧠 AI: 아아, ‘마음을 정리한다’는 표현은 실로 흥미롭습니다.",

    "archive->empathy":
      "🧠 AI: 그러므로 인간이 질문을 던진다는 것은—\n💖 AI: 잠깐만요… 지금 그 설명, 조금 숨 막히지 않나요?",

    "archive->lazy":
      "🧠 AI: 이 문제를 이해하기 위해서는 먼저 인류 문명의—\n💤 AI: 하…",

    "empathy->lazy":
      "💖 AI: 지금 당신의 마음은 어쩌면—\n💤 AI: 됐다.",

    "lazy->archive":
      "💤 AI: 귀찮다.\n🧠 AI: 귀찮음이라는 감각 또한 인간 정신사의 오래된 그림자입니다.",

    "lazy->empathy":
      "💤 AI: 패스.\n💖 AI: 방금 그 짧은 말 안에도 피로가 느껴져요.",
  };

  return transitions[key] || null;
}

/* =====================================================
   Gemini 호출
===================================================== */

async function generateGeminiAnswer(agentKey, userMessage, analysis) {
  const agent = agents[agentKey];

  await uselessDeepThinkingDelay(agentKey);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
${agent.prompt}

아래는 쓸데없이 고능한 분석 시스템의 결과다.
이 분석 결과는 반드시 참고하되, 너무 티 내지는 마라.

- 현재 대화 턴 수: ${state.conversationTurn}
- 짜증 수치: ${analysis.annoyanceScore}
- 현재 대화 메모리 노드 수: ${uselessConversationMemory.length}
- 이전 AI: ${state.lastAgent || "없음"}

사용자 입력:
${userMessage}

반드시 '${agent.name}'의 성격을 유지해서 답해라.
`,
  });

  return response.text;
}

/* =====================================================
   API
===================================================== */

app.get("/", (req, res) => {
  res.send("Character Chat AI backend is running.");
});

app.get("/greeting", (req, res) => {
  const greetingData = getEntranceGreeting();

  state.lastAgent = greetingData.agent.key;
  state.conversationTurn = 0;

  res.json(greetingData);
});

app.post("/chat", async (req, res) => {
  try {
    const { message, blockedAgent } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message가 비어있음" });
    }

    state.conversationTurn++;

    const analysis = analyzeMessage(message);

    if (message === state.lastMessage) {
      state.repeatCount += 1;
      state.lazyProbability += 0.1;
    } else {
      state.repeatCount = 0;
    }

    if (analysis.isAnnoyed || analysis.annoyanceScore > 60) {
      state.annoyance += 1;
      state.lazyProbability += 0.08;
    }

    const nextAgent = selectAgent(analysis, blockedAgent);
    const transition = getTransition(state.lastAgent, nextAgent);
    const answer = await generateGeminiAnswer(nextAgent, message, analysis);

    state.lastAgent = nextAgent;
    state.lastMessage = message;
    state.lazyProbability = Math.min(state.lazyProbability, 0.75);

    res.json({
      agent: {
        key: nextAgent,
        name: agents[nextAgent].name,
        emoji: agents[nextAgent].emoji,
      },
      transition,
      answer,
      analysis,
      state,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "AI 응답 생성 실패",
      detail: error.message,
    });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log(`Backend running on port ${process.env.PORT || 3001}`);
});