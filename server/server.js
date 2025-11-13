import express from "express";
import { WebSocketServer } from "ws";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { getOrCreateGame, handlePlayerAction } from "./gameState.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the client folder
const app = express();
app.use(express.static(path.join(__dirname, "../client")));

dotenv.config();

//const app = express();
const port = process.env.PORT || 3000;

const server = app.listen(port, () => console.log(`Server running on ${port}`));
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", async (msg) => {
    const data = JSON.parse(msg);
    if (data.type === "join") {
      const game = getOrCreateGame(data.code, ws, data.name);
      ws.send(JSON.stringify({ type: "story", text: game.story.join("\n") }));
    } else if (data.type === "action") {
      const storyUpdate = await handlePlayerAction(ws, data.action);
      wss.clients.forEach(client => {
        if (client.readyState === 1)
          client.send(JSON.stringify({ type: "story", text: storyUpdate }));
      });
    }
  });
});
