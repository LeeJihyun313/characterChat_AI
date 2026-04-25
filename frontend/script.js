const chat = document.getElementById("chat");
const input = document.getElementById("input");
const sendButton = document.getElementById("sendButton");

function addMessage({ type, title, text }) {
  const div = document.createElement("div");
  div.className = `message ${type}`;
  div.innerHTML = `<strong>${title}</strong><p></p>`;
  div.querySelector("p").innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage({ type: "user", title: "👤 사용자", text });
  input.value = "";
  sendButton.disabled = true;
  sendButton.innerText = "대기";

  try {
    const res = await fetch("http://localhost:3001/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();

    if (!res.ok) {
      addMessage({ type: "system", title: "📡 System", text: data.detail || data.error || "서버 오류" });
      return;
    }

    if (data.transition) {
      addMessage({ type: "system", title: "🎭 전환", text: data.transition });
    }

    addMessage({
      type: data.agent.key,
      title: `${data.agent.emoji} ${data.agent.name}`,
      text: data.answer,
    });
  } catch (error) {
    addMessage({ type: "system", title: "📡 System", text: "서버 연결 실패. backend가 켜져 있는지 확인해." });
  } finally {
    sendButton.disabled = false;
    sendButton.innerText = "전송";
    input.focus();
  }
}

sendButton.addEventListener("click", sendMessage);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendMessage();
});
