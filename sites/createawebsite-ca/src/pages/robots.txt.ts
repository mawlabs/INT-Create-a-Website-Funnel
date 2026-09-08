/** robots.txt (brief §10.4). A staging or demo build (PUBLIC_NOINDEX=1) disallows everything instead. */
import type { APIRoute } from 'astro';
import { absoluteUrl } from '@maw/lander-kit/lib/i18n';
import { site } from '../site';

export const GET: APIRoute = () => {
  const body = site.noindex
    ? ['# Staging build — not for indexing.', 'User-agent: *', 'Disallow: /', ''].join('\n')
    : ['User-agent: *', 'Allow: /', '', `Sitemap: ${absoluteUrl(site.origin, '/sitemap-index.xml')}`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
