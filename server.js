const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
app.use(express.json());

const BOT_TOKEN  = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SECRET_KEY = process.env.SECRET_KEY;

const messageQueue = [];

function checkSecret(req, res) {
  if (req.headers["x-secret"] !== SECRET_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// Roblox polls this for Discord messages
app.get("/poll", (req, res) => {
  if (!checkSecret(req, res)) return;
  const messages = [...messageQueue];
  messageQueue.length = 0;
  res.json({ messages });
});

// Roblox sends player chat here
app.post("/roblox-to-discord", (req, res) => {
  if (!checkSecret(req, res)) return;
  const { username, content, serverId } = req.body;
  if (!username || !content) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const channel = discordClient.channels.cache.get(CHANNEL_ID);
  if (channel) {
    // Include the server ID in the message
    channel.send(`🎮 **${username}** [Server: \`${serverId || "unknown"}\`]: ${content}`);
  }
  res.json({ ok: true });
});

// Roblox sends player list here (for !players command)
app.post("/update-players", (req, res) => {
  if (!checkSecret(req, res)) return;
  const { players, serverId } = req.body;
  // Store latest player list per server
  playerLists[serverId] = players || [];
  res.json({ ok: true });
});

// UptimeRobot ping
app.get("/ping", (req, res) => {
  res.send("pong");
});

// Store player lists per server
const playerLists = {};

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

  // ---- COMMANDS ----

  // !shutdown — tells Roblox to shut down all servers
  if (content === "!shutdown") {
    messageQueue.push({ type: "command", command: "shutdown" });
    msg.reply("⚠️ Shutdown command sent to Roblox!");
    return;
  }

  // !announce [message] — broadcasts a message in Roblox chat
  if (content.startsWith("!announce ")) {
    const announcement = content.slice("!announce ".length).trim();
    if (!announcement) {
      msg.reply("Usage: `!announce your message here`");
      return;
    }
    messageQueue.push({ type: "command", command: "announce", text: announcement });
    msg.reply(`📢 Announced in Roblox: "${announcement}"`);
    return;
  }

  // !players — shows all players currently in game
  if (content === "!players") {
    const allServers = Object.entries(playerLists);
    if (allServers.length === 0) {
      msg.reply("No players are currently in game.");
      return;
    }
    let reply = "**Players currently in game:**\n";
    for (const [serverId, players] of allServers) {
      reply += `\n🖥️ Server \`${serverId}\`:\n`;
      if (players.length === 0) {
        reply += "  *(empty)*\n";
      } else {
        reply += players.map(p => `  • ${p}`).join("\n") + "\n";
      }
    }
    msg.reply(reply);
    return;
  }

  // Regular chat message — queue it for Roblox
  messageQueue.push({
    type: "chat",
    username: msg.author.username,
    content: msg.content,
  });
});

discordClient.login(BOT_TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bridge server running on port ${PORT}`);
});
