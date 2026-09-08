#!/usr/bin/env node
/** Fixture tests for the audit engine: a neglected WordPress site, a healthy bilingual site, and a builder site. */
import { analyze, compareVersions, detectPlatform, detectPhpVersion, FINDING_IDS } from '../packages/lander-kit/lib/audit.ts';
import { versions } from '../sites/createawebsite-ca/src/data/versions.ts';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const ids = (r) => r.findings.map((f) => f.id);

const snap = (over = {}) => ({
  url: 'https://example.ca', finalUrl: 'https://example.ca/', status: 200, elapsedMs: 400, bytes: 60000,
  headers: {}, html: '<!doctype html><html lang="en"><head><title>A page</title></head><body></body></html>',
  probes: {}, ...over,
});

/* ---- version comparison ---- */
ok(compareVersions('6.4.2', '6.6') < 0, 'compare minor');
ok(compareVersions('8.10', '8.9') > 0, 'compare numeric not lexical');
ok(compareVersions('3.7', '3.7.0') === 0, 'compare missing patch');

/* ---- a neglected WordPress site ---- */
const neglected = analyze(snap({
  finalUrl: 'http://vieuxsite.ca/',
  elapsedMs: 3200,
  bytes: 700000,
  headers: { 'x-powered-by': 'PHP/7.4.33', server: 'Apache/2.4.29 (Ubuntu)' },
  html: `<!doctype html><html lang="en"><head>
    <meta name="generator" content="WordPress 5.9.3" />
    <script src="/wp-includes/js/jquery/jquery-1.12.4.min.js"></script>
    <script src="/a.js"></script><script src="/b.js"></script><script src="/c.js"></script><script src="/d.js"></script>
    </head><body><img src="http://vieuxsite.ca/x.jpg"><img src="/y.jpg"><h1>Bienvenue</h1>
    <script src="https://www.googletagmanager.com/gtag/js?id=G-X"></script></body></html>`,
  probes: { readme: { status: 200, ok: true, body: '<br /> Version 5.9.3' }, robots: { status: 404, ok: false }, sitemap: { status: 404, ok: false } },
}), versions);
ok(neglected.platform === 'wordpress', `platform: ${neglected.platform}`);
ok(neglected.platformVersion === '5.9.3', `wp version: ${neglected.platformVersion}`);
ok(neglected.phpVersion === '7.4.33', `php version: ${neglected.phpVersion}`);
for (const id of ['https.missing', 'wordpress.outdated', 'php.eol', 'wordpress.readmeExposed', 'jquery.outdated',
                  'seo.description.missing', 'seo.robots.missing', 'seo.sitemap.missing', 'lang.frenchMissing',
                  'mobile.viewport.missing', 'speed.slowResponse', 'speed.htmlWeight', 'privacy.analyticsNoConsent',
                  'a11y.imagesNoAlt', 'speed.blockingScripts']) {
  ok(ids(neglected).includes(id), `neglected site reports ${id}`);
}
ok(!ids(neglected).includes('mixedContent'), 'no mixed-content finding on an http page');
ok(neglected.score < 30, `neglected score is low: ${neglected.score}`);
ok(neglected.recommendation.projectType === 'redesign', `neglected → redesign, got ${neglected.recommendation.id}`);
console.log('neglected:', neglected.score, neglected.recommendation, ids(neglected).length, 'findings');

/* ---- a healthy bilingual site ---- */
const healthy = analyze(snap({
  elapsedMs: 300, bytes: 45000,
  headers: {
    'x-powered-by': 'PHP/8.4.1', 'strict-transport-security': 'max-age=31536000',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin',
    'content-security-policy': "default-src 'self'",
  },
  html: `<!doctype html><html lang="fr-CA"><head>
    <title>Boulangerie Saint-Roch — pain frais à Québec</title>
    <meta name="description" content="Boulangerie artisanale dans Saint-Roch. Pains au levain, viennoiseries et cafe, du mardi au dimanche." />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="generator" content="WordPress 6.9" />
    <link rel="canonical" href="https://example.ca/" />
    <link rel="alternate" hreflang="en-CA" href="https://example.ca/en/" />
    <meta property="og:title" content="Boulangerie" /><meta property="og:image" content="/og.png" />
    <script type="application/ld+json">{"@type":"Bakery"}</script>
    </head><body><h1>Pain frais</h1><img src="/a.jpg" alt="Pain" width="800" height="600" loading="lazy"></body></html>`,
  probes: {
    robots: { status: 200, ok: true, body: 'User-agent: *\nSitemap: https://example.ca/sitemap.xml' },
    sitemap: { status: 200, ok: true },
    insecure: { status: 301, ok: false, location: 'https://example.ca/' },
    en: { status: 200, ok: true },
  },
}), versions);
ok(healthy.counts.critical === 0, `healthy has no criticals: ${ids(healthy).filter((i) => healthy.findings.find((f) => f.id === i && f.severity === 'critical'))}`);
ok(healthy.score >= 85, `healthy score: ${healthy.score}`);
ok(healthy.recommendation.id === 'healthy', `healthy → healthy, got ${healthy.recommendation.id}`);
ok(ids(healthy).includes('lang.bilingual') && ids(healthy).includes('php.current') && ids(healthy).includes('wordpress.current'), 'healthy good findings');
ok(!ids(healthy).includes('lang.frenchMissing'), 'no French warning on a French site');
console.log('healthy:', healthy.score, healthy.recommendation.id, ids(healthy).length, 'findings');

/* ---- an English-only builder site ---- */
const builder = analyze(snap({
  html: `<!doctype html><html lang="en"><head><title>Studio</title>
    <meta name="generator" content="Wix.com Website Builder" /></head><body><h1>Studio</h1></body></html>`,
  headers: { 'x-wix-request-id': 'abc' },
  probes: { robots: { status: 200, ok: true, body: 'User-agent: *' } },
}), versions);
ok(builder.platform === 'wix', `builder platform: ${builder.platform}`);
ok(ids(builder).includes('lang.frenchMissing'), 'English-only site is flagged for French');
ok(builder.recommendation.currentPlatform === 'other', 'builder maps to "other" platform in the quote');
console.log('builder:', builder.score, builder.recommendation.id);

/* ---- mixed content is only reported on https, and w3.org namespaces are not counted ---- */
const mixed = analyze(snap({
  html: `<html lang="fr"><head><title>x</title></head><body>
    <svg xmlns="http://www.w3.org/2000/svg"></svg><img src="http://cdn.example.com/a.jpg"><script src="http://x.example/b.js"></script></body></html>`,
}), versions);
const m = mixed.findings.find((f) => f.id === 'mixedContent');
ok(m && m.params.count === 2, `mixed content counts 2 (got ${m?.params.count})`);

/* ---- every emitted id has a place in FINDING_IDS ---- */
const known = new Set(FINDING_IDS);
for (const r of [neglected, healthy, builder, mixed]) {
  for (const id of ids(r)) ok(known.has(id), `finding ${id} is declared in FINDING_IDS`);
}
/* ---- platform detection ---- */
ok(detectPlatform(snap({ html: '<html><body>cdn.shopify.com</body></html>' })).platform === 'shopify', 'shopify detected');
ok(detectPlatform(snap({ html: '<html><body class="woocommerce"><a href="/wp-content/x"></a></body></html>' })).platform === 'woocommerce', 'woocommerce detected');
ok(detectPhpVersion(snap({ headers: { server: 'nginx PHP/8.2.1' } })) === '8.2.1', 'php from server header');

console.log(fails ? `${fails} failure(s)` : 'audit engine OK');
process.exit(fails ? 1 : 0);
