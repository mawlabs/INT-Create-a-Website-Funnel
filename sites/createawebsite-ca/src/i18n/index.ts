/**
 * Every UI string, meta title/description, FAQ and form copy lives in en.json / fr.json (brief §3).
 * FR nodes carry `_review: true` until Angelique's pass; `_todo*` keys hold facts only she can confirm.
 */
import type {
  ChromeCopy, CompareCopy, ConsentCopy, FaqCopy, FooterCopy, FormCopy, HeaderCopy, HeroCopy,
  LangBarCopy, PageMetaCopy, PricingCopy, Reviewable, StepsCopy, WorkCopy,
} from '@maw/lander-kit/lib/copy';
import type { Locale } from '@maw/lander-kit/lib/i18n';
import en from './en.json';
import fr from './fr.json';

export interface SiteCopy {
  siteName: string;
  skipLink: string;
  header: HeaderCopy;
  footer: FooterCopy;
  langBar: LangBarCopy;
  consent: ConsentCopy;
  meta: {
    home: PageMetaCopy;
    privacy: PageMetaCopy;
    thanks: PageMetaCopy;
    notFound: PageMetaCopy;
  };
  home: {
    hero: HeroCopy;
    compare: CompareCopy;
    pricing: PricingCopy;
    steps: StepsCopy;
    work: WorkCopy;
    faq: FaqCopy;
    form: FormCopy;
  };
  guide: {
    breadcrumbHome: string;
    breadcrumbGuides: string;
    byline: string;         // "{author} · Updated {date}"
    cta: string;
    ctaNote: string;
    faqH2: string;
    backHome: string;
  } & Reviewable;
  thanks: { h1: string; text: string; back: string } & Reviewable;
  notFound: { h1: string; text: string; home: string; guide: string } & Reviewable;
  privacy: {
    h1: string;
    intro: string;
    updated: string;
    sections: ({ h2: string; paragraphs: string[] } & Reviewable)[];
    reset: string;          // button: change your analytics choice
    resetDone: string;
  } & Reviewable;
  schema: {
    siteName: string;
    orgDescription: string;
    serviceName: string;
    serviceDescription: string;
    serviceTypes: string[];
  } & Reviewable;
}

/**
 * Bilingual by law (CLAUDE.md #2): every key path in en.json must exist in fr.json and vice versa.
 * Runs at build time; a missing string in either language fails the build. `_review` / `_todo*` keys are exempt.
 */
function keyPaths(node: unknown, prefix = '', out: string[] = []): string[] {
  if (Array.isArray(node)) {
    // arrays may differ in length only when they hold plain strings (list items); objects are compared per index
    if (node.every((n) => typeof n === 'string')) out.push(`${prefix}[]`);
    else node.forEach((n, i) => keyPaths(n, `${prefix}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('_')) continue;
      keyPaths(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    out.push(prefix);
  }
  return out;
}

function assertParity(a: unknown, b: unknown, aName: string, bName: string): void {
  const pa = new Set(keyPaths(a));
  const pb = new Set(keyPaths(b));
  const missingInB = [...pa].filter((k) => !pb.has(k));
  const missingInA = [...pb].filter((k) => !pa.has(k));
  if (missingInA.length || missingInB.length) {
    throw new Error(
      `i18n: copy files differ.\n  missing in ${bName}: ${missingInB.join(', ') || '—'}\n  missing in ${aName}: ${missingInA.join(', ') || '—'}`,
    );
  }
}
assertParity(en, fr, 'en.json', 'fr.json');

export const copy: Record<Locale, SiteCopy> = {
  en: en as unknown as SiteCopy,
  fr: fr as unknown as SiteCopy,
};

export function chrome(locale: Locale): ChromeCopy {
  const c = copy[locale];
  return { siteName: c.siteName, skipLink: c.skipLink, header: c.header, footer: c.footer, consent: c.consent };
}

/** Human date per locale: "7 September 2026" / "7 septembre 2026" (brief §9.2). */
export function formatDate(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
