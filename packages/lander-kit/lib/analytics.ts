/**
 * Consent-gated analytics (brief §7.3, §11). GA4 loads only after the visitor accepts.
 * Runs in the browser. Zero third-party requests before consent.
 */
import type { Locale } from './i18n';

export type ConsentChoice = 'granted' | 'denied';
export interface ConsentRecord { analytics: ConsentChoice; at: number; }

export const CONSENT_KEY = 'maw-consent';
export const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 12 months

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __mawGa4Loaded?: boolean;
  }
}

export function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as ConsentRecord;
    if (!rec || typeof rec.at !== 'number') return null;
    if (Date.now() - rec.at > CONSENT_TTL_MS) {
      localStorage.removeItem(CONSENT_KEY);
      return null;
    }
    return rec;
  } catch {
    return null;
  }
}

export function writeConsent(analytics: ConsentChoice): void {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics, at: Date.now() } satisfies ConsentRecord));
  } catch {
    /* storage unavailable: choice is not remembered, banner shows again */
  }
}

function gtag(...args: unknown[]): void {
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(args);
}

/**
 * Load GA4. Call only after consent. Idempotent.
 * To switch to a cookieless analytics script after the 90-day gate, replace the body of this function.
 */
export function loadGA4(measurementId: string): void {
  if (!measurementId || window.__mawGa4Loaded) return;
  window.__mawGa4Loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = gtag;
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  gtag('js', new Date());
  gtag('config', measurementId, { anonymize_ip: true });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(s);
}

export type EventName =
  | 'price_reveal' | 'cta_click' | 'form_submit' | 'lang_switch'
  | 'quote_start' | 'quote_step' | 'quote_shown' | 'quote_accept' | 'quote_lead' | 'book_call' | 'out_of_budget'
  | 'audit_start' | 'audit_done' | 'audit_error' | 'audit_to_quote';

/**
 * Record an event. Before consent (or after decline) this only touches an in-memory array — no network.
 * gtag drains the dataLayer when it loads, so events that happened before acceptance on this page are kept.
 */
export function track(name: EventName, params: Record<string, string | number | undefined> = {}): void {
  const clean: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined) clean[k] = v;
  gtag('event', name, clean);
}

/**
 * Wire page-level listeners: consent decision → GA4, CTA clicks, language switch, thanks-page conversion.
 */
export function initAnalytics(opts: { measurementId: string; locale: Locale }): void {
  const consent = readConsent();
  if (consent?.analytics === 'granted') loadGA4(opts.measurementId);

  document.addEventListener('click', (ev) => {
    const el = (ev.target as Element | null)?.closest<HTMLAnchorElement>('a[data-cta]');
    if (el) {
      track('cta_click', { project: el.dataset.project || undefined, section: el.dataset.cta, lang: opts.locale });
      return;
    }
    const sw = (ev.target as Element | null)?.closest<HTMLAnchorElement>('a[data-lang-switch]');
    if (sw) track('lang_switch', { from: opts.locale, to: sw.dataset.langSwitch });
  });

  const conversion = document.body.dataset.event;
  if (conversion === 'form_submit') track('form_submit', { lang: opts.locale });
}
