/**
 * Site audit: turns one fetched snapshot of a website into a list of findings, a score and a recommendation.
 *
 * Pure functions, no DOM and no network — the snapshot is produced by the site's own fetch endpoint
 * (see the audit.php endpoint in each site public directory) and this module only reads it. Runs in the browser inside the audit island.
 *
 * No copy lives here: every finding is an id plus parameters, and the sites' i18n JSON holds the wording in
 * both languages. Version reference data is passed in, so it can be refreshed without touching the logic.
 *
 * Every finding belongs to an area (safety, being found, French, and so on) so the report can be read by
 * someone who does not know what a canonical tag is, and carries optional `evidence`: the exact thing we
 * saw on the page. Evidence is never translated — it is a quotation, not wording.
 */

export type Severity = 'critical' | 'warning' | 'info' | 'good';

/** The plain-language buckets the report is organised into, in the order they are shown. */
export const AREAS = ['security', 'software', 'findability', 'languages', 'phone', 'speed', 'access', 'privacy'] as const;
export type Area = (typeof AREAS)[number];

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
    notFound?: Probe;                 // a path that cannot exist, to catch soft 404s
    altHost?: Probe;                  // www vs non-www, to catch a duplicated site
    xmlrpc?: Probe;
  };
}

export interface Finding {
  id: FindingId;
  severity: Severity;
  area: Area;
  /** Interpolated into the finding's copy, e.g. {version}. */
  params?: Record<string, string | number>;
  /** What we actually saw, quoted back. Not copy: never translated. */
  evidence?: string;
}

export type Platform =
  | 'wordpress' | 'woocommerce' | 'shopify' | 'wix' | 'squarespace' | 'webflow'
  | 'drupal' | 'joomla' | 'shopify-headless' | 'unknown';

export type RecommendationId = 'healthy' | 'french' | 'fixes' | 'redesign' | 'migration';

/** How an area came out. Three words, not a second score: one number to argue with is enough. */
export type AreaStatus = 'act' | 'watch' | 'ok';

export interface AreaSummary {
  area: Area;
  status: AreaStatus;
  counts: Record<Severity, number>;
}

export interface AuditReport {
  url: string;
  finalUrl: string;
  platform: Platform;
  platformVersion?: string;
  phpVersion?: string;
  score: number;
  counts: Record<Severity, number>;
  /** Only the areas something was found in, in AREAS order. */
  areas: AreaSummary[];
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
  'wordpress.versionUnknown', 'wordpress.readmeExposed', 'wordpress.xmlrpcOpen',
  'php.eol', 'php.securityOnly', 'php.current', 'php.exposed', 'jquery.outdated',
  'seo.noindex', 'seo.nofollow', 'seo.title.missing', 'seo.title.long', 'seo.title.short',
  'seo.description.missing', 'seo.description.long', 'seo.h1.missing', 'seo.h1.multiple',
  'seo.headingSkips', 'seo.canonical.missing', 'seo.canonical.mismatch', 'seo.metaRefresh',
  'seo.redirectChain', 'seo.duplicateHost', 'seo.soft404',
  'seo.og.missing', 'seo.og.incomplete', 'seo.schema.present', 'seo.schema.missing',
  'seo.robots.missing', 'seo.robots.blocksAll', 'seo.robots.noSitemap',
  'seo.sitemap.present', 'seo.sitemap.missing', 'seo.sitemap.notXml',
  'seo.charset.missing', 'seo.thinContent', 'seo.internalLinks',
  'lang.missing', 'lang.frenchMissing', 'lang.frenchUnclear', 'lang.declaredWrong',
  'lang.hreflangMissing', 'lang.bilingual', 'lang.hreflang.noSelf', 'lang.hreflang.noXDefault',
  'mobile.viewport.missing', 'mobile.viewport.ok', 'mobile.viewport.noScale', 'mobile.viewport.fixedWidth',
  'speed.htmlWeight', 'speed.htmlWeight.info', 'speed.slowResponse', 'speed.fastResponse',
  'speed.blockingScripts', 'speed.stylesheets', 'speed.imagesNoDimensions', 'speed.noLazyLoading',
  'speed.legacyImages', 'speed.noCompression',
  'a11y.imagesNoAlt', 'a11y.linksNoText', 'privacy.analyticsNoConsent',
  'security.headers', 'security.serverExposed',
] as const;

export type FindingId = (typeof FINDING_IDS)[number];

/**
 * Which part of the report each finding belongs to. Static rather than passed at the call site, so a finding
 * cannot end up in two places, and so TypeScript notices when a new id has no home.
 */
