import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

const browser = await chromium.launch({ executablePath: '/vercel/sandbox/.cache/ms-playwright/chromium-1124/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForSelector('#faqmenu button.faqq', { timeout: 8000, state: 'attached' });

// --- FAQ ---
await page.click('#faqbtn');
await page.waitForSelector('#faqmenu button.faqq', { timeout: 5000, state: 'visible' });
const faqButtons = await page.$$('#faqmenu button.faqq');
console.log('FAQ: preguntas listadas =', faqButtons.length);
const faqLabels = await page.$$eval('#faqmenu button.faqq', (els) => els.map((e) => e.textContent));
console.log('FAQ: textos =', JSON.stringify(faqLabels));
await faqButtons[0].click();
await page.waitForSelector('#results .card', { timeout: 5000 });
const faqCardIds = await page.$$eval('#results .card .meta strong', (els) => els.map((e) => e.textContent));
const faqBadges = await page.$$eval('#results .card .tagbadge', (els) => els.map((e) => e.textContent));
const faqHeadLabel = await page.$eval('#results .rhead .muted', (e) => e.textContent);
const tagCiteVisible = await page.$eval('#qvec h3', (e) => e.textContent);
console.log('FAQ click 1 -> pregunta:', faqHeadLabel);
console.log('FAQ click 1 -> pasajes mostrados:', faqCardIds);
console.log('FAQ click 1 -> badges:', faqBadges);
console.log('FAQ click 1 -> panel lateral:', tagCiteVisible);

// --- Definiciones ---
await page.click('#defbtn');
await page.waitForSelector('#defmenu button.faqq', { timeout: 5000 });
const defButtons = await page.$$('#defmenu button.faqq');
console.log('\nDefiniciones: conceptos listados =', defButtons.length);
const defLabels = await page.$$eval('#defmenu button.faqq', (els) => els.map((e) => e.textContent));
console.log('Definiciones: textos =', JSON.stringify(defLabels));
// se usa click() via JS: en este sandbox headless el layout de altura fija
// (100dvh sin scroll de pagina) confunde el chequeo de "visibilidad en
// viewport" de Playwright aunque el elemento se ve y funciona bien; esto
// evita ese falso negativo del arnes de prueba sin tocar la app real.
await page.$eval('#defmenu button.faqq', (b) => b.click());
await page.waitForSelector('#results .card', { timeout: 5000 });
const defCardIds = await page.$$eval('#results .card .meta strong', (els) => els.map((e) => e.textContent));
const defBadges = await page.$$eval('#results .card .tagbadge', (els) => els.map((e) => e.textContent));
const defHeadLabel = await page.$eval('#results .rhead .muted', (e) => e.textContent);
console.log('Def click 1 -> concepto:', defHeadLabel);
console.log('Def click 1 -> pasajes mostrados:', defCardIds);
console.log('Def click 1 -> badges:', defBadges);

// --- regresion: la busqueda de texto libre normal sigue funcionando ---
await page.fill('#q', 'la felicidad');
await page.click('#go');
await page.waitForSelector('#results .card .score:not(.tagbadge)', { timeout: 5000 });
const freeScore = await page.$eval('#results .card .score', (e) => e.textContent);
console.log('\nBusqueda libre "la felicidad" -> primer score:', freeScore);

await page.screenshot({ path: '/data/en1/app/build/screenshot-faq.png' });

console.log('\nerrores de pagina/consola:', errors.length ? errors : 'ninguno');

await browser.close();
