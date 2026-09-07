import type { Locale } from '@maw/lander-kit/lib/i18n';
import type { CollectionEntry } from 'astro:content';

/** Paths of both language versions of a guide, from the shared pairKey (brief §3). */
export function guidePaths(all: CollectionEntry<'guides'>[], pairKey: string): Record<Locale, string> {
  const pair = all.filter((g) => g.data.pairKey === pairKey);
  const en = pair.find((g) => g.data.lang === 'en');
  const fr = pair.find((g) => g.data.lang === 'fr');
  if (!en || !fr) throw new Error(`guide pair "${pairKey}" must exist in both EN and FR (bilingual by law)`);
  return { en: `/guides/${en.data.slug}/`, fr: `/fr/guides/${fr.data.slug}/` };
}
