/**
 * Primary CTA: link into the Monkeys at Work quote chat (brief §7.1).
 * No JavaScript is needed for the link itself; the hero island only rewrites the `project` value.
 */
import type { Locale } from './i18n';

export const CHAT_ORIGIN = 'https://monkeysat.work/';
export const PROJECTS = ['business', 'ecommerce', 'redesign', 'changes', 'custom'] as const;
export type Project = (typeof PROJECTS)[number];
export type CtaSection = 'hero' | 'audit' | 'guide';

export interface ChatLinkOptions {
  project?: Project | null;
  lang: Locale;
  section: CtaSection;
  /** utm_source; defaults to the lander's domain. */
  source?: string;
}

export function chatUrl({ project, lang, section, source = 'createawebsite.ca' }: ChatLinkOptions): string {
  const url = new URL(CHAT_ORIGIN);
  url.searchParams.set('chat', 'open');
  if (project) url.searchParams.set('project', project);
  url.searchParams.set('lang', lang);
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', 'funnel');
  url.searchParams.set('utm_campaign', `lander-${lang}`);
  url.searchParams.set('utm_content', section);
  return url.toString();
}

export function isProject(v: unknown): v is Project {
  return typeof v === 'string' && (PROJECTS as readonly string[]).includes(v);
}
