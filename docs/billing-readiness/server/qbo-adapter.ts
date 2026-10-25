// Prepared server adapter; transport must be bound to a verified, scoped connection.
// No default fetch and no edge entrypoint; importing this cannot contact QuickBooks.
import { accountingUrl, expectJson, requestWithRetry, type QboEnv } from '../../../supabase/functions/_shared/qbo-oauth';
import type { Snapshot, SendChannel } from '../../../src/lib/billing-readiness';
import type { InvoicePayload, ProviderInvoice } from './workflow';
interface Transport {
  environment: QboEnv; realmId: string;
  fetch: Parameters<typeof requestWithRetry>[0];
  authorization(): Promise<string>; // server-only bearer, never returned/logged
}
export function qboWriteAdapter(transport: Transport) {
  async function write(s: Snapshot, path: string, body?: unknown) {
    if (s.environment !== transport.environment || s.realmId !== transport.realmId) throw new Error('cross_realm');
    const result = await requestWithRetry(transport.fetch, accountingUrl(s.environment, s.realmId, path), {
      method: 'POST', headers: { Authorization: await transport.authorization(), Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }, { retry: false }); // NO automatic write retries, including timeouts/429/5xx.
    return expectJson(result) as { Invoice?: { Id?: string; TotalAmt?: number; DueDate?: string; CustomerRef?: { value?: string } } };
  }
  return {
    async create(s: Snapshot, payload: InvoicePayload, requestId: string): Promise<ProviderInvoice> {
      if (!/^[a-zA-Z0-9-]{1,50}$/.test(requestId)) throw new Error('invalid_request_id');
      const reply = await write(s, `/invoice?requestid=${encodeURIComponent(requestId)}`, payload);
      const invoice = reply.Invoice;
      if (!invoice?.Id || invoice.CustomerRef?.value !== s.customerId || invoice.DueDate !== s.dueDate || Math.round(Number(invoice.TotalAmt) * 100) !== s.amountCents) throw new Error('provider_result_mismatch');
      return { id: invoice.Id, customerId: s.customerId, amountCents: s.amountCents, dueDate: s.dueDate, serviceStart: s.serviceStart, serviceEnd: s.serviceEnd, frequency: s.frequency };
    },
    async email(s: Snapshot, invoiceId: string, channel: SendChannel) {
      if (channel !== 'email' || !s.channels.includes('email') || !s.contactEmail || !/^\d+$/.test(invoiceId)) throw new Error('delivery_setup');
      await write(s, `/invoice/${invoiceId}/send?sendTo=${encodeURIComponent(s.contactEmail)}`);
      return 'sent' as const;
    },
    // SMS requires an explicit Telnyx adapter + official QBO invoice/payment URL lookup.
    // No generated payment URLs, fabricated success or automatic customer creation.
  };
}
