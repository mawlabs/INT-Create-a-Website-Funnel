/**
 * Single source of truth for every number on the site (brief §5.2, §5.4). Rendered into the hero reveal,
 * the pricing tables, the compare table, the FAQ, the guide, llms.txt and the Service JSON-LD.
 * Prices in Canadian dollars. Change numbers here and nowhere else.
 */
import type { PricingData } from '@maw/lander-kit/lib/pricing';

export const pricing: PricingData = {
  currency: 'CAD',
  hourlyRate: 85,         // TODO(angelique): confirm publishing the hourly rate (brief §5.4)
  maintenanceRate: 75,
  groups: [
    {
      id: 'websites', // WordPress with ACF or Elementor
      tiers: [
        { id: 'basic', price: { min: 2500, max: 3500 }, hours: { min: 30, max: 40 } },
        { id: 'intermediate', price: { min: 4000, max: 6000 }, hours: { min: 45, max: 70 } },
        { id: 'custom', price: { min: 6000, max: 10000, plus: true }, hours: { min: 70, max: 120, plus: true } },
      ],
    },
    {
      id: 'landing', // TODO(angelique): landing-page base hours are not in the chat framework; derived from "Simple/Basic 20–40 h"
      tiers: [
        { id: 'builder', price: { min: 1700, max: 2550 }, hours: { min: 20, max: 30 } },
        { id: 'customTheme', price: { min: 2550, max: 3825 }, hours: { min: 30, max: 45 } },
        { id: 'custom', price: { min: 3825, max: 5950 }, hours: { min: 45, max: 70 } },
      ],
    },
    {
      id: 'shopify',
      tiers: [
        { id: 'basic', price: { min: 2500, max: 4000 }, hours: { min: 30, max: 50 } },
        { id: 'intermediate', price: { min: 4500, max: 8000 }, hours: { min: 55, max: 95 } },
        { id: 'custom', price: { min: 8000, max: 15000, plus: true }, hours: { min: 95, max: 180, plus: true } },
      ],
    },
    {
      id: 'woocommerce',
      tiers: [
        { id: 'basic', price: { min: 3000, max: 4500 }, hours: { min: 35, max: 55 } },
        { id: 'intermediate', price: { min: 5000, max: 8000 }, hours: { min: 60, max: 95 } },
        { id: 'custom', price: { min: 8000, max: 18000, plus: true }, hours: { min: 95, max: 210, plus: true } },
      ],
    },
    {
      id: 'redesign',
      tiers: [
        { id: 'refresh', price: { min: 3500, max: 5000 }, hours: { min: 40, max: 60 } },
        { id: 'full', price: { min: 5500, max: 8500 }, hours: { min: 65, max: 100 } },
        { id: 'migration', price: { min: 7000, max: 12000, plus: true }, hours: { min: 80, max: 140, plus: true } },
      ],
    },
    {
      id: 'custom', // apps, plugins, dashboards
      tiers: [
        { id: 'discovery', price: { min: 375, max: 750 }, hours: { min: 5, max: 10 } },
        { id: 'build', price: null, hours: null }, // quoted after discovery
      ],
    },
    {
      id: 'fixes',
      tiers: [{ id: 'fixes', price: { min: 85, max: 680 }, hours: { min: 1, max: 8 } }],
    },
    {
      id: 'maintenance', // per month, at the maintenance rate
      tiers: [
        { id: 'light', price: { min: 750, max: 1350 }, hours: { min: 10, max: 18 } },
        { id: 'standard', price: { min: 1350, max: 2250 }, hours: { min: 18, max: 30 } },
        { id: 'premium', price: { min: 2250, max: 3750, plus: true }, hours: { min: 30, max: 50, plus: true } },
      ],
    },
  ],
};
