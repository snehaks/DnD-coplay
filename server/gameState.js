// gameState.js

const games = {};

export function getOrCreateGame(code, ws, name) {
  // Create game if it doesn't exist
  if (!games[code]) {
    games[code] = {
      players: [],       // { ws, name }
      story: ["A new adventure begins..."],
    };
  }

  

  const game = games[code];
  const isFirstPlayer = game.players.length === 0;

  // Add player to game
  game.players.push({ ws, name });

  // Build welcome messages
  const welcomeText = isFirstPlayer
    ? `Welcome ${name}! You are the first adventurer.\nShare your game code: ${code}`
    : `Welcome ${name}! Another adventurer has arrived.\n${game.players[0].name} is already in the game.`;

  // Send welcome message only to this player
  ws.send(JSON.stringify({ type: "story", text: welcomeText }));

  // If second player joined, notify both players
  if (!isFirstPlayer && game.players.length === 2) {
    broadcast(game, `Both players have joined!\nYour journey together begins now...\n\n${game.story.join("\n")}`);
  }

  return game;
}

function getGameForPlayer(ws) {
  for (const code in games) {
    const game = games[code];
    if (game.players.some((p) => p.ws === ws)) return game;
  }
  return null;
}

export async function handlePlayerAction(ws, action) {
  const game = getGameForPlayer(ws);
  if (!game) return "Error: Game not found.";

  // Build prompt from existing story + the new action
  const prompt = `
You are a friendly Dungeon Master narrating a simple, fun D&D-style adventure for two kids.
The story so far:

${game.story.join("\n")}

The players just did: "${action}"

Continue the story in 2–4 sentences. 
Make it exciting but age-appropriate, no violence.
End with a question or choice for the players.
`;

  // Free HuggingFace inference model (no key needed)
  const response = await fetch(
    "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: prompt })
    }
  );

  const result = await response.json();

  // Extract generated text safely
  const aiText =
    result?.generated_text ||
    result?.[0]?.generated_text ||
    "The adventure continues...";

  // Trim extra prompt if model echoes it
  const cleaned = aiText.replace(prompt, "").trim();

  // Add to story history
  game.story.push(cleaned);

  // Broadcast to all players
  broadcast(game, cleaned);

  return cleaned;
}


export function broadcast(game, text) {
  game.players.forEach((p) => {
    if (p.ws.readyState === 1) {
      p.ws.send(JSON.stringify({ type: "story", text }));
    }
  });
}