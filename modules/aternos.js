const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();

// Définir un user-agent pour passer Cloudflare
await page.setUserAgent(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
);

// Aller à la page de login
await page.goto('https://aternos.org/go/', { waitUntil: 'networkidle2' });
const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
await interaction.followUp({
  content: '🖼️ Voici la page capturée (debug) :',
  files: [{ attachment: buffer, name: 'page.png' }],
  ephemeral: true
});

// Essayons l'ancien sélecteur fiable
await page.waitForSelector('input[name="user"]', { timeout: 30000 });
await page.type('input[name="user"]', email);
await page.type('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForNavigation({ waitUntil: 'networkidle2' });

// Suite normale
await page.goto('https://aternos.org/server/', { waitUntil: 'networkidle2' });

const selector = command === 'aternos-start' ? '.server-start' : '.server-stop';
await page.waitForSelector(selector, { timeout: 10000 });
await page.click(selector);

await browser.close();
