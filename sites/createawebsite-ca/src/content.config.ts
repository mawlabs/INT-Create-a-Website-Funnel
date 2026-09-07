import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Guides: one document per language, linked by `pairKey` for hreflang (brief §3).
 * FR guides are written for Quebec, not translated; they carry `review: true` until Angelique's pass.
 */
const guides = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lang: z.enum(['en', 'fr']),
    pairKey: z.string(),
    slug: z.string(),
    datePublished: z.coerce.date(),
    dateModified: z.coerce.date(),
    author: z.string().default('Angelique Roussos'),
    review: z.boolean().default(false),
  }),
});

export const collections = { guides };
