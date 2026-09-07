/**
 * Pricing types and formatting. The numbers themselves live in each site's src/data/pricing.ts —
 * the single source of truth rendered into the hero reveal, the tables, the guide and JSON-LD.
 */
import { formatInt, formatMoney, type Locale, NNBSP } from './i18n';

/** [min, max] with an optional "and up" flag (rendered as "+" / "et plus"). */
export interface Range {
  min: number;
  max: number;
  plus?: boolean;
}

export interface Tier {
  id: string;
  price: Range | null;   // null when quoted later (custom build after discovery)
  hours: Range | null;
}

export interface PricingGroup {
  id: string;
  tiers: Tier[];
}

export interface PricingData {
  currency: 'CAD';
  hourlyRate: number;
  maintenanceRate: number;
  groups: PricingGroup[];
}

const DASH = '–'; // en dash

/** "$2,500–$6,000+" / "2 500 $ à 6 000 $ et plus" */
export function formatPriceRange(r: Range, locale: Locale): string {
  const a = formatMoney(r.min, locale);
  const b = formatMoney(r.max, locale);
  if (locale === 'fr') return `${a} à ${b}${r.plus ? ' et plus' : ''}`;
  return `${a}${DASH}${b}${r.plus ? '+' : ''}`;
}

/** "30–70" / "30 à 70" (unit supplied by the copy) */
export function formatHoursBare(r: Range, locale: Locale): string {
  const a = formatInt(r.min, locale);
  const b = formatInt(r.max, locale);
  const plus = r.plus ? '+' : '';
  return locale === 'fr' ? `${a} à ${b}${plus}` : `${a}${DASH}${b}${plus}`;
}

/** "30–70 h" / "30 à 70 h" */
export function formatHoursRange(r: Range, locale: Locale): string {
  const a = formatInt(r.min, locale);
  const b = formatInt(r.max, locale);
  const plus = r.plus ? '+' : '';
  return locale === 'fr' ? `${a} à ${b}${plus}${NNBSP}h` : `${a}${DASH}${b}${plus} h`;
}

/** Look up a tier as "group.tier". Throws at build time on a typo, so numbers never silently vanish. */
export function findTier(data: PricingData, ref: string): Tier {
  const [g, t] = ref.split('.');
  const group = data.groups.find((x) => x.id === g);
  const tier = group?.tiers.find((x) => x.id === t);
  if (!tier) throw new Error(`pricing: unknown tier reference "${ref}"`);
  return tier;
}

function spanning(data: PricingData, a: string, b: string, key: 'price' | 'hours'): Range {
  const ra = findTier(data, a)[key];
  const rb = findTier(data, b)[key];
  if (!ra || !rb) throw new Error(`pricing: tier "${a}" or "${b}" has no ${key}`);
  return { min: ra.min, max: rb.max, plus: rb.plus };
}

/**
 * Resolve pricing tokens inside copy so the JSON never repeats a number:
 *   {price:websites.basic}            → $2,500–$3,500
 *   {hours:websites.basic}            → 30–40 h
 *   {h:websites.basic}                → 30–40   (no unit, for "(30–40 hours)" in copy)
 *   {min:websites.basic}              → $2,500
 *   {max:websites.intermediate}       → $6,000
 *   {price:websites.basic..websites.intermediate}  → $2,500–$6,000 (min of first, max of second)
 *   {hours:websites.basic..websites.intermediate}  → 30–70 h
 *   {rate}                            → $85
 *   {maintenanceRate}                 → $75
 */
export function renderPricing(template: string, data: PricingData, locale: Locale): string {
  return template.replace(/\{(price|hours|h|min|max|rate|maintenanceRate)(?::([a-z0-9_.]+))?\}/g, (m, kind: string, ref?: string) => {
    if (kind === 'rate') return formatMoney(data.hourlyRate, locale);
    if (kind === 'maintenanceRate') return formatMoney(data.maintenanceRate, locale);
    if (!ref) return m; // a plain {price} / {hours} is a runtime placeholder, not a pricing token
    const key = kind === 'hours' || kind === 'h' ? 'hours' : 'price';
    let range: Range | null;
    if (ref.includes('..')) {
      const [a, b] = ref.split('..');
      range = spanning(data, a, b, key);
    } else {
      range = findTier(data, ref)[key];
    }
    if (!range) throw new Error(`pricing: tier "${ref}" has no ${key}`);
    if (kind === 'min') return formatMoney(range.min, locale);
    if (kind === 'max') return formatMoney(range.max, locale);
    if (kind === 'h') return formatHoursBare(range, locale);
    return key === 'hours' ? formatHoursRange(range, locale) : formatPriceRange(range, locale);
  });
}

/** Lowest and highest published project price, for schema.org priceRange. */
export function overallPriceRange(data: PricingData): Range {
  let min = Infinity;
  let max = 0;
  let plus = false;
  for (const g of data.groups) {
    if (g.id === 'maintenance') continue;
    for (const t of g.tiers) {
      if (!t.price) continue;
      min = Math.min(min, t.price.min);
      if (t.price.max >= max) { max = t.price.max; plus = !!t.price.plus; }
    }
  }
  return { min, max, plus };
}
