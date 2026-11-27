// Run with Playwright available in NODE_PATH; no runtime dependency is added.
// Source: the existing TSEK ribbon SVG and Queue Ticket tokens/components.
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const publicDir = resolve(__dirname, '../../frontend/public');
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(resolve(__dirname, 'social-preview.html')).href);
    await page.evaluate(() => document.fonts.ready);
    if (!await page.evaluate(() => document.fonts.check('700 62px Sora'))) throw new Error('Sora font failed to load');
    await page.screenshot({ path: resolve(publicDir, 'og-image.png') });
    const svg = readFileSync(resolve(publicDir, 'favicon.svg'), 'utf8');
    for (const [name, size, padding] of [
      ['favicon-32.png', 32, 0], ['apple-touch-icon.png', 180, 24],
      ['icon-192.png', 192, 26], ['icon-512.png', 512, 68],
      ['icon-maskable-512.png', 512, 112],
    ]) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<style>body{margin:0;background:#e9eff4;width:${size}px;height:${size}px;display:grid;place-items:center}svg{width:${size-padding*2}px;height:${size-padding*2}px}</style>${svg}`);
      await page.screenshot({ path: resolve(publicDir, name) });
    }
  } finally { await browser.close(); }
})();

