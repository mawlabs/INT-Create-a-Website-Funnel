/**
 * Site audit: turns one fetched snapshot of a website into a list of findings, a score and a recommendation.
 *
 * Pure functions, no DOM and no network — the snapshot is produced by the site's own fetch endpoint
 * (see the audit.php endpoint in each site public directory) and this module only reads it. Runs in the browser inside the audit island.
 *
 * No copy lives here: every finding is an id plus parameters, and the sites' i18n JSON holds the wording in
 * both languages. Version reference data is passed in, so it can be refreshed without touching the logic.
 */

export type Severity = 'critical' | 'warning' | 'info' | 'good';

export interface Probe {
  status: number;
  ok: boolean;
  url?: string;
  location?: string;
  body?: string;
  bytes?: number;
}

export interface Snapshot {
  url: string;
  finalUrl: string;
  status: number;
  elapsedMs: number;
  bytes: number;
  headers: Record<string, string>;   // lowercased names
  html: string;                       // may be truncated; `truncated` says so
  truncated?: boolean;
  redirects?: string[];
  probes?: {
    robots?: Probe;
    sitemap?: Probe;
    wpJson?: Probe;
    readme?: Probe;
    insecure?: Probe;                 // http:// version of the home page
    fr?: Probe;
    en?: Probe;
  };
}

export interface Finding {
  id: string;
  severity: Severity;
  /** Interpolated into the finding's copy, e.g. {version}. */
  params?: Record<string, string | number>;
}

export type Platform =
  | 'wordpress' | 'woocommerce' | 'shopify' | 'wix' | 'squarespace' | 'webflow'
  | 'drupal' | 'joomla' | 'shopify-headless' | 'unknown';

export type RecommendationId = 'healthy' | 'french' | 'fixes' | 'redesign' | 'migration';

export interface AuditReport {
  url: string;
  finalUrl: string;
  platform: Platform;
  platformVersion?: string;
  phpVersion?: string;
  score: number;
  counts: Record<Severity, number>;
  findings: Finding[];
  recommendation: {
    id: RecommendationId;
    /** Prefills the quote flow. */
    projectType: 'changes' | 'redesign';
    currentPlatform: 'wordpress' | 'shopify' | 'woocommerce' | 'other';
    /** Only for the redesign flow. */
    approach?: 'refresh' | 'fullRedesign' | 'migration';
  };
}

/** Reference data, refreshed in the site's src/data/versions.ts rather than here. */
export interface VersionData {
  checkedOn: string;
  wordpress: { latest: string; minSupported: string };
  /** PHP branches: anything below `eol` is unsupported, below `securityOnly` gets security fixes only. */
  php: { current: string; securityOnly: string; eol: string };
  jquery: { latest: string; minSupported: string };
}

/** Every finding the engine can emit. The sites assert that their copy covers all of them at build time. */
export const FINDING_IDS = [
  'https.missing', 'https.ok', 'https.noRedirect', 'https.noHsts', 'mixedContent',
  'wordpress.outdated', 'wordpress.behind', 'wordpress.current', 'wordpress.versionExposed',
  'wordpress.versionUnknown', 'wordpress.readmeExposed',
  'php.eol', 'php.securityOnly', 'php.current', 'php.exposed', 'jquery.outdated',
  'seo.noindex', 'seo.title.missing', 'seo.title.long', 'seo.title.short',
  'seo.description.missing', 'seo.description.long', 'seo.h1.missing', 'seo.h1.multiple',
  'seo.canonical.missing', 'seo.og.missing', 'seo.schema.present', 'seo.schema.missing',
  'seo.robots.missing', 'seo.sitemap.present', 'seo.sitemap.missing',
  'lang.missing', 'lang.frenchMissing', 'lang.hreflangMissing', 'lang.bilingual',
  'mobile.viewport.missing', 'mobile.viewport.ok',
  'speed.htmlWeight', 'speed.htmlWeight.info', 'speed.slowResponse', 'speed.fastResponse',
  'speed.blockingScripts', 'speed.imagesNoDimensions', 'speed.noLazyLoading',
  'a11y.imagesNoAlt', 'privacy.analyticsNoConsent', 'security.headers', 'security.serverExposed',
] as const;

