/** Per-page helpers: PageMeta from the route table, and the JSON-LD graph shared by every page. */
import type { Locale } from '@maw/lander-kit/lib/i18n';
import { absoluteUrl } from '@maw/lander-kit/lib/i18n';
import type { PageMeta } from '@maw/lander-kit/lib/seo';
import * as schema from '@maw/lander-kit/lib/schema';
import { pricing } from '../data/pricing';
import { copy } from '../i18n';
import { routes, site, type RouteKey } from '../site';

export function pageMeta(
  key: RouteKey,
  locale: Locale,
  m: { title: string; description: string },
  extra: Partial<PageMeta> = {},
): PageMeta {
  return {
    title: m.title,
    description: m.description,
    path: routes[key][locale],
    locale,
    alternates: { en: routes[key].en, fr: routes[key].fr },
    ...extra,
  };
}

/** Meta for a guide, whose paths come from the content entries rather than the route table. */
export function guideMeta(locale: Locale, m: { title: string; description: string }, paths: Record<Locale, string>): PageMeta {
  return { title: m.title, description: m.description, path: paths[locale], locale, alternates: paths, ogType: 'article' };
}

export const layoutProps = (locale: Locale) => ({
  locale,
  chrome: {
    siteName: copy[locale].siteName,
    skipLink: copy[locale].skipLink,
    header: copy[locale].header,
    footer: copy[locale].footer,
    consent: copy[locale].consent,
  },
  langBar: copy[locale === 'en' ? 'fr' : 'en'].langBar,
  site: { origin: site.origin, ga4Id: site.ga4Id, gscVerification: site.gscVerification },
  paths: { home: routes.home[locale], privacy: routes.privacy[locale] },
});

export function baseNodes(locale: Locale): Record<string, unknown>[] {
  const s = copy[locale].schema;
  return [
    schema.organization({
      name: site.org.name,
      url: site.org.url,
      logo: absoluteUrl(site.origin, '/apple-touch-icon.png'),
      sameAs: [...site.org.sameAs],
      description: s.orgDescription,
      address: site.org.address,
    }),
    schema.website({ url: site.origin.replace(/\/?$/, '/'), name: s.siteName, description: copy[locale].meta.home.description, locale }),
    schema.service({
      name: s.serviceName,
      description: s.serviceDescription,
      url: absoluteUrl(site.origin, routes.home[locale]),
      pricing,
      locale,
      serviceTypes: [...s.serviceTypes],
    }),
  ];
}
