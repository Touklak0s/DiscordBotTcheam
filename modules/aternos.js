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

    const { username, password, server_name } = rows[0];
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

      await page.waitForSelector('input.username', { visible: true, timeout: 30000 });
      await page.type('input.username', username);
      await page.type('input.password', password);
      await page.click('button.login-button');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      await page.goto('https://aternos.org/servers/', { waitUntil: 'networkidle2' });

      // trouve le serveur par son nom dans un .server-name
        const serverSelector = `div.server-name:contains("${server_name}")`;
        await page.waitForSelector(serverSelector, { timeout: 10000 });
        const serverElement = await page.$(serverSelector);
        if (!serverElement) {
          await browser.close();
          return interaction.followUp({ content: `❌ Serveur **${server_name}** introuvable.`, ephemeral: true });
        }
        await serverElement.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

      // clique sur le bouton de démarrage ou d'arrêt
      // si #start visible => clic sur #start pour démarrer le serveur, sinon clic sur #stop pour arrêter le serveur

        // const startButton = await page.$('#start');
        // const stopButton  = await page.$('#stop');

        // if (command === 'aternos-start' && startButton) {
        //   await startButton.click();
        // } else if (command === 'aternos-stop' && stopButton) {
        //   await stopButton.click();
        // } else {
        //   await browser.close();
        //   return interaction.followUp({ content: `❌ Le serveur **${server_name}** est déjà ${command === 'aternos-start' ? 'démarré' : 'arrêté'}.`, ephemeral: true });
        // }

      const selector = command === 'aternos-start' ? '#start' : '#stop';
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