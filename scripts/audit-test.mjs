#!/usr/bin/env node
/** Fixture tests for the audit engine: a neglected WordPress site, a healthy bilingual site, and a builder site. */
import { analyze, AREAS, compareVersions, detectPlatform, detectPhpVersion, FINDING_AREAS, FINDING_IDS, POSITIVE_FINDING_IDS } from '../packages/lander-kit/lib/audit.ts';
import { readFileSync } from 'node:fs';
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
    </head><body><img src="http://vieuxsite.ca/x.jpg"><img src="/y.jpg"><h1>Welcome</h1>
    <p>${'We have been serving the neighbourhood for more than thirty years and we are open from Tuesday to Sunday. '.repeat(6)}</p>
    <script src="https://www.googletagmanager.com/gtag/js?id=G-X"></script></body></html>`,
  probes: { readme: { status: 200, ok: true, body: '<br /> Version 5.9.3' }, robots: { status: 404, ok: false }, sitemap: { status: 404, ok: false }, fr: { status: 404, ok: false } },
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
    <meta charset="utf-8" />
    <title>Boulangerie Saint-Roch — pain frais à Québec</title>
    <meta name="description" content="Boulangerie artisanale dans Saint-Roch. Pains au levain, viennoiseries et cafe, du mardi au dimanche." />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="generator" content="WordPress 6.9" />
    <link rel="canonical" href="https://example.ca/" />
    <link rel="alternate" hreflang="fr-CA" href="https://example.ca/" />
    <link rel="alternate" hreflang="en-CA" href="https://example.ca/en/" />
    <link rel="alternate" hreflang="x-default" href="https://example.ca/" />
    <meta property="og:title" content="Boulangerie" /><meta property="og:description" content="Pain au levain" />
    <meta property="og:image" content="/og.png" />
    <script type="application/ld+json">{"@type":"Bakery"}</script>
    </head><body><h1>Pain frais</h1>
    <p>${'Nous cuisons chaque matin des pains au levain, des baguettes et des viennoiseries dans le quartier Saint-Roch. '.repeat(8)}</p>
    <nav><a href="/pains/">Pains</a><a href="/viennoiseries/">Viennoiseries</a><a href="/cafe/">Café</a>
    <a href="/horaire/">Horaire</a><a href="/contact/">Contact</a><a href="https://example.ca/nous/">Nous</a></nav>
    <img src="/a.webp" alt="Pain" width="800" height="600" loading="lazy"></body></html>`,
  probes: {
    robots: { status: 200, ok: true, body: 'User-agent: *\nSitemap: https://example.ca/sitemap.xml' },
    sitemap: { status: 200, ok: true, body: '<?xml version="1.0"?><urlset></urlset>' },
    insecure: { status: 301, ok: false, location: 'https://example.ca/' },
    en: { status: 200, ok: true },
    notFound: { status: 404, ok: false },
    altHost: { status: 301, ok: false },
  },
}), versions);
ok(healthy.counts.critical === 0, `healthy has no criticals: ${ids(healthy).filter((i) => healthy.findings.find((f) => f.id === i && f.severity === 'critical'))}`);
ok(healthy.score >= 80, `healthy score: ${healthy.score} — ${ids(healthy).filter((i) => !POSITIVE_FINDING_IDS.includes(i)).join(', ')}`);
ok(healthy.recommendation.id === 'healthy', `healthy → healthy, got ${healthy.recommendation.id}`);
ok(ids(healthy).includes('lang.bilingual') && ids(healthy).includes('php.current') && ids(healthy).includes('wordpress.current'), 'healthy good findings');
ok(!ids(healthy).includes('lang.frenchMissing'), 'no French warning on a French site');
console.log('healthy:', healthy.score, healthy.recommendation.id, ids(healthy).length, 'findings');

