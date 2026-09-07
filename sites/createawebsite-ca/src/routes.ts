/**
 * Route table (brief §4). Pure data so astro.config.mjs (sitemap hreflang links) and src/site.ts share it.
 * Guide slugs must match the `slug` frontmatter of the content entries; GuidePage asserts this at build time.
 */
export const routes = {
  home: { en: '/', fr: '/fr/' },
  guide: { en: '/guides/how-much-does-a-website-cost-canada/', fr: '/fr/guides/combien-coute-un-site-web-quebec/' },
  privacy: { en: '/privacy/', fr: '/fr/confidentialite/' },
  thanks: { en: '/thanks/', fr: '/fr/merci/' },
  notFound: { en: '/404/', fr: '/fr/404/' },
} as const;

export type RouteKey = keyof typeof routes;
