// QA gate 3: phone render (390 x 844, DPR 2, touch) of the signed-out pages. Login is still blocked
// (no Supabase), so this covers /login (en, gu, Try as on / off), /not-found, F2, F3, F4, F6 and favicon.
// usage: node pw-gate3.cjs <base-url> <mode>   mode = demo-on | demo-off
// playwright-core 1.62 (npx cache) + cached Chromium 1208, as in the Sprint B re-gate.
const { chromium } = require('/home/raish/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const base = process.argv[2] || 'http://localhost:3140';
const mode = process.argv[3] || 'demo-on';
const OUT = '/home/raish/raish/mahua-crm/docs/qa/screenshots/gate-3';

async function facts(page) {
  return page.evaluate(() => {
    const seg = Array.from(document.querySelectorAll('[role="radiogroup"] [role="radio"]')).map((b) => {
      const r = b.getBoundingClientRect();
      return { text: b.textContent.trim(), h: Math.round(r.height * 10) / 10, w: Math.round(r.width * 10) / 10 };
    });
    const tryAs = Array.from(document.querySelectorAll('button')).filter((b) => b.className.includes('h-[72px]')).map((b) => ({ text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height) }));
    const buttons = Array.from(document.querySelectorAll('button, a[href], input')).filter((el) => el.offsetParent !== null && el.type !== 'hidden').map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), label: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('type') || '').trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) };
    });
    const bodyCs = getComputedStyle(document.body);
    return {
      path: location.pathname,
      htmlLang: document.documentElement.lang,
      title: document.title,
      h1: document.querySelector('h1')?.textContent,
      tryAsHeading: /Try as|આ રીતે/.test(document.body.innerText) ? 'present' : 'absent',
      tryAsButtons: tryAs,
      langSegments: seg,
      passwordIds: document.querySelectorAll('#password').length,
      formNoValidate: document.querySelector('form')?.noValidate ?? null,
      bodyFontSize: bodyCs.fontSize,
      bodyLineHeight: bodyCs.lineHeight,
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      rawKeys: (document.body.innerText.match(/\b[a-z]+(?:\.[a-z_]+){1,}\b/g) || []).filter((s) => !s.includes('example') && !s.endsWith('.com')),
      smallTargets: buttons.filter((b) => b.h < 44 || b.w < 44),
      faviconLinks: Array.from(document.querySelectorAll('link[rel~="icon"]')).map((l) => l.getAttribute('href')),
    };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
  const langs = mode === 'demo-on' ? ['en', 'gu'] : ['en'];
  for (const lang of langs) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addCookies([{ name: 'lang', value: lang, url: base }]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errors.push('pageerror ' + e.message));

    const resp = await page.goto(base + '/login', { waitUntil: 'networkidle' });
    const f = await facts(page);
    console.log(JSON.stringify({ mode, lang, status: resp && resp.status(), ...f }));
    const shot = mode === 'demo-on' ? `login-${lang}.png` : 'login-demo-off.png';
    await page.screenshot({ path: `${OUT}/${shot}`, fullPage: true });
    console.log(`screenshot ${shot}`);

    if (mode === 'demo-on') {
      // F6: Sign in with both fields empty -> our own 'required' words under each field, no browser bubble.
      await page.locator('form button[type="submit"]').click();
      await page.waitForTimeout(300);
      const req = await page.evaluate(() => ({
        errorsUnderFields: Array.from(document.querySelectorAll('[id$="-error"]')).map((e) => `${e.id}: ${e.textContent.trim()}`),
        ariaInvalid: Array.from(document.querySelectorAll('[aria-invalid="true"]')).map((e) => e.id),
        url: location.pathname,
      }));
      console.log(JSON.stringify({ mode, lang, F6_after_empty_submit: req }));
      await page.screenshot({ path: `${OUT}/login-${lang}-required.png`, fullPage: true });
      console.log(`screenshot login-${lang}-required.png`);

      // Try as without Supabase: the server action must answer with a plain message, not crash.
      const firstTry = page.locator('button.h-\\[72px\\]').first();
      if (await firstTry.count()) {
        await firstTry.click();
        await page.waitForTimeout(2500);
        const alert = await page.locator('[role="alert"]').allTextContents();
        console.log(JSON.stringify({ mode, lang, tryAsOwnerWithoutSupabase: { alert, url: await page.evaluate(() => location.pathname) } }));
        await page.screenshot({ path: `${OUT}/login-${lang}-tryas-offline.png`, fullPage: true });
        console.log(`screenshot login-${lang}-tryas-offline.png`);
      }

      const nf = await page.goto(base + '/no-such-page', { waitUntil: 'networkidle' });
      const nff = await page.evaluate(() => ({
        path: location.pathname, h1: document.querySelector('h1')?.textContent, text: document.body.innerText.slice(0, 200).replace(/\n+/g, ' | '),
        links: Array.from(document.querySelectorAll('a')).map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), h: Math.round(a.getBoundingClientRect().height) })),
        horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        rawKeys: (document.body.innerText.match(/\b[a-z]+(?:\.[a-z_]+){1,}\b/g) || []),
      }));
      console.log(JSON.stringify({ mode, lang, notFound: { status: nf && nf.status(), ...nff } }));
      await page.screenshot({ path: `${OUT}/not-found-${lang}.png`, fullPage: true });
      console.log(`screenshot not-found-${lang}.png`);

      const fav = await page.goto(base + '/favicon.ico');
      console.log(JSON.stringify({ favicon: { status: fav.status(), type: fav.headers()['content-type'] } }));
    }
    console.log(JSON.stringify({ mode, lang, consoleErrors: errors }));
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error('PW ERROR', e.message); process.exit(1); });
