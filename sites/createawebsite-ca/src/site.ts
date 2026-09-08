/** Site-level configuration: public identifiers from .env (brief §3) and fixed facts from the brief. */
export const site = {
  name: 'createawebsite.ca',
  domain: 'createawebsite.ca',
  origin: (import.meta.env.PUBLIC_SITE_URL as string | undefined) || 'https://createawebsite.ca',
  ga4Id: (import.meta.env.PUBLIC_GA4_ID as string | undefined) ?? '',          // TODO(angelique): GA4 measurement ID (brief §13 #3)
  gscVerification: (import.meta.env.PUBLIC_GSC_VERIFICATION as string | undefined) ?? '', // TODO(angelique): Search Console access (brief §13 #3)
  hubspot: {
    portalId: (import.meta.env.PUBLIC_HUBSPOT_PORTAL_ID as string | undefined) ?? '',   // TODO(angelique): portal ID (brief §13 #2)
    formEn: (import.meta.env.PUBLIC_HUBSPOT_FORM_EN as string | undefined) ?? '',       // TODO(angelique): EN form GUID (brief §13 #2)
    formFr: (import.meta.env.PUBLIC_HUBSPOT_FORM_FR as string | undefined) ?? '',       // TODO(angelique): FR form GUID (brief §13 #2)
  },
  supportEmail: 'support@monkeysat.work',
  /**
   * Quote leads go to the MAW `process-lead` edge function (same pipeline as the chat: Supabase → HubSpot → ClickUp).
   * TODO(angelique): confirm the function URL and CORS with Karim or Hamza before launch; the host below is the
   * project host documented for the ClickUp webhook (MAW360 documentation §17.4).
   */
  leadEndpoint: (import.meta.env.PUBLIC_MAW_LEAD_ENDPOINT as string | undefined) || 'https://jkuhsxbylrrtdcbkmtec.supabase.co/functions/v1/process-lead',
  /** The site's own fetch endpoint for the audit tool (public/api/audit.php, deployed with the static files). */
  auditEndpoint: (import.meta.env.PUBLIC_AUDIT_ENDPOINT as string | undefined) || '/api/audit.php',
  termsUrl: 'https://monkeysat.work/terms', // TODO(angelique): confirm the public URL of the MAW terms & conditions
  bookUrl: 'https://meetings.hubspot.com/ange1',
  org: {
    name: 'Monkeys at Work',
    url: 'https://monkeysat.work/',
    sameAs: [
      'https://www.instagram.com/monkeysat.work/',
      'https://www.facebook.com/themonkeysatwork',
      'https://www.linkedin.com/in/angeliqueroussos/',
    ],
    author: 'Angelique Roussos',
    // TODO(angelique): business address enables LocalBusiness schema (brief §13 #8)
    address: undefined as undefined,
  },
} as const;

export { routes, type RouteKey } from './routes';
