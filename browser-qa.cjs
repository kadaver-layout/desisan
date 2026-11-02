const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const qaRequire = createRequire(process.env.TEMP + '/desisan-browser-qa/package.json');
const { chromium } = qaRequire('playwright');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const pages = fs.readdirSync('dist').filter(name => name.endsWith('.html'));
  for (const name of pages) for (const width of [1920, 1280, 1024, 768, 480, 360, 320]) {
    errors.length = 0;
    if (await page.locator('#mobile-menu[open]').count()) {
      await page.evaluate(() => document.getElementById('mobile-menu').close());
      await page.waitForFunction(() => !history.state?.desisanMenu);
    }
    await page.setViewportSize({ width, height: 900 });
    await page.goto(pathToFileURL(process.cwd() + '/dist/' + name).href);
    // Проверяем после загрузки шрифтов и пересчёта ResizeObserver шапки.
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    const result = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, items: document.querySelectorAll('article.cart-item').length, brokenImages: [...document.images].filter(image => !image.closest('[hidden]') && image.complete && !image.naturalWidth).map(image => image.getAttribute('src')), duplicateIds: [...new Set([...document.querySelectorAll('[id]')].map(node => node.id).filter((id, index, all) => all.indexOf(id) !== index))] }));
    if (result.documentWidth > width || errors.length || result.brokenImages.length || result.duplicateIds.length) console.log(JSON.stringify({name,...result,errors:[...errors]}));
  }
  console.log('Checked ' + pages.length + ' pages at 7 widths.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
