/**
 * QuotePanel island (vanilla TS, no framework). Renders the MAW quote flow step by step inside the hero panel,
 * computes the range with lib/quote.ts, and sends the lead to the MAW pipeline. Accessible: real buttons and
 * checkboxes, focus moves to each new question, the result is announced via aria-live, Escape/“Previous” go back.
 */
import { track } from './analytics';
import { formatInt, formatMoney, interpolate, type Locale } from './i18n';
import { sendLead } from './lead';
import type { PricingData } from './pricing';
import {
  buildLeadPayload, computeQuote, isComplete, newSessionId, nextStep, pruneAnswers, stepsFor,
  type Answers, type QuoteResult, type StepDef, type StepId,
} from './quote';
import type { QuoteCopy } from './copy';

interface Config {
  locale: Locale;
  copy: QuoteCopy;
  pricing: PricingData;
  leadEndpoint: string;
  bookUrl: string;
  supportEmail: string;
  thanksPath: string;
  privacyPath: string;
  termsUrl: string;
  domain: string;
  chatUrl: string;
}

type View = 'steps' | 'result' | 'intake' | 'followup' | 'budget';
interface State { answers: Answers; view: View; }

const STORE = 'caw-quote';
const FADE = 150;

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

export function mountQuotePanel(root: HTMLElement): void {
  const cfg = JSON.parse(root.dataset.config ?? '{}') as Config;
  const c = cfg.copy;
  const stage = root.querySelector<HTMLElement>('[data-quote-stage]')!;
  const loadedAt = Date.now();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let sessionId = '';
  let state: State = { answers: {}, view: 'steps' };
  let started = false;

  try {
    const saved = sessionStorage.getItem(STORE);
    if (saved) {
      const parsed = JSON.parse(saved) as State & { sessionId?: string };
      state = { answers: pruneAnswers(parsed.answers ?? {}), view: parsed.view === 'result' && isComplete(parsed.answers ?? {}) ? 'result' : 'steps' };
      sessionId = parsed.sessionId ?? '';
      started = Object.keys(state.answers).length > 0;
    }
  } catch { /* ignore */ }
  if (!sessionId) sessionId = newSessionId();

  const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify({ ...state, sessionId })); } catch { /* ignore */ } };
  const money = (n: number) => formatMoney(n, cfg.locale);
  const dash = cfg.locale === 'fr' ? ' à ' : '–';
  const range = (low: number, high: number, plus = false) => `${money(low)}${dash}${money(high)}${plus ? (cfg.locale === 'fr' ? ' et plus' : '+') : ''}`;
  const hours = (low: number, high: number, plus = false) => `${formatInt(low, cfg.locale)}${dash}${formatInt(high, cfg.locale)}${plus ? '+' : ''} ${c.result.hoursUnit}`;

  const label = (step: StepId, opt: string) => c.steps[step]?.options[opt] ?? opt;
  const summaryLines = (): string[] =>
    stepsFor(state.answers).filter((s) => state.answers[s.id] !== undefined).map((s) => {
      const v = state.answers[s.id]!;
      const vals = (Array.isArray(v) ? v : [v]).map((o) => label(s.id, o)).join(', ');
      return `${c.steps[s.id]?.q ?? s.id} ${vals}`;
    });

  const leader = (labelText: string, value: string, extraClass = '') => {
    const line = h('div', { class: `leader-line small ${extraClass}`.trim() });
    line.append(h('span', { class: 'label', text: labelText }), h('span', { class: 'leader', 'aria-hidden': 'true' }), h('span', { class: 'value price', text: value }));
    return line;
  };

  const focusHeading = () => {
    const q = stage.querySelector<HTMLElement>('[data-focus]');
    q?.focus({ preventScroll: true });
  };

  const swap = (build: () => Node[]) => {
    const apply = () => {
      stage.replaceChildren(...build());
      stage.classList.remove('is-fading');
      focusHeading();
    };
    if (reduced.matches) { apply(); return; }
    stage.classList.add('is-fading');
    window.setTimeout(apply, FADE);
  };

  const go = (view: View) => { state.view = view; save(); render(); };

  /* ---------- steps ---------- */
  const renderStep = (step: StepDef): Node[] => {
    const all = stepsFor(state.answers);
    const index = all.findIndex((s) => s.id === step.id);
    const copyStep = c.steps[step.id];
    const nodes: Node[] = [];
    nodes.push(h('p', { class: 'meta on-dark progress', text: interpolate(c.progress, { n: index + 1, total: all.length }) }));
    nodes.push(h('h2', { class: 'q', id: 'quote-q', tabindex: '-1', 'data-focus': true, text: copyStep.q }));
    if (copyStep.hint) nodes.push(h('p', { class: 'hint', text: copyStep.hint }));
    if (step.multi) nodes.push(h('p', { class: 'hint', text: c.multiHint }));

    const current = state.answers[step.id];
    const group = h('div', { class: 'options', role: 'group', 'aria-labelledby': 'quote-q' });

    if (step.multi) {
      const selected = new Set(Array.isArray(current) ? current : []);
      for (const opt of step.options) {
        const id = `q-${step.id}-${opt}`;
        const input = h('input', { type: 'checkbox', id, value: opt, checked: selected.has(opt) });
        input.addEventListener('change', () => {
          if (opt === 'none' && input.checked) group.querySelectorAll<HTMLInputElement>('input:not([value="none"])').forEach((i) => { i.checked = false; });
          if (opt !== 'none' && input.checked) { const none = group.querySelector<HTMLInputElement>('input[value="none"]'); if (none) none.checked = false; }
        });
        const lab = h('label', { class: 'opt', for: id }, input, optText(copyStep, opt));
        group.append(lab);
      }
      nodes.push(group);
      const cont = h('button', { type: 'button', class: 'btn btn-small', text: c.continue });
      cont.addEventListener('click', () => {
        const chosen = Array.from(group.querySelectorAll<HTMLInputElement>('input:checked')).map((i) => (i as HTMLInputElement).value);
        if (chosen.length === 0) { group.querySelector<HTMLInputElement>('input')?.focus(); return; }
        answer(step, chosen);
      });
      nodes.push(h('div', { class: 'actions' }, cont, backButton(index)));
    } else {
      for (const opt of step.options) {
        const btn = h('button', { type: 'button', class: 'opt', 'aria-pressed': current === opt ? 'true' : 'false' });
        btn.append(optText(copyStep, opt), h('span', { class: 'opt-dot', 'aria-hidden': 'true' }));
        btn.addEventListener('click', () => { btn.setAttribute('aria-pressed', 'true'); answer(step, opt); });
        group.append(btn);
      }
      nodes.push(group);
      if (index > 0) nodes.push(h('div', { class: 'actions' }, backButton(index)));
    }
    return nodes;
  };

  const optText = (copyStep: QuoteCopy['steps'][string], opt: string) => {
    const wrap = h('span', { class: 'opt-text' }, h('span', { class: 'opt-label', text: copyStep.options[opt] }));
    const desc = copyStep.desc?.[opt];
    if (desc) wrap.append(h('span', { class: 'opt-desc', text: desc }));
    return wrap;
  };

  const backButton = (index: number) => {
    if (index === 0) return null;
    const b = h('button', { type: 'button', class: 'linkish', text: c.back });
    b.addEventListener('click', back);
    return b;
  };

  const answer = (step: StepDef, value: string | string[]) => {
    if (!started) { started = true; track('quote_start', { lang: cfg.locale }); }
    state.answers = pruneAnswers({ ...state.answers, [step.id]: value });
    track('quote_step', { step: step.id, value: Array.isArray(value) ? value.join('|') : value });
    state.view = isComplete(state.answers) ? 'result' : 'steps';
    save();
    render();
  };

  const back = () => {
    const answered = stepsFor(state.answers).filter((s) => state.answers[s.id] !== undefined);
    const last = answered[answered.length - 1];
    if (state.view !== 'steps') { state.view = 'steps'; }
    if (last) delete state.answers[last.id];
    state.answers = pruneAnswers(state.answers);
    save();
    render();
  };

  const reset = () => { state = { answers: {}, view: 'steps' }; save(); render(); };

  /* ---------- result ---------- */
  const renderResult = (r: QuoteResult): Node[] => {
    const nodes: Node[] = [];
    nodes.push(h('p', { class: 'meta on-dark progress', text: c.panelLabel }));
    if (r.kind === 'discovery') {
      nodes.push(h('h2', { class: 'q', tabindex: '-1', 'data-focus': true, text: c.result.discovery.heading }));
      nodes.push(h('p', { class: 'body', text: interpolate(c.result.discovery.text, { price: range(r.price.low, r.price.high), hours: `${r.hours.low}${dash}${r.hours.high}` }) }));
      const book = h('a', { class: 'btn', href: cfg.bookUrl, rel: 'noopener', 'data-cta': 'book', text: c.result.discovery.cta });
      book.addEventListener('click', () => track('book_call', { project: 'custom', lang: cfg.locale }));
      const send = h('button', { type: 'button', class: 'linkish', text: c.result.discovery.send });
      send.addEventListener('click', () => { track('quote_accept', { project: 'custom' }); go('intake'); });
      nodes.push(h('div', { class: 'actions' }, book, h('span', { class: 'hint', text: c.result.discovery.or }), send));
      nodes.push(footerLinks());
      return nodes;
    }
    nodes.push(h('h2', { class: 'q', tabindex: '-1', 'data-focus': true, text: c.result.heading }));
    const box = h('div', { class: 'reveal', 'aria-live': 'polite' });
    box.append(leader(c.result.priceLabel, range(r.price.low, r.price.high, r.price.plus), 'big'));
    box.append(leader(c.result.hoursLabel, hours(r.hours.low, r.hours.high, r.hours.plus), 'faint'));
    const bd = r.breakdown;
    const contentLabel = r.projectType === 'ecommerce' ? c.result.breakdown.contentShop : c.result.breakdown.content;
    box.append(
      leader(c.result.breakdown.design, hours(bd.design.low, bd.design.high), 'faint'),
      leader(c.result.breakdown.development, hours(bd.development.low, bd.development.high), 'faint'),
      leader(contentLabel, hours(bd.content.low, bd.content.high), 'faint'),
      leader(c.result.breakdown.testing, hours(bd.testing.low, bd.testing.high), 'faint'),
      leader(c.result.timelineLabel, interpolate(c.result.weeks, { low: r.weeks.low, high: r.weeks.high }), 'faint'),
    );
    if (r.timeline === 'rush') box.append(h('p', { class: 'hint', text: c.result.rushNote }));
    if (r.designProvided) box.append(h('p', { class: 'hint', text: c.result.designNote }));
    nodes.push(box);
    nodes.push(h('h3', { class: 'sub-h', text: c.result.provideHeading }));
    nodes.push(h('ul', { class: 'provide' }, ...r.provide.map((k) => h('li', { text: c.result.provide[k] ?? k }))));
    nodes.push(h('p', { class: 'hint', text: `${c.result.guarantee} ${c.result.taxes}` }));

    const accept = h('button', { type: 'button', class: 'btn', text: c.result.actions.accept });
    accept.addEventListener('click', () => { track('quote_accept', { project: r.projectType, low: r.price.low, high: r.price.high }); go('intake'); });
    const book = h('a', { class: 'btn btn-outline btn-small', href: cfg.bookUrl, rel: 'noopener', 'data-cta': 'book', text: c.result.actions.book });
    book.addEventListener('click', () => track('book_call', { project: r.projectType, lang: cfg.locale }));
    const budget = h('button', { type: 'button', class: 'btn btn-outline btn-small', text: c.result.actions.budget });
    budget.addEventListener('click', () => { track('out_of_budget', { project: r.projectType }); go('budget'); });
    nodes.push(h('div', { class: 'actions' }, accept), h('div', { class: 'actions' }, book, budget));
    nodes.push(footerLinks());
    return nodes;
  };

  const footerLinks = () => {
    const wrap = h('p', { class: 'hint links' });
    const chat = h('a', { href: cfg.chatUrl, 'data-cta': 'hero', text: c.result.actions.chat });
    const over = h('button', { type: 'button', class: 'linkish', text: c.startOver });
    over.addEventListener('click', reset);
    const back = h('button', { type: 'button', class: 'linkish', text: c.back });
    back.addEventListener('click', () => { state.view = 'steps'; const all = stepsFor(state.answers); const last = all[all.length - 1]; if (last) delete state.answers[last.id]; save(); render(); });
    wrap.append(back, ' · ', over, ' · ', chat);
    return wrap;
  };

  /* ---------- budget ---------- */
  const renderBudget = (): Node[] => {
    const book = h('a', { class: 'btn', href: cfg.bookUrl, rel: 'noopener', 'data-cta': 'book', text: c.budget.book });
    book.addEventListener('click', () => track('book_call', { project: String(state.answers.projectType), lang: cfg.locale, from: 'budget' }));
    const later = h('button', { type: 'button', class: 'btn btn-outline btn-small', text: c.budget.later });
    later.addEventListener('click', () => go('followup'));
    const back = h('button', { type: 'button', class: 'linkish', text: c.budget.back });
    back.addEventListener('click', () => go('result'));
    return [
      h('p', { class: 'meta on-dark progress', text: c.panelLabel }),
      h('h2', { class: 'q', tabindex: '-1', 'data-focus': true, text: c.budget.heading }),
      h('p', { class: 'body', text: c.budget.text }),
      h('div', { class: 'actions' }, book, later),
      h('p', { class: 'hint links' }, back),
    ];
  };

  /* ---------- intake ---------- */
  const renderIntake = (followUp: boolean): Node[] => {
    const i = c.intake;
    const form = h('form', { class: 'intake', novalidate: true });
    const field = (name: string, labelText: string, type = 'text', required = false, autocomplete?: string) => {
      const id = `qi-${name}`;
      const wrap = h('div', { class: 'field' });
      const input = type === 'textarea'
        ? h('textarea', { id, name, rows: '3' })
        : h('input', { id, name, type, required, autocomplete, inputmode: type === 'email' ? 'email' : type === 'tel' ? 'tel' : undefined });
      wrap.append(h('label', { for: id, text: labelText }), input, h('p', { class: 'field-error', id: `${id}-err`, hidden: true }));
      input.setAttribute('aria-describedby', `${id}-err`);
      return wrap;
    };
    form.append(
      field('firstname', i.name, 'text', true, 'name'),
      field('email', i.email, 'email', true, 'email'),
      field('phone', i.phone, 'tel', false, 'tel'),
      field('company', i.company, 'text', false, 'organization'),
      field('notes', i.notes, 'textarea'),
    );
    const consentWrap = h('div', { class: 'field' });
    const consent = h('input', { type: 'checkbox', id: 'qi-consent', name: 'consent' });
    consentWrap.append(h('div', { class: 'field-check' }, consent, h('label', { for: 'qi-consent', text: i.consent })), h('p', { class: 'field-error', id: 'qi-consent-err', hidden: true }));
    form.append(consentWrap);
    const hp = h('div', { class: 'hp', 'aria-hidden': 'true' }, h('label', { for: 'qi-website', tabindex: '-1', text: 'Website' }), h('input', { id: 'qi-website', name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' }));
    form.append(hp);
    const submit = h('button', { type: 'submit', class: 'btn', text: followUp ? i.followUpButton : i.button });
    const status = h('p', { class: 'form-status', role: 'alert', hidden: true });
    form.append(h('div', { class: 'actions' }, submit), status);

    const setErr = (name: string, text: string | null) => {
      const wrap = form.querySelector<HTMLElement>(`#qi-${name}`)!.closest<HTMLElement>('.field')!;
      const p = wrap.querySelector<HTMLElement>('.field-error')!;
      p.textContent = text ?? ''; p.hidden = !text;
      if (text) { wrap.dataset.invalid = 'true'; form.querySelector(`#qi-${name}`)!.setAttribute('aria-invalid', 'true'); }
      else { delete wrap.dataset.invalid; form.querySelector(`#qi-${name}`)!.removeAttribute('aria-invalid'); }
    };
    const say = (t: string) => { status.textContent = t; status.hidden = !t; };

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      say('');
      const v = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement).value.trim();
      let first: string | null = null;
      const check = (n: string, ok: boolean, msg: string) => { setErr(n, ok ? null : msg); if (!ok && !first) first = n; };
      check('firstname', v('firstname').length > 0, i.errors.name);
      check('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email')), i.errors.email);
      check('consent', consent.checked, i.errors.consent);
      if (first) { form.querySelector<HTMLElement>(`#qi-${first}`)?.focus(); return; }
      if ((form.elements.namedItem('website') as HTMLInputElement).value) { window.location.assign(cfg.thanksPath); return; }
      if (Date.now() - loadedAt < 3000) { say(i.errors.tooFast); return; }
      if (!cfg.leadEndpoint) { say(i.errors.notConfigured.replace('{email}', cfg.supportEmail)); return; }
      const result = computeQuote(state.answers, cfg.pricing);
      if (!result) { go('steps'); return; }
      submit.disabled = true;
      say(i.sending);
      let auditLines: string[] = [];
      try {
        const saved = sessionStorage.getItem('caw-audit');
        if (saved) auditLines = (JSON.parse(saved) as { summary?: string[] }).summary ?? [];
      } catch { /* ignore */ }
      const payload = buildLeadPayload({
        name: v('firstname'), email: v('email'), phone: v('phone'), company: v('company'), notes: v('notes'),
        locale: cfg.locale, answers: state.answers, result, summaryLines: [...summaryLines(), ...auditLines], sessionId,
        source: { domain: cfg.domain, page: window.location.href, lang: cfg.locale, utm_source: cfg.domain, utm_medium: 'funnel', utm_campaign: `lander-${cfg.locale}`, utm_content: 'quote' },
        followUp, feedback: followUp ? 'out_of_budget' : undefined,
      });
      const res = await sendLead(cfg.leadEndpoint, payload);
      if (res.ok) {
        track('quote_lead', { project: String(state.answers.projectType), status: followUp ? 'follow_up' : 'quoted', lang: cfg.locale });
        try { sessionStorage.removeItem(STORE); } catch { /* ignore */ }
        window.location.assign(cfg.thanksPath);
        return;
      }
      submit.disabled = false;
      say(i.errors.network.replace('{email}', cfg.supportEmail));
    });

    const back = h('button', { type: 'button', class: 'linkish', text: c.back });
    back.addEventListener('click', () => go(followUp ? 'budget' : 'result'));
    return [
      h('p', { class: 'meta on-dark progress', text: c.panelLabel }),
      h('h2', { class: 'q', tabindex: '-1', 'data-focus': true, text: followUp ? i.followUpHeading : i.heading }),
      h('p', { class: 'hint', text: followUp ? i.followUpIntro : i.intro }),
      summaryBlock(),
      form,
      h('p', { class: 'hint links' }, back),
    ];
  };

  const summaryBlock = () => {
    const det = h('details', { class: 'summary' });
    det.append(h('summary', { text: c.summary.heading }));
    const ul = h('ul');
    for (const s of stepsFor(state.answers)) {
      const v = state.answers[s.id];
      if (v === undefined) continue;
      ul.append(h('li', { text: `${c.steps[s.id]?.q ?? s.id} ${(Array.isArray(v) ? v : [v]).map((o) => label(s.id, o)).join(', ')}` }));
    }
    det.append(ul);
    return det;
  };

  /* ---------- render ---------- */
  function render() {
    if (state.view === 'steps') {
      const step = nextStep(state.answers);
      if (!step) { state.view = 'result'; }
      else { swap(() => renderStep(step)); return; }
    }
    if (state.view === 'result') {
      const r = computeQuote(state.answers, cfg.pricing);
      if (!r) { state.view = 'steps'; render(); return; }
      if (r.kind === 'quote') track('quote_shown', { project: r.projectType, low: r.price.low, high: r.price.high, complexity: r.complexity, lang: cfg.locale });
      else track('quote_shown', { project: 'custom', lang: cfg.locale });
      swap(() => renderResult(r));
      return;
    }
    if (state.view === 'budget') { swap(renderBudget); return; }
    if (state.view === 'intake') { swap(() => renderIntake(false)); return; }
    if (state.view === 'followup') { swap(() => renderIntake(true)); return; }
  }

  // The audit hands over a project type and platform; jump the flow forward rather than making them retype it.
  window.addEventListener('maw:quote-prefill', (ev) => {
    const detail = (ev as CustomEvent<{ answers: Record<string, string> }>).detail;
    if (!detail?.answers) return;
    state = { answers: pruneAnswers(detail.answers as Answers), view: 'steps' };
    started = true;
    save();
    render();
    root.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(focusHeading, reduced.matches ? 0 : 400);
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.view === 'steps' && Object.keys(state.answers).length > 0) { e.preventDefault(); back(); }
  });

  // Initial paint replaces the server-rendered first question without moving focus (nothing was interacted with yet).
  const step = nextStep(state.answers);
  if (state.view === 'steps' && step) stage.replaceChildren(...renderStep(step));
  else render();
}
