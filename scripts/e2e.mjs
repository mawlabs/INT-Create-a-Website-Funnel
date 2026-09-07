#!/usr/bin/env node
/**
 * Browser checks against the built createawebsite-ca output (brief §14): hero reveal + CTA project param,
 * keyboard operation, consent gating (zero third-party requests before consent), form errors, no-JS fallbacks,
 * language links and hreflang. Usage: node scripts/e2e.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const dist = new URL('../sites/createawebsite-ca/dist', import.meta.url).pathname;
const port = 4700;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dist], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const executablePath = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-CA' });
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  check('no page errors', errors.length === 0, errors.join(' | '));
  check('html.js set by island', await page.evaluate(() => document.documentElement.classList.contains('js')));
  check('langbar shown for fr browser on EN page', await page.isVisible('[data-langbar]'));
  check('langbar text is French', (await page.textContent('[data-langbar] p')).includes('aussi en français'));
  check('consent banner shown', await page.isVisible('[data-consent]'));
  const thirdParty = requests.filter((u) => !u.startsWith(`http://127.0.0.1:${port}`));
  check('zero third-party requests before consent', thirdParty.length === 0, thirdParty.join(','));

  // hero reveal
  check('cta hidden before selection', await page.isHidden('[data-cta-wrap]'));
  await page.check('input[name="project"][value="ecommerce"]');
  await page.waitForTimeout(300);
  const revealText = await page.textContent('[data-project="ecommerce"]');
  check('reveal visible after selection', await page.isVisible('[data-project="ecommerce"]'), revealText);
  check('placeholder hidden', await page.isHidden('[data-reveal-empty]'));
  check('other reveals hidden', await page.isHidden('[data-project="business"]'));
  const href = await page.getAttribute('a[data-cta="hero"]', 'href');
  check('cta href has project=ecommerce', href.includes('project=ecommerce'), href);
  check('cta href has utm', href.includes('utm_source=createawebsite.ca') && href.includes('utm_content=hero') && href.includes('lang=en'));
  const dl = await page.evaluate(() => JSON.stringify(window.dataLayer));
  check('price_reveal event queued in dataLayer (no network)', dl.includes('price_reveal') && dl.includes('ecommerce'), dl);
  // keyboard: arrow key moves selection
  await page.focus('input[name="project"][value="ecommerce"]');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  check('keyboard changes selection to redesign', await page.isVisible('[data-project="redesign"]'));
  check('cta href updated to redesign', (await page.getAttribute('a[data-cta="hero"]', 'href')).includes('project=redesign'));

  // decline consent → nothing loads
  await page.click('[data-consent-decline]');
  check('banner hidden after decline', await page.isHidden('[data-consent]'));
  const stored = await page.evaluate(() => localStorage.getItem('maw-consent'));
  check('consent stored as denied', stored && stored.includes('denied'), stored);
  await page.waitForTimeout(300);
  check('still zero third-party after decline', requests.filter((u) => !u.startsWith(`http://127.0.0.1:${port}`)).length === 0);

  // form validation
  check('form visible with JS', await page.isVisible('[data-lead-form]'));
  await page.click('[data-lead-form] [data-submit]');
  const nameErr = await page.textContent('#form-name-err');
  check('name error specific', nameErr.includes('Enter your name'), nameErr);
  check('focus moved to first invalid', await page.evaluate(() => document.activeElement?.id) === 'form-name');
  await page.fill('#form-name', 'Test');
  await page.fill('#form-email', 'not-an-email');
  await page.fill('#form-message', 'A site');
  await page.check('#form-consent');
  await page.click('[data-lead-form] [data-submit]');
  const emailErr = await page.textContent('#form-email-err');
  check('email error specific', emailErr.includes('Enter an email address'), emailErr);
  await page.fill('#form-email', 'test@example.com');
  await page.click('[data-lead-form] [data-submit]');
  await page.waitForTimeout(200);
  const fast = await page.textContent('[data-status]');
  check('submission under 3 s is rejected (timing guard)', fast.includes('That was quick'), fast);
  await page.waitForTimeout(3100);
  await page.click('[data-lead-form] [data-submit]');
  await page.waitForTimeout(200);
  const status = await page.textContent('[data-status]');
  check('not-configured message with email (no portal id yet)', status.includes('support@monkeysat.work'), status);
  check('no network call made by form', !requests.some((u) => u.includes('hsforms')));

  // consent accept → GA4 loader would run (no ID configured → nothing loads)
  await page.evaluate(() => localStorage.removeItem('maw-consent'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-consent-accept]');
  await page.waitForTimeout(300);
  check('accept stored', (await page.evaluate(() => localStorage.getItem('maw-consent'))).includes('granted'));
  check('no GA request when PUBLIC_GA4_ID is empty', !requests.some((u) => u.includes('googletagmanager')));

  // FR page + switch links
  await page.goto(`http://127.0.0.1:${port}/fr/`, { waitUntil: 'networkidle' });
  check('fr page lang', (await page.getAttribute('html', 'lang')) === 'fr-CA');
  check('fr switch to EN links /', (await page.getAttribute('header a[data-lang-switch="en"]', 'href')) === '/');
  check('langbar hidden on FR page for fr browser', await page.isHidden('[data-langbar]'));
  await page.check('input[name="project"][value="business"]');
  await page.waitForTimeout(300);
  check('fr cta href lang=fr', (await page.getAttribute('a[data-cta="hero"]', 'href')).includes('lang=fr&') );

  // guide page hreflang pair
  await page.goto(`http://127.0.0.1:${port}/guides/how-much-does-a-website-cost-canada/`, { waitUntil: 'networkidle' });
  const frAlt = await page.getAttribute('link[hreflang="fr-CA"]', 'href');
  check('guide hreflang fr points to fr slug', frAlt.endsWith('/fr/guides/combien-coute-un-site-web-quebec/'), frAlt);
  check('guide switch link to FR slug', (await page.getAttribute('header a[data-lang-switch="fr"]', 'href')) === '/fr/guides/combien-coute-un-site-web-quebec/');

  // thanks page fires form_submit into dataLayer
  await page.goto(`http://127.0.0.1:${port}/thanks/`, { waitUntil: 'networkidle' });
  check('thanks queues form_submit', (await page.evaluate(() => JSON.stringify(window.dataLayer))).includes('form_submit'));

  // reduced motion: reveal immediate
  const ctx2 = await browser.newContext({ reducedMotion: 'reduce', javaScriptEnabled: false });
  const p2 = await ctx2.newPage();
  await p2.goto(`http://127.0.0.1:${port}/`);
  await p2.check('input[name="project"][value="changes"]');
  check('no-JS: CSS :has reveals text', await p2.isVisible('[data-project="changes"]'));
  check('no-JS: form hidden, noscript line visible', await p2.isHidden('[data-lead-form]') && (await p2.textContent('noscript')).includes('support@monkeysat.work'));
  check('no-JS: consent banner hidden (nothing loads anyway)', await p2.isHidden('[data-consent]'));
  await ctx2.close();
  await ctx.close();
} finally {
  await browser.close();
  server.kill();
}
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
