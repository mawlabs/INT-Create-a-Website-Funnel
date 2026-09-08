/**
 * Site audit island (vanilla TS). Sends the visitor's address to the site's own fetch endpoint, analyses the
 * snapshot in the browser with lib/audit.ts, and renders the findings, the score and one recommendation.
 * The recommendation prefills the quote flow, so a scan can turn into a quote without retyping anything.
 */
import { track } from './analytics';
import type { AuditReport, Finding, Severity, Snapshot, VersionData } from './audit';
import { analyze, summarize } from './audit';
import { interpolate, type Locale } from './i18n';
import type { AuditCopy } from './copy';

/** What the fetch endpoint answers with: a snapshot, or a refusal carrying a code the copy can word. */
type AuditResponse = (Snapshot & { ok: true }) | { ok: false; error?: string; status?: number };

interface Config {
  locale: Locale;
  copy: AuditCopy;
  versions: VersionData;
  endpoint: string;
  supportEmail: string;
}

export const AUDIT_STORE = 'caw-audit';
const SEVERITIES: Severity[] = ['critical', 'warning', 'info', 'good'];

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | undefined> = {}, ...children: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c != null) el.append(c);
  return el;
};

export function mountAuditPanel(root: HTMLElement): void {
  const cfg = JSON.parse(root.dataset.config ?? '{}') as Config;
  const c = cfg.copy;
  const form = root.querySelector<HTMLFormElement>('[data-audit-form]')!;
  const input = root.querySelector<HTMLInputElement>('[data-audit-url]')!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const status = root.querySelector<HTMLElement>('[data-audit-status]')!;
  const output = root.querySelector<HTMLElement>('[data-audit-output]')!;
  form.hidden = false;

  const say = (text: string, kind: 'busy' | 'error' | '' = '') => {
    status.textContent = text;
    status.hidden = !text;
    status.dataset.kind = kind;
  };

  const errorText = (code: string, params: Record<string, string | number> = {}) => {
    const template = c.errors[code] ?? c.errors.network;
    return interpolate(template, { email: cfg.supportEmail, ...params });
  };

  const finding = (f: Finding) => {
    const copy = c.findings[f.id];
    if (!copy) return null;
    const params = f.params ?? {};
    const title = params.count === 1 && copy.titleOne ? copy.titleOne : copy.title;
    return h('li', { class: 'finding', 'data-severity': f.severity },
      h('span', { class: 'sev', 'aria-hidden': 'true' }),
      h('div', {},
        h('p', { class: 'f-title', text: interpolate(title, params) }),
        h('p', { class: 'f-detail', text: interpolate(copy.detail, params) })),
    );
  };

  const render = (report: AuditReport, truncated: boolean) => {
    const host = (() => { try { return new URL(report.finalUrl).host; } catch { return report.finalUrl; } })();
    const wrap = h('div', { class: 'report' });

    const grade = report.score >= 85 ? 'good' : report.score >= 60 ? 'warning' : 'critical';
    const head = h('div', { class: 'report-head' });
    head.append(
      h('div', { class: 'score', 'data-grade': grade },
        h('span', { class: 'score-num', text: String(report.score) }),
        h('span', { class: 'score-of', text: c.result.scoreOutOf })),
      (() => {
        const dl = h('dl', { class: 'facts' });
        dl.append(h('dt', { text: c.result.platformLabel }), h('dd', { text: report.platform === 'unknown' ? c.result.unknownPlatform : `${platformName(report.platform)}${report.platformVersion ? ` ${report.platformVersion}` : ''}` }));
        if (report.phpVersion) dl.append(h('dt', { text: c.result.phpLabel }), h('dd', { text: `PHP ${report.phpVersion}` }));
        return dl;
      })(),
    );
    wrap.append(h('h3', { class: 'report-h', tabindex: '-1', 'data-focus': true, text: interpolate(c.result.heading, { host }) }), head);
    if (truncated) wrap.append(h('p', { class: 'note', text: c.truncated }));

    for (const severity of SEVERITIES) {
      const items = report.findings.filter((f) => f.severity === severity).map(finding).filter(Boolean) as HTMLElement[];
      if (items.length === 0) continue;
      const list = h('ul', { class: 'findings', role: 'list' });
      items.forEach((i) => list.append(i));
      wrap.append(h('h4', { class: 'group', 'data-severity': severity, text: c.result.groups[severity] }), list);
    }

    const rec = c.recommendation[report.recommendation.id];
    const cta = h('button', { type: 'button', class: 'btn', text: rec.cta });
    cta.addEventListener('click', () => {
      track('audit_to_quote', { recommendation: report.recommendation.id, score: report.score, platform: report.platform });
      const answers: Record<string, string> = { projectType: report.recommendation.projectType, currentPlatform: report.recommendation.currentPlatform };
      if (report.recommendation.approach) answers.approach = report.recommendation.approach;
      window.dispatchEvent(new CustomEvent('maw:quote-prefill', { detail: { answers } }));
    });
    wrap.append(h('div', { class: 'rec' }, h('h4', { text: rec.title }), h('p', { text: rec.text }), h('div', { class: 'actions' }, cta)));

    const again = h('button', { type: 'button', class: 'linkish', text: c.again });
    again.addEventListener('click', () => {
      output.replaceChildren();
      form.hidden = false;
      input.value = '';
      input.focus();
    });
    wrap.append(h('p', { class: 'again' }, again));

    output.replaceChildren(wrap);
    wrap.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
  };

  const platformName = (p: AuditReport['platform']) =>
    ({ wordpress: 'WordPress', woocommerce: 'WooCommerce', shopify: 'Shopify', wix: 'Wix', squarespace: 'Squarespace', webflow: 'Webflow', drupal: 'Drupal', joomla: 'Joomla', 'shopify-headless': 'Shopify', unknown: '' })[p];

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const url = input.value.trim();
    if (!url) { say(errorText('url_required'), 'error'); input.focus(); return; }
    if (!cfg.endpoint) { say(errorText('not_configured'), 'error'); return; }
    button.disabled = true;
    output.replaceChildren();
    say(c.checking, 'busy');
    track('audit_start', { lang: cfg.locale });

    let snapshot: Snapshot;
    try {
      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const payload = (await res.json()) as AuditResponse;
      if (!res.ok || !payload.ok) {
        const code = (!payload.ok && payload.error) || 'network';
        say(errorText(code, { status: (!payload.ok && payload.status) || res.status }), 'error');
        track('audit_error', { code });
        button.disabled = false;
        return;
      }
      snapshot = payload;
    } catch {
      say(errorText('network'), 'error');
      track('audit_error', { code: 'network' });
      button.disabled = false;
      return;
    }

    const report = analyze(snapshot, cfg.versions);
    say('');
    button.disabled = false;
    form.hidden = true;
    render(report, !!snapshot.truncated);
    track('audit_done', { score: report.score, platform: report.platform, critical: report.counts.critical, recommendation: report.recommendation.id });
    try { sessionStorage.setItem(AUDIT_STORE, JSON.stringify({ summary: summarize(report), url: report.finalUrl })); } catch { /* ignore */ }
  });
}
