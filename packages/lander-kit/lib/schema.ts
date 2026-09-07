/**
 * JSON-LD builders (brief §10.3). Facts (names, URLs, social profiles) come from the brief.
 */
import type { Locale } from './i18n';
import { formatMoney } from './i18n';
import type { PricingData } from './pricing';
import { overallPriceRange } from './pricing';

export const ORG_ID = 'https://monkeysat.work/#organization';

export interface OrgInput {
  name: string;
  url: string;
  logo: string;                // absolute URL
  sameAs: string[];
  description?: string;
  address?: {                  // optional: enables LocalBusiness (brief §13 #8)
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
}

export function organization(o: OrgInput): Record<string, unknown> {
  return {
    '@type': o.address ? ['Organization', 'LocalBusiness'] : 'Organization',
    '@id': ORG_ID,
    name: o.name,
    url: o.url,
    logo: o.logo,
    sameAs: o.sameAs,
    ...(o.description ? { description: o.description } : {}),
    ...(o.address ? { address: { '@type': 'PostalAddress', ...o.address } } : {}),
  };
}

export function website(input: { url: string; name: string; description: string; locale: Locale }): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': `${input.url}#website`,
    url: input.url,
    name: input.name,
    description: input.description,
    inLanguage: input.locale === 'fr' ? 'fr-CA' : 'en-CA',
    publisher: { '@id': ORG_ID },
  };
}

export function service(input: {
  name: string;
  description: string;
  url: string;
  pricing: PricingData;
  locale: Locale;
  serviceTypes: string[];
}): Record<string, unknown> {
  const range = overallPriceRange(input.pricing);
  const priceRange = `${formatMoney(range.min, input.locale)}–${formatMoney(range.max, input.locale)}${range.plus ? '+' : ''}`;
  return {
    '@type': 'Service',
    name: input.name,
    description: input.description,
    url: input.url,
    serviceType: input.serviceTypes,
    provider: { '@id': ORG_ID },
    areaServed: [
      { '@type': 'Country', name: 'Canada' },
      { '@type': 'AdministrativeArea', name: 'Quebec' },
    ],
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: input.pricing.currency,
      lowPrice: range.min,
      highPrice: range.max,
      priceRange,
      url: input.url,
    },
  };
}

export interface FaqItem { q: string; a: string; }

export function faqPage(items: FaqItem[]): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  };
}

export function article(input: {
  headline: string;
  description: string;
  url: string;
  image: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
  authorUrl?: string;
  locale: Locale;
  wordCount?: number;
}): Record<string, unknown> {
  return {
    '@type': 'Article',
    '@id': `${input.url}#article`,
    headline: input.headline,
    description: input.description,
    url: input.url,
    mainEntityOfPage: input.url,
    image: input.image,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    inLanguage: input.locale === 'fr' ? 'fr-CA' : 'en-CA',
    author: { '@type': 'Person', name: input.authorName, ...(input.authorUrl ? { url: input.authorUrl } : {}) },
    publisher: { '@id': ORG_ID },
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
  };
}

export function breadcrumbs(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

/** Wrap nodes in one @graph document. */
export function graph(nodes: Record<string, unknown>[]): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
