const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
app.use(express.json());

const BOT_TOKEN  = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SECRET_KEY = process.env.SECRET_KEY;

const messageQueue = [];
const playerLists = {};

function checkSecret(req, res) {
  if (req.headers["x-secret"] !== SECRET_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// Roblox polls this for commands
app.get("/poll", (req, res) => {
  if (!checkSecret(req, res)) return;
  const messages = [...messageQueue];
  messageQueue.length = 0;
  res.json({ messages });
});

// Roblox sends join/leave events here
app.post("/roblox-event", (req, res) => {
  if (!checkSecret(req, res)) return;
  const { type, username, serverId } = req.body;
  if (!type || !username) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const channel = discordClient.channels.cache.get(CHANNEL_ID);
  if (channel) {
    if (type === "join") {
      channel.send(`✅ **${username}** joined the game [Server: \`${serverId || "unknown"}\`]`);
    } else if (type === "leave") {
      channel.send(`👋 **${username}** left the game [Server: \`${serverId || "unknown"}\`]`);
    }
  }
  res.json({ ok: true });
});

// Roblox sends player list here
app.post("/update-players", (req, res) => {
  if (!checkSecret(req, res)) return;
  const { players, serverId } = req.body;
  playerLists[serverId] = players || [];
  res.json({ ok: true });
});

// UptimeRobot ping
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
  if (msg.author.bot) return;
  if (msg.channelId !== CHANNEL_ID) return;

  const content = msg.content.trim();

  // !announce [message] — shows a chat message to all players
  if (content.startsWith("!announce ")) {
    const text = content.slice("!announce ".length).trim();
    if (!text) { msg.reply("Usage: `!announce your message here`"); return; }
    messageQueue.push({ type: "announce", text });
    msg.reply(`📢 Announced in game: "${text}"`);
    return;
  }

  // !news [message] — shows a pop-up notification to all players
  if (content.startsWith("!news ")) {
    const text = content.slice("!news ".length).trim();
    if (!text) { msg.reply("Usage: `!news your update here`"); return; }
    messageQueue.push({ type: "news", text });
    msg.reply(`📰 News sent to game: "${text}"`);
    return;
  }

  // !players — lists all players grouped by server
  if (content === "!players") {
    const allServers = Object.entries(playerLists);
    if (allServers.length === 0) {
      msg.reply("No players are currently in game.");
      return;
    }
    let reply = "**Players currently in game:**\n";
    let total = 0;
    for (const [serverId, players] of allServers) {
      reply += `\n🖥️ Server \`${serverId}\`:\n`;
      if (players.length === 0) {
        reply += "  *(empty)*\n";
      } else {
        reply += players.map(p => `  • ${p}`).join("\n") + "\n";
        total += players.length;
      }
    }
    reply += `\n**Total: ${total} player(s)**`;
    msg.reply(reply);
    return;
  }

  // !restart — restarts all servers
  if (content === "!restart") {
    messageQueue.push({ type: "restart" });
    msg.reply("🔄 Restart command sent to all servers!");
    return;
  }

  // Unknown command
  if (content.startsWith("!")) {
    msg.reply("❓ Unknown command. Available commands: `!announce`, `!news`, `!players`, `!restart`");
  }
});

discordClient.login(BOT_TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bridge server running on port ${PORT}`);
});
