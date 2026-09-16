/**
 * Site audit island (vanilla TS). Sends the visitor's address to the site's own fetch endpoint, analyses the
 * snapshot in the browser with lib/audit.ts, and shows the urgent findings only — the full report is a file they
 * download after leaving an email, and following up is theirs to opt into.
 *
 * Views: form → report (urgent + "need help?") → email → sent (download + book a call).
 */
import { track } from './analytics';
import type { AuditReport, Finding, Severity, Snapshot, VersionData } from './audit';
import { analyze, platformLabel, summarize } from './audit';
import { buildReportFile } from './audit-report-file';
import type { AuditCopy } from './copy';
import { interpolate, type Locale } from './i18n';
import { buildAuditSubmission, hubspotEndpoint, submitLead } from './lead';

interface Config {
  locale: Locale;
  copy: AuditCopy;
  versions: VersionData;
  endpoint: string;
  supportEmail: string;
  bookUrl: string;
  pageName: string;
  hubspot: { portalId: string; formGuid: string };
}

/** What the fetch endpoint answers with: a snapshot, or a refusal carrying a code the copy can word. */
type AuditResponse = (Snapshot & { ok: true }) | { ok: false; error?: string; status?: number };

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

  const loadedAt = Date.now();
  let report: AuditReport | null = null;
  let fileUrl = '';

  const say = (text: string, kind: 'busy' | 'error' | '' = '') => {
    status.textContent = text;
    status.hidden = !text;
    status.dataset.kind = kind;
  };

  const errorText = (code: string, params: Record<string, string | number> = {}) =>
    interpolate(c.errors[code] ?? c.errors.network, { email: cfg.supportEmail, ...params });

  const show = (nodes: Node[]) => {
    output.replaceChildren(...nodes);
    output.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
  };

  const host = () => {
    try { return new URL(report!.finalUrl).host; } catch { return report!.finalUrl; }
  };

  /* ---------- pieces ---------- */

  // What it is, what it means, what we actually saw, and what to do. The last two are the difference between
  // a list of complaints and something a reader can act on without phoning anyone.
  const findingItem = (f: Finding) => {
    const copy = c.findings[f.id];
    if (!copy) return null;
    const params = f.params ?? {};
    const title = params.count === 1 && copy.titleOne ? copy.titleOne : copy.title;
    const body = h('div', {},
      h('p', { class: 'f-title', text: interpolate(title, params) }),
      h('p', { class: 'f-detail', text: interpolate(copy.detail, params) }));
    if (f.evidence) {
      body.append(h('p', { class: 'f-evidence' },
        h('span', { class: 'f-label', text: c.result.evidenceLabel }),
        h('code', { text: f.evidence })));
    }
    if (copy.fix) {
      body.append(h('p', { class: 'f-fix' },
        h('span', { class: 'f-label', text: c.result.fixLabel }),
        interpolate(copy.fix, params)));
    }
    return h('li', { class: 'finding', 'data-severity': f.severity }, h('span', { class: 'sev', 'aria-hidden': 'true' }), body);
  };

  // Eight words that say where the trouble is. Someone who reads nothing else should still learn whether the
  // problem is the software, the French, or being findable at all.
  const areasBlock = () => {
    const list = h('ul', { class: 'areas', role: 'list' });
    for (const a of report!.areas) {
      const copy = c.areas[a.area];
      if (!copy) continue;
      list.append(h('li', { class: 'area', 'data-status': a.status },
        h('span', { class: 'area-label', text: copy.label }),
        h('span', { class: 'area-status', text: c.result.areaStatus[a.status] })));
    }
    return h('div', { class: 'areas-wrap' },
      h('h4', { class: 'areas-h', text: c.result.areasHeading }),
      list);
  };

  const scoreBlock = () => {
    const r = report!;
    const grade = r.score >= 85 ? 'good' : r.score >= 60 ? 'warning' : 'critical';
    const head = h('div', { class: 'report-head' });
    const dl = h('dl', { class: 'facts' });
    const platform = r.platform === 'unknown' ? c.result.unknownPlatform : platformLabel(r.platform);
    dl.append(h('dt', { text: c.result.platformLabel }), h('dd', { text: `${platform}${r.platformVersion ? ` ${r.platformVersion}` : ''}` }));
    if (r.phpVersion) dl.append(h('dt', { text: c.result.phpLabel }), h('dd', { text: `PHP ${r.phpVersion}` }));
    head.append(
      h('div', { class: 'score', 'data-grade': grade },
        h('span', { class: 'score-num', text: String(r.score) }),
        h('span', { class: 'score-of', text: c.result.scoreOutOf })),
      dl,
    );
    return head;
  };

  const countsRow = () => {
    const r = report!;
    const row = h('ul', { class: 'counts', role: 'list' });
    for (const s of SEVERITIES) {
      if (r.counts[s] === 0) continue;
      row.append(h('li', { 'data-severity': s, text: interpolate(c.result.counts[s], { n: r.counts[s] }) }));
    }
    return row;
  };

  const downloadFile = () => {
    if (!fileUrl) {
      const html = buildReportFile(report!, c, cfg.locale, cfg.supportEmail);
      fileUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    }
    const a = h('a', { href: fileUrl, download: `site-check-${host()}-${new Date().toISOString().slice(0, 10)}.html` });
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
  };

  /* ---------- views ---------- */

  const viewReport = () => {
    const r = report!;
    const nodes: Node[] = [h('div', { class: 'report' })];
    const wrap = nodes[0] as HTMLElement;
    wrap.append(
      h('h3', { class: 'report-h', tabindex: '-1', 'data-focus': true, text: interpolate(c.result.heading, { host: host() }) }),
      scoreBlock(),
      countsRow(),
      areasBlock(),
    );

    // Every urgent finding is shown: they are the point of the page, and the counts row would otherwise disagree
    // with the list. Warnings and small notes live in the downloadable report.
    const urgent = r.findings.filter((f) => f.severity === 'critical');
    if (urgent.length > 0) {
      const list = h('ul', { class: 'findings', role: 'list' });
      urgent.forEach((f) => { const item = findingItem(f); if (item) list.append(item); });
      wrap.append(h('h4', { class: 'group', 'data-severity': 'critical', text: c.result.groups.critical }), list);
    } else {
      wrap.append(h('p', { class: 'nothing-urgent', text: c.report.nothingUrgent }));
    }
    wrap.append(h('p', { class: 'more-line', text: c.report.moreLine }));

    // Need help with this? — the recommendation, then the two ways forward.
    const rec = c.recommendation[r.recommendation.id];
    const quoteCta = h('button', { type: 'button', class: 'btn', text: rec.cta });
    quoteCta.addEventListener('click', () => {
      track('audit_to_quote', { recommendation: r.recommendation.id, score: r.score, platform: r.platform });
      const answers: Record<string, string> = { projectType: r.recommendation.projectType, currentPlatform: r.recommendation.currentPlatform };
      if (r.recommendation.approach) answers.approach = r.recommendation.approach;
      window.dispatchEvent(new CustomEvent('maw:quote-prefill', { detail: { answers } }));
    });
    const reportCta = h('button', { type: 'button', class: 'btn btn-outline', text: c.report.download });
    reportCta.addEventListener('click', () => { track('audit_report_open', { score: r.score }); show(viewEmail()); });
    wrap.append(h('div', { class: 'rec' },
      h('p', { class: 'meta rec-label', text: c.report.helpHeading }),
      h('h4', { text: rec.title }),
      h('p', { text: rec.text }),
      h('div', { class: 'actions' }, quoteCta, reportCta)));

    wrap.append(h('p', { class: 'again' }, againLink()));
    return nodes;
  };

  const againLink = () => {
    const again = h('button', { type: 'button', class: 'linkish', text: c.again });
    again.addEventListener('click', () => {
      output.replaceChildren();
      report = null;
      if (fileUrl) { URL.revokeObjectURL(fileUrl); fileUrl = ''; }
      form.hidden = false;
      input.value = '';
      input.focus();
    });
    return again;
  };

  const viewEmail = () => {
    const e = c.email;
    const wrap = h('div', { class: 'report gate' });
    const formEl = h('form', { class: 'gate-form', novalidate: true });

    const field = h('div', { class: 'field' });
    const emailInput = h('input', { id: 'audit-email', name: 'email', type: 'email', inputmode: 'email', autocomplete: 'email', required: true, 'aria-describedby': 'audit-email-err' });
    field.append(h('label', { for: 'audit-email', text: e.label }), emailInput, h('p', { class: 'field-error', id: 'audit-email-err', hidden: true }));

    const consent = h('input', { type: 'checkbox', id: 'audit-followup', name: 'followup' });
    const consentField = h('div', { class: 'field' },
      h('div', { class: 'field-check' }, consent, h('label', { for: 'audit-followup', text: e.consent })),
      h('p', { class: 'hint', text: e.consentHint }));

    const hp = h('div', { class: 'hp', 'aria-hidden': 'true' },
      h('label', { for: 'audit-website', tabindex: '-1', text: 'Website' }),
      h('input', { id: 'audit-website', name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' }));

    const submit = h('button', { type: 'submit', class: 'btn', text: e.button });
    const gateStatus = h('p', { class: 'form-status', role: 'alert', hidden: true });
    formEl.append(field, consentField, hp, h('div', { class: 'actions' }, submit), gateStatus, h('p', { class: 'meta purpose', text: e.purpose }));

    const setError = (text: string | null) => {
      const p = field.querySelector<HTMLElement>('.field-error')!;
      p.textContent = text ?? '';
      p.hidden = !text;
      if (text) { field.dataset.invalid = 'true'; emailInput.setAttribute('aria-invalid', 'true'); }
      else { delete field.dataset.invalid; emailInput.removeAttribute('aria-invalid'); }
    };
    const gateSay = (t: string) => { gateStatus.textContent = t; gateStatus.hidden = !t; };

    formEl.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      gateSay('');
      const value = emailInput.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { setError(e.errors.email); emailInput.focus(); return; }
      setError(null);
      if ((formEl.elements.namedItem('website') as HTMLInputElement).value) { show(viewSent(false)); return; }
      if (Date.now() - loadedAt < 3000) { gateSay(e.errors.tooFast); return; }

      const followUp = consent.checked;
      if (!cfg.hubspot.portalId || !cfg.hubspot.formGuid) {
        gateSay(interpolate(e.errors.notConfigured, { email: cfg.supportEmail }));
        return;
      }
      submit.disabled = true;
      gateSay(e.sending);
      const submission = buildAuditSubmission({
        email: value,
        report: report!,
        followUp,
        locale: cfg.locale,
        consentText: `${e.purpose} ${followUp ? e.consent : e.consentHint}`,
        followUpLabel: e.consent,
        noFollowUpLabel: e.consentHint,
        pageName: cfg.pageName,
      });
      const res = await submitLead(hubspotEndpoint(cfg.hubspot), submission);
      submit.disabled = false;
      if (!res.ok) { gateSay(interpolate(e.errors.network, { email: cfg.supportEmail })); return; }
      track('audit_report_sent', { followUp: followUp ? 1 : 0, score: report!.score });
      show(viewSent(followUp));
    });

    const back = h('button', { type: 'button', class: 'linkish', text: e.back });
    back.addEventListener('click', () => show(viewReport()));

    wrap.append(
      h('h3', { class: 'report-h', tabindex: '-1', 'data-focus': true, text: e.heading }),
      h('p', { class: 'intro', text: e.intro }),
      formEl,
      h('p', { class: 'again' }, back),
    );
    return [wrap];
  };

  const viewSent = (followUp: boolean) => {
    const s = c.sent;
    const wrap = h('div', { class: 'report sent' });
    downloadFile();

    const again = h('button', { type: 'button', class: 'btn btn-outline btn-small', text: s.downloadAgain });
    again.addEventListener('click', downloadFile);

    const book = h('a', { class: 'btn', href: cfg.bookUrl, rel: 'noopener', 'data-cta': 'book', text: s.book });
    book.addEventListener('click', () => track('book_call', { from: 'audit', lang: cfg.locale }));

    const quote = h('button', { type: 'button', class: 'linkish', text: s.quote });
    quote.addEventListener('click', () => {
      const r = report!;
      track('audit_to_quote', { recommendation: r.recommendation.id, score: r.score, platform: r.platform, from: 'sent' });
      const answers: Record<string, string> = { projectType: r.recommendation.projectType, currentPlatform: r.recommendation.currentPlatform };
      if (r.recommendation.approach) answers.approach = r.recommendation.approach;
      window.dispatchEvent(new CustomEvent('maw:quote-prefill', { detail: { answers } }));
    });

    wrap.append(
      h('h3', { class: 'report-h dot-end', tabindex: '-1', 'data-focus': true, text: s.heading.replace(/\.$/, '') }),
      h('p', { text: s.text }),
      h('p', { class: 'hint', text: followUp ? s.followUp : s.noFollowUp }),
      h('div', { class: 'actions' }, again),
      h('div', { class: 'rec' },
        h('h4', { text: s.bookHeading }),
        h('p', { text: s.bookText }),
        h('div', { class: 'actions' }, book, quote)),
      h('p', { class: 'again' }, againLink()),
    );
    return [wrap];
  };

  /* ---------- run ---------- */

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
      const res = await fetch(cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
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

    report = analyze(snapshot, cfg.versions);
    say('');
    button.disabled = false;
    form.hidden = true;
    show(viewReport());
    track('audit_done', { score: report.score, platform: report.platform, critical: report.counts.critical, recommendation: report.recommendation.id });
    try { sessionStorage.setItem(AUDIT_STORE, JSON.stringify({ summary: summarize(report), url: report.finalUrl })); } catch { /* ignore */ }
  });
}
