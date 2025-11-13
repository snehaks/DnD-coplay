//const socket = new WebSocket("wss://your-render-app.onrender.com");
//const socket = new WebSocket("ws://localhost:3000");
const socket = new WebSocket(`ws://${window.location.host}`);

const storyDiv = document.getElementById("story");
const playerNameInput = document.getElementById("playerName");
const gameCodeInput = document.getElementById("gameCode");
const actionInput = document.getElementById("action");
const turnInfo = document.getElementById("turnInfo");

document.getElementById("joinBtn").onclick = () => {
  socket.send(JSON.stringify({
    type: "join",
    name: playerNameInput.value,
    code: gameCodeInput.value
  }));
};

document.getElementById("sendBtn").onclick = () => {
  socket.send(JSON.stringify({
    type: "action",
    action: actionInput.value
  }));
  actionInput.value = "";
};

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "story") {
    storyDiv.innerHTML += `<p>${msg.text}</p>`;
  } else if (msg.type === "turn") {
    turnInfo.innerText = `Your turn: ${msg.player}`;
    document.getElementById("inputArea").style.display = "block";
  }
};