export const FINDING_AREAS: Record<FindingId, Area> = {
  'https.missing': 'security', 'https.ok': 'security', 'https.noRedirect': 'security',
  'https.noHsts': 'security', 'mixedContent': 'security',
  'security.headers': 'security', 'security.serverExposed': 'security', 'wordpress.xmlrpcOpen': 'security',
  'wordpress.readmeExposed': 'security',

  'wordpress.outdated': 'software', 'wordpress.behind': 'software', 'wordpress.current': 'software',
  'wordpress.versionExposed': 'software', 'wordpress.versionUnknown': 'software',
  'php.eol': 'software', 'php.securityOnly': 'software', 'php.current': 'software',
  'php.exposed': 'software', 'jquery.outdated': 'software',

  'seo.noindex': 'findability', 'seo.nofollow': 'findability',
  'seo.title.missing': 'findability', 'seo.title.long': 'findability', 'seo.title.short': 'findability',
  'seo.description.missing': 'findability', 'seo.description.long': 'findability',
  'seo.h1.missing': 'findability', 'seo.h1.multiple': 'findability', 'seo.headingSkips': 'findability',
  'seo.canonical.missing': 'findability', 'seo.canonical.mismatch': 'findability',
  'seo.metaRefresh': 'findability', 'seo.redirectChain': 'findability',
  'seo.duplicateHost': 'findability', 'seo.soft404': 'findability',
  'seo.og.missing': 'findability', 'seo.og.incomplete': 'findability',
  'seo.schema.present': 'findability', 'seo.schema.missing': 'findability',
  'seo.robots.missing': 'findability', 'seo.robots.blocksAll': 'findability', 'seo.robots.noSitemap': 'findability',
  'seo.sitemap.present': 'findability', 'seo.sitemap.missing': 'findability', 'seo.sitemap.notXml': 'findability',
  'seo.charset.missing': 'findability', 'seo.thinContent': 'findability', 'seo.internalLinks': 'findability',

  'lang.missing': 'languages', 'lang.frenchMissing': 'languages', 'lang.frenchUnclear': 'languages',
  'lang.declaredWrong': 'languages', 'lang.hreflangMissing': 'languages', 'lang.bilingual': 'languages',
  'lang.hreflang.noSelf': 'languages', 'lang.hreflang.noXDefault': 'languages',

  'mobile.viewport.missing': 'phone', 'mobile.viewport.ok': 'phone',
  'mobile.viewport.noScale': 'phone', 'mobile.viewport.fixedWidth': 'phone',

  'speed.htmlWeight': 'speed', 'speed.htmlWeight.info': 'speed', 'speed.slowResponse': 'speed',
  'speed.fastResponse': 'speed', 'speed.blockingScripts': 'speed', 'speed.stylesheets': 'speed',
  'speed.imagesNoDimensions': 'speed', 'speed.noLazyLoading': 'speed',
  'speed.legacyImages': 'speed', 'speed.noCompression': 'speed',

  'a11y.imagesNoAlt': 'access', 'a11y.linksNoText': 'access',

  'privacy.analyticsNoConsent': 'privacy',
};

/**
 * The findings that report something already in order. They carry no "how to fix" line, and the sites'
 * build-time copy check knows not to ask for one.
 */
export const POSITIVE_FINDING_IDS: readonly FindingId[] = [
  'https.ok', 'wordpress.current', 'php.current', 'seo.schema.present', 'seo.sitemap.present',
  'lang.bilingual', 'mobile.viewport.ok', 'speed.fastResponse',
];

/** Error codes the fetch endpoint can return, so the sites can word them all. */
export const AUDIT_ERROR_CODES = [
  'url_required', 'url_invalid', 'url_scheme', 'url_port', 'url_private', 'url_too_long',
  'dns_failed', 'fetch_failed', 'site_error', 'site_blocked', 'too_many_redirects', 'redirect_unreachable',
  'rate_limited', 'server_unavailable',
  'method_not_allowed', 'network', 'not_configured',
] as const;

/* ------------------------------------------------------------------ helpers */

/**
 * How much HTML the regex passes are allowed to see.
 *
 * Several patterns here are a lazy quantifier between two anchors — `<script>…</script>`, `<a>…</a>`,
 * `<!--…-->`. On a page full of OPENED but never closed tags each start position scans to the end of the
 * document looking for a close that is not there, which is quadratic. Measured: a page of repeated
 * `<script>x` costs 69 ms at 60 KB, 262 ms at 120 KB, 1.2 s at 250 KB and **43 seconds at MAX_BYTES** — all
 * synchronous, in the visitor's tab, with the status still reading "checking".
 *
 * A hostile site can serve that deliberately, and our own truncation at MAX_BYTES can produce it by accident
 * by cutting mid-tag.
 *
 * Two fixes, because there were two causes. The tag scans now exclude `<` as well as `>` (see `tags` below),
 * which took a page of `'<'.repeat(n)` from 887 SECONDS at MAX_BYTES to 8 ms. What remains is the lazy
 * `[\s\S]*?` pairs — `<script>…</script>` and `<a>…</a>` — which are still quadratic on unclosed tags and
 * cannot be bounded by excluding a character. Hence this cap: at 150 KB those two together measure about
 * 700 ms worst case, against 78 seconds at MAX_BYTES.
 *
 * A home page with more markup than 150 KB is already being told its page is heavy, from snap.bytes, which
 * this does not affect.
 */
const ANALYSIS_MAX_CHARS = 150_000;

const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 18, warning: 7, info: 1, good: 0 };
/** Tunes how fast the curve falls. Raising it is kinder to sites with a long tail of small notes. */
const SCORE_SOFTENER = 60;
const EVIDENCE_MAX = 180;
const PARAM_MAX = 60;

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
  const m = html.match(/<head[^<>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1] : html.slice(0, 40000);
};

const attr = (tag: string, name: string): string | undefined => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined;
};

/**
 * Every tag scan here excludes `<` as well as `>`.
 *
 * `[^>]*` looks equivalent and is catastrophically not: on a run of `<` with no `>` anywhere, the quantifier
 * consumes the rest of the document from every start position before failing, which is quadratic. Measured
 * on `'<'.repeat(n)`: 3.8 s at 100 KB, 59 s at 400 KB, **887 seconds at MAX_BYTES**. Excluding `<` makes each
 * bad position fail on its first character instead. The cost is that a raw `<` inside a quoted attribute
 * value no longer matches, which is rare, usually malformed, and worth it.
 */
const tags = (html: string, name: string): string[] => html.match(new RegExp(`<${name}\\b[^<>]*>`, 'gi')) ?? [];

