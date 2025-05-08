// Discord bot to manage game roles in a server
process.env.DEBUG = 'discord.js:*';

// Function to parse color input
function parseColor(input) {
    if (!input) return null;

    const namedColors = {
        red: 0xFF0000,
        green: 0x00FF00,
        blue: 0x0000FF,
        purple: 0x800080,
        pink: 0xFFC0CB,
        yellow: 0xFFFF00,
        orange: 0xFFA500,
        black: 0x000000,
        white: 0xFFFFFF,
    };

    if (input.startsWith('#')) {
        return parseInt(input.slice(1), 16);
    }

    const color = namedColors[input.toLowerCase()];
    return color ?? null;
}


// index.js
const { Client, GatewayIntentBits, Partials, Routes, REST, SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, Events } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

let createdRoles = [];
let roleMessageData = null;

// Load stored roles and message data
if (fs.existsSync('./roles.json')) {
  createdRoles = JSON.parse(fs.readFileSync('./roles.json')).createdRoles || [];
}
if (fs.existsSync('./rolesMessage.json')) {
  roleMessageData = JSON.parse(fs.readFileSync('./rolesMessage.json'));
}

function saveRoles() {
  fs.writeFileSync('./roles.json', JSON.stringify({ createdRoles }, null, 2));
}

function saveRoleMessageData(data) {
  fs.writeFileSync('./rolesMessage.json', JSON.stringify(data, null, 2));
}

async function updateRolesMessage(client) {
  // const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const channel = await guild.channels.fetch(roleMessageData.channelId).catch(() => null);
  const rolesData = JSON.parse(fs.readFileSync('roles.json'));

  const embed = {
    title: '🎮 Rôles de jeux disponibles',
    description: rolesData.map(role => `${role.emoji} ${role.name} ${role.emoji}`).join('\n'),
    color: 0x9c84ef
  };

  const components = [];
  let currentRow = { type: 1, components: [] };

  for (let i = 0; i < rolesData.length; i++) {
    const role = rolesData[i];

    const button = {
      type: 2,
      label: role.name,
      custom_id: `role-${role.name}`,
      style: 1
    };

    currentRow.components.push(button);

    if (currentRow.components.length === 5 || i === rolesData.length - 1) {
      components.push(currentRow);
      currentRow = { type: 1, components: [] };
    }

    // Ne pas dépasser 5 lignes (Discord limite)
    if (components.length >= 5) break;
  }

  const message = await channel.messages.fetch(process.env.ROLES_MESSAGE_ID);
  await message.edit({ embeds: [embed], components });
}


client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
    if (commandName === 'role-create') {
      const nom = interaction.options.getString('nom');
      const couleur = interaction.options.getString('couleur');
      const icone = interaction.options.getString('icone') || '';
      const name = `${icone} ${nom} ${icone}`.trim();

      const role = await interaction.guild.roles.create({
        name,
        color: parseColor(couleur) ?? 'Random',
        hoist: true,
        mentionable: true,
        reason: `Créé par ${interaction.user.tag}`
      });

      createdRoles.push({ id: role.id, name: role.name });
      saveRoles();
      await updateRolesMessage(interaction.guild);
      await interaction.reply({ content: `🎉 Rôle **${role.name}** créé avec succès.`, ephemeral: true });

    } else if (commandName === 'role-delete') {
      const nom = interaction.options.getString('nom');
      const role = interaction.guild.roles.cache.find(role => 
        role.name.includes(roleNameInput) && 
        createdRoles.has(role.id) // <- uniquement les rôles créés via create
    );

      if (role && createdRoles.find(r => r.id === role.id)) {
        await role.delete('Suppression via /role-delete');
        createdRoles = createdRoles.filter(r => r.id !== role.id);
        saveRoles();
        await updateRolesMessage(interaction.guild);
        await interaction.reply({ content: `🗑️ Rôle **${nom}** supprimé.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `❌ Rôle **${nom}** introuvable ou non géré par le bot.`, ephemeral: true });
      }

    } else if (commandName === 'roles-setup') {
      const embed = new EmbedBuilder()
        .setTitle('🎮 Rôles de jeux disponibles')
        .setDescription(createdRoles.map(role => `${role.name}`).join('\n') || 'Aucun rôle disponible.')
        .setColor('Random');

      const rows = [];
      for (const role of createdRoles) {
        const button = new ButtonBuilder()
          .setCustomId(`toggle_role_${role.id}`)
          .setLabel(role.name)
          .setStyle(ButtonStyle.Secondary);
        rows.push(new ActionRowBuilder().addComponents(button));
      }

      const message = await interaction.channel.send({ embeds: [embed], components: rows });
      roleMessageData = {
        channelId: interaction.channel.id,
        messageId: message.id
      };
      saveRoleMessageData(roleMessageData);
      await interaction.reply({ content: '📌 Message de rôles créé et suivi !', ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    const roleId = interaction.customId.replace('toggle_role_', '');
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) return;

    const hasRole = interaction.member.roles.cache.has(roleId);
    if (hasRole) {
      await interaction.member.roles.remove(roleId);
      await interaction.reply({ content: `❌ Rôle **${role.name}** retiré.`, ephemeral: true });
    } else {
      await interaction.member.roles.add(roleId);
      await interaction.reply({ content: `✅ Rôle **${role.name}** ajouté.`, ephemeral: true });
    }
  }
});

// Register commands
const commands = [
  new SlashCommandBuilder()
    .setName('role-create')
    .setDescription('Créer un rôle jeu')
    .addStringOption(option => option.setName('nom').setDescription('Nom du jeu').setRequired(true))
    .addStringOption(option => option.setName('couleur').setDescription('Couleur hexadécimale du rôle').setRequired(false))
    .addStringOption(option => option.setName('icone').setDescription('Icône à afficher autour du nom').setRequired(false)),

  new SlashCommandBuilder()
    .setName('role-delete')
    .setDescription('Supprimer un rôle jeu')
    .addStringOption(option => option.setName('nom').setDescription('Nom complet du rôle').setRequired(true)),

  new SlashCommandBuilder()
    .setName('roles-setup')
    .setDescription('Créer ou mettre à jour le message de sélection de rôles')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log('🔄 Enregistrement des commandes slash...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Commandes enregistrées');
    client.login(TOKEN);
  } catch (error) {
    console.error(error);
  }
})();
