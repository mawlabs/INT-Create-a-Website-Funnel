/**
 * Prop contracts for the kit components. Sites fill these from src/i18n/{en,fr}.json.
 * Any node may carry `_review: true` (machine-drafted French awaiting Angelique's pass)
 * or `_todo`-prefixed keys (facts only Angelique can confirm). scripts/check-copy.mjs counts both.
 */
export interface Reviewable {
  _review?: boolean;
  [key: `_todo${string}`]: string | undefined;
}

export interface HeaderCopy extends Reviewable {
  logoAlt: string;
  homeLabel: string;
  switchLabel: string;
  en: string;
  fr: string;
  nav: { label: string; quote: string; audit: string; guide: string };
  book: string;
}

export interface FooterCopy extends Reviewable {
  iconAlt: string;
  line: string;              // contains {maw} where the parent link goes
  mawName: string;
  links: { guide: string; privacy: string; book: string; email: string };
}

export interface LangBarCopy extends Reviewable { text: string; link: string; dismiss: string; }

export interface ConsentCopy extends Reviewable { text: string; accept: string; decline: string; privacy: string; label: string; }

export interface ChromeCopy {
  siteName: string;
  skipLink: string;
  header: HeaderCopy;
  footer: FooterCopy;
  consent: ConsentCopy;
}

export interface LeaderCopy extends Reviewable { label: string; value: string; }

export interface HeroCopy extends Reviewable {
  pill: string;
  h1: string;                 // ends with a period rendered as the brand dot
  sub: string;
  lines: LeaderCopy[];
}

export interface StepCopy extends Reviewable {
  q: string;
  hint?: string;
  options: Record<string, string>;
  /** Optional plain-language line under an option, for terms a shop owner may not know. */
  desc?: Record<string, string>;
}

export interface QuoteCopy extends Reviewable {
  sticker: string;
  panelLabel: string;
  progress: string;           // "Question {n} of {total}"
  back: string;
  continue: string;
  startOver: string;
  multiHint: string;
  steps: Record<string, StepCopy>;
  result: {
    heading: string;
    priceLabel: string;
    hoursLabel: string;
    hoursUnit: string;         // "h"
    breakdown: { design: string; development: string; content: string; contentShop: string; testing: string };
    timelineLabel: string;
    weeks: string;             // "{low}–{high} weeks"
    rushNote: string;
    designNote: string;
    provideHeading: string;
    provide: Record<string, string>;
    guarantee: string;
    taxes: string;
    discovery: { heading: string; text: string; cta: string; or: string; send: string };
    actions: { accept: string; book: string; budget: string; chat: string };
  } & Reviewable;
  intake: {
    heading: string;
    intro: string;
    followUpHeading: string;
    followUpIntro: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    notes: string;
    consent: string;
    button: string;
    followUpButton: string;
    sending: string;
    errors: { name: string; email: string; consent: string; tooFast: string; network: string; notConfigured: string } & Reviewable;
  } & Reviewable;
  budget: { heading: string; text: string; book: string; later: string; back: string } & Reviewable;
  nojs: { text: string; link: string } & Reviewable;
  summary: { heading: string; edit: string } & Reviewable;
}

export interface AuditFindingCopy {
  title: string;
  detail: string;
  /** One sentence: what to actually do about it. Absent on findings that report something already in order. */
  fix?: string;
  /** Used when the count is 1. */
  titleOne?: string;
}

/** A plain-language section of the report: what it covers, and why a reader should care. */
export interface AuditAreaCopy { label: string; blurb: string }

export interface AuditCopy extends Reviewable {
  h2: string;
  intro: string;
  label: string;
  placeholder: string;
  button: string;
  checking: string;
  again: string;
  disclaimer: string;
  truncated: string;
  nojs: string;                       // contains {email}
  result: {
    heading: string;                  // contains {host}
    scoreLabel: string;
    scoreOutOf: string;
    platformLabel: string;
    phpLabel: string;
    unknownPlatform: string;
    groups: Record<'critical' | 'warning' | 'info' | 'good', string>;
    counts: Record<'critical' | 'warning' | 'info' | 'good', string>;
    empty: string;
    areasHeading: string;
    areaStatus: Record<'act' | 'watch' | 'ok', string>;
    fixLabel: string;
    evidenceLabel: string;
  } & Reviewable;
  report: { helpHeading: string; moreLine: string; nothingUrgent: string; download: string } & Reviewable;
  email: {
    heading: string; intro: string; label: string; consent: string; consentHint: string; purpose: string;
    button: string; sending: string; back: string;
    errors: { email: string; tooFast: string; network: string; notConfigured: string } & Reviewable;
  } & Reviewable;
  sent: {
    heading: string; text: string; followUp: string; noFollowUp: string; downloadAgain: string;
    bookHeading: string; bookText: string; book: string; quote: string;
  } & Reviewable;
  /** The downloadable report is a standalone document, so it carries its own strings. */
  file: {
    title: string; generated: string; intro: string; recHeading: string; footer: string; print: string;
    contents: string; checks: string; areaAllClear: string;
  } & Reviewable;
  /** Keyed by Area from lib/audit. */
  areas: Record<string, AuditAreaCopy>;
  recommendation: Record<string, { title: string; text: string; cta: string }>;
  errors: Record<string, string>;
  findings: Record<string, AuditFindingCopy>;
}

export interface StepsCopy extends Reviewable {
  h2: string;
  items: ({ title: string; text: string } & Reviewable)[];
}

export interface CaseStudy { client: string; job: string; result: string; url: string; image: ImageMetadata; imageAlt: string; }
export interface Testimonial { quote: string; name: string; business: string; }

export interface WorkCopy extends Reviewable { h2: string; aside: string; linkLabel: string; quotesHeading: string; }

export interface FaqItemCopy extends Reviewable { q: string; a: string; }
export interface FaqCopy extends Reviewable { h2: string; items: FaqItemCopy[]; }

export interface FormCopy extends Reviewable {
  h2: string;
  intro: string;
  name: string;
  email: string;
  message: string;
  consent: string;
  button: string;
  sending: string;
  note: string;
  errors: { name: string; email: string; message: string; consent: string; tooFast: string; network: string; notConfigured: string } & Reviewable;
  noscript: string;
}

export interface PageMetaCopy extends Reviewable { title: string; description: string; }
