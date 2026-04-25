const chat = document.getElementById("chat");
const input = document.getElementById("input");
const sendButton = document.getElementById("sendButton");

/* =========================
   메시지 출력
========================= */

function addMessage(text, type) {
  const div = document.createElement("div");
  div.className = `message ${type}`;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

/* =========================
   타이핑 효과
========================= */

function addTypingMessage(text, type) {
  const div = document.createElement("div");
  div.className = `message ${type}`;
  chat.appendChild(div);

  let index = 0;

  const timer = setInterval(() => {
    div.innerText = text.slice(0, index);
    index++;
    chat.scrollTop = chat.scrollHeight;

    if (index > text.length) clearInterval(timer);
  }, 12);
}

/* =========================
   로딩 UI
========================= */

function addLoadingMessage() {
  const div = document.createElement("div");
  div.className = "message system loading";
  chat.appendChild(div);

  const messages = [
    "서버 깨우는 중",
    "AI 찾는 중",
    "누군가 고민 중",
    "대답할 AI 선택 중"
  ];

  let dots = "";
  let msgIndex = 0;

  const interval = setInterval(() => {
    dots = dots.length < 3 ? dots + "." : "";
    div.innerText = messages[msgIndex] + dots;

    if (Math.random() < 0.25) {
      msgIndex = (msgIndex + 1) % messages.length;
    }

    chat.scrollTop = chat.scrollHeight;
  }, 400);

  return { div, interval };
}

/* =========================
   로딩 제거
========================= */

function removeLoader(loader) {
  if (!loader) return;

  clearInterval(loader.interval);

  if (loader.div && loader.div.parentNode) {
    loader.div.remove();
  }
}

/* =========================
   메시지 전송
========================= */

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";
  sendButton.disabled = true;

  const loader = addLoadingMessage();

  try {
    const res = await fetch("https://characterchat-ai.onrender.com/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    removeLoader(loader);

    if (!res.ok) {
      console.error("백엔드 에러:", data);
      addMessage(`서버 오류: ${data.error || "알 수 없는 오류"}`, "system");
      return;
    }

    if (!data.agent) {
      console.error("agent 없음:", data);
      addMessage("서버 응답 형식 오류: agent 정보가 없습니다.", "system");
      return;
    }

    if (data.transition) {
      addTypingMessage(data.transition, "system");
    }

    setTimeout(() => {
      addTypingMessage(
        `${data.agent.emoji || "🙂"} ${data.agent.name || "AI"}\n${data.reply || data.answer || "응답이 없습니다."}`,
        data.agent.key || "system"
      );
    }, data.transition ? 500 : 0);

  } catch (err) {
    removeLoader(loader);
    console.error("서버 연결 실패:", err);
    addMessage("서버 연결 실패", "system");
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
}

/* =========================
   이벤트
========================= */

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

sendButton.addEventListener("click", sendMessage);