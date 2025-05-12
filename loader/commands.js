const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

async function loadCommands(client) {
  client.commands = new Map();

  const commandFiles = fs.readdirSync(path.join(__dirname, '../modules')).filter(file => file.endsWith('.js'));
  const commandsArray = [];

  for (const file of commandFiles) {
    const command = require(`../modules/${file}`);
    if (Array.isArray(command.data)) {
      command.data.forEach(cmd => {
        client.commands.set(cmd.name, command);
        commandsArray.push(cmd.toJSON());
      });
    } else {
      client.commands.set(command.data.name, command);
      commandsArray.push(command.data.toJSON());
    }
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commandsArray });
  console.log('✅ Commandes slash enregistrées.');

  client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd) await cmd.execute(interaction, client);
    } else if (interaction.isButton()) {
      const { handleButton } = require('../modules/role');
      await handleButton(interaction);
    }
  });
}

module.exports = { loadCommands };