/** Error codes the fetch endpoint can return, so the sites can word them all. */
export const AUDIT_ERROR_CODES = [
  'url_required', 'url_invalid', 'url_scheme', 'url_port', 'url_private', 'url_too_long',
  'dns_failed', 'fetch_failed', 'site_error', 'too_many_redirects', 'rate_limited',
  'method_not_allowed', 'network', 'not_configured',
] as const;

/* ------------------------------------------------------------------ helpers */

const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 18, warning: 7, info: 2, good: 0 };

/** -1 if a < b, 0 if equal, 1 if a > b. Missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

const head = (html: string): string => {
  const m = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1] : html.slice(0, 40000);
};

const attr = (tag: string, name: string): string | undefined => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined;
};

const tags = (html: string, name: string): string[] => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];

const metaContent = (html: string, nameOrProperty: string): string | undefined => {
  for (const tag of tags(html, 'meta')) {
    const n = (attr(tag, 'name') ?? attr(tag, 'property') ?? '').toLowerCase();
    if (n === nameOrProperty.toLowerCase()) return attr(tag, 'content');
  }
  return undefined;
};

const textOf = (html: string, tag: string): string | undefined => {
  const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : undefined;
};

/* --------------------------------------------------------------- detection */

export function detectPlatform(snap: Snapshot): { platform: Platform; version?: string } {
  const html = snap.html;
  const h = snap.headers;
  const generator = metaContent(html, 'generator') ?? '';

  if (/shopify/i.test(generator) || /cdn\.shopify\.com/i.test(html) || h['x-shopid'] || /Shopify\.theme/.test(html)) {
    return { platform: 'shopify' };
  }
  if (/wix\.com/i.test(generator) || h['x-wix-request-id'] || /static\.wixstatic\.com/i.test(html)) {
    return { platform: 'wix' };
  }
  if (/squarespace/i.test(generator) || /static1\.squarespace\.com/i.test(html) || /Squarespace\.afterBodyLoad/.test(html)) {
    return { platform: 'squarespace' };
  }
  if (/webflow/i.test(generator) || /data-wf-page/i.test(html) || /assets\.website-files\.com/i.test(html)) {
    return { platform: 'webflow' };
  }
  const drupal = generator.match(/Drupal\s*([\d.]+)?/i);
  if (drupal || h['x-drupal-cache'] || h['x-generator']?.match(/drupal/i)) {
    return { platform: 'drupal', version: drupal?.[1] };
  }
  if (/Joomla/i.test(generator)) return { platform: 'joomla' };

  const wpVersion = detectWordPressVersion(snap);
  const isWp = !!wpVersion
    || /WordPress/i.test(generator)
    || /\/wp-(content|includes)\//i.test(html)
    || snap.probes?.wpJson?.ok === true
    || !!h['link']?.match(/wp-json/i);
  if (isWp) {
    const woo = /WooCommerce\s*([\d.]+)/i.exec(html) ?? /woocommerce[-_]/i.exec(html);
    if (woo || /class="[^"]*woocommerce/i.test(html)) return { platform: 'woocommerce', version: wpVersion };
    return { platform: 'wordpress', version: wpVersion };
  }
  return { platform: 'unknown' };
}

