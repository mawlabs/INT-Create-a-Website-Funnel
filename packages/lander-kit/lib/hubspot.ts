/**
 * HubSpot Forms API without the HubSpot script (brief §7.2). Runs in the browser inside the LeadForm island.
 */
export interface HubSpotFormConfig {
  portalId: string;
  formGuid: string;
}

export function hubspotEndpoint({ portalId, formGuid }: HubSpotFormConfig): string {
  return `https://api.hsforms.com/submissions/v3/integration/submit/${encodeURIComponent(portalId)}/${encodeURIComponent(formGuid)}`;
}

export interface LeadFields {
  email: string;
  firstname: string;
  message: string;
}

export interface LeadContext {
  pageUri: string;
  pageName: string;
  /** HubSpot tracking cookie, only when present (only after consent; we never set it ourselves). */
  hutk?: string;
}

export interface LeadSubmission {
  fields: { objectTypeId: '0-1'; name: string; value: string }[];
  context: LeadContext;
  legalConsentOptions: {
    consent: {
      consentToProcess: boolean;
      text: string;
    };
  };
}

export function buildSubmission(fields: LeadFields, context: LeadContext, consentText: string): LeadSubmission {
  return {
    fields: [
      { objectTypeId: '0-1', name: 'email', value: fields.email },
      { objectTypeId: '0-1', name: 'firstname', value: fields.firstname },
      { objectTypeId: '0-1', name: 'message', value: fields.message },
    ],
    context,
    legalConsentOptions: {
      consent: { consentToProcess: true, text: consentText },
    },
  };
}

/** Read the HubSpot tracking cookie if it exists. We never create it. */
export function readHutk(): string | undefined {
  const m = document.cookie.match(/(?:^|;\s*)hubspotutk=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

export async function submitLead(endpoint: string, body: LeadSubmission): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true, status: res.status };
    let error = '';
    try {
      const data = (await res.json()) as { message?: string; errors?: { message?: string }[] };
      error = data.message ?? data.errors?.map((e) => e.message).join('; ') ?? '';
    } catch {
      /* no body */
    }
    return { ok: false, status: res.status, error };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'network' };
  }
}
