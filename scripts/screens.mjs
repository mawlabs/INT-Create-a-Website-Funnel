#!/usr/bin/env node
/**
 * Screenshots every page of a built site at 390 px and 1280 px into docs/screens/<site>/ (brief §0, §14).
 * Usage: node scripts/screens.mjs [site-name]   (serves sites/<name>/dist on a local port)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const root = new URL('..', import.meta.url).pathname;
const siteName = process.argv[2] || 'createawebsite-ca';
const dist = join(root, 'sites', siteName, 'dist');
if (!existsSync(dist)) { console.error(`no build at ${dist}; run pnpm --filter ${siteName} build`); process.exit(1); }
const out = join(root, 'docs', 'screens', siteName);
mkdirSync(out, { recursive: true });

function pages(dir, base = '') {
  const list = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) list.push(...pages(p, `${base}/${name}`));
    else if (name === 'index.html') list.push(`${base}/`);
    else if (name === '404.html') list.push(`${base}/404.html`);
  }
  return list;
}

const port = 4321 + Math.floor(Math.random() * 1000);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dist], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const executablePath = process.env.CHROMIUM_PATH || [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium',
].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
try {
  for (const [label, width] of [['390', 390], ['1280', 1280]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, locale: 'en-CA' });
    for (const path of pages(dist)) {
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'networkidle' });
      const file = `${path.replace(/\.html$/, '').replace(/^\/|\/$/g, '').replace(/\//g, '__') || 'home'}--${label}.png`;
      await page.screenshot({ path: join(out, file), fullPage: true });
      console.log(`screens: ${file}`);
      await page.close();
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
