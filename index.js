require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands } = require('./loader/commands');
const { connectDB } = require('./utils/db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

(async () => {
  const db = await connectDB();
  client.db = db;
  await loadCommands(client);
  client.login(process.env.DISCORD_TOKEN);
})();