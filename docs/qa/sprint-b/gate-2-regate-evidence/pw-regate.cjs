// QA gate 2 re-gate: phone render of the fixed routes while signed out (login is still blocked).
// usage: node pw-regate.cjs <base-url>   (playwright-core 1.62 + cached Chromium 1208)
const { chromium } = require('/home/raish/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const base = process.argv[2] || 'http://localhost:3130';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
  for (const lang of ['en', 'gu']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addCookies([{ name: 'lang', value: lang, url: base }]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    for (const path of ['/buyers/new?from_inquiry=66666666-6666-4666-8666-666666666610', '/quotes/new?inquiry=66666666-6666-4666-8666-666666666610', '/inquiries/new']) {
      const resp = await page.goto(base + path, { waitUntil: 'networkidle' });
      const info = await page.evaluate(() => ({
        finalUrl: location.pathname,
        h1: document.querySelector('h1')?.textContent,
        htmlLang: document.documentElement.lang,
        horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        rawKeys: (document.body.innerText.match(/\b[a-z]+(?:\.[a-z_]+){1,}\b/g) || []).filter((s) => !s.includes('example')),
      }));
      console.log(JSON.stringify({ lang, path, status: resp && resp.status(), ...info }));
    }
    await page.screenshot({ path: `docs/qa/screenshots/gate-2-regate/redirect-login-${lang}.png` });
    console.log(JSON.stringify({ lang, consoleErrors: errors }));
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error('PW ERROR', e.message); process.exit(1); });
