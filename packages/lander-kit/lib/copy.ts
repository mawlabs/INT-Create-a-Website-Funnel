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
  nav: { prices: string; how: string; guide: string };
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

export interface BoardGroupCopy extends Reviewable {
  title: string;
  tiers: Record<string, string>;
  suffix?: string;            // e.g. "a month"
}

export interface BoardCopy extends Reviewable {
  label: string;
  h2: string;
  intro: string;
  stamp: string;
  groups: Record<string, BoardGroupCopy>;
  quotedLater: string;
  line: string;
  cta: string;
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
  badge: string;
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
