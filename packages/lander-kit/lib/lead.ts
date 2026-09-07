/**
 * Sends a quote lead into the Monkeys at Work pipeline: the same `process-lead` edge function the chat uses,
 * so the lead lands in Supabase, HubSpot and ClickUp with the quote attached (brief §7.1 attribution via `source`).
 * Browser-side. Zero calls before the visitor submits the intake form.
 */
import type { ProcessLeadPayload } from './quote';

export interface LeadResult { ok: boolean; status: number; error?: string; leadId?: string; }

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