/* ---- an English-only builder site ---- */
const builder = analyze(snap({
  html: `<!doctype html><html lang="en"><head><title>Studio</title>
    <meta name="generator" content="Wix.com Website Builder" /></head><body><h1>Studio</h1>
    <p>${'We are a small design studio and we would be glad to hear from you about what you have in mind. '.repeat(6)}</p>
    </body></html>`,
  headers: { 'x-wix-request-id': 'abc' },
  probes: { robots: { status: 200, ok: true, body: 'User-agent: *' }, notFound: { status: 404, ok: false }, fr: { status: 404, ok: false } },
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

/* ---- the version thresholds: every PHP branch lands where it should ---- */
// Stale reference data here does not fall silent, it asserts "nothing to do here" — so each branch is pinned.
const phpBranch = (v) => ids(analyze(snap({ headers: { 'x-powered-by': `PHP/${v}` } }), versions))
  .find((id) => ['php.eol', 'php.securityOnly', 'php.current'].includes(id));
ok(phpBranch('7.4.33') === 'php.eol', `7.4 is past end of life (got ${phpBranch('7.4.33')})`);
ok(phpBranch('8.1.27') === 'php.eol', `8.1 is past end of life (got ${phpBranch('8.1.27')})`);
ok(phpBranch('8.2.20') === 'php.securityOnly', `8.2 is security-only (got ${phpBranch('8.2.20')})`);
ok(phpBranch('8.3.14') === 'php.securityOnly', `8.3 is security-only (got ${phpBranch('8.3.14')})`);
ok(phpBranch('8.4.3') === 'php.current', `8.4 is current (got ${phpBranch('8.4.3')})`);

/* ---- the rebuild verdict is grounded in findings, not in a curve ---- */
// A site with no critical findings must never be told to start over. The report used to print "nothing
// urgent came up" directly above "a rebuild will cost less than the repairs".
const tiredButFine = analyze(snap({
  elapsedMs: 3000, bytes: 300000,
  html: `<html lang="fr"><head><meta charset="utf-8"><title>Boulangerie artisanale de Quebec</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/1.css"><link rel="stylesheet" href="/2.css"><link rel="stylesheet" href="/3.css">
    <link rel="stylesheet" href="/4.css"><link rel="stylesheet" href="/5.css"><link rel="stylesheet" href="/6.css">
    <link rel="stylesheet" href="/7.css">
    <script src="/a.js"></script><script src="/b.js"></script><script src="/c.js"></script><script src="/d.js"></script>
    </head><body><h1>Pain</h1><img src="/a.jpg"><img src="/b.jpg"><img src="/c.jpg"><img src="/d.jpg"><img src="/e.jpg">
    </body></html>`,
}), versions);
ok(tiredButFine.counts.critical === 0, 'the tired fixture really has no criticals');
ok(tiredButFine.recommendation.projectType === 'changes',
  `no criticals means no rebuild verdict (score ${tiredButFine.score}, got ${tiredButFine.recommendation.id})`);

/* ---- language: the words on the page decide, not the metadata ---- */
// Every one of these was a false Bill 96 accusation before the page's own text was consulted. The finding
// names a law and goes out with MAW's name on it, so it has to be right or it has to stay silent.
const langCase = (html, probes = {}) => ids(analyze(snap({ html, probes }), versions))
  .filter((id) => id.startsWith('lang.'));

const FR_BODY = 'Nous cuisons chaque matin des pains au levain et des viennoiseries dans le quartier Saint-Roch, et vous pouvez aussi commander pour vos evenements. Notre equipe vous accueille du mardi au dimanche, et tous nos produits sont faits sur place avec des farines du Quebec. ';
const EN_BODY = 'We bake sourdough bread and pastries every morning in the Saint-Roch neighbourhood, and you can also order for your events. Our team is here from Tuesday to Sunday, and all of our products are made on the premises with flour from this province. ';
const page = (lang, body, extra = '', switcher = '') =>
  `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>Boulangerie Exemple a Quebec</title>${extra}</head>
   <body><h1>Boulangerie</h1><nav>${switcher}</nav><p>${body.repeat(3)}</p></body></html>`;

const allFrench = langCase(page('en-US', FR_BODY));
ok(!allFrench.includes('lang.frenchMissing'), `an all-French site is never accused under Bill 96 (got ${allFrench})`);
ok(allFrench.includes('lang.declaredWrong'), 'an all-French site on an English theme is told its lang attribute is wrong');

for (const [name, switcher] of [
  ['a switcher label inside a span', '<a href="/fr/"><span>FR</span></a>'],
  ['a flag image switcher', '<a href="/fr/"><img src="/fr.png" alt="Francais"></a>'],
  ['French at /fr-ca/ rather than /fr/', '<a href="/fr-ca/"><span>FR</span></a>'],
]) {
  const got = langCase(page('en', EN_BODY, '', switcher), { fr: { status: 405, ok: false } });
  ok(!got.includes('lang.frenchMissing'), `${name}: no accusation when we could not confirm (got ${got})`);
  ok(got.includes('lang.frenchUnclear'), `${name}: asks the question instead (got ${got})`);
}

const reallyEnglishOnly = langCase(page('en', EN_BODY), { fr: { status: 404, ok: false } });
ok(reallyEnglishOnly.includes('lang.frenchMissing'), `English words plus a clean 404 on /fr/ still earns the Charter finding (got ${reallyEnglishOnly})`);

const probeTimedOut = langCase(page('en', EN_BODY), { fr: { status: 0, ok: false } });
ok(!probeTimedOut.includes('lang.frenchMissing'), 'a probe that never answered is not evidence of anything');
ok(probeTimedOut.includes('lang.frenchUnclear'), 'a probe that never answered downgrades to a question');

const tooShort = langCase('<html lang="en"><head><meta charset="utf-8"><title>Studio de design</title></head><body><h1>Studio</h1></body></html>', { fr: { status: 404, ok: false } });
ok(!tooShort.some((id) => id === 'lang.frenchMissing' || id === 'lang.frenchUnclear'), `too little text to judge means silence (got ${tooShort})`);

const properlyBilingual = langCase(page('fr-CA', FR_BODY, '<link rel="alternate" hreflang="en-CA" href="https://example.ca/en/">'));
ok(properlyBilingual.includes('lang.bilingual'), `a properly bilingual site is credited (got ${properlyBilingual})`);
ok(!properlyBilingual.includes('lang.declaredWrong'), 'a French page declaring French is not corrected');

/* ---- mixed content: sub-resources only, never hyperlinks ---- */
const outboundLinks = analyze(snap({
  html: `<html lang="fr"><head><meta charset="utf-8"><title>Boulangerie de quartier</title></head><body><h1>x</h1>
    <a href="http://www.facebook.com/nous">Facebook</a><a href="http://ville.quebec.qc.ca/">Ville</a>
    <link rel="profile" href="http://gmpg.org/xfn/11"></body></html>`,
}), versions);
ok(!ids(outboundLinks).includes('mixedContent'), 'plain http:// hyperlinks are not mixed content');

const realMixed = analyze(snap({
  html: `<html lang="fr"><head><meta charset="utf-8"><title>Boulangerie de quartier</title>
    <link rel="stylesheet" href="http://cdn.example.com/a.css"></head><body><h1>x</h1>
    <a href="http://www.facebook.com/nous">Facebook</a>
    <img src="http://cdn.example.com/a.jpg"><script src="http://x.example/b.js"></script></body></html>`,
}), versions);
const rm = realMixed.findings.find((f) => f.id === 'mixedContent');
ok(rm && rm.params.count === 3, `a stylesheet, an image and a script do count (got ${rm?.params.count})`);

/* ---- a version we inferred may warn, but never accuse ---- */
const cachePlugin = analyze(snap({
  html: `<html lang="en"><head><meta charset="utf-8"><title>Boulangerie Exemple a Quebec</title>
    <script src='/wp-includes/js/jquery/jquery.min.js?ver=3.7.1'></script>
    <link rel='stylesheet' href='/wp-includes/css/dist/block-library/style.min.css?ver=6.6.2'>
    </head><body><h1>x</h1></body></html>`,
}), versions);
ok(cachePlugin.platformVersion === '6.6.2', `jQuery's ?ver= is not the WordPress version (got ${cachePlugin.platformVersion})`);
ok(!ids(cachePlugin).includes('wordpress.outdated'), 'an inferred version never raises a critical');

const readmeWins = analyze(snap({
  html: `<html lang="en"><head><meta charset="utf-8"><title>Boulangerie Exemple a Quebec</title>
    <script src='/wp-includes/js/jquery/jquery.min.js?ver=3.7.1'></script></head><body><h1>x</h1></body></html>`,
  probes: { readme: { status: 200, ok: true, body: '<br /> Version 6.6.2' } },
}), versions);
ok(readmeWins.platformVersion === '6.6.2', `the readme is consulted before any file name (got ${readmeWins.platformVersion})`);

/* ---- a probe that never answered is never reported as a fact ---- */
const silent = ids(analyze(snap({
  probes: { robots: { status: 0, ok: false }, sitemap: { status: 0, ok: false }, insecure: { status: 0, ok: false } },
}), versions));
for (const id of ['seo.robots.missing', 'seo.sitemap.missing', 'https.noRedirect']) {
  ok(!silent.includes(id), `an unanswered probe does not produce ${id}`);
}
const refused = ids(analyze(snap({ probes: { robots: { status: 403, ok: false } } }), versions));
ok(!refused.includes('seo.robots.missing'), 'a 403 on robots.txt is not proof there is no robots.txt');
const trulyAbsent = ids(analyze(snap({ probes: { robots: { status: 404, ok: false } } }), versions));
ok(trulyAbsent.includes('seo.robots.missing'), 'a clean 404 on robots.txt is proof enough');

/* ---- technical SEO: one fixture that trips every check added for it ---- */
const technical = analyze(snap({
  url: 'http://www.technique.ca',
  finalUrl: 'https://www.technique.ca/',
  redirects: ['https://www.technique.ca/', 'https://www.technique.ca/'],
  bytes: 120000,
  headers: { 'content-type': 'text/html', 'x-robots-tag': 'nofollow' },
  html: `<!doctype html><html lang="fr-CA"><head>
    <title>Accueil</title>
    <meta name="description" content="Bienvenue." />
    <meta name="viewport" content="width=1024, user-scalable=no" />
    <meta http-equiv="refresh" content="5; url=/accueil/" />
    <link rel="canonical" href="https://autre-site.ca/" />
    <link rel="alternate" hreflang="en-CA" href="https://www.technique.ca/en/" />
    <link rel="stylesheet" href="/1.css"><link rel="stylesheet" href="/2.css"><link rel="stylesheet" href="/3.css">
    <link rel="stylesheet" href="/4.css"><link rel="stylesheet" href="/5.css"><link rel="stylesheet" href="/6.css">
    <link rel="stylesheet" href="/7.css">
    <meta property="og:title" content="Accueil" />
    </head><body><h1>Accueil</h1><h3>Sous-titre</h3>
    <a href="/contact/"><img src="/icone.png"></a>
    <img src="/a.jpg" alt="a"><img src="/b.jpg" alt="b"><img src="/c.jpg" alt="c">
    <img src="/d.png" alt="d"><img src="/e.png" alt="e">
    </body></html>`,
  probes: {
    robots: { status: 200, ok: true, body: 'User-agent: *\nDisallow: /' },
    sitemap: { status: 200, ok: true, body: '<!doctype html><html><body>Page introuvable</body></html>' },
    notFound: { status: 200, ok: true, url: 'https://www.technique.ca/maw-site-check-does-not-exist-8f21c4/' },
    altHost: { status: 200, ok: true, url: 'https://technique.ca/' },
    fr: { status: 200, ok: true },
  },
}), versions);
for (const id of ['seo.nofollow', 'seo.canonical.mismatch', 'seo.metaRefresh', 'seo.redirectChain',
                  'seo.duplicateHost', 'seo.soft404', 'seo.robots.blocksAll', 'seo.robots.noSitemap',
                  'seo.sitemap.notXml', 'seo.charset.missing', 'seo.thinContent', 'seo.internalLinks',
                  'seo.headingSkips', 'seo.og.incomplete', 'lang.hreflang.noSelf', 'lang.hreflang.noXDefault',
                  'mobile.viewport.noScale', 'mobile.viewport.fixedWidth', 'speed.stylesheets',
                  'speed.legacyImages', 'speed.noCompression', 'a11y.linksNoText']) {
  ok(ids(technical).includes(id), `technical fixture reports ${id}`);
}
ok(!ids(technical).includes('seo.sitemap.present'), 'an HTML sitemap is not a sitemap');
ok(!ids(technical).includes('seo.noindex'), 'nofollow alone is not noindex');
ok(!ids(technical).includes('mobile.viewport.ok'), 'a locked, fixed-width viewport is not "ok"');
const mismatch = technical.findings.find((f) => f.id === 'seo.canonical.mismatch');
ok(mismatch?.evidence === 'https://autre-site.ca/', `canonical evidence quotes the address, got ${mismatch?.evidence}`);
console.log('technical:', technical.score, technical.recommendation.id, ids(technical).length, 'findings');

/* ---- a canonical only counts as a mismatch when it names a different page ---- */
const canonicalPage = (finalUrl, href) => ids(analyze(snap({
  finalUrl,
  html: `<html lang="fr"><head><meta charset="utf-8"><title>Services de reparation</title><link rel="canonical" href="${href}"></head><body><h1>x</h1></body></html>`,
}), versions)).includes('seo.canonical.mismatch');
// A canonical exists to declare the https, non-www, no-trailing-slash version of an address. Reporting it as
// "points somewhere else" because the visitor typed the address a different way would be wrong on a correctly
// built site — and every one of these was a false alarm until the self-check on our own pages caught it.
ok(!canonicalPage('https://example.ca/services/', 'https://example.ca/services'), 'trailing slash alone is not a canonical mismatch');
ok(!canonicalPage('http://example.ca/services/', 'https://example.ca/services/'), 'a canonical naming the https version is not a mismatch');
ok(!canonicalPage('https://www.example.ca/services/', 'https://example.ca/services/'), 'a canonical naming the non-www version is not a mismatch');
ok(!canonicalPage('https://example.ca/services/', 'https://www.example.ca/services/'), 'a canonical naming the www version is not a mismatch');
ok(!canonicalPage('https://example.ca/services/', '/services/'), 'a relative canonical resolves against the page');
ok(canonicalPage('https://example.ca/services/', 'https://example.ca/'), 'a canonical naming a different page is a mismatch');
ok(canonicalPage('https://example.ca/services/', 'https://autre.ca/services/'), 'a canonical naming a different domain is a mismatch');

/* ---- robots.txt: a later Allow: / cancels the site-wide Disallow ---- */
const allowed = analyze(snap({
  probes: { robots: { status: 200, ok: true, body: 'User-agent: *\nDisallow: /\nAllow: /' } },
}), versions);
ok(!ids(allowed).includes('seo.robots.blocksAll'), 'Allow: / cancels the site-wide Disallow');
const blockedForOne = analyze(snap({
  probes: { robots: { status: 200, ok: true, body: 'User-agent: AhrefsBot\nDisallow: /' } },
}), versions);
ok(!ids(blockedForOne).includes('seo.robots.blocksAll'), 'blocking one crawler is not blocking the site');

/* ---- areas: every finding has one, and the summaries agree with the findings ---- */
for (const id of FINDING_IDS) ok(AREAS.includes(FINDING_AREAS[id]), `${id} has a declared area`);
for (const r of [neglected, healthy, builder, technical]) {
  for (const f of r.findings) {
    ok(f.area === FINDING_AREAS[f.id], `${f.id} carries its declared area`);
    ok(POSITIVE_FINDING_IDS.includes(f.id) === (f.severity === 'good'), `${f.id}: severity and POSITIVE_FINDING_IDS agree`);
    ok(!f.evidence || f.evidence.length <= 180, `${f.id}: evidence is trimmed`);
  }
  for (const a of r.areas) {
    const mine = r.findings.filter((f) => f.area === a.area);
    ok(mine.length > 0, `area ${a.area} is only listed when something landed in it`);
    for (const sev of ['critical', 'warning', 'info', 'good']) {
      ok(a.counts[sev] === mine.filter((f) => f.severity === sev).length, `area ${a.area} counts ${sev} correctly`);
    }
    const expected = a.counts.critical > 0 ? 'act' : a.counts.warning > 0 ? 'watch' : 'ok';
    ok(a.status === expected, `area ${a.area} status is ${expected}`);
  }
  ok(r.areas.map((a) => AREAS.indexOf(a.area)).every((n, i, all) => i === 0 || n > all[i - 1]), 'areas come back in AREAS order');
}

/* ---- both languages word every finding, and every problem says what to do about it ---- */
for (const locale of ['en', 'fr']) {
  const copy = JSON.parse(readFileSync(new URL(`../sites/createawebsite-ca/src/i18n/${locale}.json`, import.meta.url), 'utf8')).home.audit;
  for (const id of FINDING_IDS) {
    const c = copy.findings[id];
    ok(!!c?.title && !!c?.detail, `${locale}: ${id} has a title and a detail`);
    ok(POSITIVE_FINDING_IDS.includes(id) ? !c?.fix : !!c?.fix, `${locale}: ${id} has a fix line unless it is good news`);
  }
  for (const area of AREAS) ok(!!copy.areas?.[area]?.label, `${locale}: area ${area} is worded`);
  ok(!!copy.result.areaStatus?.act && !!copy.result.fixLabel && !!copy.result.evidenceLabel, `${locale}: report labels are worded`);
}

/* ---- every emitted id has a place in FINDING_IDS ---- */
const known = new Set(FINDING_IDS);
for (const r of [neglected, healthy, builder, mixed, technical]) {
  for (const id of ids(r)) ok(known.has(id), `finding ${id} is declared in FINDING_IDS`);
}
/* ---- platform detection ---- */
ok(detectPlatform(snap({ html: '<html><body>cdn.shopify.com</body></html>' })).platform === 'shopify', 'shopify detected');
ok(detectPlatform(snap({ html: '<html><body class="woocommerce"><a href="/wp-content/x"></a></body></html>' })).platform === 'woocommerce', 'woocommerce detected');
ok(detectPhpVersion(snap({ headers: { server: 'nginx PHP/8.2.1' } })) === '8.2.1', 'php from server header');

console.log(fails ? `${fails} failure(s)` : 'audit engine OK');
process.exit(fails ? 1 : 0);