const metaContent = (html: string, nameOrProperty: string): string | undefined => {
  for (const tag of tags(html, 'meta')) {
    const n = (attr(tag, 'name') ?? attr(tag, 'property') ?? '').toLowerCase();
    if (n === nameOrProperty.toLowerCase()) return attr(tag, 'content');
  }
  return undefined;
};

const textOf = (html: string, tag: string): string | undefined => {
  const m = html.match(new RegExp(`<${tag}\\b[^<>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<[^<>]*>/g, '').replace(/\s+/g, ' ').trim() : undefined;
};

/** Everything a visitor would read, with markup and scripts taken out. */
const visibleText = (html: string): string => html
  .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^<>]*>/g, ' ')
  .replace(/&[a-z#0-9]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Host and path only — no scheme, no `www.`, no trailing slash — because those three differences are what a
 * canonical (or an hreflang self-link) exists to declare. We reach the page at whatever address the visitor
 * typed; a canonical naming the https version, or the non-www one, is the tag doing its job, and reporting
 * that as "points somewhere else" would be wrong on a correctly built site. A different path or a genuinely
 * different domain still counts. The https and duplicate-host stories are told by their own findings.
 */
const sameAddress = (a: string, b: string): boolean => {
  const norm = (u: string): string => {
    try {
      const x = new URL(u, b);
      return `${x.host.replace(/^www\./i, '')}${x.pathname.replace(/\/+$/, '')}`.toLowerCase();
    } catch {
      return u.replace(/\/+$/, '').toLowerCase();
    }
  };
  return norm(a) === norm(b);
};

/**
 * The `Disallow: /` line that hides the whole site from search engines, if there is one.
 * Only rules addressed to every crawler count — blocking one scraper by name is a choice, not a mistake —
 * and an equally specific `Allow: /` anywhere in those rules wins, which is how crawlers read it.
 */
function robotsBlocksAll(body: string): string | undefined {
  let appliesToEveryone = false;
  let blocking: string | undefined;
  let allowsRoot = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') { appliesToEveryone = value === '*'; continue; }
    if (!appliesToEveryone) continue;
    if (key === 'allow' && value === '/') allowsRoot = true;
    if (key === 'disallow' && value === '/') blocking ??= line;
  }
  return allowsRoot ? undefined : blocking;
}

/**
 * Elements that actually load something, and the attribute that loads it.
 *
 * A hyperlink is not one of them. `<a href="http://facebook.com/…">` is an ordinary link to an ordinary site
 * and the browser does nothing about it; matching any `href` made every page with an old footer link into a
 * red critical reading "images or scripts get blocked, which breaks how the page looks". `rel` decides
 * whether a `<link>` loads anything — `profile` and `pingback` do not.
 */
const SUBRESOURCE: Record<string, string[]> = {
  img: ['src', 'srcset'], script: ['src'], iframe: ['src'], frame: ['src'],
  video: ['src', 'poster'], audio: ['src'], source: ['src', 'srcset'],
  embed: ['src'], track: ['src'], object: ['data'], input: ['src'],
  link: ['href'], form: ['action'],
};
const LINK_LOADS = /(^|\s)(stylesheet|preload|prefetch|prerender|icon|apple-touch-icon|manifest)(\s|$)/i;

function insecureSubresources(html: string): string[] {
  const found = new Set<string>();
  for (const [name, attrs] of Object.entries(SUBRESOURCE)) {
    for (const tag of tags(html, name)) {
      if (name === 'link' && !LINK_LOADS.test(attr(tag, 'rel') ?? '')) continue;
      if (name === 'input' && (attr(tag, 'type') ?? '').toLowerCase() !== 'image') continue;
      for (const a of attrs) {
        const value = attr(tag, a);
        if (!value) continue;
        // srcset is a comma-separated list of "url descriptor" pairs; everything else is one url.
        for (const candidate of value.split(',')) {
          const url = candidate.trim().split(/\s+/)[0];
          if (/^http:\/\//i.test(url)) found.add(url);
        }
      }
    }
  }
  return [...found];
}

/* --------------------------------------------------------------- detection */

export function detectPlatform(snap: Snapshot): { platform: Platform; version?: string; authoritative?: boolean } {
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
  const drupal = generator.match(/Drupal\s*([\d.]{1,20})?/i);
  if (drupal || h['x-drupal-cache'] || h['x-generator']?.match(/drupal/i)) {
    return { platform: 'drupal', version: drupal?.[1] };
  }
  if (/Joomla/i.test(generator)) return { platform: 'joomla' };

  const wp = detectWordPressVersion(snap);
  const wpVersion = wp.version;
  const isWp = !!wpVersion
    || /WordPress/i.test(generator)
    || /\/wp-(content|includes)\//i.test(html)
    || snap.probes?.wpJson?.ok === true
    || !!h['link']?.match(/wp-json/i);
  if (isWp) {
    const woo = /WooCommerce\s*([\d.]{1,20})/i.exec(html) ?? /woocommerce[-_]/i.exec(html);
    if (woo || /class="[^"]*woocommerce/i.test(html)) return { platform: 'woocommerce', version: wpVersion, authoritative: wp.authoritative };
    return { platform: 'wordpress', version: wpVersion, authoritative: wp.authoritative };
  }
  return { platform: 'unknown' };
}

/**
 * Core assets whose `?ver=` really does track the WordPress release. Deliberately a short list: the old
 * catch-all matched `/wp-includes/js/jquery/jquery.min.js?ver=3.7.1` — and since every caching plugin worth
 * using excludes jQuery from concatenation, that is often the FIRST versioned asset in the document. A
 * patched, hardened site was being told it was running WordPress 3.7.1 and was no longer supported.
 */
const CORE_ASSET = /\/wp-(?:includes|admin)\/(?:css\\?\/dist\\?\/block-library|css\\?\/classic-themes|css\\?\/dashicons|js\\?\/wp-emoji-release)[^"']*[?&]ver=(\d+\.\d+(?:\.\d+)?)/i;

/**
 * `authoritative` says whether the site told us its version or we guessed it from a file name. Only the
 * site's own word is allowed to raise a critical: being wrong about this in front of someone's web guy costs
 * more than the finding is worth.
 */
function detectWordPressVersion(snap: Snapshot): { version?: string; authoritative: boolean } {
  const generator = metaContent(snap.html, 'generator') ?? '';
  const fromMeta = generator.match(/WordPress\s+([\d.]{1,20})/i);
  if (fromMeta) return { version: fromMeta[1], authoritative: true };

  const readme = snap.probes?.readme;
  if (readme?.ok && readme.body) {
    const m = readme.body.match(/Version\s+([\d.]{1,20})/i);
    if (m) return { version: m[1], authoritative: true };
  }

  const fromAsset = snap.html.match(CORE_ASSET);
  // Below 5.0 the block library did not exist, so a match that old is a misread, not an ancient site.
  if (fromAsset && compareVersions(fromAsset[1], '5.0') >= 0) return { version: fromAsset[1], authoritative: false };
  return { authoritative: false };
}

export function detectPhpVersion(snap: Snapshot): string | undefined {
  const powered = snap.headers['x-powered-by'] ?? '';
  const m = powered.match(/PHP\/([\d.]{1,20})/i);
  if (m) return m[1];
  const server = snap.headers['server'] ?? '';
  const m2 = server.match(/PHP\/([\d.]{1,20})/i);
  return m2 ? m2[1] : undefined;
}

function detectJQuery(html: string): string | undefined {
  const m = html.match(/jquery[/-]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i) ?? html.match(/jquery\/(\d+\.\d+(?:\.\d+)?)\//i);
  return m ? m[1] : undefined;
}

const CMP_SIGNS = /cookiebot|onetrust|cookieconsent|cookie-law-info|complianz|axeptio|didomi|klaro|tarteaucitron|borlabs|termly|iubenda|usercentrics|osano|cookieyes/i;
const ANALYTICS_SIGNS = /googletagmanager\.com\/gtag|google-analytics\.com\/(analytics|ga)\.js|gtag\s*\(|_gaq\.push|googletagmanager\.com\/gtm\.js|facebook\.net\/[^"']*fbevents/i;

/** Did this probe come back at all? status 0 means no answer: a timeout, a refusal, or one we skipped. */
const answered = (p?: Probe): boolean => !!p && p.status > 0;

/**
 * Is this probe positive evidence that the thing is NOT there? Only a clean 404 or 410 is. A 403, a 429, a
 * 5xx or no answer at all means we could not tell — and "we could not tell" must never reach somebody as a
 * statement of fact about their website.
 */
const missing = (p?: Probe): boolean => !!p && (p.status === 404 || p.status === 410);

/**
 * Which language a page is written in, judged from its own words rather than from what it declares.
 *
 * Deliberately crude and deliberately cautious: a short list of function words that belong to one language
 * and not the other, over the first several hundred words, and it answers 'unknown' unless one side clearly
 * wins. Its only job is to stop the tool telling an all-French business that it has no French.
 */
const FRENCH_WORDS = /\b(?:les|des|une|nous|vous|pour|avec|dans|est|sont|votre|notre|cette|qui|que|aux|du|et|sur|chez|leur|tous|toute|aussi|sans|mais|plus|ainsi|depuis|toujours|entre|selon|dont|alors|comme|fait|peut|ses|leurs|cela)\b/gi;
const ENGLISH_WORDS = /\b(?:the|and|with|for|you|your|our|from|this|that|are|is|have|has|about|more|will|can|been|was|were|they|their|what|when|which|would|there|out|up|but|all|any|how|its|also|into|than|then|them|these|some)\b/gi;
const LANGUAGE_SAMPLE = 400;

function languageOfText(text: string): 'fr' | 'en' | 'unknown' {
  const sample = text.split(' ').slice(0, LANGUAGE_SAMPLE).join(' ');
  const fr = (sample.match(FRENCH_WORDS) ?? []).length;
  const en = (sample.match(ENGLISH_WORDS) ?? []).length;
  // Enough signal to be worth anything, and a clear enough margin that a few loan words cannot flip it.
  if (fr >= 8 && fr > en * 1.5) return 'fr';
  if (en >= 8 && en > fr * 1.5) return 'en';
  return 'unknown';
}

/* ---------------------------------------------------------------- analysis */

export function analyze(snap: Snapshot, versions: VersionData): AuditReport {
  const findings: Finding[] = [];
  const add = (id: FindingId, severity: Severity, params?: Record<string, string | number>, evidence?: string) => {
    findings.push({
      id,
      severity,
      area: FINDING_AREAS[id],
      // `evidence` was clipped and `params` was not, so a target-supplied version string went through at full
      // length into the report, the downloadable file and — via summarize() — the lead that reaches the CRM.
      // An oversized lead POST fails and is reported to the visitor as unrecorded, which loses the lead
      // silently: the worst outcome a lead magnet has.
      params: params && Object.fromEntries(Object.entries(params).map(
        ([k, v]) => [k, typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, PARAM_MAX) : v],
      )),
      evidence: evidence ? evidence.replace(/\s+/g, ' ').trim().slice(0, EVIDENCE_MAX) : undefined,
    });
  };

  const html = snap.html.length > ANALYSIS_MAX_CHARS ? snap.html.slice(0, ANALYSIS_MAX_CHARS) : snap.html;
  // Anything that reads "we saw none of X" has to know it may simply not have looked far enough.
  const partial = snap.truncated === true || snap.html.length > ANALYSIS_MAX_CHARS;
  const h = snap.headers;
  const doc = head(html);
  const https = snap.finalUrl.startsWith('https://');
  const { platform, version: platformVersion, authoritative: versionIsStated } = detectPlatform(snap);
  const phpVersion = detectPhpVersion(snap);
  const isWordPress = platform === 'wordpress' || platform === 'woocommerce';

  /* ---- connection ---- */
  if (!https) {
    add('https.missing', 'critical', undefined, snap.finalUrl);
  } else {
    add('https.ok', 'good');
    const insecure = snap.probes?.insecure;
    // No answer is not evidence that the insecure address works. Saying so would be inventing a finding.
    if (answered(insecure) && !(insecure!.status >= 300 && insecure!.status < 400 && (insecure!.location ?? '').startsWith('https://'))) {
      add('https.noRedirect', 'warning');
    }
    if (!h['strict-transport-security']) add('https.noHsts', 'info');
  }

  const insecureLoads = https ? insecureSubresources(html) : [];
  if (insecureLoads.length > 0) add('mixedContent', 'critical', { count: insecureLoads.length }, insecureLoads[0]);

  /* ---- platform and versions ---- */
  if (isWordPress) {
    if (platformVersion) {
      const unsupported = compareVersions(platformVersion, versions.wordpress.minSupported) < 0;
      if (unsupported && versionIsStated) {
        add('wordpress.outdated', 'critical', { version: platformVersion, latest: versions.wordpress.latest });
      } else if (unsupported || compareVersions(platformVersion, versions.wordpress.latest) < 0) {
        // A version pieced together from a file name is a warning at most, however old it looks.
        add('wordpress.behind', 'warning', { version: platformVersion, latest: versions.wordpress.latest });
      } else {
        add('wordpress.current', 'good', { version: platformVersion });
      }
      // Only a site that publishes its version is exposing it; one we inferred is not "visible to anyone".
      if (versionIsStated) add('wordpress.versionExposed', 'info', { version: platformVersion });
    } else {
      add('wordpress.versionUnknown', 'info');
    }
    if (snap.probes?.readme?.ok) add('wordpress.readmeExposed', 'warning', undefined, snap.probes.readme.url);

    const xmlrpc = snap.probes?.xmlrpc;
    const xmlrpcOpen = xmlrpc && (xmlrpc.status === 405 || (xmlrpc.status === 200 && /XML-RPC server accepts POST/i.test(xmlrpc.body ?? '')));
    if (xmlrpcOpen) add('wordpress.xmlrpcOpen', 'info', undefined, xmlrpc.url);
  }

  if (phpVersion) {
    if (compareVersions(phpVersion, versions.php.eol) < 0) {
      add('php.eol', 'critical', { version: phpVersion, current: versions.php.current });
    } else if (compareVersions(phpVersion, versions.php.securityOnly) < 0) {
      add('php.securityOnly', 'warning', { version: phpVersion, current: versions.php.current });
    } else {
      add('php.current', 'good', { version: phpVersion });
    }
    add('php.exposed', 'info', { version: phpVersion }, h['x-powered-by'] ?? h['server']);
  }

  const jquery = detectJQuery(html);
  if (jquery && compareVersions(jquery, versions.jquery.minSupported) < 0) {
    add('jquery.outdated', 'warning', { version: jquery, latest: versions.jquery.latest });
  }

  /* ---- findability: can a search engine read, index and tell apart this page ---- */
  const robotsMeta = (metaContent(html, 'robots') ?? '').toLowerCase();
  const xRobots = (h['x-robots-tag'] ?? '').toLowerCase();
  if (robotsMeta.includes('noindex') || xRobots.includes('noindex')) {
    add('seo.noindex', 'critical', undefined, robotsMeta || xRobots);
  } else if (robotsMeta.includes('nofollow') || xRobots.includes('nofollow')) {
    add('seo.nofollow', 'warning', undefined, robotsMeta || xRobots);
  }

  const title = textOf(html, 'title');
  if (!title) add('seo.title.missing', 'critical');
  else if (title.length > 65) add('seo.title.long', 'info', { length: title.length }, title);
  else if (title.length < 15) add('seo.title.short', 'info', { length: title.length }, title);

  const description = metaContent(html, 'description');
  if (!description) add('seo.description.missing', 'warning');
  else if (description.length > 165) add('seo.description.long', 'info', { length: description.length }, description);

  const h1s = html.match(/<h1\b[^<>]*>/gi) ?? [];
  if (h1s.length === 0) add('seo.h1.missing', 'warning');
  else if (h1s.length > 1) add('seo.h1.multiple', 'info', { count: h1s.length }, textOf(html, 'h1'));

  const levels = [...html.matchAll(/<h([1-6])\b[^<>]*>/gi)].map((m) => Number(m[1]));
  const skip = levels.findIndex((level, i) => i > 0 && level - levels[i - 1] > 1);
  if (skip > 0) add('seo.headingSkips', 'info', {}, `h${levels[skip - 1]} → h${levels[skip]}`);

  const canonicalTag = doc.match(/<link[^<>]+rel\s*=\s*["']?canonical["']?[^<>]*>/i)?.[0];
  const canonical = canonicalTag ? attr(canonicalTag, 'href') : undefined;
  if (!canonical) add('seo.canonical.missing', 'info');
  else if (!sameAddress(canonical, snap.finalUrl)) add('seo.canonical.mismatch', 'warning', {}, canonical);

  const refresh = tags(doc, 'meta').find((t) => (attr(t, 'http-equiv') ?? '').toLowerCase() === 'refresh');
  if (refresh) add('seo.metaRefresh', 'warning', {}, attr(refresh, 'content'));

  const chain = snap.redirects ?? [];
  if (chain.length >= 2) add('seo.redirectChain', 'info', { count: chain.length }, [snap.url, ...chain].join(' → '));

  const altHost = snap.probes?.altHost;
  if (altHost?.status === 200) add('seo.duplicateHost', 'warning', {}, altHost.url);

  const notFound = snap.probes?.notFound;
  if (notFound?.status === 200) add('seo.soft404', 'warning', {}, notFound.url);

  const ogTitle = metaContent(html, 'og:title');
  const ogImage = metaContent(html, 'og:image');
  const ogDescription = metaContent(html, 'og:description');
  if (!ogTitle && !ogImage) {
    add('seo.og.missing', 'info');
  } else if (!ogTitle || !ogImage || !ogDescription) {
    const missing = [!ogTitle && 'og:title', !ogDescription && 'og:description', !ogImage && 'og:image'].filter(Boolean);
    add('seo.og.incomplete', 'info', { count: missing.length }, missing.join(', '));
  }

  const hasSchema = /application\/ld\+json/i.test(html) || /itemscope/i.test(html);
  if (hasSchema) add('seo.schema.present', 'good');
  else add('seo.schema.missing', 'info');

  const robots = snap.probes?.robots;
  const robotsBody = robots?.ok ? (robots.body ?? '') : '';
  const blocked = robotsBlocksAll(robotsBody);
  if (robots?.ok) {
    if (blocked) add('seo.robots.blocksAll', 'critical', {}, blocked);
  } else if (missing(robots)) {
    add('seo.robots.missing', 'warning');
  }
  const sitemap = snap.probes?.sitemap;
  const sitemapFromRobots = /^\s*sitemap:\s*http/im.test(robotsBody);
  const sitemapIsHtml = sitemap?.ok && !!sitemap.body && /^\s*(?:﻿)?(?:<!doctype html|<html)/i.test(sitemap.body);
  if (sitemapIsHtml) add('seo.sitemap.notXml', 'warning', {}, sitemap.url);
  else if (sitemap?.ok || sitemapFromRobots) add('seo.sitemap.present', 'good', {}, sitemap?.ok ? sitemap.url : undefined);
  else if (missing(sitemap)) add('seo.sitemap.missing', 'warning');
  // Only worth saying when we actually read the file.
  if (robots?.ok && !sitemapFromRobots) add('seo.robots.noSitemap', 'info');

  const hasCharsetTag = tags(doc, 'meta').some((t) => attr(t, 'charset') || (attr(t, 'http-equiv') ?? '').toLowerCase() === 'content-type');
  if (!hasCharsetTag && !/charset=/i.test(h['content-type'] ?? '')) add('seo.charset.missing', 'warning');

  const text = visibleText(html);
  const words = text ? text.split(' ').filter((w) => w.length > 1).length : 0;
  if (!partial && words < 300) add('seo.thinContent', words < 120 ? 'warning' : 'info', { words });

  const links = [...html.matchAll(/<a\b([^<>]*)>([\s\S]*?)<\/a>/gi)];
  const internal = links.filter(([, raw]) => {
    const href = attr(`<a ${raw}>`, 'href');
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) return false;
    if (!/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) return true;   // relative: same site by definition
    return sameHost(href, snap.finalUrl);
  }).length;
  if (internal < 5) add('seo.internalLinks', 'info', { count: internal });

  /* ---- languages (Charter of the French Language, updated by Bill 96) ---- */
  const htmlTag = html.match(/<html\b[^<>]*>/i)?.[0] ?? '';
  const lang = (attr(htmlTag, 'lang') ?? '').toLowerCase();
  const hreflangs = (html.match(/hreflang\s*=\s*["']([a-z-]+)["']/gi) ?? []).map((s) => s.toLowerCase());
  const hasFrHreflang = hreflangs.some((s) => s.includes('"fr') || s.includes("'fr"));
  const frProbe = snap.probes?.fr?.ok === true;
  const frLink = /(<a[^<>]*>\s*(fran[çc]ais|fr)\s*<\/a>)/i.test(html);
  const frenchSomewhere = lang.startsWith('fr') || hasFrHreflang || frProbe || frLink;

  // Before any of the metadata signals, read what the page actually says. All four signals above are
  // metadata, and every one of them is absent on the commonest shape of French Quebec site there is: an
  // all-French bakery on a theme that shipped `<html lang="en-US">`. Accusing that site of breaching the
  // Charter is the worst thing this tool can do, so the words get the last word.
  const written = languageOfText(text);

  if (!lang) add('lang.missing', 'warning');

  if (written === 'fr' && !lang.startsWith('fr')) {
    // Written in French, declared as something else. A real problem — screen readers read it aloud with the
    // wrong pronunciation — but a technical one, not a legal one.
    add('lang.declaredWrong', 'warning', {}, lang || undefined);
  }

  if (frenchSomewhere || written === 'fr') {
    if (!lang.startsWith('fr') && !hasFrHreflang && (frProbe || frLink)) {
      add('lang.hreflangMissing', 'warning', {}, frProbe ? snap.probes?.fr?.url : undefined);
    } else if (lang.startsWith('fr') || hasFrHreflang) {
      add('lang.bilingual', 'good', {}, lang || undefined);
    }
  } else if (written === 'en' && missing(snap.probes?.fr)) {
    // English words, and the usual French address answered a clean 404. That is as close to certain as this
    // check gets, and only here is the Charter worth naming.
    add('lang.frenchMissing', 'critical');
  } else if (written === 'en') {
    // English words, but we could not confirm there is no French version — it may live somewhere we did not
    // look. Ask rather than accuse.
    add('lang.frenchUnclear', 'warning');
  }
  // Too little text to judge: say nothing at all.

  // Wiring between the language versions, checked only where there is wiring to judge.
  const alternates = tags(doc, 'link').filter((t) => attr(t, 'hreflang'));
  if (alternates.length > 0) {
    const values = alternates.map((t) => (attr(t, 'hreflang') ?? '').toLowerCase());
    if (!values.includes('x-default')) add('lang.hreflang.noXDefault', 'info', {}, values.join(', '));
    if (!alternates.some((t) => sameAddress(attr(t, 'href') ?? '', snap.finalUrl))) {
      add('lang.hreflang.noSelf', 'info', { count: alternates.length });
    }
  }

  /* ---- on a phone ---- */
  const viewport = metaContent(html, 'viewport');
  if (!viewport) {
    add('mobile.viewport.missing', 'critical');
  } else {
    const v = viewport.toLowerCase();
    const locked = /user-scalable\s*=\s*(no|0)/.test(v) || /maximum-scale\s*=\s*(0?\.\d+|1(\.0+)?)\s*(,|;|$)/.test(v);
    const fixed = v.match(/width\s*=\s*(\d+)/);
    if (locked) add('mobile.viewport.noScale', 'warning', {}, viewport);
    if (fixed) add('mobile.viewport.fixedWidth', 'warning', { width: fixed[1] }, viewport);
    if (!locked && !fixed) add('mobile.viewport.ok', 'good');
  }

  /* ---- speed ---- */
  const kb = Math.round(snap.bytes / 1024);
  if (kb > 500) add('speed.htmlWeight', 'warning', { kb });
  else if (kb > 200) add('speed.htmlWeight.info', 'info', { kb });

  if (snap.elapsedMs > 2500) add('speed.slowResponse', 'warning', { ms: snap.elapsedMs });
  else if (snap.elapsedMs < 800) add('speed.fastResponse', 'good', { ms: snap.elapsedMs });

  if (!h['content-encoding'] && snap.bytes > 50 * 1024) add('speed.noCompression', 'warning', { kb });

  const blockingScripts = tags(doc, 'script').filter((t) => attr(t, 'src') && !/\basync\b|\bdefer\b/i.test(t) && (attr(t, 'type') ?? '') !== 'module');
  if (blockingScripts.length > 3) add('speed.blockingScripts', 'warning', { count: blockingScripts.length }, attr(blockingScripts[0], 'src'));

  const sheets = tags(doc, 'link').filter((t) => /stylesheet/i.test(attr(t, 'rel') ?? '')).length;
  if (sheets > 6) add('speed.stylesheets', 'info', { count: sheets });

  const imgs = tags(html, 'img');
  const noAlt = imgs.filter((t) => attr(t, 'alt') === undefined).length;
  if (noAlt > 0) add('a11y.imagesNoAlt', imgs.length > 0 && noAlt / imgs.length > 0.3 ? 'warning' : 'info', { count: noAlt, total: imgs.length });
  const noDims = imgs.filter((t) => attr(t, 'width') === undefined || attr(t, 'height') === undefined).length;
  if (noDims > 4) add('speed.imagesNoDimensions', 'info', { count: noDims });
  const lazy = imgs.filter((t) => (attr(t, 'loading') ?? '').toLowerCase() === 'lazy').length;
  if (imgs.length > 8 && lazy === 0) add('speed.noLazyLoading', 'info', { count: imgs.length });

  const sources = imgs.map((t) => `${attr(t, 'src') ?? ''} ${attr(t, 'srcset') ?? ''}`);
  const oldFormat = sources.filter((s) => /\.(jpe?g|png)(\?|#|\s|$)/i.test(s)).length;
  const newFormat = sources.filter((s) => /\.(webp|avif)(\?|#|\s|$)/i.test(s)).length
    + (/<source[^<>]+type\s*=\s*["']image\/(webp|avif)/i.test(html) ? 1 : 0);
  if (oldFormat >= 5 && newFormat === 0) add('speed.legacyImages', 'info', { count: oldFormat });

  /* ---- everyone can use it ---- */
  const unlabelledLinks = links.filter(([, raw, inner]) => {
    const tag = `<a ${raw}>`;
    if (!attr(tag, 'href')) return false;
    if (attr(tag, 'aria-label') || attr(tag, 'title') || attr(tag, 'aria-labelledby')) return false;
    if (visibleText(inner)) return false;
    const img = inner.match(/<img\b[^<>]*>/i);
    return !(img && (attr(img[0], 'alt') ?? '').trim());
  }).length;
  if (unlabelledLinks > 0) add('a11y.linksNoText', unlabelledLinks > 3 ? 'warning' : 'info', { count: unlabelledLinks });

  /* ---- privacy and hardening ---- */
  const analytics = ANALYTICS_SIGNS.test(html);
  const cmp = CMP_SIGNS.test(html);
  if (analytics && !cmp) add('privacy.analyticsNoConsent', 'warning');

  const missingHeaders = ['x-content-type-options', 'referrer-policy', 'content-security-policy'].filter((n) => !h[n]);
  if (missingHeaders.length >= 2) add('security.headers', 'info', { count: missingHeaders.length }, missingHeaders.join(', '));
  if (/apache\/[\d.]+|nginx\/[\d.]+/i.test(h['server'] ?? '')) add('security.serverExposed', 'info', { server: h['server'] }, h['server']);

  /* ---- score, areas and recommendation ---- */
  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0, good: 0 };
  for (const f of findings) counts[f.severity] += 1;
  // A curve rather than a subtraction: a neglected site should rank low without bottoming out at zero, which
  // reads as an insult rather than a measurement.
  const penalty = findings.reduce((t, f) => t + SEVERITY_WEIGHT[f.severity], 0);
  const score = Math.max(1, Math.min(100, Math.round(100 / (1 + penalty / SCORE_SOFTENER))));

  const order: Severity[] = ['critical', 'warning', 'info', 'good'];
  const bySeverity = (a: Finding, b: Finding) => order.indexOf(a.severity) - order.indexOf(b.severity);
  findings.sort(bySeverity);

  const areas: AreaSummary[] = [];
  for (const area of AREAS) {
    const mine = findings.filter((f) => f.area === area);
    if (mine.length === 0) continue;
    const areaCounts: Record<Severity, number> = { critical: 0, warning: 0, info: 0, good: 0 };
    for (const f of mine) areaCounts[f.severity] += 1;
    const status: AreaStatus = areaCounts.critical > 0 ? 'act' : areaCounts.warning > 0 ? 'watch' : 'ok';
    areas.push({ area, status, counts: areaCounts });
  }

  const currentPlatform: AuditReport['recommendation']['currentPlatform'] =
    platform === 'woocommerce' ? 'woocommerce' : platform === 'shopify' ? 'shopify' : platform === 'wordpress' ? 'wordpress' : 'other';
  const builder = platform === 'wix' || platform === 'squarespace' || platform === 'webflow';
  const frenchMissing = findings.some((f) => f.id === 'lang.frenchMissing');

  /**
   * Telling a stranger their website should be rebuilt is a costing claim, and the engine has no basis for
   * one it can only reach by adding up invented weights. It is now grounded in named findings instead: the
   * things that genuinely mean "this is past patching". A long tail of small notes cannot reach that verdict,
   * and with no critical findings at all it is never reached — the report was previously capable of printing
   * "nothing urgent came up" directly above "a rebuild will cost less than the repairs".
   */
  const PAST_PATCHING: FindingId[] = [
    'php.eol', 'wordpress.outdated', 'https.missing', 'mobile.viewport.missing',
    'seo.robots.blocksAll', 'seo.noindex', 'seo.title.missing',
  ];
  const severe = findings.filter((f) => PAST_PATCHING.includes(f.id)).length;

  let recommendation: AuditReport['recommendation'];
  if (counts.critical === 0 && counts.warning === 0) {
    recommendation = { id: 'healthy', projectType: 'changes', currentPlatform };
  } else if (builder && counts.critical > 0) {
    recommendation = { id: 'migration', projectType: 'redesign', currentPlatform, approach: 'migration' };
  } else if (severe >= 2) {
    recommendation = { id: 'redesign', projectType: 'redesign', currentPlatform, approach: 'fullRedesign' };
  } else if (frenchMissing && counts.critical <= 1) {
    recommendation = { id: 'french', projectType: 'changes', currentPlatform };
  } else {
    recommendation = { id: 'fixes', projectType: 'changes', currentPlatform };
  }

  return { url: snap.url, finalUrl: snap.finalUrl, platform, platformVersion, phpVersion, score, counts, areas, findings, recommendation };
}

function sameHost(href: string, base: string): boolean {
  try {
    return new URL(href, base).host.replace(/^www\./i, '') === new URL(base).host.replace(/^www\./i, '');
  } catch {
    return false;
  }
}

const PLATFORM_NAMES: Record<Platform, string> = {
  wordpress: 'WordPress', woocommerce: 'WooCommerce', shopify: 'Shopify', 'shopify-headless': 'Shopify',
  wix: 'Wix', squarespace: 'Squarespace', webflow: 'Webflow', drupal: 'Drupal', joomla: 'Joomla', unknown: '',
};

/** How a platform is spelled in the interface. Empty for an unrecognized one: the copy supplies that wording. */
export function platformLabel(platform: Platform): string {
  return PLATFORM_NAMES[platform] ?? '';
}

/** The findings of one area, urgent first. */
export function findingsIn(report: AuditReport, area: Area): Finding[] {
  return report.findings.filter((f) => f.area === area);
}

/** A one-line, copy-free summary for the lead record. */
export function summarize(report: AuditReport): string[] {
  return [
    `Site audit: ${report.finalUrl}`,
    `Platform: ${report.platform}${report.platformVersion ? ` ${report.platformVersion}` : ''}${report.phpVersion ? `, PHP ${report.phpVersion}` : ''}`,
    `Score: ${report.score}/100 (${report.counts.critical} critical, ${report.counts.warning} warnings, ${report.counts.info} notes)`,
    `Areas: ${report.areas.map((a) => `${a.area}=${a.status}`).join(', ')}`,
    `Findings: ${report.findings.filter((f) => f.severity !== 'good').map((f) => f.id).join(', ') || 'none'}`,
    `Recommended: ${report.recommendation.id}`,
  ];
}
