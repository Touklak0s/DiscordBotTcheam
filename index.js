require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  EmbedBuilder, 
  Events 
} = require('discord.js');
const mysql = require('mysql2/promise');
const fs = require('fs');

// Client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Connexion MySQL
let db;
async function connectDB() {
  db = await mysql.createConnection({
    host     : process.env.MYSQLHOST,
    user     : process.env.MYSQLUSER,
    password : process.env.MYSQLPASSWORD,
    database : process.env.MYSQLDATABASE,
    port     : process.env.MYSQLPORT
  });
  console.log('✅ Connecté à la base de données MySQL');
}
connectDB();

// Gestion des couleurs
function parseColor(input) {
  const namedColors = {
    red    : 0xFF0000,
    green  : 0x00FF00,
    blue   : 0x0000FF,
    purple : 0x800080,
    pink   : 0xFFC0CB,
    yellow : 0xFFFF00,
    orange : 0xFFA500,
    black  : 0x000000,
    white  : 0xFFFFFF,
    gray   : 0x808080,
    brown  : 0xA52A2A,
    cyan   : 0x00FFFF,
    magenta: 0xFF00FF,
  };
  if (!input) return null;
  if (input.startsWith('#')) return parseInt(input.slice(1), 16);
  return namedColors[input.toLowerCase()] || null;
}

// Stockage message des rôles
let roleMessageData = null;
const saveData = (data) => fs.writeFileSync('./rolesMessage.json', JSON.stringify(data, null, 2));
const loadData = () => {
  if (fs.existsSync('./rolesMessage.json')) {
    roleMessageData = JSON.parse(fs.readFileSync('./rolesMessage.json'));
  }
};
loadData();

// Mettre à jour le message de rôles
async function updateRolesMessage(guild) {
  if (!roleMessageData) return;

  const channel = await guild.channels.fetch(roleMessageData.channelId).catch(() => null);
  if (!channel) return;

  const [rows] = await db.execute('SELECT * FROM roles');
  const rolesData = rows;

  const embed = new EmbedBuilder()
    .setTitle('🎮 Choisis tes jeux')
    .setDescription(rolesData.map(r => `${r.name}`).join('\n') || 'Aucun rôle.')
    .setColor(0x9c84ef);

  const components = [];
  let row = new ActionRowBuilder();
  rolesData.forEach((r, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`toggle_role_${r.id}`)
        .setLabel(r.name)
        .setStyle(ButtonStyle.Secondary)
    );
    if ((i + 1) % 5 === 0 || i === rolesData.length - 1) {
      components.push(row);
      row = new ActionRowBuilder();
    }
  });

  const message = await channel.messages.fetch(roleMessageData.messageId).catch(() => null);
  if (message) {
    await message.edit({ embeds: [embed], components });
  }
}

// Démarrage du bot
client.once('ready', () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);
});

// Interactions slash + boutons
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'role-create') {
      const nom      = interaction.options.getString('nom');
      const couleur  = interaction.options.getString('couleur');
      const icone    = interaction.options.getString('icone') || '';
      const roleName = `${icone} ${nom} ${icone}`.trim();

      const role = await interaction.guild.roles.create({
        name: roleName,
        color: parseColor(couleur) ?? 'Random',
        hoist: true,
        mentionable: true
      });
      
      await updateRolesMessage(interaction.guild);

      await db.execute('INSERT INTO roles (id, name, color, emoji) VALUES (?, ?, ?, ?)', [
        role.id, role.name, couleur || null, icone || null
      ]);

      await interaction.reply({ content: `✅ Rôle **${role.name}** créé !`, ephemeral: true });

    } else if (commandName === 'role-delete') {
      const nom = interaction.options.getString('nom');
      const role = interaction.guild.roles.cache.find(r => r.name === nom);
      if (!role) return interaction.reply({ content: '❌ Rôle introuvable.', ephemeral: true });

      await role.delete();
      await db.execute('DELETE FROM roles WHERE id = ?', [role.id]);
      await updateRolesMessage(interaction.guild);
      await interaction.reply({ content: `🗑️ Rôle **${nom}** supprimé.`, ephemeral: true });

    } else if (commandName === 'roles-setup') {
      const [rows] = await db.execute('SELECT * FROM roles');
      const rolesData = rows;

      const embed = new EmbedBuilder()
        .setTitle('🎮 Choisis tes jeux')
        .setDescription(rolesData.map(r => `${r.emoji || ''} ${r.name} ${r.emoji || ''}`).join('\n') || 'Aucun rôle.')
        .setColor('Random');

      const components = [];
      let row = new ActionRowBuilder();
      rolesData.forEach((r, i) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`toggle_role_${r.id}`)
            .setLabel(r.name)
            .setStyle(ButtonStyle.Secondary)
        );
        if ((i + 1) % 5 === 0 || i === rolesData.length - 1) {
          components.push(row);
          row = new ActionRowBuilder();
        }
      });

      const message = await interaction.channel.send({ embeds: [embed], components });
      roleMessageData = {
        channelId: interaction.channel.id,
        messageId: message.id
      };
      saveData(roleMessageData);

      await interaction.reply({ content: '📌 Message de rôles configuré !', ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    try {
      const roleId = interaction.customId.replace('toggle_role_', '');
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.reply({ 
        content: `❌ Une erreur est survenue. ID du rôle manquant ou invalide : ${interaction.customId.replace('toggle_role_', '')}`, 
        ephemeral: true 
      });
  
      const member = interaction.member;
      const hasRole = member.roles.cache.has(roleId);
  
      if (hasRole) {
        await member.roles.remove(roleId);
        await interaction.reply({ content: `❌ Rôle **${role.name}** retiré.`, ephemeral: true });
      } else {
        await member.roles.add(roleId);
        await interaction.reply({ content: `✅ Rôle **${role.name}** ajouté.`, ephemeral: true });
      }
    } catch (error) {
      console.error('Erreur interaction bouton :', error);
      if (!interaction.replied) {
        await interaction.reply({ 
          content: `❌ Une erreur est survenue. ID du rôle manquant ou invalide : ${interaction.customId.replace('toggle_role_', '')}`, 
          ephemeral: true 
        });
      }
    }
  }
  
});

// Enregistrement des commandes
const commands = [
  new SlashCommandBuilder()
    .setName('role-create')
    .setDescription('Créer un rôle jeu')
    .addStringOption(opt => opt.setName('nom').setDescription('Nom du jeu').setRequired(true))
    .addStringOption(opt => opt.setName('couleur').setDescription('Couleur (hex ou nom)').setRequired(false))
    .addStringOption(opt => opt.setName('icone').setDescription('Emoji décoratif').setRequired(false)),
  new SlashCommandBuilder()
    .setName('role-delete')
    .setDescription('Supprimer un rôle jeu')
    .addStringOption(opt => opt.setName('nom').setDescription('Nom exact du rôle à supprimer').setRequired(true)),
  new SlashCommandBuilder()
    .setName('roles-setup')
    .setDescription('Créer le message pour gérer les rôles')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Commandes slash enregistrées.');
    client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('Erreur lors de l’enregistrement des commandes :', error);
  }
})();
