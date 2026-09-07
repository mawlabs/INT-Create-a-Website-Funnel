/**
 * Meta, canonical and hreflang helpers (brief §10.2).
 */
import { absoluteUrl, LANG_TAG, type Locale } from './i18n';

export interface PageMeta {
  title: string;
  description: string;
  /** Path of this page, e.g. "/fr/" */
  path: string;
  locale: Locale;
  /** Paths of the same page in each locale; used for hreflang + the language switch. */
  alternates: Record<Locale, string>;
  /** Absolute or root-relative OG image; defaults to /og-{locale}.png */
  ogImage?: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
}

export interface HreflangLink {
  hreflang: string;
  href: string;
}

export function hreflangLinks(origin: string, alternates: Record<Locale, string>): HreflangLink[] {
  const links: HreflangLink[] = (Object.keys(alternates) as Locale[]).map((l) => ({
    hreflang: LANG_TAG[l],
    href: absoluteUrl(origin, alternates[l]),
  }));
  links.push({ hreflang: 'x-default', href: absoluteUrl(origin, alternates.en) });
  return links;
}

export function canonicalUrl(origin: string, path: string): string {
  return absoluteUrl(origin, path);
}
