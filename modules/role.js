const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { parseColor } = require('../utils/color');

const dataFile = path.join(__dirname, '../../rolesMessage.json');

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function loadData() {
  if (fs.existsSync(dataFile)) {
    return JSON.parse(fs.readFileSync(dataFile));
  }
  return null;
}

async function updateRolesMessage(guild, db) {
  const roleMessageData = loadData();
  if (!roleMessageData) return;

  const channel = await guild.channels.fetch(roleMessageData.channelId).catch(() => null);
  if (!channel) return;

  const [rows] = await db.execute('SELECT * FROM roletroismerde');
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
        .setCustomId(`toggle_role_${r.role_id}`)
        .setLabel(r.name)
        .setStyle(ButtonStyle.Secondary)
    );
    if ((i + 1) % 5 === 0 || i === rolesData.length - 1) {
      components.push(row);
      row = new ActionRowBuilder();
    }
  });

  const message = await channel.messages.fetch(roleMessageData.messageId).catch(() => null);
  if (message) await message.edit({ embeds: [embed], components });
}

module.exports = {
  data: [
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
  ],

  async execute(interaction, client) {
    const db = client.db;
    const commandName = interaction.commandName;

    if (commandName === 'role-create') {
      const nom = interaction.options.getString('nom');
      const couleur = interaction.options.getString('couleur');
      const icone = interaction.options.getString('icone') || '';
      const roleName = `${icone} ${nom} ${icone}`.trim();

      const role = await interaction.guild.roles.create({
        name: roleName,
        color: parseColor(couleur) ?? 'Random',
        hoist: true,
        mentionable: true
      });

      await db.execute('INSERT INTO roletroismerde (id, name, color, emoji, role_id) VALUES (?, ?, ?, ?, ?)', [
        role.id, role.name, couleur || null, icone || null, role.id
      ]);

      await updateRolesMessage(interaction.guild, db);
      await interaction.reply({ content: `✅ Rôle **${role.name}** créé !`, ephemeral: true });
    }

    if (commandName === 'role-delete') {
      const nom = interaction.options.getString('nom');
      const role = interaction.guild.roles.cache.find(r => r.name === nom);
      if (!role) return interaction.reply({ content: '❌ Rôle introuvable.', ephemeral: true });

      await role.delete();
      await db.execute('DELETE FROM roletroismerde WHERE role_id = ?', [role.id]);
      await updateRolesMessage(interaction.guild, db);
      await interaction.reply({ content: `🗑️ Rôle **${nom}** supprimé.`, ephemeral: true });
    }

    if (commandName === 'roles-setup') {
      const [rows] = await db.execute('SELECT * FROM roletroismerde');
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
            .setCustomId(`toggle_role_${r.role_id}`)
            .setLabel(r.name)
            .setStyle(ButtonStyle.Secondary)
        );
        if ((i + 1) % 5 === 0 || i === rolesData.length - 1) {
          components.push(row);
          row = new ActionRowBuilder();
        }
      });

      const message = await interaction.channel.send({ embeds: [embed], components });
      const roleMessageData = { channelId: interaction.channel.id, messageId: message.id };
      saveData(roleMessageData);
      await interaction.reply({ content: '📌 Message de rôles configuré !', ephemeral: true });
    }
  },

  async handleButton(interaction) {
    const roleId = interaction.customId.replace('toggle_role_', '');
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) {
      return interaction.reply({ content: `❌ Rôle introuvable : ${roleId}`, ephemeral: true });
    }

    const member = interaction.member;
    const hasRole = member.roles.cache.has(roleId);

    if (hasRole) {
      await member.roles.remove(roleId);
      await interaction.reply({ content: `❌ Rôle **${role.name}** retiré.`, ephemeral: true });
    } else {
      await member.roles.add(roleId);
      await interaction.reply({ content: `✅ Rôle **${role.name}** ajouté.`, ephemeral: true });
    }
  }
};