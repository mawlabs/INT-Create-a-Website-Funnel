// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { routes } from './src/routes';

const site = process.env.PUBLIC_SITE_URL || 'https://createawebsite.ca';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  prefetch: false,
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !/\/(404|thanks|merci)\/?$/.test(new URL(page).pathname.replace(/\/$/, '')),
      // hreflang pairs from the route table: EN and FR slugs differ, so the built-in i18n option can't pair them.
      serialize(item) {
        const path = new URL(item.url).pathname;
        const pair = Object.values(routes).find((r) => r.en === path || r.fr === path);
        if (!pair) return item;
        /** @param {string} p */
        const abs = (p) => new URL(p, site).toString();
        return {
          ...item,
          links: [
            { lang: 'en-CA', url: abs(pair.en) },
            { lang: 'fr-CA', url: abs(pair.fr) },
            { lang: 'x-default', url: abs(pair.en) },
          ],
        };
      },
    }),
  ],
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
