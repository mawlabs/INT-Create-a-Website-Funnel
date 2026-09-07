/**
 * Instant quote engine. Mirrors the Monkeys at Work chat flow (chat edge function SYSTEM_PROMPT and
 * public/docs/chat-flow-documentation.md, April 2026) as a deterministic step flow plus the pricing framework.
 * No copy lives here: step and option ids are keys into the site's i18n JSON. Numbers come from the site's
 * pricing.ts (tiers) plus the adders below, which encode the framework's "Add-Ons" and "Cost adjustment factors".
 *
 * Runs at build time (tables, JSON-LD) and in the browser (QuotePanel island). Pure functions, no DOM.
 */
import type { Locale } from './i18n';
import { findTier, type PricingData, type Range } from './pricing';

export const PROJECT_TYPES = ['business', 'blog', 'landing', 'ecommerce', 'redesign', 'changes', 'custom'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

/** Every step id the flow can ask. Labels live in i18n under quote.steps.<id>. */
export type StepId =
  | 'projectType' | 'platform' | 'currentPlatform' | 'approach' | 'design' | 'multilingual'
  | 'integrations' | 'shopIntegrations' | 'newIntegrations' | 'pages' | 'blog' | 'categories'
  | 'templates' | 'affiliate' | 'products' | 'productHelp' | 'international' | 'morePages'
  | 'changeTypes' | 'users' | 'timeline';

export interface StepDef {
  id: StepId;
  options: readonly string[];
  multi?: boolean;
}

export type Answers = Partial<Record<StepId, string | string[]>>;

const WEB_INTEGRATIONS = ['analytics', 'crm', 'newsletter', 'liveChat', 'booking', 'other', 'none'] as const;
const SHOP_INTEGRATIONS = ['payments', 'shipping', 'subscriptions', 'reviews', 'marketing', 'other', 'none'] as const;

const S = {
  projectType: { id: 'projectType', options: PROJECT_TYPES } as StepDef,
  platformWeb: { id: 'platform', options: ['wordpress', 'fullyCustom', 'other'] } as StepDef,
  platformShop: { id: 'platform', options: ['shopify', 'woocommerce', 'fullyCustom'] } as StepDef,
  currentPlatform: { id: 'currentPlatform', options: ['wordpress', 'shopify', 'woocommerce', 'other'] } as StepDef,
  approachWeb: { id: 'approach', options: ['builder', 'customTheme'] } as StepDef,
  approachShop: { id: 'approach', options: ['themeStore', 'customizedStore', 'customCodedStore'] } as StepDef,
  approachRedesign: { id: 'approach', options: ['refresh', 'fullRedesign', 'migration'] } as StepDef,
  design: { id: 'design', options: ['ready', 'inspiration', 'scratch'] } as StepDef,
  multilingual: { id: 'multilingual', options: ['bilingual', 'multi', 'single'] } as StepDef,
  integrations: { id: 'integrations', options: WEB_INTEGRATIONS, multi: true } as StepDef,
  shopIntegrations: { id: 'shopIntegrations', options: SHOP_INTEGRATIONS, multi: true } as StepDef,
  newIntegrations: { id: 'newIntegrations', options: WEB_INTEGRATIONS, multi: true } as StepDef,
  pages: { id: 'pages', options: ['p1_5', 'p6_10', 'p11_20', 'p20plus'] } as StepDef,
  blog: { id: 'blog', options: ['yes', 'no', 'later'] } as StepDef,
  categories: { id: 'categories', options: ['c1_3', 'c4_8', 'c9plus'] } as StepDef,
  templates: { id: 'templates', options: ['multi', 'one', 'unsure'] } as StepDef,
  affiliate: { id: 'affiliate', options: ['yes', 'no', 'later'] } as StepDef,
  products: { id: 'products', options: ['under50', 'p50_200', 'p200_1000', 'p1000plus'] } as StepDef,
  productHelp: { id: 'productHelp', options: ['full', 'few', 'none'] } as StepDef,
  international: { id: 'international', options: ['multi', 'caUs', 'local'] } as StepDef,
  morePages: { id: 'morePages', options: ['few', 'many', 'same'] } as StepDef,
  changeTypes: { id: 'changeTypes', options: ['features', 'design', 'fixes', 'content', 'performance', 'other'], multi: true } as StepDef,
  users: { id: 'users', options: ['internal', 'customers', 'both', 'other'] } as StepDef,
  timeline: { id: 'timeline', options: ['standard', 'rush', 'flexible'] } as StepDef,
} as const;

/** All step definitions, for rendering every option label once. */
export const ALL_STEPS: StepDef[] = Object.values(S);

/**
 * The ordered steps for a set of answers so far. Re-evaluated after every answer, so a step can appear
 * or disappear (build approach is skipped for "Fully Custom" / "Other", as in the chat prompt STEP 3).
 */
export function stepsFor(a: Answers): StepDef[] {
  const type = a.projectType as ProjectType | undefined;
  const steps: StepDef[] = [S.projectType];
  if (!type) return steps;
  const platform = a.platform as string | undefined;
  switch (type) {
    case 'business':
      steps.push(S.platformWeb);
      if (platform === 'wordpress') steps.push(S.approachWeb);
      steps.push(S.design, S.multilingual, S.integrations, S.pages, S.blog, S.timeline);
      break;
    case 'blog':
      steps.push(S.platformWeb);
      if (platform === 'wordpress') steps.push(S.approachWeb);
      steps.push(S.design, S.multilingual, S.categories, S.templates, S.affiliate, S.integrations, S.timeline);
      break;
    case 'landing':
      steps.push(S.platformWeb);
      if (platform === 'wordpress') steps.push(S.approachWeb);
      steps.push(S.design, S.multilingual, S.integrations, S.timeline);
      break;
    case 'ecommerce':
      steps.push(S.platformShop);
      if (platform === 'shopify' || platform === 'woocommerce') steps.push(S.approachShop);
      steps.push(S.design, S.multilingual, S.shopIntegrations, S.products, S.productHelp, S.international, S.timeline);
      break;
    case 'redesign':
      steps.push(S.currentPlatform, S.approachRedesign, S.design, S.newIntegrations, S.morePages, S.timeline);
      break;
    case 'changes':
      steps.push(S.currentPlatform, S.changeTypes, S.newIntegrations, S.timeline);
      break;
    case 'custom':
      steps.push(S.users);
      break;
  }
  return steps;
}

/** First unanswered step, or null when the flow is complete. */
export function nextStep(a: Answers): StepDef | null {
  for (const step of stepsFor(a)) {
    const v = a[step.id];
    if (v === undefined || (Array.isArray(v) && v.length === 0)) return step;
  }
  return null;
}

/** Drop answers that belong to steps no longer in the flow (after going back and changing a branch). */
export function pruneAnswers(a: Answers): Answers {
  const valid = new Set(stepsFor(a).map((s) => s.id));
  const out: Answers = {};
  for (const [k, v] of Object.entries(a)) if (valid.has(k as StepId)) out[k as StepId] = v as string | string[];
  return out;
}

export type Complexity = 'simple' | 'moderate' | 'complex' | 'major';

export interface HourRange { low: number; high: number; }

export interface Quote {
  kind: 'quote';
  projectType: ProjectType;
  hours: HourRange & { plus: boolean };
  price: { low: number; high: number; plus: boolean; currency: 'CAD' };
  breakdown: { design: HourRange; development: HourRange; content: HourRange; testing: HourRange };
  weeks: HourRange;
  complexity: Complexity;
  /** Keys into i18n quote.provide.* */
  provide: string[];
  timeline: 'standard' | 'rush' | 'flexible';
  /** Tier reference used as the base, e.g. "websites.basic", for transparency in the lead record. */
  base: string;
}

export interface Discovery {
  kind: 'discovery';
  projectType: 'custom';
  price: { low: number; high: number; currency: 'CAD' };
  hours: HourRange;
}

export type QuoteResult = Quote | Discovery;

/* ---- adders: extra hours [low, high] per answer (framework add-ons converted at the hourly rate) ---- */
const ADD: Record<string, Record<string, [number, number]>> = {
  integrations: { analytics: [1, 2], crm: [3, 8], newsletter: [2, 5], liveChat: [2, 4], booking: [4, 9], other: [3, 9], none: [0, 0] },
  shopIntegrations: { payments: [1, 3], shipping: [3, 8], subscriptions: [8, 15], reviews: [2, 5], marketing: [3, 8], other: [3, 9], none: [0, 0] },
  pages: { p1_5: [0, 0], p6_10: [0, 0], p11_20: [10, 20], p20plus: [25, 40] },
  blog: { yes: [4, 8], no: [0, 0], later: [0, 0] },
  categories: { c1_3: [0, 0], c4_8: [4, 8], c9plus: [8, 15] },
  templates: { multi: [6, 12], one: [0, 0], unsure: [2, 6] },
  affiliate: { yes: [4, 8], no: [0, 0], later: [2, 4] },
  products: { under50: [0, 0], p50_200: [5, 10], p200_1000: [10, 20], p1000plus: [20, 40] },
  productHelp: { full: [6, 24], few: [2, 4], none: [0, 0] },       // product data entry +$500–2,000
  international: { multi: [4, 10], caUs: [2, 4], local: [0, 0] },   // Shopify Markets +$300–800
  morePages: { few: [5, 10], many: [15, 30], same: [0, 0] },
  changeTypes: { features: [6, 15], design: [5, 12], fixes: [2, 6], content: [2, 5], performance: [3, 8], other: [2, 6] },
};
ADD.newIntegrations = ADD.integrations;

/* multipliers */
const MULT: Record<string, Record<string, [number, number]>> = {
  design: { ready: [0.9, 0.9], inspiration: [1, 1], scratch: [1, 1] },
  multilingual: { bilingual: [1.2, 1.3], multi: [1.3, 1.4], single: [1, 1] },   // framework: +20–40%
  timeline: { standard: [1, 1], rush: [1.2, 1.3], flexible: [1, 1] },           // prompt: add 20–30% for rush
};

const SPLIT: Record<ProjectType, [number, number, number, number]> = {
  business: [0.3, 0.45, 0.12, 0.13],
  blog: [0.3, 0.45, 0.12, 0.13],
  landing: [0.35, 0.4, 0.12, 0.13],
  ecommerce: [0.25, 0.45, 0.18, 0.12],
  redesign: [0.35, 0.4, 0.12, 0.13],
  changes: [0.15, 0.6, 0.1, 0.15],
  custom: [0.25, 0.5, 0.1, 0.15],
};

function baseTier(a: Answers, data: PricingData): { ref: string; price: Range | null; hours: Range | null } {
  const type = a.projectType as ProjectType;
  const platform = a.platform as string | undefined;
  const approach = a.approach as string | undefined;
  const ref = (() => {
    switch (type) {
      case 'business':
      case 'blog':
        if (platform === 'fullyCustom') return 'websites.custom';
        if (approach === 'customTheme' || platform === 'other') return 'websites.intermediate';
        return 'websites.basic';
      case 'landing':
        if (platform === 'fullyCustom') return 'landing.custom';
        return approach === 'customTheme' || platform === 'other' ? 'landing.customTheme' : 'landing.builder';
      case 'ecommerce': {
        const p = platform === 'shopify' ? 'shopify' : 'woocommerce'; // fully custom stores are priced off the WooCommerce table
        if (platform === 'fullyCustom' || approach === 'customCodedStore') return `${p}.custom`;
        return approach === 'customizedStore' ? `${p}.intermediate` : `${p}.basic`;
      }
      case 'redesign':
        return approach === 'migration' ? 'redesign.migration' : approach === 'fullRedesign' ? 'redesign.full' : 'redesign.refresh';
      case 'changes':
        return 'changes.base';
      default:
        return 'custom.discovery';
    }
  })();
  if (ref === 'changes.base') return { ref, price: null, hours: null };
  const t = findTier(data, ref);
  return { ref, price: t.price, hours: t.hours };
}

function round(n: number, step: number, dir: 'floor' | 'ceil'): number {
  return (dir === 'floor' ? Math.floor(n / step) : Math.ceil(n / step)) * step;
}

export function complexityFor(hoursMid: number): Complexity {
  if (hoursMid < 40) return 'simple';
  if (hoursMid < 80) return 'moderate';
  if (hoursMid < 150) return 'complex';
  return 'major';
}

export function isComplete(a: Answers): boolean {
  return a.projectType !== undefined && nextStep(a) === null;
}

/** Compute the quote. Returns null while the flow is incomplete. */
export function computeQuote(a: Answers, data: PricingData): QuoteResult | null {
  if (!isComplete(a)) return null;
  const type = a.projectType as ProjectType;

  if (type === 'custom') {
    const t = findTier(data, 'custom.discovery');
    return {
      kind: 'discovery',
      projectType: 'custom',
      price: { low: t.price!.min, high: t.price!.max, currency: 'CAD' },
      hours: { low: t.hours!.min, high: t.hours!.max },
    };
  }

  const base = baseTier(a, data);
  let hLow = base.hours?.min ?? 0;
  let hHigh = base.hours?.max ?? 0;
  let pLow = base.price?.min ?? 0;
  let pHigh = base.price?.max ?? 0;
  const plus = !!base.hours?.plus;

  // adders
  let extraLow = 0;
  let extraHigh = 0;
  for (const [step, table] of Object.entries(ADD)) {
    const v = a[step as StepId];
    if (v === undefined) continue;
    for (const opt of Array.isArray(v) ? v : [v]) {
      const add = table[opt];
      if (add) { extraLow += add[0]; extraHigh += add[1]; }
    }
  }
  hLow += extraLow; hHigh += extraHigh;
  pLow += extraLow * data.hourlyRate; pHigh += extraHigh * data.hourlyRate;

  // multipliers
  for (const [step, table] of Object.entries(MULT)) {
    const v = a[step as StepId];
    const m = typeof v === 'string' ? table[v] : undefined;
    if (!m) continue;
    hLow *= m[0]; hHigh *= m[1]; pLow *= m[0]; pHigh *= m[1];
  }

  hLow = Math.max(1, Math.round(hLow));
  hHigh = Math.max(hLow + 1, Math.round(hHigh));
  pLow = Math.max(data.hourlyRate, round(pLow, 50, 'floor'));
  pHigh = Math.max(pLow + 50, round(pHigh, 50, 'ceil'));

  const timeline = (a.timeline as Quote['timeline']) ?? 'standard';
  // Timeline in weeks from hours: a 30–40 h site is 4–7 weeks; rush compresses. TODO(angelique): confirm the formula.
  let wLow = Math.max(type === 'changes' ? 1 : 2, Math.round(hLow / 8));
  let wHigh = Math.max(wLow + 1, Math.round(hHigh / 6));
  if (timeline === 'rush') { wLow = Math.max(1, Math.round(wLow * 0.6)); wHigh = Math.max(wLow + 1, Math.round(wHigh * 0.6)); }

  const split = SPLIT[type];
  const part = (i: number): HourRange => ({ low: Math.max(1, Math.round(hLow * split[i])), high: Math.max(1, Math.round(hHigh * split[i])) });

  const provide = ['brand', 'content'];
  if (a.design === 'ready') provide.unshift('designFiles');
  if (type === 'ecommerce') provide.push('products');
  if (type === 'redesign' || type === 'changes') provide.push('access');
  if (a.multilingual === 'bilingual' || a.multilingual === 'multi') provide.push('translations');

  return {
    kind: 'quote',
    projectType: type,
    hours: { low: hLow, high: hHigh, plus },
    price: { low: pLow, high: pHigh, plus, currency: 'CAD' },
    breakdown: { design: part(0), development: part(1), content: part(2), testing: part(3) },
    weeks: { low: wLow, high: wHigh },
    complexity: complexityFor((hLow + hHigh) / 2),
    provide,
    timeline,
    base: base.ref,
  };
}

/* ---- lead payload for the MAW `process-lead` edge function (same pipeline as the chat) ---- */

export interface LeadInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  locale: Locale;
  answers: Answers;
  result: QuoteResult;
  /** Human-readable answer labels, already localized, for the description. */
  summaryLines: string[];
  sessionId: string;
  source: Record<string, string | undefined>;
  /** "Out of budget → contact me in a month" path. */
  followUp?: boolean;
  feedback?: string;
}

