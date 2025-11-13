const socket = new WebSocket("wss://dnd-coplay.onrender.com");
//const ws = new WebSocket(`ws://${window.location.host}`);

const joinBtn = document.getElementById("joinBtn");
const actionBtn = document.getElementById("actionBtn");

joinBtn.onclick = () => {
  const name = document.getElementById("name").value;
  const code = document.getElementById("code").value.trim().toUpperCase();

  ws.send(JSON.stringify({
    type: "join",
    name,
    code
  }));
};

actionBtn.onclick = () => {
  const action = document.getElementById("action").value;
  document.getElementById("action").value = "";

  ws.send(JSON.stringify({
    type: "action",
    action
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "story") {
    // Hide join UI
    document.getElementById("join-section").style.display = "none";

    // Show gameplay UI
    document.getElementById("game-section").style.display = "block";

    // Append new story text
    const storyBox = document.getElementById("story");
    storyBox.value += data.text + "\n\n";
    storyBox.scrollTop = storyBox.scrollHeight;
  }
};
