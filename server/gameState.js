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

  if (!process.env.HF_TOKEN) {
    console.error("HF_TOKEN environment variable not set.");
    return "The Dungeon Master is currently unavailable (missing API token).";
  }

  const prompt = `You are a friendly Dungeon Master narrating a simple, fun D&D-style adventure for two kids.
The story so far:
${game.story.join("\n")}

The players just did: "${action}"

Continue the story in 2–4 sentences. Make it exciting but age-appropriate, no gore. End with a question or choice for the players.
`;

  // Choose a model endpoint
  const hfModel = process.env.HF_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct";  
  const hfUrl = `https://api-inference.huggingface.co/models/${hfModel}`;

  const headers = {
    "Authorization": `Bearer ${process.env.HF_TOKEN}`,
    "Content-Type": "application/json"
  };

  let aiText = "The adventure continues...";
  try {
    const res = await fetch(hfUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: prompt, parameters: { return_full_text: false } })
    });

    const json = await res.json();

    if (!res.ok || json.error) {
      const errorMessage = json.error || `API request failed with status ${res.status}`;
      console.error("AI call error:", errorMessage);
      throw new Error(errorMessage);
    }

    // The standard API response is an array.
    const generatedText = json?.[0]?.generated_text;

    if (!generatedText) {
      throw new Error("Invalid response structure from AI: " + JSON.stringify(json));
    }
    aiText = generatedText.trim();
  } catch (err) {
    console.error("AI call error:", err);
    aiText = "The DM pauses for a moment, thinking... The adventure continues.";
  }

  // Save to story and return
  game.story.push(`${aiText}`);
  return aiText;
}


export function broadcast(game, text) {
  game.players.forEach((p) => {
    if (p.ws.readyState === 1) {
      p.ws.send(JSON.stringify({ type: "story", text }));
    }
  });
}