export interface ProcessLeadPayload {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  issue_description: string;
  complexity: Complexity;
  estimated_hours: number;
  estimated_quote: number;
  quoted_range_low: number;
  quoted_range_high: number;
  urgency: string | null;
  is_existing_customer: false;
  feedback: string | null;
  follow_up_requested: boolean;
  follow_up_date: string | null;
  sessionId: string;
  language: Locale;
  source: Record<string, string | undefined>;
}

export function buildLeadPayload(input: LeadInput): ProcessLeadPayload {
  const r = input.result;
  const hoursMid = Math.round((r.hours.low + r.hours.high) / 2);
  const quoteMid = Math.round((r.price.low + r.price.high) / 2);
  const complexity: Complexity = r.kind === 'quote' ? r.complexity : 'complex';
  const urgency = r.kind === 'quote' ? (r.timeline === 'rush' ? 'rush' : r.timeline === 'flexible' ? 'flexible' : 'normal') : null;
  const followUpDate = input.followUp ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() : null;
  const header = `[${input.source.domain ?? 'createawebsite.ca'} · ${input.locale.toUpperCase()}]`;
  const priceLine = r.kind === 'quote'
    ? `Quoted range: $${r.price.low.toLocaleString('en-CA')} - $${r.price.high.toLocaleString('en-CA')}${r.price.plus ? '+' : ''} CAD (${r.hours.low}-${r.hours.high}${r.hours.plus ? '+' : ''} h, ${r.complexity}, base ${r.base})`
    : `Custom solution: discovery phase $${r.price.low} - $${r.price.high} CAD (${r.hours.low}-${r.hours.high} h). No build quote yet.`;
  const description = [header, ...input.summaryLines, priceLine, input.notes ? `Notes: ${input.notes}` : null]
    .filter(Boolean)
    .join('\n');
  return {
    name: input.name,
    email: input.email.trim().toLowerCase(),
    phone: input.phone || null,
    company: input.company || null,
    issue_description: description,
    complexity,
    estimated_hours: hoursMid,
    estimated_quote: quoteMid,
    quoted_range_low: r.price.low,
    quoted_range_high: r.price.high,
    urgency,
    is_existing_customer: false,
    feedback: input.feedback ?? null,
    follow_up_requested: !!input.followUp,
    follow_up_date: followUpDate,
    sessionId: input.sessionId,
    language: input.locale,
    source: input.source,
  };
}

export function newSessionId(): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `caw-${rnd}`;
}
