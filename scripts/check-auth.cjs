/* Optional browser acceptance: run Vite with VITE_NEON_AUTH_URL=https://auth.example.test/auth. */
const { createRequire } = require('node:module');
const { mkdirSync, mkdtempSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = (process.env.PLAYWRIGHT_PACKAGE_JSON ? createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON) : require)('playwright');
const base = process.env.AUTH_BASE_URL || 'http://127.0.0.1:5230';
const out = process.env.AUTH_EVIDENCE_DIR || mkdtempSync(path.join(require('node:os').tmpdir(), 'tsek-auth-evidence-'));
(async () => {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 960 } });
      const requests = [];
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://auth.example.test/**', route => {
        const endpoint = new URL(route.request().url()).pathname;
        requests.push(endpoint);
        const body = endpoint.endsWith('/get-session') ? null
          : endpoint.endsWith('/sign-up/email') ? { token: null, user: { id: 'synthetic-user', name: 'Synthetic Citizen', email: 'citizen@example.test', emailVerified: false } }
            : { status: true };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(base + '/login');
      await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
      await page.getByRole('button', { name: 'New to TSEK? Create an account' }).click();
      await page.getByLabel('Full name').fill('Synthetic Citizen');
      await page.getByLabel('Email', { exact: true }).fill('citizen@example.test');
      await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
      for (const scene of ['signup', 'verification']) {
        if (scene === 'verification') {
          await page.getByRole('button', { name: 'Create account', exact: true }).click();
          await page.getByRole('heading', { name: 'Check your inbox' }).waitFor();
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${scene} overflow at ${width}`);
        if (width === 390 || width === 1440) await page.screenshot({ path: path.join(out, `${scene}-${width}.png`), fullPage: true });
        results.push({ width, scene, overflow: false });
      }
      await page.getByRole('button', { name: 'Send a new verification code' }).click();
      await page.getByRole('status').filter({ hasText: 'new verification code' }).waitFor();
      await page.getByLabel('Email verification code').fill('123456');
      await page.getByRole('button', { name: 'Verify email code' }).click();
      await page.getByRole('heading', { name: 'Sign in to your applications' }).waitFor();
      assert(requests.some(url => url.endsWith('/email-otp/send-verification-otp')));
      assert(requests.some(url => url.endsWith('/email-otp/verify-email')));
      assert.deepEqual(errors, []);
      await page.getByRole('link', { name: 'Back to home' }).click();
      await page.locator('.queue-hero').waitFor();
      await page.close();
    }
    writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ passed: results.length, evidence: out }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
