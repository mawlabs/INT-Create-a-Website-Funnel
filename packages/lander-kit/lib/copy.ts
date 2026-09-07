/**
 * Prop contracts for the kit components. Sites fill these from src/i18n/{en,fr}.json.
 * Any node may carry `_review: true` (machine-drafted French awaiting Angelique's pass)
 * or `_todo`-prefixed keys (facts only Angelique can confirm). scripts/check-copy.mjs counts both.
 */
import type { Project } from './chat';

export interface Reviewable {
  _review?: boolean;
  [key: `_todo${string}`]: string | undefined;
}

export interface HeaderCopy extends Reviewable {
  logoAlt: string;          // "Monkeys at Work"
  homeLabel: string;        // aria-label for the logo link
  switchLabel: string;      // aria-label on the language nav
  en: string;               // "EN"
  fr: string;               // "FR"
}

export interface FooterCopy extends Reviewable {
  iconAlt: string;
  line: string;
  links: { site: string; portfolio: string; book: string; privacy: string };
}

export interface LangBarCopy extends Reviewable {
  text: string;             // written in the language it offers
  link: string;
  dismiss: string;
}

export interface ConsentCopy extends Reviewable {
  text: string;
  accept: string;
  decline: string;
  privacy: string;
  label: string;            // aria-label for the region
}

export interface ChromeCopy {
  siteName: string;
  skipLink: string;
  header: HeaderCopy;
  footer: FooterCopy;
  consent: ConsentCopy;
}

export interface HeroTile extends Reviewable {
  id: Project;
  label: string;
  reveal: string;           // may contain pricing tokens
}

export interface HeroCopy extends Reviewable {
  h1: string;
  sub: string;
  panelHeading: string;
  tiles: HeroTile[];
  placeholder: string;
  cta: string;
  ctaNote: string;
  caption: string;
}

export interface CompareRow extends Reviewable {
  label: string;
  cells: [string, string, string];
  highlight?: boolean;
}

export interface CompareCopy extends Reviewable {
  h2: string;
  intro: string;
  columns: [string, string, string];
  rows: CompareRow[];
  no: { title: string; items: string[] } & Reviewable;
  yes: { title: string; items: string[] } & Reviewable;
}

export interface PricingTierCopy extends Reviewable {
  name: string;
  includes: string;
}

export interface PricingGroupCopy extends Reviewable {
  title: string;
  priceLabel?: string;      // overrides the "Price" header (e.g. "Price a month")
  tiers: Record<string, PricingTierCopy>;
}

export interface PricingCopy extends Reviewable {
  h2: string;
  intro: string;
  headers: { tier: string; price: string; hours: string; includes: string };
  quotedLater: string;
  groups: Record<string, PricingGroupCopy>;
  line: string;
  cta: string;
  ctaNote: string;
}

export interface StepsCopy extends Reviewable {
  h2: string;
  items: ({ title: string; text: string } & Reviewable)[];
}

export interface CaseStudy {
  client: string;
  job: string;
  result: string;
  url: string;
  image: ImageMetadata;
  imageAlt: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  business: string;
}

export interface WorkCopy extends Reviewable {
  h2: string;
  linkLabel: string;        // "Read the case study"
  quotesHeading: string;
}

export interface FaqItemCopy extends Reviewable {
  q: string;
  a: string;                // may contain pricing tokens and one {guideLink}
}

export interface FaqCopy extends Reviewable {
  h2: string;
  items: FaqItemCopy[];
}

export interface FormCopy extends Reviewable {
  h2: string;
  intro: string;
  name: string;
  email: string;
  message: string;
  consent: string;
  button: string;
  sending: string;
  errors: {
    name: string;
    email: string;
    message: string;
    consent: string;
    tooFast: string;
    network: string;
    notConfigured: string;
  } & Reviewable;
  noscript: string;         // contains {email}
}

export interface PageMetaCopy extends Reviewable {
  title: string;
  description: string;
}
