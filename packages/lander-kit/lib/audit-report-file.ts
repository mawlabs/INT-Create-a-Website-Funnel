/**
 * Builds the full site-check report as one standalone HTML file the visitor downloads and keeps.
 * No network, no fonts, no scripts: it has to open in ten years and print cleanly. All wording comes from
 * the site's copy, so the file is bilingual like everything else.
 *
 * Organised by area rather than by severity: someone reading it wants to know whether the problem is the
 * software, the French or being found at all, and severity alone never answers that. Within an area the
 * urgent findings still come first, and the ones the site passed are kept in — a check you passed is the
 * only thing that makes the ones you failed believable.
 */
import type { AuditAreaCopy, AuditCopy } from './copy';
import { AREAS, platformLabel, type Area, type AuditReport, type Finding, type Severity } from './audit';
import { interpolate, type Locale } from './i18n';

const ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ESCAPE[ch]);

const SEVERITIES: Severity[] = ['critical', 'warning', 'info', 'good'];
const BAR: Record<Severity, string> = { critical: '#E76F51', warning: '#F4A261', info: 'rgba(54,57,62,.25)', good: '#2A9D8F' };
const DOT: Record<'act' | 'watch' | 'ok', string> = { act: '#E76F51', watch: '#F4A261', ok: '#2A9D8F' };

