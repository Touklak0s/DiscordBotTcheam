const { SlashCommandBuilder } = require('discord.js');
const puppeteer = require('puppeteer');

module.exports = {
  data: [
    new SlashCommandBuilder()
      .setName('aternos-start')
      .setDescription('Démarre le serveur Aternos'),
    new SlashCommandBuilder()
      .setName('aternos-stop')
      .setDescription('Arrête le serveur Aternos')
  ],

  async execute(interaction, client) {
    const db      = client.db;
    const command = interaction.commandName;
    const guildId = 1;

    const [rows] = await db.execute('SELECT * FROM aternos WHERE id = ?', [guildId]);
    if (!rows.length) {
      return interaction.reply({ content: '⚠️ Le serveur Aternos n’a pas encore été configuré.', ephemeral: true });
    }

    const { email, password, server_name } = rows[0];
    await interaction.reply({ content: `⏳ Tentative de ${command === 'aternos-start' ? 'démarrage' : 'arrêt'} du serveur Aternos...`, ephemeral: true });

    try {
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      await page.goto('https://aternos.org/go/', { waitUntil: 'networkidle2' });

      await page.type('#user', email);
      await page.type('#password', password);
      await page.click('#login');

      await page.waitForNavigation();
      await page.goto(`https://aternos.org/server/`, { waitUntil: 'networkidle2' });

      // Vérifier et cliquer sur le bouton
      const buttonSelector = command === 'aternos-start' ? '.server-start' : '.server-stop';

      await page.waitForSelector(buttonSelector, { timeout: 10000 });
      await page.click(buttonSelector);

      await browser.close();

      await interaction.followUp({ content: `✅ Serveur **${server_name}** en cours de ${command === 'aternos-start' ? 'démarrage' : 'fermeture'}.`, ephemeral: true });
    } catch (err) {
      console.error('Erreur Puppeteer :', err);
      await interaction.followUp({ content: '❌ Une erreur est survenue lors de l’automatisation.', ephemeral: true });
    }
  }
};
