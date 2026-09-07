/** llms.txt (brief §10.4): what the site is, the headline ranges, the guide URLs and the chat link. Numbers from pricing.ts. */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { chatUrl } from '@maw/lander-kit/lib/chat';
import { absoluteUrl } from '@maw/lander-kit/lib/i18n';
import { renderPricing } from '@maw/lander-kit/lib/pricing';
import { pricing } from '../data/pricing';
import { routes, site } from '../site';

export const GET: APIRoute = async () => {
  const guides = await getCollection('guides');
  const r = (t: string) => renderPricing(t, pricing, 'en');
  const lines = [
    '# createawebsite.ca',
    '',
    '> A static, bilingual (English / French-Canadian) site by Monkeys at Work, a web studio in Quebec. It shows honest price ranges for getting a website built in Canada and links to the Monkeys at Work quote chat, which gives an exact range in about three minutes.',
    '',
    '## Price ranges (CAD)',
    '',
    `- Business websites (WordPress): ${r('{price:websites.basic..websites.custom}')} (${r('{h:websites.basic..websites.custom}')} hours)`,
    `- Online stores, Shopify: ${r('{price:shopify.basic..shopify.custom}')}; WooCommerce: ${r('{price:woocommerce.basic..woocommerce.custom}')}`,
    `- Redesigns: ${r('{price:redesign.refresh..redesign.migration}')}`,
    `- Quick fixes and updates: ${r('{price:fixes.fixes}')} (${r('{h:fixes.fixes}')} hours)`,
    `- Custom apps and integrations: discovery phase ${r('{price:custom.discovery}')}, build quoted after`,
    `- Maintenance plans: ${r('{price:maintenance.light..maintenance.premium}')} a month`,
    `- Hourly rate: ${r('{rate}')}; maintenance rate: ${r('{maintenanceRate}')}`,
    '',
    '## Pages',
    '',
    `- [Home (EN)](${absoluteUrl(site.origin, routes.home.en)})`,
    `- [Accueil (FR)](${absoluteUrl(site.origin, routes.home.fr)})`,
    ...guides.map((g) => `- [${g.data.title}](${absoluteUrl(site.origin, g.data.lang === 'fr' ? `/fr/guides/${g.data.slug}/` : `/guides/${g.data.slug}/`)})`),
    `- [Privacy](${absoluteUrl(site.origin, routes.privacy.en)}) · [Confidentialité](${absoluteUrl(site.origin, routes.privacy.fr)})`,
    '',
    '## Get an exact price range',
    '',
    `- English: ${chatUrl({ lang: 'en', section: 'guide', source: site.domain })}`,
    `- Français: ${chatUrl({ lang: 'fr', section: 'guide', source: site.domain })}`,
    '',
    `## Monkeys at Work`,
    '',
    `- ${site.org.url}`,
    `- Book a call: ${site.bookUrl}`,
    `- ${site.supportEmail}`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
