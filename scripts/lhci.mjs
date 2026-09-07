#!/usr/bin/env node
/**
 * Lighthouse CI against the built output of every deployable site, with the brief §10.5 budgets:
 * mobile ≥ 95 in all four categories on every page, ≤ 300 KB transferred, no third-party requests.
 * Usage: node scripts/lhci.mjs [site-name ...]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sites = JSON.parse(readFileSync(join(root, 'sites.json'), 'utf8'));
const wanted = process.argv.slice(2);
const targets = sites.filter((s) => (wanted.length ? wanted.includes(s.name) : s.deploy));

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

let failed = false;
for (const site of targets) {
  const dist = join(root, 'sites', site.name, 'dist');
  if (!existsSync(dist)) { console.error(`lhci: no build at ${dist}`); failed = true; continue; }
  const urls = pages(dist).map((p) => `http://localhost/${p.replace(/^\//, '')}`);
  const config = join(root, 'lighthouserc.json');
  const res = spawnSync('npx', ['lhci', 'autorun', `--config=${config}`, `--collect.staticDistDir=${dist}`, ...urls.map((u) => `--collect.url=${u}`)], {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, CHROME_PATH: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
  });
  if (res.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