export function buildReportFile(report: AuditReport, copy: AuditCopy, locale: Locale, supportEmail: string): string {
  const host = (() => { try { return new URL(report.finalUrl).host; } catch { return report.finalUrl; } })();
  const date = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const platform = report.platform === 'unknown' ? copy.result.unknownPlatform : platformLabel(report.platform);
  const rec = copy.recommendation[report.recommendation.id];
  const areaCopy = (area: Area): AuditAreaCopy | undefined => copy.areas?.[area];

  const finding = (f: Finding, severity: Severity): string => {
    const c = copy.findings[f.id];
    if (!c) return '';
    const params = f.params ?? {};
    const title = params.count === 1 && c.titleOne ? c.titleOne : c.title;
    const evidence = f.evidence
      ? `<p class="line"><span class="tag">${esc(copy.result.evidenceLabel)}</span><code>${esc(f.evidence)}</code></p>`
      : '';
    const fix = c.fix
      ? `<p class="line fix"><span class="tag">${esc(copy.result.fixLabel)}</span>${esc(interpolate(c.fix, params))}</p>`
      : '';
    return `<li style="border-left:5px solid ${BAR[severity]}">`
      + `<h4>${esc(interpolate(title, params))}</h4>`
      + `<p>${esc(interpolate(c.detail, params))}</p>${evidence}${fix}</li>`;
  };

  // Contents: every area, its verdict, and how many things landed in it. The one page someone reads twice.
  const contents = report.areas.map((a) => {
    const label = areaCopy(a.area)?.label ?? a.area;
    const tally = SEVERITIES
      .filter((s) => a.counts[s] > 0)
      .map((s) => esc(interpolate(copy.result.counts[s], { n: a.counts[s] })))
      .join(' · ');
    return `<li><a href="#area-${a.area}"><span class="dot-mark" style="background:${DOT[a.status]}"></span>`
      + `<span class="c-label">${esc(label)}</span></a>`
      + `<span class="c-status">${esc(copy.result.areaStatus[a.status])}</span>`
      + `<span class="c-tally">${tally}</span></li>`;
  }).join('');

  const sections = AREAS.map((area) => {
    const summary = report.areas.find((a) => a.area === area);
    if (!summary) return '';
    const info = areaCopy(area);
    const groups = SEVERITIES.map((severity) => {
      const items = report.findings.filter((f) => f.area === area && f.severity === severity);
      if (items.length === 0) return '';
      return `<p class="sev-head"><span class="rule" style="background:${BAR[severity]}"></span>${esc(copy.result.groups[severity])}</p>`
        + `<ul class="findings">${items.map((f) => finding(f, severity)).join('')}</ul>`;
    }).join('');
    return `<section id="area-${area}" class="area">`
      + `<h2><span class="dot-mark" style="background:${DOT[summary.status]}"></span>${esc(info?.label ?? area)}</h2>`
      + `<p class="blurb">${esc(info?.blurb ?? '')}</p>`
      + (groups || `<p class="blurb">${esc(copy.file.areaAllClear)}</p>`)
      + `</section>`;
  }).join('');

  return `<!doctype html>
<html lang="${locale === 'fr' ? 'fr-CA' : 'en-CA'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(interpolate(copy.file.title, { host }))}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 2.5rem 1.25rem 4rem; background: #FBF4EA; color: #36393E;
         font: 16px/1.6 "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 46rem; margin: 0 auto; }
  h1 { font-size: 2rem; line-height: 1.1; margin: 0 0 .5rem; letter-spacing: -.02em; }
  h1 .dot { color: #E76F51; }
  h2 { font-size: 1.35rem; margin: 0 0 .35rem; letter-spacing: -.01em; display: flex; align-items: center; gap: .6rem; }
  h3 { font-size: 1.1rem; margin: 0 0 .5rem; }
  h4 { font-size: 1rem; margin: 0 0 .25rem; }
  p { margin: 0 0 .75rem; }
  .meta { font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: .8rem; letter-spacing: .04em; color: #5c6066; }
  .facts { display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: center; margin: 1.5rem 0;
           padding: 1.25rem; background: #fff; border: 2px solid #36393E; }
  .score { font-size: 3rem; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
  .score small { font-size: .8rem; font-weight: 400; color: #5c6066; margin-left: .35rem; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: .2rem 1rem; margin: 0; }
  dt { font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: .8rem; color: #5c6066; }
  dd { margin: 0; font-weight: 600; }
  .dot-mark { width: .6rem; height: .6rem; flex: none; display: inline-block; }
  .contents { margin: 2rem 0; padding: 1.25rem; background: #fff; border: 2px solid #36393E; }
  .contents h3 { margin-bottom: .25rem; }
  .contents ol { list-style: none; padding: 0; margin: .75rem 0 0; }
  .contents li { display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: .25rem 1rem;
                 padding: .45rem 0; border-top: 1px solid rgba(54,57,62,.18); }
  .contents a { display: flex; align-items: center; gap: .6rem; font-weight: 600; text-decoration: none; }
  .contents a:hover .c-label, .contents a:focus .c-label { text-decoration: underline; }
  .c-status { font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: .8rem; color: #5c6066; white-space: nowrap; }
  .c-tally { grid-column: 1 / -1; font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: .75rem;
             letter-spacing: .04em; color: #5c6066; padding-left: 1.2rem; }
  .area { margin-top: 2.75rem; }
  .blurb { color: #494d53; font-size: .95rem; max-width: 40rem; }
  .sev-head { display: flex; align-items: center; gap: .6rem; margin: 1.5rem 0 .5rem;
              font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: .8rem; letter-spacing: .06em;
              text-transform: uppercase; color: #5c6066; }
  .sev-head .rule { width: 1.1rem; height: .3rem; flex: none; display: inline-block; }
  ul.findings { list-style: none; padding: 0; margin: 0; }
  ul.findings li { padding: .75rem 0 .75rem 1rem; margin-bottom: .5rem; }
  ul.findings p { margin: 0; font-size: .95rem; color: #494d53; }
  .line { margin-top: .4rem !important; font-size: .9rem !important; }
  .line .tag { font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: .72rem; letter-spacing: .06em;
               text-transform: uppercase; color: #5c6066; margin-right: .5rem; }
  .line code { font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: .85rem; word-break: break-word;
               background: rgba(54,57,62,.07); padding: .1em .35em; }
  .fix { color: #36393E !important; }
  .rec { margin-top: 2.75rem; padding: 1.25rem; background: #fff; border: 2px solid #36393E; box-shadow: 4px 4px 0 #36393E; }
  .rec h2 { margin-top: 0; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid rgba(54,57,62,.25); font-size: .85rem; color: #5c6066; }
  a { color: #36393E; }
  @media print {
    body { background: #fff; padding: 0; }
    .rec { box-shadow: none; }
    .noprint { display: none; }
    .area { break-inside: avoid-page; }
    ul.findings li { break-inside: avoid-page; }
  }
</style>
</head>
<body>
<main>
  <p class="meta">${esc(interpolate(copy.file.generated, { date }))}</p>
  <h1>${esc(interpolate(copy.file.title, { host }))}<span class="dot">.</span></h1>
  <p>${esc(interpolate(copy.file.intro, { host }))}</p>

  <div class="facts">
    <div class="score">${report.score}<small>${esc(copy.result.scoreOutOf)}</small></div>
    <dl>
      <dt>${esc(copy.result.platformLabel)}</dt><dd>${esc(platform)}${report.platformVersion ? ` ${esc(report.platformVersion)}` : ''}</dd>
      ${report.phpVersion ? `<dt>${esc(copy.result.phpLabel)}</dt><dd>PHP ${esc(report.phpVersion)}</dd>` : ''}
    </dl>
  </div>

  <nav class="contents" aria-label="${esc(copy.file.contents)}">
    <h3>${esc(copy.file.contents)}</h3>
    <p class="meta">${esc(interpolate(copy.file.checks, { n: report.findings.length }))}</p>
    <ol>${contents}</ol>
  </nav>

  ${sections}

  <div class="rec">
    <h2>${esc(copy.file.recHeading)}</h2>
    <h3>${esc(rec.title)}</h3>
    <p>${esc(rec.text)}</p>
  </div>

  <p class="meta noprint" style="margin-top:1.5rem">${esc(copy.file.print)}</p>
  <footer>${esc(interpolate(copy.file.footer, { email: supportEmail }))}<br>${esc(report.finalUrl)}</footer>
</main>
</body>
</html>`;
}
