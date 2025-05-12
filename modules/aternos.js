const { SlashCommandBuilder } = require('discord.js');
const puppeteer = require('puppeteer');

module.exports = {
  data: [
    new SlashCommandBuilder().setName('aternos-start').setDescription('Démarre le serveur Aternos'),
    new SlashCommandBuilder().setName('aternos-stop').setDescription('Arrête le serveur Aternos')
  ],

  async execute(interaction, client) {
    const db = client.db;
    const command = interaction.commandName;
    const guildId = 1;

    const [rows] = await db.execute('SELECT * FROM aternos WHERE id = ?', [guildId]);
    if (!rows.length) {
      return interaction.reply({ content: '⚠️ Aucune configuration Aternos trouvée.', ephemeral: true });
    }

    const { email, password, server_name } = rows[0];
    await interaction.reply({ content: `⏳ Connexion à Aternos pour ${command === 'aternos-start' ? 'démarrer' : 'arrêter'} le serveur...`, ephemeral: true });

    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );

      await page.goto('https://aternos.org/go/', { waitUntil: 'networkidle2' });

      // Screenshot pour debug
      const debugShot = await page.screenshot({ type: 'png', fullPage: true });
      await interaction.followUp({
        content: '📸 Page après chargement de /go :',
        files: [{ attachment: debugShot, name: 'aternos_debug.png' }],
        ephemeral: true
      });

      await page.waitForSelector('input[name="user"]', { timeout: 30000 });
      await page.type('input[name="user"]', email);
      await page.type('input[name="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      await page.goto('https://aternos.org/server/', { waitUntil: 'networkidle2' });

      const selector = command === 'aternos-start' ? '.server-start' : '.server-stop';
      await page.waitForSelector(selector, { timeout: 10000 });
      await page.click(selector);

      await browser.close();

      await interaction.followUp({
        content: `✅ Serveur **${server_name}** ${command === 'aternos-start' ? 'en cours de démarrage' : 'en arrêt'}.`,
        ephemeral: true
      });
    } catch (err) {
      console.error('Erreur Puppeteer :', err);
      await interaction.followUp({ content: '❌ Erreur lors du traitement Aternos.', ephemeral: true });
    }
  }
};