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

      // Browserless
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      // Page de connexion

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


      // Page des serveurs 

        // Accepte les cookies 'fc-button-label'
          await page.waitForSelector('.fc-button-label', { visible: true, timeout: 30000 }).catch(() => null);
          await page.click('.fc-button-label');

        // trouve le serveur par son nom dans un .server-name
          // Trouve le serveur par son nom dans un .server-name
          await page.waitForSelector('div.server-name', { visible: true, timeout: 30000 });

          const serverElementHandle = await page.$$eval('div.server-name', (elements, server_name) => {
            const el = elements.find(e => e.textContent.trim() === server_name);
            if (el) {
              el.scrollIntoView();
              return el.getAttribute('data-server-id') || el.innerText; // Just to return something non-null
            }
            return null;
          }, server_name);

          if (!serverElementHandle) {
            await browser.close();
            return interaction.followUp({ content: `❌ Serveur **${server_name}** introuvable.`, ephemeral: true });
          }

          // Clique sur le serveur correspondant
          const serverElements = await page.$$('div.server-name');
          for (const el of serverElements) {
            const text = await (await el.getProperty('textContent')).jsonValue();
            if (text.trim() === server_name) {
              await el.click();
              break;
            }
          }
          
          await page.waitForNavigation({ waitUntil: 'networkidle2' });

      //Page de démarrage/arrêt
          // si .btn-success est visible, alors le serveur est démarré -> on le stoppe (command === 'aternos-stop')
          // Sinon si le .btn-danger est visible, alors le serveur arrêté -> on le démarre (command === 'aternos-start')
          const buttonSelector = command === 'aternos-start' ? '.btn-danger' : '.btn-success';
          await page.waitForSelector(buttonSelector, { visible: true, timeout: 30000 });
          const button = await page.$(buttonSelector);
          if (!button) {
            await browser.close();
            return interaction.followUp({ content: `❌ Impossible de trouver le bouton pour ${command === 'aternos-start' ? 'démarrer' : 'arrêter'} le serveur.`, ephemeral: true });
          }
          await button.click();
          await page.waitForTimeout(2000); // Attendre un peu pour que l'action soit prise en compte
          // Vérifier si le serveur est en cours de démarrage ou d'arrêt
          const statusSelector = command === 'aternos-start' ? '.btn-danger' : '.btn-success';
          await page.waitForSelector(statusSelector, { visible: true, timeout: 30000 });
          const statusButton = await page.$(statusSelector);
          if (!statusButton) {
            await browser.close();
            return interaction.followUp({ content: `❌ Impossible de ${command === 'aternos-start' ? 'démarrer' : 'arrêter'} le serveur.`, ephemeral: true });
          }
          await page.waitForTimeout(2000); // Attendre un peu pour que l'action soit prise en compte
          // Vérifier si le serveur est en cours de démarrage ou d'arrêt
          // const statusText = await (await statusButton.getProperty('textContent')).jsonValue(); 
          
          


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