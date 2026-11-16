// Signed-in walkthrough against hosted Supabase: Try as each role at 390x844, visit the role's pages.
// Usage: node docs/qa/sprint-c/hosted-walkthrough.cjs http://localhost:3150
const { chromium } = require('/home/raish/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const BASE = process.argv[2] || 'http://localhost:3150';
const OUT = __dirname + '/../screenshots/hosted';
const ROLES = {
  Owner: ['/', '/inquiries', '/quotes', '/orders', '/payments', '/catalog', '/users', '/settings'],
  Accounts: ['/', '/payments', '/payments/new', '/orders'],
  Sales: ['/', '/inquiries', '/inquiries/new', '/buyers', '/samples', '/quotes/new'],
  Plant: ['/', '/orders', '/buyers'],
};
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/snap/bin/chromium' });
  let fails = 0;
  for (const [role, paths] of Object.entries(ROLES)) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 160)));
    await page.goto(BASE + '/login');
    await page.getByRole('button', { name: new RegExp('^' + role + '$') }).click();
    try { await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }); }
    catch { console.log(`FAIL ${role}: still on /login: ${(await page.innerText('body')).slice(0, 200).replace(/\n/g, ' | ')}`); fails++; await ctx.close(); continue; }
    for (const p of paths) {
      const r = await page.goto(BASE + p);
      const url = new URL(page.url()).pathname;
      const text = await page.innerText('body');
      const bad = /Something went wrong|Could not load|Application error|Access denied/i.test(text);
      const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const money = role === 'Plant' && /₹|\$\d|Money due|Balance/.test(text);
      const ok = r.status() < 400 && !bad && !hscroll && !money && url !== '/login';
      if (!ok) fails++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${role.padEnd(8)} ${p.padEnd(16)} -> ${url} ${r.status()}${bad ? ' error-text' : ''}${hscroll ? ' h-scroll' : ''}${money ? ' MONEY-VISIBLE' : ''} | ${text.split('\n').filter(Boolean).slice(0, 4).join(' / ').slice(0, 110)}`);
      await page.screenshot({ path: `${OUT}/${role.toLowerCase()}${p === '/' ? '_home' : p.replace(/\//g, '_')}.png`, fullPage: true });
    }
    if (errs.length) console.log(`  console errors (${role}): ${[...new Set(errs)].slice(0, 5).join(' || ')}`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `WALKTHROUGH: ${fails} failure(s)` : 'WALKTHROUGH: all pages ok');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
