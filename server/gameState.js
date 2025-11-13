import fetch from "node-fetch";

const games = {};

export function getOrCreateGame(code, ws, playerName) {
  if (!games[code]) {
    games[code] = {
      players: [],
      story: ["The AI Dungeon Master greets you. The adventure begins!"],
      turnIndex: 0
    };
  }

  const game = games[code];
  game.players.push({ name: playerName, ws });
  return game;
}

export async function handlePlayerAction(ws, action) {
  const game = Object.values(games).find(g =>
    g.players.some(p => p.ws === ws)
  );

  const player = game.players[game.turnIndex];
  const prompt = game.story.join("\n") + `\n${player.name}: ${action}\nDM:`;

  const response = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1",
    {
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      body: JSON.stringify({ inputs: prompt })
    }
  );

  const result = await response.json();
  const aiReply = result[0]?.generated_text?.split("DM:")?.pop()?.trim() || "The DM is silent.";

  game.story.push(`${player.name}: ${action}`, `DM: ${aiReply}`);
  game.turnIndex = (game.turnIndex + 1) % game.players.length;

  return `DM: ${aiReply}`;
}
