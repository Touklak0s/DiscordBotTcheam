const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

async function loadCommands(client) {
  client.commands = new Map();
  const buttonHandlers = new Map();

  const commandFiles = fs.readdirSync(path.join(__dirname, '../modules')).filter(file => file.endsWith('.js'));
  const commandsArray = [];

  for (const file of commandFiles) {
    const command = require(`../modules/${file}`);

    // Enregistrer les slash commands
    if (Array.isArray(command.data)) {
      command.data.forEach(cmd => {
        client.commands.set(cmd.name, command);
        commandsArray.push(cmd.toJSON());
      });
    } else if (command.data) {
      client.commands.set(command.data.name, command);
      commandsArray.push(command.data.toJSON());
    }

    // Enregistrer les gestionnaires de boutons s'ils existent
    if (typeof command.handleButton === 'function') {
      buttonHandlers.set(file.replace('.js', ''), command.handleButton);
    }
  }

  // Enregistrement sur Discord
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commandsArray });
  console.log('✅ Commandes slash enregistrées.');

  // Gestion des interactions
  client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd) await cmd.execute(interaction, client);
    }

    else if (interaction.isButton()) {
      const id = interaction.customId;

      // Exemple : customId = toggle_role_123 → handler = "role"
      const handlerKey = Object.keys(Object.fromEntries(buttonHandlers)).find(key =>
        id.startsWith(key) || id.includes(`_${key}_`) || id.includes(`${key}`)
      );

      const handler = buttonHandlers.get(handlerKey);
      if (handler) {
        await handler(interaction);
      } else {
        console.warn(`Aucun gestionnaire trouvé pour le bouton : ${id}`);
      }
    }
  });
}

module.exports = { loadCommands };
