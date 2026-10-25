// Read-only QuickBooks setup discovery. GET only; returns minimum safe fields, never tokens.
// Every confirm/save re-reads live records and compares an evidence fingerprint.
import { validProviderId } from '../../../src/lib/billing-readiness';
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped provider JSON, validated field-by-field
export type Get = (path: string) => Promise<Record<string, any>>;
const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const fp = (parts: unknown[]) => JSON.stringify(parts);

export interface ProviderEvidence {
  realmId: string; companyName: string; country: string;
  item: { id: string; name: string; active: boolean; type: string; taxable: boolean | null; incomeAccountId: string };
  account: { id: string; name: string; active: boolean; type: string };
  taxSupported: boolean; blockers: string[]; fingerprint: string;
}
export async function discoverProvider(get: Get, realmId: string, itemId: string): Promise<ProviderEvidence> {
  if (!validProviderId(itemId)) throw new Error('invalid_item');
  const item = (await get(`/item/${itemId}`)).Item;
  if (!item || s(item.Id) !== itemId) throw new Error('item_not_found');
  const incomeAccountId = s(item.IncomeAccountRef?.value); // derived from the live Item, never typed
  if (!validProviderId(incomeAccountId)) throw new Error('item_income_account_missing');
  const [accountData, companyData] = await Promise.all([get(`/account/${incomeAccountId}`), get(`/companyinfo/${realmId}`)]);
  const account = accountData.Account; const company = companyData.CompanyInfo;
  if (!account || s(account.Id) !== incomeAccountId) throw new Error('account_not_found');
  if (!company || s(company.Id) !== realmId) throw new Error('company_mismatch');
  const blockers: string[] = [];
  if (item.Active === false) blockers.push('Item inactive');
  if (account.Active === false) blockers.push('Income account inactive');
  if (account.AccountType !== 'Income') blockers.push('Account is not an Income account');
  const country = s(company.Country);
  if (country !== 'US') blockers.push('Only US non-taxable (NON) treatment is supported');
  const taxable = typeof item.Taxable === 'boolean' ? item.Taxable : null;
  if (taxable === true) blockers.push('Item is marked taxable in QuickBooks; NON treatment not supported');
  const e = {
    realmId, companyName: s(company.CompanyName), country,
    item: { id: itemId, name: s(item.Name), active: item.Active !== false, type: s(item.Type), taxable, incomeAccountId },
    account: { id: incomeAccountId, name: s(account.Name), active: account.Active !== false, type: s(account.AccountType) },
  };
  return { ...e, taxSupported: blockers.length === 0, blockers,
    fingerprint: fp([realmId, itemId, e.item.name, e.item.active, e.item.type, taxable, incomeAccountId, e.account.name, e.account.active, e.account.type, country, s(item.SyncToken), s(account.SyncToken)]) };
}

export interface AppCustomer { id: string; customer: string; status: string | null; contact_email?: string | null; contact_phone?: string | null; address?: string | null }
export interface QbCustomer { id: string; displayName: string; active: boolean; email: string; phone: string; address: string; syncToken: string }
export const normEmail = (e?: string | null) => (e ?? '').trim().toLowerCase();
export const normPhone = (p?: string | null) => (p ?? '').replace(/\D/g, '').slice(-10);
export const normText = (t?: string | null) => (t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped provider JSON
function qbCustomer(c: Record<string, any>): QbCustomer {
  const a = c.BillAddr ?? {};
  return { id: s(c.Id), displayName: s(c.DisplayName), active: c.Active !== false, email: s(c.PrimaryEmailAddr?.Address),
    phone: s(c.PrimaryPhone?.FreeFormNumber || c.Mobile?.FreeFormNumber),
    address: [a.Line1, a.City, a.CountrySubDivisionCode, a.PostalCode].filter(Boolean).join(', '), syncToken: s(c.SyncToken) };
}
export async function readCustomer(get: Get, id: string): Promise<QbCustomer> {
  if (!validProviderId(id)) throw new Error('invalid_customer');
  const c = (await get(`/customer/${id}`)).Customer;
  if (!c || s(c.Id) !== id) throw new Error('customer_not_found');
  return qbCustomer(c);
}
/** Bounded search returns LEADS only; nothing is linked from a search result. */
export async function searchCustomers(get: Get, term: string): Promise<QbCustomer[]> {
  const t = term.trim();
  if (t.length < 2 || t.length > 60) throw new Error('invalid_search');
  const safe = t.replace(/['\\%]/g, '');
  const q = `select * from Customer where DisplayName like '%${safe}%' MAXRESULTS 10`;
  const qr = (await get(`/query?query=${encodeURIComponent(q)}`)).QueryResponse;
  if (!qr) throw new Error('search_failed');
  return (qr.Customer ?? []).slice(0, 10).map(qbCustomer);
}
export type Evidence = { field: 'email' | 'phone' | 'address' | 'name'; result: 'match' | 'conflict' | 'absent' };
export function compareIdentity(app: AppCustomer, qb: QbCustomer) {
  const cmp = (a: string, b: string): Evidence['result'] => !a || !b ? 'absent' : a === b ? 'match' : 'conflict';
  const evidence: Evidence[] = [
    { field: 'email', result: cmp(normEmail(app.contact_email), normEmail(qb.email)) },
    { field: 'phone', result: cmp(normPhone(app.contact_phone), normPhone(qb.phone)) },
    { field: 'address', result: cmp(normText(app.address).split(' ').slice(0, 3).join(' '), normText(qb.address).split(' ').slice(0, 3).join(' ')) },
    { field: 'name', result: cmp(normText(app.customer), normText(qb.displayName)) },
  ];
  // Name alone never supports a link; at least one contact/address match and no conflicts.
  const strong = evidence.some(e => e.field !== 'name' && e.result === 'match');
  const conflicts = evidence.filter(e => e.result === 'conflict').map(e => e.field);
  const blockers: string[] = [];
  if (!qb.active) blockers.push('QuickBooks customer inactive');
  if (!strong) blockers.push('No email, phone or address match — owner review required');
  if (conflicts.length) blockers.push(`Conflicting ${conflicts.join(', ')} — owner review required`);
  return { evidence, supported: blockers.length === 0, blockers };
}
export const customerFingerprint = (realmId: string, app: AppCustomer, qb: QbCustomer) =>
  fp([realmId, app.id, normText(app.customer), normEmail(app.contact_email), normPhone(app.contact_phone), normText(app.address), qb.id, qb.displayName, qb.active, normEmail(qb.email), normPhone(qb.phone), normText(qb.address), qb.syncToken]);
