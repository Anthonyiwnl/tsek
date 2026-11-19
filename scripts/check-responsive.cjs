/* Optional browser acceptance check. See docs/evidence/247/README.md. */
const { createRequire } = require('node:module');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = (process.env.PLAYWRIGHT_PACKAGE_JSON ? createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON) : require)('playwright');
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5247';
const out = path.resolve(__dirname, '../docs/evidence/247');
const ticket = '/tests/fixtures/ticket-preview.html';
const staff = '/tests/fixtures/staff-preview.html';
const scenes = [
  ['landing', '/', 'h1'],
  ['sign-in', '/#/applications', '.queue-sign-in-form'],
  ['password-setup', '/#/password-setup', '.password-setup'],
  ['overview', ticket + '?list', '.overview-records article'],
  ['ticket', ticket, '.requirement-row'],
  ['documents', ticket + '?documents', '.analysis-toggle', async p => { await p.locator('.analysis-toggle').click(); }],
  ['submitted', ticket + '?status=submitted&documents', '.review-state'],
  ['approved', ticket + '?status=approved&documents', '.review-state'],
  ['rejected', ticket + '?status=rejected&documents', '.review-state'],
  ['new-application', ticket + '?list', '.overview-records', async p => { await p.getByRole('button', { name: 'New application' }).click(); await p.locator('dialog[open]').waitFor(); }],
  ['edit-draft', ticket, '.requirement-row', async p => { await p.getByRole('button', { name: 'Edit draft' }).click(); await p.locator('dialog[open]').waitFor(); }],
  ['delete-draft', ticket, '.requirement-row', async p => { await p.getByRole('button', { name: 'Delete draft', exact: true }).click(); await p.locator('dialog[open]').waitFor(); }],
  ['empty', ticket + '?list&state=empty', '.overview-summary'],
  ['error', ticket + '?list&state=error', '[role=alert]'],
  ['loading', ticket + '?list&state=loading', '[role=status]'],
  ['staff-queue', staff, '.staff-table tbody tr'],
  ['staff', staff, '.staff-table tbody tr', async p => { await p.getByRole('button', { name: 'Open application' }).first().click(); await p.getByRole('heading', { name: 'Staff decision' }).waitFor(); }],
];
const capture = new Set(['landing', 'sign-in', 'overview', 'ticket', 'documents', 'new-application', 'staff-queue', 'staff']);
(async () => {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const results = [];
  try {
    for (const width of [390, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route('https://auth.example.test/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
      for (const [name, url, ready, prepare] of scenes) {
        await page.goto(base + url);
        await page.locator(ready).first().waitFor();
        if (prepare) await prepare(page);
        await page.evaluate(() => document.fonts.ready);
        const result = await page.evaluate(() => {
          const root = document.querySelector('dialog[open]') || document;
          const shortTargets = [...root.querySelectorAll('button,a[href],input,select,textarea,summary')].filter(e => {
            const target = e.matches('input[type=checkbox]') ? e.closest('label') || e : e;
            const r = target.getBoundingClientRect();
            return e.checkVisibility() && r.width > 0 && r.height > 0 && (r.width < 39.5 || r.height < 39.5);
          }).map(e => ({ element: e.tagName, text: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 50), class: e.className }));
          const overflow = [...document.querySelectorAll('body *')].filter(e => {
            const r = e.getBoundingClientRect();
            return e.checkVisibility() && r.width > 0 && r.right > innerWidth + 1;
          }).slice(0, 8).map(e => e.className || e.tagName);
          const scrollContainers = [...document.querySelectorAll('body *')].filter(e => e.checkVisibility() && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowX)).map(e => e.className || e.tagName);
          return { scrollWidth: document.documentElement.scrollWidth, overflow, shortTargets, scrollContainers };
        });
        results.push({ name, width, ...result });
        if (width !== 1440 && capture.has(name)) await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true });
        // Exercise the real narrow-header controls and keyboard dismissal.
        if (width === 390 && name === 'overview') {
          const toggle = page.getByRole('button', { name: 'Workspace menu' });
          assert.equal(await page.getByRole('link', { name: 'Admin records' }).isVisible(), false);
          await toggle.click();
          await page.keyboard.press('Tab');
          assert.equal(await page.getByRole('link', { name: 'My applications', exact: true }).evaluate(e => e === document.activeElement), true);
          assert.equal(await page.getByRole('button', { name: 'Sign out' }).isVisible(), true);
          await page.getByRole('link', { name: 'Admin records' }).focus();
          await page.keyboard.press('Escape');
          assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
          assert.equal(await toggle.evaluate(e => e === document.activeElement), true);
        }
        if (width === 390 && name === 'landing') {
          await page.getByLabel('Navigation menu').click();
          await page.locator('.queue-mobile-menu a[href="#services"]').click();
          assert.equal(await page.locator('.queue-mobile-menu').getAttribute('open'), null);
        }
      }
      await page.close();
    }
    writeFileSync(path.join(out, 'measurements.json'), JSON.stringify(results, null, 2) + '\n');
    const failures = results.filter(r => r.scrollWidth > r.width || r.overflow.length || r.shortTargets.length || r.scrollContainers.length);
    console.log(JSON.stringify({ scenarios: results.length, failures }, null, 2));
    assert.equal(failures.length, 0, 'Responsive acceptance failures');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
