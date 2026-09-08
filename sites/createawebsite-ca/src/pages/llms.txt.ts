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
    '> A static, bilingual (English / French-Canadian) site by Monkeys at Work, a web studio in Quebec. It gives an instant website quote: answer the same questions the studio asks every client (type of site, platform, pages, languages, integrations, timeline) and get a price range with the hours behind it, on the page, in about three minutes. It also checks an existing website for out-of-date software, missing search-engine basics and a missing French version.',
    '',
    '## What the site does',
    '',
    '- **Instant quote**: answer the same questions the studio asks every client (type of site, platform, build approach, pages, languages, integrations, timeline) and get a price range on the spot, with the hours split across design, development, content, and testing and launch. No email needed to see the range.',
    '- **Site check**: enter an existing website address and get a plain-language report on what is out of date or missing — CMS and PHP versions, HTTPS, search-engine basics, whether a French version exists, phone readiness, speed and accessibility signals — with one recommendation.',
    '',
    '## Typical price ranges (CAD)',
    '',
    `- Business websites: ${r('{price:websites.basic..websites.intermediate}')}, fully custom ${r('{price:websites.custom}')}`,
    `- Online stores: from ${r('{min:shopify.basic}')}, ${r('{price:shopify.intermediate}')} for a customized store`,
    `- Redesigns: ${r('{price:redesign.refresh..redesign.migration}')}`,
    `- Fixes and changes: ${r('{price:fixes.fixes}')}`,
    `- Custom apps and integrations: planning phase ${r('{price:custom.discovery}')}, build quoted after`,
    `- Maintenance: ${r('{price:maintenance.light..maintenance.premium}')} a month`,
    `- Hourly rate ${r('{rate}')}; maintenance rate ${r('{maintenanceRate}')}. The exact range comes from the quote tool.`,
    '',
    '## Pages',
    '',
    `- [Home (EN)](${absoluteUrl(site.origin, routes.home.en)})`,
    `- [Accueil (FR)](${absoluteUrl(site.origin, routes.home.fr)})`,
    ...guides.map((g) => `- [${g.data.title}](${absoluteUrl(site.origin, g.data.lang === 'fr' ? `/fr/guides/${g.data.slug}/` : `/guides/${g.data.slug}/`)})`),
    `- [Privacy](${absoluteUrl(site.origin, routes.privacy.en)}) · [Confidentialité](${absoluteUrl(site.origin, routes.privacy.fr)})`,
    '',
    '## Get an instant quote or check a site',
    '',
    `- On the page: ${absoluteUrl(site.origin, routes.home.en)}#quote (EN) · ${absoluteUrl(site.origin, routes.home.fr)}#quote (FR)`,
    '- The same flow in the Monkeys at Work chat:',
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
