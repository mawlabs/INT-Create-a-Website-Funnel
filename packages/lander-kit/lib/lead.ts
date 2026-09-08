/**
 * Sends a quote lead into the Monkeys at Work pipeline: the same `process-lead` edge function the chat uses,
 * so the lead lands in Supabase, HubSpot and ClickUp with the quote attached (brief §7.1 attribution via `source`).
 * Browser-side. Zero calls before the visitor submits the intake form.
 */
import type { AuditReport } from './audit';
import { summarize } from './audit';
import { buildSubmission, hubspotEndpoint, readHutk, submitLead, type LeadSubmission } from './hubspot';
import type { Locale } from './i18n';
import type { ProcessLeadPayload } from './quote';

export interface LeadResult { ok: boolean; status: number; error?: string; leadId?: string; }

/**
 * A site-check lead is a contact with a report attached, not a quoted project, so it goes through the HubSpot
 * form rather than the chat's `process-lead` pipeline — nothing invents an estimate that would then sort above
 * real quotes in the lead list.
 */
export function buildAuditSubmission(input: {
  email: string;
  report: AuditReport;
  followUp: boolean;
  locale: Locale;
  consentText: string;
  followUpLabel: string;
  noFollowUpLabel: string;
  pageName: string;
}): LeadSubmission {
  const host = (() => { try { return new URL(input.report.finalUrl).host; } catch { return input.report.finalUrl; } })();
  const message = [
    `Site check requested from createawebsite.ca (${input.locale.toUpperCase()}).`,
    input.followUp ? input.followUpLabel : input.noFollowUpLabel,
    '',
    ...summarize(input.report),
  ].join('\n');
  return buildSubmission(
    { email: input.email.trim().toLowerCase(), firstname: host, message },
    {
      pageUri: window.location.href,
      pageName: input.pageName,
      ...(readHutk() ? { hutk: readHutk() } : {}),
    },
    input.consentText,
  );
}

export { hubspotEndpoint, submitLead };

export async function sendLead(endpoint: string, payload: ProcessLeadPayload): Promise<LeadResult> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let data: { error?: string; lead?: { id?: string } } = {};
    try { data = (await res.json()) as typeof data; } catch { /* no body */ }
    if (res.ok) return { ok: true, status: res.status, leadId: data.lead?.id };
    return { ok: false, status: res.status, error: data.error };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'network' };
  }
}
