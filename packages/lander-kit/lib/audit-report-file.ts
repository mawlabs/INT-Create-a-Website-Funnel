/**
 * Builds the full site-check report as one standalone HTML file the visitor downloads and keeps.
 * No network, no fonts, no scripts: it has to open in ten years and print cleanly. All wording comes from
 * the site's copy, so the file is bilingual like everything else.
 */
import type { AuditCopy } from './copy';
import { platformLabel, type AuditReport, type Severity } from './audit';
import { interpolate, type Locale } from './i18n';

const ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ESCAPE[ch]);

const SEVERITIES: Severity[] = ['critical', 'warning', 'info', 'good'];
const BAR: Record<Severity, string> = { critical: '#E76F51', warning: '#F4A261', info: 'rgba(54,57,62,.25)', good: '#2A9D8F' };

export function buildReportFile(report: AuditReport, copy: AuditCopy, locale: Locale, supportEmail: string): string {
  const host = (() => { try { return new URL(report.finalUrl).host; } catch { return report.finalUrl; } })();
  const date = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const platform = report.platform === 'unknown' ? copy.result.unknownPlatform : platformLabel(report.platform);
  const rec = copy.recommendation[report.recommendation.id];

  const groups = SEVERITIES.map((severity) => {
    const items = report.findings.filter((f) => f.severity === severity);
    if (items.length === 0) return '';
    const rows = items.map((f) => {
      const c = copy.findings[f.id];
      if (!c) return '';
      const params = f.params ?? {};
      const title = params.count === 1 && c.titleOne ? c.titleOne : c.title;
      return `<li style="border-left:5px solid ${BAR[severity]}"><h3>${esc(interpolate(title, params))}</h3><p>${esc(interpolate(c.detail, params))}</p></li>`;
    }).join('');
    return `<h2>${esc(copy.result.groups[severity])}</h2><ul class="findings">${rows}</ul>`;
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
  h2 { font-size: 1.25rem; margin: 2.5rem 0 .75rem; letter-spacing: -.01em; }
  h3 { font-size: 1rem; margin: 0 0 .25rem; }
  p { margin: 0 0 .75rem; }
  .meta { font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: .8rem; letter-spacing: .04em; color: #5c6066; }
  .facts { display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: center; margin: 1.5rem 0;
           padding: 1.25rem; background: #fff; border: 2px solid #36393E; }
  .score { font-size: 3rem; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
  .score small { font-size: .8rem; font-weight: 400; color: #5c6066; margin-left: .35rem; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: .2rem 1rem; margin: 0; }
  dt { font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: .8rem; color: #5c6066; }
  dd { margin: 0; font-weight: 600; }
  ul.findings { list-style: none; padding: 0; margin: 0; }
  ul.findings li { padding: .75rem 0 .75rem 1rem; margin-bottom: .5rem; }
  ul.findings p { margin: 0; font-size: .95rem; color: #494d53; }
  .rec { margin-top: 2.5rem; padding: 1.25rem; background: #fff; border: 2px solid #36393E; box-shadow: 4px 4px 0 #36393E; }
  .rec h2 { margin-top: 0; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid rgba(54,57,62,.25); font-size: .85rem; color: #5c6066; }
  a { color: #36393E; }
  @media print { body { background: #fff; padding: 0; } .rec { box-shadow: none; } .noprint { display: none; } }
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

  ${groups}

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
