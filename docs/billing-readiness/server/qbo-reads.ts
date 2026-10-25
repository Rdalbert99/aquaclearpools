// Read adapter PREPARED ONLY: all transport injected; no fetch until explicitly called.
import { accountingUrl, expectJson, requestWithRetry, type QboEnv } from '../../../supabase/functions/_shared/qbo-oauth';
import { normalizeOpenInvoices } from '../../../supabase/functions/_shared/qbo-balance';
import { validProviderId, type Snapshot } from '../../../src/lib/billing-readiness';
import type { ProviderInvoice } from './workflow';
type RecordValue = { Id?: string; Active?: boolean; CustomerRef?: { value?: string }; DueDate?: string; TxnDate?: string; PrivateNote?: string; TotalAmt?: number; Balance?: number; IncomeAccountRef?: { value?: string }; AccountType?: string; Line?: { Description?: string }[] };
export function qboReadAdapter(deps: {
  environment: QboEnv; realmId: string; fetch: Parameters<typeof requestWithRetry>[0]; authorization(): Promise<string>;
  // Company-specific tax verification is mandatory: US/non-US QBO tax rules differ.
  verifyTax(s: Snapshot): Promise<boolean>;
}) {
  async function read(s: Snapshot, path: string): Promise<Record<string, unknown>> {
    if (s.environment !== deps.environment || s.realmId !== deps.realmId || !validProviderId(s.customerId)) throw new Error('cross_realm');
    return expectJson(await requestWithRetry(deps.fetch, accountingUrl(s.environment, s.realmId, path), {
      method: 'GET', headers: { Authorization: await deps.authorization(), Accept: 'application/json' },
    }, { retry: true })) as Record<string, unknown>;
  }
  async function allInvoices(s: Snapshot): Promise<RecordValue[]> {
    const all: RecordValue[] = [];
    for (let start = 1; ; start += 100) {
      const query = `select * from Invoice where CustomerRef = '${s.customerId}' STARTPOSITION ${start} MAXRESULTS 100`;
      const data = await read(s, `/query?query=${encodeURIComponent(query)}`);
      const qr = data.QueryResponse as { Invoice?: RecordValue[] } | undefined;
      if (!qr || !Array.isArray(qr.Invoice ?? [])) throw new Error('read_failed');
      const page = qr.Invoice ?? [];
      if (page.some(i => i.CustomerRef?.value !== s.customerId || !i.Id)) throw new Error('read_failed');
      all.push(...page);
      if (page.length < 100) return all;
      // Bound pathological provider paging; abort rather than return incomplete/zero balance.
      if (start >= 10001) throw new Error('pagination_review_required');
    }
  }
  return {
    async verifySetup(s: Snapshot) {
      if (!validProviderId(s.provider.itemId) || !validProviderId(s.provider.incomeAccountId)) return false;
      const [customer, item, account] = await Promise.all([
        read(s, `/customer/${s.customerId}`), read(s, `/item/${s.provider.itemId}`), read(s, `/account/${s.provider.incomeAccountId}`),
      ]);
      const c = customer.Customer as RecordValue | undefined;
      const i = item.Item as RecordValue | undefined;
      const a = account.Account as RecordValue | undefined;
      return c?.Id === s.customerId && c.Active !== false && i?.Id === s.provider.itemId && i.Active !== false &&
        i.IncomeAccountRef?.value === s.provider.incomeAccountId && a?.Id === s.provider.incomeAccountId && a.Active !== false && a.AccountType === 'Income' && await deps.verifyTax(s);
    },
    async balances(s: Snapshot) {
      const invoices = normalizeOpenInvoices({ QueryResponse: { Invoice: await allInvoices(s) } }, s.customerId);
      return { available: true, invoices }; // failures throw; never false success/$0
    },
    async existing(s: Snapshot): Promise<{ status: 'clear' | 'ambiguous'; exact: ProviderInvoice[] }> {
      const invoices = await allInvoices(s); // includes paid, partial and manual invoices
      const exact: ProviderInvoice[] = [];
      let ambiguous = false;
      for (const i of invoices) {
        const descriptions = [i.PrivateNote ?? '', ...(i.Line ?? []).map(l => l.Description ?? '')].join(' ');
        const coverage = descriptions.includes(`Pool service ${s.serviceStart} through ${s.serviceEnd}`) || descriptions.includes(`Aqua Clear service ${s.serviceStart} through ${s.serviceEnd}; ${s.frequency}`);
        const amount = Math.round(Number(i.TotalAmt) * 100);
        if (coverage && i.Id && i.DueDate === s.dueDate && amount === s.amountCents) {
          exact.push({ id: i.Id, customerId: s.customerId, amountCents: amount, dueDate: s.dueDate, serviceStart: s.serviceStart, serviceEnd: s.serviceEnd, frequency: s.frequency });
        } else if (coverage || i.DueDate === s.dueDate || (i.TxnDate === s.sendAt.slice(0, 10) && amount === s.amountCents)) {
          ambiguous = true; // Never infer relevance or create over an ambiguous manual invoice.
        }
      }
      return { status: ambiguous || exact.length > 1 ? 'ambiguous' : 'clear', exact };
    },
  };
}
