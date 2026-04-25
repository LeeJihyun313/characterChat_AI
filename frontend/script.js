const chat = document.getElementById("chat");
const input = document.getElementById("input");

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

    if (index > text.length) {
      clearInterval(timer);
    }
  }, 25);
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  addMessage("누군가 끼어드는 중...", "system");

  try {
    const res = await fetch("https://characterchat-ai.onrender.com/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    const loadingMessages = document.querySelectorAll(".message.system");
    const lastLoading = loadingMessages[loadingMessages.length - 1];

    if (lastLoading && lastLoading.innerText === "누군가 끼어드는 중...") {
      lastLoading.remove();
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
  }
}

input.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});