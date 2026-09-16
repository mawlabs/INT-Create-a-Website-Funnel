#!/usr/bin/env node
/**
 * Screenshots the site-check result itself, which the page-level pass in screens.mjs cannot reach: it only
 * exists after a scan. Runs the audit against a stubbed endpoint so the picture is the same every time, and
 * writes the downloadable report beside it so the file can be opened and read.
 * Usage: node scripts/screens-audit.mjs [site-name]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const root = new URL('..', import.meta.url).pathname;
const siteName = process.argv[2] || 'createawebsite-ca';
const dist = join(root, 'sites', siteName, 'dist');
if (!existsSync(dist)) { console.error(`no build at ${dist}; run pnpm --filter ${siteName} build`); process.exit(1); }
const out = join(root, 'docs', 'screens', siteName);
mkdirSync(out, { recursive: true });

/** A tired but not hopeless WordPress site: enough findings in enough areas to show the report doing its job. */
const snapshot = {
  ok: true,
  url: 'https://boulangerie-exemple.ca',
  finalUrl: 'https://boulangerie-exemple.ca/',
  status: 200,
  elapsedMs: 2800,
  bytes: 240000,
  redirects: ['https://boulangerie-exemple.ca/', 'https://boulangerie-exemple.ca/'],
  truncated: false,
  headers: { 'x-powered-by': 'PHP/8.1.27', server: 'Apache/2.4.52 (Ubuntu)', 'content-type': 'text/html' },
  html: `<!doctype html><html lang="en"><head>
    <title>Home | Boulangerie Exemple | Fresh bread, pastries, coffee and catering in the Quebec City area</title>
    <meta name="generator" content="WordPress 6.6.2">
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
    <link rel="canonical" href="https://boulangerie-exemple.ca/home/">
    <link rel="stylesheet" href="/1.css"><link rel="stylesheet" href="/2.css"><link rel="stylesheet" href="/3.css">
    <link rel="stylesheet" href="/4.css"><link rel="stylesheet" href="/5.css"><link rel="stylesheet" href="/6.css">
    <link rel="stylesheet" href="/7.css">
    <script src="/wp-includes/js/jquery/jquery-3.4.1.min.js"></script>
    <script src="/a.js"></script><script src="/b.js"></script><script src="/c.js"></script><script src="/d.js"></script>
    <script src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
    </head><body><h1>Boulangerie Exemple</h1><h3>Open Tuesday to Sunday</h3>
    <p>Fresh bread every morning.</p>
    <a href="/menu/">Menu</a>
    <a href="tel:4180000000"><img src="/phone.png"></a>
    <img src="/a.jpg"><img src="/b.jpg"><img src="/c.jpg"><img src="/d.png"><img src="/e.png">
    </body></html>`,
  probes: {
    robots: { status: 200, ok: true, body: 'User-agent: *\nDisallow: /wp-admin/' },
    sitemap: { status: 404, ok: false },
    notFound: { status: 200, ok: true, url: 'https://boulangerie-exemple.ca/maw-site-check-does-not-exist-8f21c4/' },
    altHost: { status: 200, ok: true, url: 'https://www.boulangerie-exemple.ca/' },
    insecure: { status: 200, ok: true },
    xmlrpc: { status: 405, ok: false, url: 'https://boulangerie-exemple.ca/xmlrpc.php' },
  },
};

const port = 4321 + Math.floor(Math.random() * 1000);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dist], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const origin = `http://127.0.0.1:${port}`;

const executablePath = process.env.CHROMIUM_PATH || [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium',
].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
let reportFile = '';
try {
  for (const [label, width] of [['390', 390], ['1280', 1280]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    await page.route('**/api/audit.php', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot) }));
    await page.addInitScript(() => {
      window.__files = [];
      const realCreate = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => { blob.text().then((t) => window.__files.push(t)).catch(() => {}); return realCreate(blob); };
      HTMLAnchorElement.prototype.click = function () { if (!this.download) return HTMLElement.prototype.click.call(this); };
    });
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    await page.fill('[data-audit-url]', 'boulangerie-exemple.ca');
    await page.click('[data-audit-panel] button[type="submit"]');
    await page.waitForSelector('[data-audit-output] .report .areas');
    await page.waitForTimeout(300);
    await page.locator('[data-audit-panel]').screenshot({ path: join(out, `audit-report--${label}.png`) });
    console.log(`screens: audit-report--${label}.png`);
    await page.close();
  }

  // The downloadable file: produced through the real flow, then photographed as a reader would see it.
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await page.route('**/api/audit.php', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot) }));
  await page.addInitScript(() => {
    window.__files = [];
    const realCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { blob.text().then((t) => window.__files.push(t)).catch(() => {}); return realCreate(blob); };
    HTMLAnchorElement.prototype.click = function () { if (!this.download) return HTMLElement.prototype.click.call(this); };
  });
  // The gate refuses to pretend it sent anything while HubSpot is unconfigured, and the built site has no
  // keys in it, so stand in for both the ids and the endpoint.
  await page.route(`${origin}/`, async (route) => {
    const res = await route.fetch();
    const body = (await res.text())
      .replace('&quot;portalId&quot;:&quot;&quot;', '&quot;portalId&quot;:&quot;1234&quot;')
      .replace('&quot;formGuid&quot;:&quot;&quot;', '&quot;formGuid&quot;:&quot;abcd&quot;');
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
  });
  await page.route('**/api.hsforms.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.fill('[data-audit-url]', 'boulangerie-exemple.ca');
  await page.click('[data-audit-panel] button[type="submit"]');
  await page.waitForSelector('[data-audit-output] .report .areas');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[data-audit-output] .rec button')].pop();
    btn?.click();
  });
  await page.waitForTimeout(200);
  await page.fill('#audit-email', 'proprietaire@boulangerie-exemple.ca');
  await page.waitForTimeout(3200);   // the gate's own timing guard
  await page.click('[data-audit-output] .gate-form button[type="submit"]');
  await page.waitForSelector('[data-audit-output] .sent', { timeout: 5000 });
  await page.waitForTimeout(400);
  reportFile = await page.evaluate(() => window.__files?.[0] ?? '');
  await page.close();

  if (reportFile) {
    const path = join(out, 'audit-full-report.html');
    writeFileSync(path, reportFile);
    console.log('screens: audit-full-report.html');
    const file = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2 });
    await file.setContent(reportFile, { waitUntil: 'load' });
    await file.screenshot({ path: join(out, 'audit-full-report--1000.png'), fullPage: true });
    console.log('screens: audit-full-report--1000.png');
    await file.close();
  } else {
    console.error('screens: the downloadable report was not produced');
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  server.kill();
}
