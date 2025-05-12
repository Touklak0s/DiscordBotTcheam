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
      return interaction.reply({ content: '⚠️ Le serveur Aternos n’a pas encore été configuré.', flags: 1 << 6 });
    }

    const { email, password, server_name } = rows[0];
    await interaction.reply({ content: `⏳ Tentative de ${command === 'aternos-start' ? 'démarrage' : 'arrêt'} du serveur Aternos...`, flags: 1 << 6 });

    try {
       const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
       });      const page = await browser.newPage();

      await page.goto('https://aternos.org/go/', { waitUntil: 'networkidle2' });

      // Remplir le formulaire avec les nouveaux sélecteurs
      await page.waitForSelector('input.username');
      await page.type('input.username', email);
      await page.type('input.password', password);
      
      // Soumettre le formulaire
      await page.click('button.login-button');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      await page.goto(`https://aternos.org/server/`, { waitUntil: 'networkidle2' });

      // Vérifier et cliquer sur le bouton
      const buttonSelector = command === 'aternos-start' ? '.server-start' : '.server-stop';

      await page.waitForSelector(buttonSelector, { timeout: 10000 });
      await page.click(buttonSelector);

      await browser.close();

      await interaction.followUp({ content: `✅ Serveur **${server_name}** en cours de ${command === 'aternos-start' ? 'démarrage' : 'fermeture'}.`, flags: 1 << 6 });
    } catch (err) {
      console.error('Erreur Puppeteer :', err);
      await interaction.followUp({ content: '❌ Une erreur est survenue lors de l’automatisation.', flags: 1 << 6 });
    }
  }
};
