const chat = document.getElementById("chat");
const input = document.getElementById("input");
const sendButton = document.getElementById("sendButton");

// ⭐ 추가
const affectionBox = document.getElementById("affectionBox");

function addMessage(text, type) {
  const div = document.createElement("div");
  div.className = `message ${type}`;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

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
  }, 22);
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";
  sendButton.disabled = true;

  addMessage("적절한 답변 도출 중...", "system");

  try {
    const res = await fetch("https://characterchat-ai.onrender.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    const loadingMessages = document.querySelectorAll(".message.system");
    const lastLoading = loadingMessages[loadingMessages.length - 1];
    if (lastLoading && lastLoading.innerText === "누군가 끼어드는 중...") {
      lastLoading.remove();
    }

    // ⭐ 호감도 UI 업데이트
    if (data.affection !== undefined) {
      affectionBox.innerText =
        `💗 호감도: ${data.affection} (${data.delta >= 0 ? "+" : ""}${data.delta})`;
    }

    // ⭐ 태도 변화 '척'
    if (data.affection >= 70 && Math.random() < 0.4) {
      addTypingMessage("System\nAI가 당신을 좋아하는 것 같습니다.", "system");
    }

    if (data.affection <= 30 && Math.random() < 0.4) {
      addTypingMessage("System\nAI가 약간 서운해하는 것 같습니다.", "system");
    }

    // ⭐ 쓸데없는 이벤트
    if (data.affection === 100) {
      addTypingMessage("System\n호감도 MAX. 아무 일도 일어나지 않습니다.", "system");
    }

    if (data.transition) {
      addTypingMessage(data.transition, "system");
    }

    setTimeout(() => {
      addTypingMessage(
        `${data.agent.emoji} ${data.agent.name}\n${data.answer}`,
        data.agent.key
      );
    }, data.transition ? 800 : 0);

  } catch (err) {
    addMessage("서버 연결 실패", "system");
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
}

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});
sendButton.addEventListener("click", sendMessage);