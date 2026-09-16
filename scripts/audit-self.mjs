#!/usr/bin/env node
/**
 * Runs the site checker against this site's own built pages, served over real HTTP.
 *
 * The fixture tests prove the engine reports what it is told to report. This proves it behaves on markup a
 * real build produced, with real response headers — and it is the cheapest false-positive alarm there is:
 * a site we built to pass these checks should pass them. Anything that fires here is either a bug in the
 * check or a bug in the site, and both are worth knowing before a stranger's site trips it.
 *
 * It is not a substitute for running the PHP endpoint against a real domain, which nothing here can do.
 * Usage: node scripts/audit-self.mjs [site-name]
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze } from '../packages/lander-kit/lib/audit.ts';
import { versions } from '../sites/createawebsite-ca/src/data/versions.ts';

const root = new URL('..', import.meta.url).pathname;
const siteName = process.argv[2] || 'createawebsite-ca';
const dist = join(root, 'sites', siteName, 'dist');
if (!existsSync(dist)) { console.error(`no build at ${dist}; run pnpm --filter ${siteName} build`); process.exit(1); }

const port = 5200 + Math.floor(Math.random() * 500);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dist], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const origin = `http://127.0.0.1:${port}`;

// The pages are fetched from a local file server but presented to the engine at the address they are built
// for. An address is a property of the hosting, not of the markup, and the checks that read it (canonical,
// hreflang self-links, https) would otherwise all fire on the loopback address rather than on the page.
const domain = JSON.parse(readFileSync(join(root, 'sites.json'), 'utf8')).find((x) => x.name === siteName)?.domain;
if (!domain) { console.error(`no domain for ${siteName} in sites.json`); process.exit(1); }
const publicOrigin = `https://${domain}`;

/** The same shape audit.php returns, built from real responses rather than a literal. */
async function snapshot(path) {
  const started = Date.now();
  const res = await fetch(`${origin}${path}`);
  const html = await res.text();
  const headers = Object.fromEntries([...res.headers].map(([k, v]) => [k.toLowerCase(), v]));
  const probe = async (p, keep = true) => {
    try {
      const r = await fetch(`${origin}${p}`);
      return { status: r.status, ok: r.ok, url: `${origin}${p}`, body: keep ? (await r.text()).slice(0, 12000) : undefined };
    } catch { return { status: 0, ok: false }; }
  };
  return {
    url: `${publicOrigin}${path}`,
    finalUrl: `${publicOrigin}${path}`,
    status: res.status,
    elapsedMs: Date.now() - started,
    bytes: Buffer.byteLength(html),
    headers,
    html,
    redirects: [],
    probes: {
      robots: await probe('/robots.txt'),
      sitemap: await probe('/sitemap-index.xml'),
      fr: await probe('/fr/', false),
      en: await probe('/', false),
      notFound: await probe('/maw-site-check-does-not-exist-8f21c4/', false),
      insecure: { status: 301, ok: false, location: `${publicOrigin}/` },
    },
  };
}

let fails = 0;
try {
  for (const path of ['/', '/fr/', '/guides/how-much-does-a-website-cost-canada/']) {
    const report = analyze(await snapshot(path), versions);
    const problems = report.findings.filter((f) => f.severity === 'critical' || f.severity === 'warning');
    console.log(`\n${path}  score ${report.score}  ${report.counts.critical} urgent, ${report.counts.warning} to fix, ${report.counts.info} small, ${report.counts.good} good`);
    for (const f of report.findings) {
      if (f.severity === 'good') continue;
      console.log(`  ${f.severity.padEnd(8)} ${f.area.padEnd(12)} ${f.id}${f.evidence ? `  — ${f.evidence.slice(0, 70)}` : ''}`);
    }

    // Findings we expect from a static site behind a plain file server, and would not expect on real hosting.
    const hosting = new Set(['https.noHsts', 'security.headers', 'speed.noCompression', 'seo.sitemap.missing']);
    const ours = problems.filter((f) => !hosting.has(f.id));
    if (ours.length > 0) {
      fails++;
      console.log(`  ^ ${ours.length} finding(s) the site itself should not have: ${ours.map((f) => f.id).join(', ')}`);
    }
  }
} finally {
  server.kill();
}
console.log(fails ? `\n${fails} page(s) with findings of our own making` : '\nour own pages come back clean');
process.exit(fails ? 1 : 0);
