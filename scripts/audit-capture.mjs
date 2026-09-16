#!/usr/bin/env node
/**
 * Captures real websites into snapshot files the audit engine can be replayed against, for ever, offline.
 *
 * WHY THIS EXISTS: the engine has only ever seen fixtures we wrote ourselves, which is why it shipped several
 * confident false statements. Proving it right needs real pages — but the build sandbox has no outbound
 * network, and the PHP endpoint is blocked on a hosting question nobody has answered yet. This script breaks
 * that deadlock: run it on ANY machine with an internet connection (a laptop is fine), commit the snapshots,
 * and from then on `pnpm test` replays real Quebec websites on every change, with no network at all.
 *
 * It writes exactly the shape sites/createawebsite-ca/public/api/audit.php returns, including the same probes,
 * so a snapshot captured here and a snapshot captured in production are the same object to the engine.
 *
 *   node scripts/audit-capture.mjs boulangerie.ca clinique.qc.ca …
 *   node scripts/audit-capture.mjs --from docs/corpus-sites.txt
 *
 * NOT the production path and deliberately not SSRF-hardened: it is a developer tool, run by a person, on a
 * list of addresses that person chose. audit.php is the only thing a stranger may point at a URL. It is
 * polite by default — one site at a time, a second between them, and a user agent that says who we are.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const OUT = join(root, 'docs', 'corpus');
const UA = 'Mozilla/5.0 (compatible; createawebsite.ca site check; +https://createawebsite.ca/)';
const NOT_FOUND_PATH = 'maw-site-check-does-not-exist-8f21c4';   // must match audit.php
const MAX_BYTES = 1_500_000;
const PAUSE_MS = 1000;

const args = process.argv.slice(2);
const fromFlag = args.indexOf('--from');
const targets = fromFlag === -1
  ? args
  : readFileSync(args[fromFlag + 1], 'utf8').split('\n').map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);

if (targets.length === 0) {
  console.error(fromFlag === -1
    ? 'usage: node scripts/audit-capture.mjs <domain…>   |   --from <file with one domain per line>'
    : `${args[fromFlag + 1]} has no domains in it yet — only comments.\n`
      + 'It is waiting to be filled in: 40-60 real Quebec businesses, one per line, including some you know\n'
      + 'are well built. See docs/corpus/README.md for what makes a useful corpus.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function once(url, method = 'GET', keep = 4000) {
  const started = Date.now();
  try {
    const res = await fetch(url, { method, redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.8' }, signal: AbortSignal.timeout(10_000) });
    const body = method === 'HEAD' ? '' : (await res.text());
    return {
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      headers: Object.fromEntries([...res.headers].map(([k, v]) => [k.toLowerCase(), v.slice(0, 500)])),
      body: body.slice(0, keep),
      fullBody: body,
      bytes: Buffer.byteLength(body),
      elapsedMs: Date.now() - started,
      url,
    };
  } catch (err) {
    return { status: 0, ok: false, headers: {}, body: '', fullBody: '', bytes: 0, elapsedMs: Date.now() - started, url, error: String(err.message ?? err) };
  }
}

/** Probes carry no fullBody: only what audit.php would have kept. */
const probe = async (url, method = 'GET', keep = 4000) => {
  const r = await once(url, method, keep);
  return { status: r.status, ok: r.ok, location: r.headers.location ?? null, body: r.body, bytes: r.bytes, url: r.url };
};

async function capture(target) {
  const start = /^https?:\/\//i.test(target) ? target : `https://${target}`;
  const redirects = [];
  let current = start;
  let page;

  for (let i = 0; i <= 4; i++) {
    page = await once(current, 'GET', MAX_BYTES);
    if (page.status === 0) return { error: page.error, url: start };
    const location = page.headers.location;
    if (page.status >= 300 && page.status < 400 && location) {
      current = new URL(location, current).toString();
      redirects.push(current);
      continue;
    }
    break;
  }

  const origin = new URL(current).origin;
  const host = new URL(current).host;
  const html = page.fullBody;

  const probes = { robots: await probe(`${origin}/robots.txt`, 'GET', 12_000) };
  probes.sitemap = await probe(`${origin}/sitemap.xml`);
  if (!probes.sitemap.ok) {
    const alt = await probe(`${origin}/sitemap_index.xml`);
    if (alt.ok) probes.sitemap = alt;
  }
  if (/\/wp-(content|includes)\//i.test(html) || /wordpress/i.test(html)) {
    probes.wpJson = await probe(`${origin}/wp-json/`, 'HEAD');
    probes.readme = await probe(`${origin}/readme.html`);
    probes.xmlrpc = await probe(`${origin}/xmlrpc.php`);
  }
  if (origin.startsWith('https://')) probes.insecure = await probe(`http://${host}/`, 'HEAD');
  probes.fr = await probe(`${origin}/fr/`, 'HEAD');
  probes.en = await probe(`${origin}/en/`, 'HEAD');
  probes.notFound = await probe(`${origin}/${NOT_FOUND_PATH}/`);
  const otherHost = host.toLowerCase().startsWith('www.') ? host.slice(4) : `www.${host}`;
  probes.altHost = await probe(`${origin.startsWith('https') ? 'https' : 'http'}://${otherHost}/`, 'HEAD');

  return {
    url: start,
    finalUrl: current,
    status: page.status,
    elapsedMs: page.elapsedMs,
    bytes: page.bytes,
    truncated: page.bytes > MAX_BYTES,
    headers: page.headers,
    redirects,
    html,
    probes,
  };
}

mkdirSync(OUT, { recursive: true });
let saved = 0;
for (const [i, target] of targets.entries()) {
  process.stdout.write(`[${i + 1}/${targets.length}] ${target} … `);
  const snap = await capture(target);
  if (snap.error) { console.log(`could not reach it (${snap.error})`); await sleep(PAUSE_MS); continue; }
  const name = new URL(snap.finalUrl).host.replace(/[^a-z0-9.-]/gi, '_');
  writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(snap, null, 1)}\n`);
  saved++;
  console.log(`${snap.status}, ${Math.round(snap.bytes / 1024)} KB, ${Object.keys(snap.probes).length} probes → docs/corpus/${name}.json`);
  await sleep(PAUSE_MS);
}
console.log(`\n${saved}/${targets.length} captured into docs/corpus/. Commit them, then run: node scripts/run-tests.mjs corpus`);
