/**
 * "Work we've shipped" (brief §5.6). Empty until Angelique picks them — the section is not rendered while empty.
 * TODO(angelique): pick the three case studies (which, images, one-line results) — do not fabricate (brief §13 #5).
 * TODO(angelique): two testimonials, text and permission (brief §13 #5).
 *
 * Shape, per locale:
 *   import photo from '../assets/work/client.jpg';
 *   caseStudies.en.push({ client: 'Client', job: 'One sentence on the job.', result: 'One on the result.',
 *     url: 'https://monkeysat.work/portfolio/client', image: photo, imageAlt: 'Alt text' });
 */
import type { CaseStudy, Testimonial } from '@maw/lander-kit/lib/copy';
import type { Locale } from '@maw/lander-kit/lib/i18n';

export const caseStudies: Record<Locale, CaseStudy[]> = { en: [], fr: [] };
export const testimonials: Record<Locale, Testimonial[]> = { en: [], fr: [] };
