// =======================================
// DISCORD <-> ROBLOX BRIDGE SERVER
// =======================================

const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
app.use(express.json());

// ---- SETTINGS (set these in Render's Environment tab) ----
const BOT_TOKEN  = process.env.BOT_TOKEN;   // your Discord bot token
const CHANNEL_ID = process.env.CHANNEL_ID;  // the Discord channel ID
const SECRET_KEY = process.env.SECRET_KEY;  // a random password you make up

// ---- MESSAGE QUEUE ----
// Discord messages are stored here until Roblox comes to pick them up
const messageQueue = [];

// ---- SECURITY CHECK ----
// Rejects any request that doesn't have the correct secret key
function checkSecret(req, res) {
  if (req.headers["x-secret"] !== SECRET_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ---- ROUTES ----

// Roblox calls this every few seconds to pick up new Discord messages
app.get("/poll", (req, res) => {
  if (!checkSecret(req, res)) return;
  const messages = [...messageQueue];
  messageQueue.length = 0; // clear the queue after delivering
  res.json({ messages });
});

// Roblox calls this when a player sends a chat message in-game
app.post("/roblox-to-discord", (req, res) => {
  if (!checkSecret(req, res)) return;
  const { username, content } = req.body;
  if (!username || !content) {
    return res.status(400).json({ error: "Missing username or content" });
  }
  // Send it to the Discord channel
  const channel = discordClient.channels.cache.get(CHANNEL_ID);
  if (channel) {
    channel.send(`🎮 **${username}**: ${content}`);
  }
  res.json({ ok: true });
});

// UptimeRobot pings this to keep the server awake
app.get("/ping", (req, res) => {
  res.send("pong");
});

// ---- DISCORD BOT ----
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

discordClient.on("ready", () => {
  console.log(`Discord bot logged in as ${discordClient.user.tag}`);
});

discordClient.on("messageCreate", (msg) => {
  // Ignore messages from other bots and wrong channels
  if (msg.author.bot) return;
  if (msg.channelId !== CHANNEL_ID) return;

  // Add the message to the queue for Roblox to pick up
  messageQueue.push({
    username: msg.author.username,
    content: msg.content,
  });

  console.log(`Queued message from ${msg.author.username}: ${msg.content}`);
});

discordClient.login(BOT_TOKEN);

// ---- START SERVER ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bridge server running on port ${PORT}`);
});
