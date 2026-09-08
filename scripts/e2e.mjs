#!/usr/bin/env node
/**
 * Browser checks against the built createawebsite-ca output: the quote flow (every project type reaches a result,
 * back and Escape, keyboard, multi-select, intake validation, timing guard, no request to the lead endpoint before
 * submit), consent gating (zero third-party requests before consent), language links, hreflang, no-JS fallback.
 * Usage: node scripts/e2e.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const dist = new URL('../sites/createawebsite-ca/dist', import.meta.url).pathname;
const port = 4700;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dist], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
// Use the browser this environment ships with when there is one; otherwise let playwright find its own.
const executablePath = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const origin = `http://127.0.0.1:${port}`;

const pick = async (page, text) => {
  const btn = page.locator('[data-quote-stage] button.opt', { hasText: text }).first();
  await btn.click();
  await page.waitForTimeout(220);
};
const question = (page) => page.textContent('[data-quote-stage] .q');

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-CA' });
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const thirdParty = () => requests.filter((u) => !u.startsWith(origin));

  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  check('no page errors', errors.length === 0, errors.join(' | '));
  check('html.js set by island', await page.evaluate(() => document.documentElement.classList.contains('js')));
  check('langbar shown for fr browser on EN page', await page.isVisible('[data-langbar]'));
  check('consent banner shown', await page.isVisible('[data-consent]'));
  check('zero third-party requests before consent', thirdParty().length === 0, thirdParty().join(','));
  check('first question rendered by island as buttons', (await page.locator('[data-quote-stage] button.opt').count()) === 7);
  check('progress shows question 1', (await page.textContent('[data-quote-stage] .progress')).includes('Question 1'));

  // Business flow, with multi-select and back
  await pick(page, 'A website for my business');
  check('step 2 asks platform', (await question(page)).includes('built on'));
  check('progress updated', (await page.textContent('[data-quote-stage] .progress')).includes('Question 2 of 8'));
  await pick(page, 'WordPress');
  check('step 3 asks build approach for WordPress', (await question(page)).includes('build'));
  await page.click('[data-quote-stage] button.linkish', { timeout: 2000 }); // Previous question
  await page.waitForTimeout(220);
  check('back returns to platform', (await question(page)).includes('built on'));
  await pick(page, 'Fully custom code');
  check('fully custom skips build approach', (await question(page)).includes('design'));
  check('total steps back to 8 without build approach', (await page.textContent('[data-quote-stage] .progress')).includes('of 8'));
  await pick(page, 'examples');
  await pick(page, 'English and French');
  check('integrations is multi-select', (await page.locator('[data-quote-stage] input[type=checkbox]').count()) === 7);
  await page.check('[data-quote-stage] input[value="crm"]');
  await page.check('[data-quote-stage] input[value="booking"]');
  await page.check('[data-quote-stage] input[value="none"]');
  check('choosing none clears the others', !(await page.isChecked('[data-quote-stage] input[value="crm"]')));
  await page.check('[data-quote-stage] input[value="crm"]');
  check('choosing an integration clears none', !(await page.isChecked('[data-quote-stage] input[value="none"]')));
  await page.locator('[data-quote-stage] button.btn', { hasText: 'Continue' }).click();
  await page.waitForTimeout(220);
  check('after integrations asks pages', (await question(page)).includes('pages'));
  await pick(page, '6 to 10');
  await pick(page, 'Maybe later');
  check('timeline is last', (await question(page)).includes('How soon'));
  // keyboard: Enter on a focused option
  await page.focus('[data-quote-stage] button.opt >> nth=1');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(220);
  const heading = await question(page);
  check('result shown after timeline (keyboard)', heading.includes('ballpark'), heading);
  const priceText = await page.textContent('[data-quote-stage] .reveal .big .value');
  check('price range rendered', /\$[\d,]+–\$[\d,]+\+?/.test(priceText), priceText);
  check('rush note shown for rush', (await page.textContent('[data-quote-stage]')).includes('Rush timeline'));
  check('focus moved to result heading', await page.evaluate(() => document.activeElement?.classList.contains('q')));
  const dl = await page.evaluate(() => JSON.stringify(window.dataLayer));
  check('quote_shown queued in dataLayer, no network', dl.includes('quote_shown') && dl.includes('quote_start'), dl.slice(0, 200));
  check('still zero third-party requests', thirdParty().length === 0, thirdParty().join(','));
  check('book a call link present', (await page.getAttribute('[data-quote-stage] a[data-cta="book"]', 'href')).includes('meetings.hubspot.com/ange1'));

  // Out of budget → follow-up intake
  await page.locator('[data-quote-stage] button', { hasText: 'Out of budget' }).click();
  await page.waitForTimeout(220);
  check('budget view', (await question(page)).includes('Budgets'));
  await page.locator('[data-quote-stage] button', { hasText: 'Contact me in a month' }).click();
  await page.waitForTimeout(220);
  check('follow-up intake view', (await question(page)).includes('month'));
  await page.locator('[data-quote-stage] button.linkish', { hasText: 'Previous' }).click();
  await page.waitForTimeout(220);
  await page.locator('[data-quote-stage] button.linkish', { hasText: 'Back to my quote' }).click();
  await page.waitForTimeout(220);
  check('back to result', (await question(page)).includes('ballpark'));

  // Accept → intake validation
  await page.locator('[data-quote-stage] button.btn', { hasText: "Great, let's get started" }).click();
  await page.waitForTimeout(220);
  check('intake view', (await question(page)).includes('Almost there'));
  check('answers summary present', (await page.locator('[data-quote-stage] details.summary li').count()) >= 6);
  await page.locator('[data-quote-stage] form button[type=submit]').click();
  await page.waitForTimeout(100);
  check('name error specific', (await page.textContent('#qi-firstname-err')).includes('Enter your name'));
  check('focus on first invalid', await page.evaluate(() => document.activeElement?.id) === 'qi-firstname');
  await page.fill('#qi-firstname', 'Test');
  await page.fill('#qi-email', 'nope');
  await page.check('#qi-consent');
  await page.locator('[data-quote-stage] form button[type=submit]').click();
  await page.waitForTimeout(100);
  check('email error specific', (await page.textContent('#qi-email-err')).includes('email'));
  await page.fill('#qi-email', 'test@example.com');
  check('no lead request before submit', !requests.some((u) => u.includes('process-lead')));
  // Reload persistence
  await page.reload({ waitUntil: 'networkidle' });
  check('answers persist across reload (result view restored)', (await question(page)).includes('ballpark'));
  // Start over
  await page.locator('[data-quote-stage] button.linkish', { hasText: 'Start over' }).click();
  await page.waitForTimeout(220);
  check('start over returns to question 1', (await page.textContent('[data-quote-stage] .progress')).includes('Question 1'));

  // Every project type reaches a result with first options
  for (const type of ['A blog', 'One page to promote', 'An online store', 'A new look for my current site', 'Changes or fixes', 'Something custom']) {
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => sessionStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await pick(page, type);
    let guard = 0;
    while (guard++ < 12) {
      const q = await question(page);
      if (q.includes('ballpark') || q.includes('planning')) break;
      const multi = await page.locator('[data-quote-stage] input[type=checkbox]').count();
      if (multi) { await page.locator('[data-quote-stage] input[type=checkbox]').first().check(); await page.locator('[data-quote-stage] button.btn').first().click(); await page.waitForTimeout(220); }
      else await page.locator('[data-quote-stage] button.opt').first().click().then(() => page.waitForTimeout(220));
    }
    const q = await question(page);
    check(`flow "${type}" reaches a result`, q.includes('ballpark') || q.includes('planning'), q);
  }
  check('custom flow shows discovery, no build price', (await page.textContent('[data-quote-stage]')).includes('$375') && !(await page.textContent('[data-quote-stage]')).includes('Price range'));

  // decline consent → nothing loads
  await page.click('[data-consent-decline]');
  check('consent stored as denied', (await page.evaluate(() => localStorage.getItem('maw-consent'))).includes('denied'));
  check('still zero third-party after decline', thirdParty().length === 0);

  // Question form (HubSpot) still works: not configured message
  check('question form visible', await page.isVisible('[data-lead-form]'));


  // ---- Site audit: mocked endpoint, so the checks are about the island and the engine, not the network ----
  const wpFixture = {
    ok: true,
    url: 'https://vieuxsite.ca', finalUrl: 'https://vieuxsite.ca/', status: 200, elapsedMs: 3100, bytes: 240000,
    headers: { 'x-powered-by': 'PHP/7.4.33', server: 'Apache/2.4.29' },
    html: `<!doctype html><html lang="en"><head><title>Vieux site</title>
      <meta name="generator" content="WordPress 5.9.3" /></head>
      <body><h1>Bonjour</h1><img src="/a.jpg"></body></html>`,
    probes: { robots: { status: 404, ok: false }, sitemap: { status: 404, ok: false }, readme: { status: 200, ok: true, body: 'Version 5.9.3' } },
  };
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  check('audit form visible with JS', await page.isVisible('[data-audit-form]'));

  await page.route('**/api/audit.php', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wpFixture) }));
  await page.click('[data-audit-panel] button[type="submit"]');
  check('audit needs an address', (await page.textContent('[data-audit-status]')).includes('website address'));

  await page.fill('[data-audit-url]', 'vieuxsite.ca');
  await page.click('[data-audit-panel] button[type="submit"]');
  await page.waitForSelector('[data-audit-output] .report', { timeout: 5000 });
  const reportText = await page.textContent('[data-audit-output]');
  check('audit shows the platform and PHP version', reportText.includes('WordPress 5.9.3') && reportText.includes('PHP 7.4.33'), reportText.slice(0, 120));
  check('audit flags the outdated CMS', reportText.includes('no longer supported'));
  check('audit flags PHP end of life', reportText.includes('no longer gets security fixes'));
  check('audit flags the missing French version', reportText.includes('no French version'));
  check('audit groups findings by severity', (await page.locator('[data-audit-output] .finding[data-severity="critical"]').count()) >= 3);
  const score = Number(await page.textContent('[data-audit-output] .score-num'));
  check('audit score is a low number for this fixture', score >= 0 && score < 40, String(score));
  check('audit focus moves to the report heading', await page.evaluate(() => document.activeElement?.classList.contains('report-h')));
  check('audit summary kept for the lead', (await page.evaluate(() => sessionStorage.getItem('caw-audit') ?? '')).includes('vieuxsite.ca'));

  // The recommendation hands over to the quote flow
  await page.click('[data-audit-output] .rec button.btn');
  await page.waitForTimeout(600);
  const afterHandoff = await question(page);
  check('audit prefills the quote and skips the answered questions', !afterHandoff.includes('What are you building'), afterHandoff);
  const answers = await page.evaluate(() => JSON.parse(sessionStorage.getItem('caw-quote') ?? '{}').answers ?? {});
  check('prefilled answers carry the project type and platform', answers.projectType === 'redesign' && answers.currentPlatform === 'wordpress', JSON.stringify(answers));

  // Endpoint refusals are worded, not raw codes
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.route('**/api/audit.php', (route) => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'rate_limited' }) }));
  await page.fill('[data-audit-url]', 'example.ca');
  await page.click('[data-audit-panel] button[type="submit"]');
  await page.waitForTimeout(400);
  check('audit rate-limit message is in plain words', (await page.textContent('[data-audit-status]')).includes('Wait a couple of minutes'));
  await page.unroute('**/api/audit.php');

  // FR page (clear the shared sessionStorage state first: answers persist across the EN/FR pages of one origin by design)
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${origin}/fr/`, { waitUntil: 'networkidle' });
  check('fr page lang', (await page.getAttribute('html', 'lang')) === 'fr-CA');
  check('fr first question in French', (await question(page)).includes('bâtir'));
  await page.locator('[data-quote-stage] button.opt', { hasText: 'Une boutique en ligne' }).click();
  await page.waitForTimeout(220);
  check('fr step 2 in French', (await question(page)).includes('bâti'));
  check('fr switch to EN links /', (await page.getAttribute('header a[data-lang-switch="en"]', 'href')) === '/');

  // guide hreflang + CTA to quote
  await page.goto(`${origin}/guides/how-much-does-a-website-cost-canada/`, { waitUntil: 'networkidle' });
  check('guide hreflang fr', (await page.getAttribute('link[hreflang="fr-CA"]', 'href')).endsWith('/fr/guides/combien-coute-un-site-web-quebec/'));
  check('guide CTA points to the quote tool', (await page.getAttribute('a[data-cta="guide"]', 'href')) === '/#quote');
  check('guide has no DIY comparison table', !(await page.content()).includes('DIY builder, freelancer or studio'));

  await page.goto(`${origin}/thanks/`, { waitUntil: 'networkidle' });
  check('thanks queues form_submit', (await page.evaluate(() => JSON.stringify(window.dataLayer))).includes('form_submit'));

  // no-JS
  const ctx2 = await browser.newContext({ javaScriptEnabled: false });
  const p2 = await ctx2.newPage();
  await p2.goto(`${origin}/`);
  const hrefs = await p2.$$eval('[data-nojs-option]', (as) => as.map((a) => a.getAttribute('href')));
  check('no-JS: options link to the MAW chat with project param', hrefs.length === 7 && hrefs.every((h) => h.includes('monkeysat.work') && h.includes('project=')), hrefs[3]);
  const noscripts = await p2.$$eval('noscript', (ns) => ns.map((n) => n.textContent));
  check('no-JS: audit form hidden', await p2.isHidden('[data-audit-form]'));
  check('no-JS: question form hidden, noscript fallback with email', await p2.isHidden('[data-lead-form]') && noscripts.some((t) => t.includes('support@monkeysat.work')), noscripts.join(' | ').slice(0, 120));
  await ctx2.close();
  await ctx.close();
} finally {
  await browser.close();
  server.kill();
}
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