function detectWordPressVersion(snap: Snapshot): string | undefined {
  const generator = metaContent(snap.html, 'generator') ?? '';
  const fromMeta = generator.match(/WordPress\s+([\d.]+)/i);
  if (fromMeta) return fromMeta[1];
  const fromAsset = snap.html.match(/\/wp-(?:includes|admin)\/[^"']*[?&]ver=([\d]+\.[\d.]+)/i);
  if (fromAsset) return fromAsset[1];
  const readme = snap.probes?.readme;
  if (readme?.ok && readme.body) {
    const m = readme.body.match(/Version\s+([\d.]+)/i);
    if (m) return m[1];
  }
  return undefined;
}

export function detectPhpVersion(snap: Snapshot): string | undefined {
  const powered = snap.headers['x-powered-by'] ?? '';
  const m = powered.match(/PHP\/([\d.]+)/i);
  if (m) return m[1];
  const server = snap.headers['server'] ?? '';
  const m2 = server.match(/PHP\/([\d.]+)/i);
  return m2 ? m2[1] : undefined;
}

function detectJQuery(html: string): string | undefined {
  const m = html.match(/jquery[/-]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i) ?? html.match(/jquery\/(\d+\.\d+(?:\.\d+)?)\//i);
  return m ? m[1] : undefined;
}

const CMP_SIGNS = /cookiebot|onetrust|cookieconsent|cookie-law-info|complianz|axeptio|didomi|klaro|tarteaucitron|borlabs|termly|iubenda|usercentrics|osano|cookieyes/i;
const ANALYTICS_SIGNS = /googletagmanager\.com\/gtag|google-analytics\.com\/(analytics|ga)\.js|gtag\s*\(|_gaq\.push|googletagmanager\.com\/gtm\.js|facebook\.net\/[^"']*fbevents/i;

/* ---------------------------------------------------------------- analysis */

export function analyze(snap: Snapshot, versions: VersionData): AuditReport {
  const findings: Finding[] = [];
  const add = (id: string, severity: Severity, params?: Record<string, string | number>) => findings.push({ id, severity, params });

  const html = snap.html;
  const h = snap.headers;
  const doc = head(html);
  const https = snap.finalUrl.startsWith('https://');
  const { platform, version: platformVersion } = detectPlatform(snap);
  const phpVersion = detectPhpVersion(snap);

  /* ---- connection ---- */
  if (!https) {
    add('https.missing', 'critical');
  } else {
    add('https.ok', 'good');
    const insecure = snap.probes?.insecure;
    if (insecure && !(insecure.status >= 300 && insecure.status < 400 && (insecure.location ?? '').startsWith('https://'))) {
      add('https.noRedirect', 'warning');
    }
    if (!h['strict-transport-security']) add('https.noHsts', 'info');
  }

  const mixed = https
    ? (html.match(/(?:src|href)\s*=\s*["']http:\/\/(?!(?:www\.)?(?:w3\.org|schema\.org|purl\.org|ogp\.me|gmpg\.org|xmlns))/gi) ?? []).length
    : 0;
  if (mixed > 0) add('mixedContent', 'critical', { count: mixed });

  /* ---- platform and versions ---- */
  if (platform === 'wordpress' || platform === 'woocommerce') {
    if (platformVersion) {
      if (compareVersions(platformVersion, versions.wordpress.minSupported) < 0) {
        add('wordpress.outdated', 'critical', { version: platformVersion, latest: versions.wordpress.latest });
      } else if (compareVersions(platformVersion, versions.wordpress.latest) < 0) {
        add('wordpress.behind', 'warning', { version: platformVersion, latest: versions.wordpress.latest });
      } else {
        add('wordpress.current', 'good', { version: platformVersion });
      }
      add('wordpress.versionExposed', 'info', { version: platformVersion });
    } else {
      add('wordpress.versionUnknown', 'info');
    }
    if (snap.probes?.readme?.ok) add('wordpress.readmeExposed', 'warning');
  }

  if (phpVersion) {
    if (compareVersions(phpVersion, versions.php.eol) < 0) {
      add('php.eol', 'critical', { version: phpVersion, current: versions.php.current });
    } else if (compareVersions(phpVersion, versions.php.securityOnly) < 0) {
      add('php.securityOnly', 'warning', { version: phpVersion, current: versions.php.current });
    } else {
      add('php.current', 'good', { version: phpVersion });
    }
    add('php.exposed', 'info', { version: phpVersion });
  }

  const jquery = detectJQuery(html);
  if (jquery && compareVersions(jquery, versions.jquery.minSupported) < 0) {
    add('jquery.outdated', 'warning', { version: jquery, latest: versions.jquery.latest });
  }

  /* ---- findability ---- */
  const robotsMeta = (metaContent(html, 'robots') ?? '').toLowerCase();
  const xRobots = (h['x-robots-tag'] ?? '').toLowerCase();
  if (robotsMeta.includes('noindex') || xRobots.includes('noindex')) add('seo.noindex', 'critical');

  const title = textOf(html, 'title');
  if (!title) add('seo.title.missing', 'critical');
  else if (title.length > 65) add('seo.title.long', 'info', { length: title.length });
  else if (title.length < 15) add('seo.title.short', 'info', { length: title.length });

  const description = metaContent(html, 'description');
  if (!description) add('seo.description.missing', 'warning');
  else if (description.length > 165) add('seo.description.long', 'info', { length: description.length });

  const h1s = html.match(/<h1\b[^>]*>/gi) ?? [];
  if (h1s.length === 0) add('seo.h1.missing', 'warning');
  else if (h1s.length > 1) add('seo.h1.multiple', 'info', { count: h1s.length });

  if (!/<link[^>]+rel\s*=\s*["']?canonical/i.test(doc)) add('seo.canonical.missing', 'info');
  if (!metaContent(html, 'og:title') && !metaContent(html, 'og:image')) add('seo.og.missing', 'info');

  const hasSchema = /application\/ld\+json/i.test(html) || /itemscope/i.test(html);
  if (hasSchema) add('seo.schema.present', 'good');
  else add('seo.schema.missing', 'info');

  const robots = snap.probes?.robots;
  if (!robots?.ok) add('seo.robots.missing', 'warning');
  const sitemapFromRobots = /^\s*sitemap:\s*http/im.test(robots?.body ?? '');
  if (snap.probes?.sitemap?.ok || sitemapFromRobots) add('seo.sitemap.present', 'good');
  else add('seo.sitemap.missing', 'warning');

  /* ---- languages (Charter of the French Language, updated by Bill 96) ---- */
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? '';
  const lang = (attr(htmlTag, 'lang') ?? '').toLowerCase();
  const hreflangs = (html.match(/hreflang\s*=\s*["']([a-z-]+)["']/gi) ?? []).map((s) => s.toLowerCase());
  const hasFrHreflang = hreflangs.some((s) => s.includes('"fr') || s.includes("'fr"));
  const frProbe = snap.probes?.fr?.ok === true;
  const frLink = /(<a[^>]*>\s*(fran[çc]ais|fr)\s*<\/a>)/i.test(html);
  const frenchSomewhere = lang.startsWith('fr') || hasFrHreflang || frProbe || frLink;

  if (!lang) add('lang.missing', 'warning');
  if (!frenchSomewhere) {
    add('lang.frenchMissing', 'critical');
  } else if (!lang.startsWith('fr') && !hasFrHreflang && (frProbe || frLink)) {
    add('lang.hreflangMissing', 'warning');
  } else if (lang.startsWith('fr') || hasFrHreflang) {
    add('lang.bilingual', 'good');
  }

  /* ---- phone and speed ---- */
  if (!metaContent(html, 'viewport')) add('mobile.viewport.missing', 'critical');
  else add('mobile.viewport.ok', 'good');

  const kb = Math.round(snap.bytes / 1024);
  if (kb > 500) add('speed.htmlWeight', 'warning', { kb });
  else if (kb > 200) add('speed.htmlWeight.info', 'info', { kb });

  if (snap.elapsedMs > 2500) add('speed.slowResponse', 'warning', { ms: snap.elapsedMs });
  else if (snap.elapsedMs < 800) add('speed.fastResponse', 'good', { ms: snap.elapsedMs });

  const blocking = tags(doc, 'script').filter((t) => attr(t, 'src') && !/\basync\b|\bdefer\b/i.test(t) && (attr(t, 'type') ?? '') !== 'module').length;
  if (blocking > 3) add('speed.blockingScripts', 'warning', { count: blocking });

  const imgs = tags(html, 'img');
  const noAlt = imgs.filter((t) => attr(t, 'alt') === undefined).length;
  if (noAlt > 0) add('a11y.imagesNoAlt', imgs.length > 0 && noAlt / imgs.length > 0.3 ? 'warning' : 'info', { count: noAlt, total: imgs.length });
  const noDims = imgs.filter((t) => attr(t, 'width') === undefined || attr(t, 'height') === undefined).length;
  if (noDims > 4) add('speed.imagesNoDimensions', 'info', { count: noDims });
  const lazy = imgs.filter((t) => (attr(t, 'loading') ?? '').toLowerCase() === 'lazy').length;
  if (imgs.length > 8 && lazy === 0) add('speed.noLazyLoading', 'info', { count: imgs.length });

  /* ---- privacy and hardening ---- */
  const analytics = ANALYTICS_SIGNS.test(html);
  const cmp = CMP_SIGNS.test(html);
  if (analytics && !cmp) add('privacy.analyticsNoConsent', 'warning');

  const missingHeaders = ['x-content-type-options', 'referrer-policy', 'content-security-policy'].filter((n) => !h[n]);
  if (missingHeaders.length >= 2) add('security.headers', 'info', { count: missingHeaders.length });
  if (/apache\/[\d.]+|nginx\/[\d.]+/i.test(h['server'] ?? '')) add('security.serverExposed', 'info', { server: h['server'] });

  /* ---- score and recommendation ---- */
  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0, good: 0 };
  for (const f of findings) counts[f.severity] += 1;
  // A curve rather than a subtraction: a neglected site should rank low without bottoming out at zero, which
  // reads as an insult rather than a measurement.
  const penalty = findings.reduce((t, f) => t + SEVERITY_WEIGHT[f.severity], 0);
  const score = Math.max(1, Math.min(100, Math.round(100 / (1 + penalty / 45))));

  const order: Severity[] = ['critical', 'warning', 'info', 'good'];
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  const currentPlatform: AuditReport['recommendation']['currentPlatform'] =
    platform === 'woocommerce' ? 'woocommerce' : platform === 'shopify' ? 'shopify' : platform === 'wordpress' ? 'wordpress' : 'other';
  const builder = platform === 'wix' || platform === 'squarespace' || platform === 'webflow';
  const frenchMissing = findings.some((f) => f.id === 'lang.frenchMissing');

  let recommendation: AuditReport['recommendation'];
  if (score >= 85 && counts.critical === 0) {
    recommendation = { id: 'healthy', projectType: 'changes', currentPlatform };
  } else if (score < 55 && builder) {
    recommendation = { id: 'migration', projectType: 'redesign', currentPlatform, approach: 'migration' };
  } else if (score < 55) {
    recommendation = { id: 'redesign', projectType: 'redesign', currentPlatform, approach: 'fullRedesign' };
  } else if (frenchMissing && counts.critical <= 1) {
    recommendation = { id: 'french', projectType: 'changes', currentPlatform };
  } else {
    recommendation = { id: 'fixes', projectType: 'changes', currentPlatform };
  }

  return { url: snap.url, finalUrl: snap.finalUrl, platform, platformVersion, phpVersion, score, counts, findings, recommendation };
}

/** A one-line, copy-free summary for the lead record. */
export function summarize(report: AuditReport): string[] {
  return [
    `Site audit: ${report.finalUrl}`,
    `Platform: ${report.platform}${report.platformVersion ? ` ${report.platformVersion}` : ''}${report.phpVersion ? `, PHP ${report.phpVersion}` : ''}`,
    `Score: ${report.score}/100 (${report.counts.critical} critical, ${report.counts.warning} warnings, ${report.counts.info} notes)`,
    `Findings: ${report.findings.filter((f) => f.severity !== 'good').map((f) => f.id).join(', ') || 'none'}`,
    `Recommended: ${report.recommendation.id}`,
  ];
}
