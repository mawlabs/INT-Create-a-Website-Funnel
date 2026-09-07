/**
 * Locale helpers. Copy never lives in the kit: sites pass strings in via props.
 */
export type Locale = 'en' | 'fr';

export const LOCALES: readonly Locale[] = ['en', 'fr'] as const;
export const DEFAULT_LOCALE: Locale = 'en';

/** BCP 47 tag for <html lang> and hreflang. */
export const LANG_TAG: Record<Locale, string> = { en: 'en-CA', fr: 'fr-CA' };
/** Open Graph locale. */
export const OG_LOCALE: Record<Locale, string> = { en: 'en_CA', fr: 'fr_CA' };

export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'fr' : 'en';
}

/** Ensure a path starts with "/" and, unless it names a file, ends with "/" (site uses directory URLs). */
export function normalizePath(path: string): string {
  let p = path.startsWith('/') ? path : `/${path}`;
  const last = p.slice(p.lastIndexOf('/') + 1);
  if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(last)) p = `${p}/`;
  return p;
}

/** Absolute URL for a path, given the site origin. */
export function absoluteUrl(origin: string, path: string): string {
  return new URL(normalizePath(path), origin).toString();
}

/** Narrow no-break space, used in French numbers and before "$" (brief §9.2). */
export const NNBSP = ' ';

/** Format an integer with locale thousands separator: 2,500 / 2 500. */
export function formatInt(n: number, locale: Locale): string {
  const digits = Math.round(n).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'fr' ? NNBSP : ',');
  return grouped;
}

/** Money in CAD: $2,500 / 2 500 $. */
export function formatMoney(n: number, locale: Locale): string {
  return locale === 'fr' ? `${formatInt(n, 'fr')}${NNBSP}$` : `$${formatInt(n, 'en')}`;
}

/** Generic interpolation: "Hello {name}" with a map of values. Unknown keys are left as-is. */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z0-9_.:-]+)\}/g, (m, key: string) =>
    key in values ? String(values[key]) : m,
  );
}
