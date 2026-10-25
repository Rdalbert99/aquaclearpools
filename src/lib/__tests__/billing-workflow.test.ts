import { describe, it, expect, vi } from 'vitest';
import { readinessRow, invoiceSlot, snapshotCanonical, coverageOverlaps, type Snapshot } from '../billing-readiness';
import { executeInvoice, invoicePayload, resumeDelivery, type Authority, type Store, type Run, type Provider, type Approval, type Policy, type ProviderInvoice } from '../../../docs/billing-readiness/server/workflow';
import { qboWriteAdapter } from '../../../docs/billing-readiness/server/qbo-adapter';
import { scheduledTick, dispatchAnnouncement } from '../../../docs/billing-readiness/server/scheduler';
function snapshot(): Snapshot {
  const row = readinessRow({ id: 'c1', customer: 'Robert Boswell', status: 'Active', service_rate: 200, contact_phone: '6015551234', contact_email: 'a@b.com' }, '2026-10', {
    enrollment: { enabled: true, firstServicePeriod: '2026-11', revision: 1, updatedBy: 'owner', updatedAt: '2026-10-25T12:09:00Z' }, businessId: 'b1', realmId: '123', environment: 'sandbox', smsConsent: true, smsOptedOut: false, consentRevision: '1',
    mapping: { businessId: 'b1', realmId: '123', environment: 'sandbox', clientId: 'c1', customerId: '114', verified: true, revision: '1' },
    provider: { verified: true, itemId: '1', incomeAccountId: '2', taxMode: 'non_taxable', taxCode: 'NON', revision: '1' },
  });
  if (!row.snapshot) throw new Error('bad_fixture'); return row.snapshot;
}
function harness() {
  const s = snapshot();
  const approval: Approval = { id: 'a1', snapshot: s, approvedBy: 'admin', approvedAt: '2026-10-25T12:00:00Z', fingerprint: snapshotCanonical(s) };
  let current: Snapshot | null = s;
  let policy: Policy = { billingMode: 'qbo', invoiceEnabled: true, announcementEnabled: false, migrationVerified: true, deploymentVerified: true, providerVerified: true, environment: 'sandbox', realmId: '123', businessId: 'b1' };
  const records = new Map<string, Run>();
  const events: string[] = [];
  const authority: Authority = {
    authenticate: async token => token === 'mock-admin' || token === 'mock-scheduler' ? { id: token, businessId: 'b1', kind: token === 'mock-admin' ? 'admin' : 'scheduler' } : null,
    policy: async () => policy, approval: async id => id === 'a1' ? approval : null, current: async () => current,
  };
  const store: Store = {
    claim: async a => {
      const slot = invoiceSlot(a.snapshot);
      if (records.has(slot) || [...records.values()].some(r => coverageOverlaps(r.snapshot, a.snapshot))) return null;
      const run: Run = { id: 'run1', auditId: 'audit1', snapshot: a.snapshot, requestId: 'stable-request-1', state: 'claimed', providerInvoiceId: null, channels: { sms: 'pending', email: 'pending' } };
      records.set(slot, run); events.push('claim'); return run;
    },
    find: async slot => records.get(slot) ?? null,
    update: async (id, patch) => {
      const run = [...records.values()].find(r => r.id === id); if (!run) throw new Error('missing_run');
      if (patch.state) run.state = patch.state;
      if (patch.providerInvoiceId) run.providerInvoiceId = patch.providerInvoiceId;
      if (patch.channel && patch.channelState) run.channels[patch.channel] = patch.channelState;
      events.push(patch.code ?? patch.state ?? 'update');
    },
    claimChannel: async (id, channel) => {
      const run = [...records.values()].find(r => r.id === id); if (!run || !['pending', 'failed'].includes(run.channels[channel] ?? '')) return false;
      run.channels[channel] = 'sending'; return true;
    },
  };
  const invoice: ProviderInvoice = { id: '901', customerId: s.customerId, amountCents: 20000, dueDate: s.dueDate, serviceStart: s.serviceStart, serviceEnd: s.serviceEnd, frequency: 'monthly' };
  const provider: Provider = {
    existing: vi.fn(async () => ({ status: 'clear' as const, exact: [] })), verifySetup: vi.fn(async () => true), balances: vi.fn(async () => ({ available: true })),
    create: vi.fn(async () => invoice), deliver: vi.fn(async () => 'sent' as const),
  };
  return { authority, store, provider, s, invoice, events, records, approval, change: (value: Snapshot | null) => { current = value; }, policy: (value: Partial<Policy>) => { policy = { ...policy, ...value }; } };
}
describe('mocked server-only QBO workflow', () => {
  it('rejects unauthorized and disabled before provider or claim', async () => {
    const h = harness(); await expect(executeInvoice(h, 'wrong', 'a1')).rejects.toThrow('unauthorized');
    h.policy({ billingMode: 'off' }); await expect(executeInvoice(h, 'mock-admin', 'a1')).rejects.toThrow('disabled');
    expect(h.provider.create).not.toHaveBeenCalled(); expect(h.records.size).toBe(0);
  });
  it('rejects cross realm and changed approval', async () => {
    const h = harness(); h.policy({ realmId: '999' }); await expect(executeInvoice(h, 'mock-admin', 'a1')).rejects.toThrow('cross_realm');
    h.policy({ realmId: '123' }); h.change({ ...h.s, amountCents: 21000 }); await expect(executeInvoice(h, 'mock-admin', 'a1')).rejects.toThrow('stale_approval');
  });
  it('manual/scheduler races and repeated clicks create once, send each channel once', async () => {
    const h = harness();
    const results = await Promise.all([executeInvoice(h, 'mock-admin', 'a1'), executeInvoice(h, 'mock-scheduler', 'a1')]);
    expect(results.map(r => r.state).sort()).toEqual(['complete', 'duplicate']);
    expect((await executeInvoice(h, 'mock-admin', 'a1')).state).toBe('duplicate');
    expect(h.provider.create).toHaveBeenCalledTimes(1); expect(h.provider.deliver).toHaveBeenCalledTimes(2);
    expect(h.provider.create).toHaveBeenCalledWith(h.s, expect.objectContaining({ CustomerRef: { value: '114' }, DueDate: '2026-11-01' }), 'stable-request-1');
    expect(h.events.indexOf('create_in_flight')).toBeLessThan(h.events.indexOf('invoice_recorded'));
  });
  it('uncertain creation never blindly retries', async () => {
    const h = harness(); h.provider.create = vi.fn(async () => { throw new Error('timeout'); });
    expect((await executeInvoice(h, 'mock-admin', 'a1')).state).toBe('reconcile');
    expect((await executeInvoice(h, 'mock-admin', 'a1')).state).toBe('duplicate');
    expect(h.provider.create).toHaveBeenCalledTimes(1); expect(h.provider.deliver).not.toHaveBeenCalled();
  });
  it('partial delivery preserves ID and sent channel; definitive failure can resume only once', async () => {
    const h = harness(); let email = 0;
    h.provider.deliver = vi.fn(async (_, __, channel) => channel === 'email' && email++ === 0 ? 'failed' : 'sent');
    expect((await executeInvoice(h, 'mock-admin', 'a1')).state).toBe('blocked');
    let lock = false;
    const deps = { ...h, claimResume: async () => { if (lock) return false; lock = true; return true; } };
    const result = await Promise.all([resumeDelivery(deps, 'mock-admin', 'a1'), resumeDelivery(deps, 'mock-scheduler', 'a1')]);
    expect(result.sort()).toEqual(['complete', 'duplicate']);
    expect(h.provider.create).toHaveBeenCalledTimes(1);
    const deliver = vi.mocked(h.provider.deliver);
    expect(deliver.mock.calls.filter(call => call[2] === 'sms')).toHaveLength(1);
    expect(deliver.mock.calls.filter(call => call[2] === 'email')).toHaveLength(2);
  });
  it('unknown channel needs reconciliation not resend', async () => {
    const h = harness(); h.provider.deliver = vi.fn(async () => 'unknown' as const);
    expect((await executeInvoice(h, 'mock-admin', 'a1')).state).toBe('reconcile');
    await expect(resumeDelivery({ ...h, claimResume: async () => true }, 'mock-admin', 'a1')).rejects.toThrow('reconciliation_required');
    expect(h.provider.deliver).toHaveBeenCalledTimes(1);
  });
  it('existing manual exact invoice is adopted not recreated; ambiguous invoices block', async () => {
    const h = harness(); h.provider.existing = vi.fn(async () => ({ status: 'clear' as const, exact: [h.invoice] }));
    expect((await executeInvoice(h, 'mock-admin', 'a1')).state).toBe('complete'); expect(h.provider.create).not.toHaveBeenCalled();
    const other = harness(); other.provider.existing = vi.fn(async () => ({ status: 'ambiguous' as const, exact: [] }));
    expect((await executeInvoice(other, 'mock-admin', 'a1')).state).toBe('blocked'); expect(other.provider.create).not.toHaveBeenCalled();
  });
  it('unknown balance/read errors never become zero', async () => {
    const h = harness(); h.provider.balances = vi.fn(async () => ({ available: false }));
    expect((await executeInvoice(h, 'mock-admin', 'a1')).state).toBe('blocked'); expect(h.provider.create).not.toHaveBeenCalled();
    const other = harness(); other.provider.existing = vi.fn(async () => { throw new Error('read_failed'); });
    expect((await executeInvoice(other, 'mock-admin', 'a1')).state).toBe('blocked'); expect(other.provider.create).not.toHaveBeenCalled();
  });
  it('STOP after creation blocks delivery and preserves official invoice ID', async () => {
    const h = harness(); h.provider.create = vi.fn(async () => { h.change(null); return h.invoice; });
    expect((await executeInvoice(h, 'mock-admin', 'a1')).state).toBe('reconcile');
    expect(h.provider.deliver).not.toHaveBeenCalled(); expect([...h.records.values()][0].providerInvoiceId).toBe('901');
  });
  it('new QBO line remains $200, never old $220 balance', () => {
    const body = invoicePayload(snapshot()); expect(body.Line).toHaveLength(1); expect(body.Line[0].Amount).toBe(200);
    expect(body.Line[0].SalesItemLineDetail).toMatchObject({ ItemRef: { value: '1' }, TaxCodeRef: { value: 'NON' } });
  });
  it('adapter cross realm rejects without I/O and timeout writes are never retried', async () => {
    const s = snapshot(); const fetch = vi.fn(async () => { throw new Error('mock_network_failure'); });
    const adapter = qboWriteAdapter({ realmId: '123', environment: 'sandbox', fetch, authorization: async () => 'mock-only' });
    await expect(adapter.create({ ...s, environment: 'production' }, invoicePayload(s), 'request-1')).rejects.toThrow('cross_realm'); expect(fetch).not.toHaveBeenCalled();
    await expect(adapter.create(s, invoicePayload(s), 'request-1')).rejects.toThrow(); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('scheduler disabled and unauthorized do not enqueue', async () => {
    const deps = { authenticateScheduler: async (s: string) => s === 'mock', config: async () => ({ billingMode: 'off', invoiceEnabled: false, announcementEnabled: false, announcementHour: null, approvedScopeId: null, migrationVerified: false, deploymentVerified: false, providerVerified: false }), enqueueApprovedInvoices: vi.fn(), enqueueAnnouncement: vi.fn() };
    await expect(scheduledTick(deps, 'bad', new Date('2026-10-26T17:00:00Z'))).rejects.toThrow('unauthorized');
    await expect(scheduledTick(deps, 'mock', new Date('2026-10-26T17:00:00Z'))).rejects.toThrow('disabled'); expect(deps.enqueueApprovedInvoices).not.toHaveBeenCalled();
  });
  it('announcement requires approved scope and fresh consent; claims are per channel', async () => {
    const send = vi.fn(async () => 'sent' as const); const record = vi.fn();
    const claims = new Set<string>();
    const deps = { authenticate: async () => true, approvedRecipient: async () => ({ enabled: true, scopeApproved: true, channels: ['email' as const] }), claim: async (id: string, ch: string) => { const key = id + ch; if (claims.has(key)) return false; claims.add(key); return true; }, send, record };
    await Promise.all([dispatchAnnouncement(deps, 'mock', 'c1'), dispatchAnnouncement(deps, 'mock', 'c1')]); expect(send).toHaveBeenCalledTimes(1);
    await expect(dispatchAnnouncement({ ...deps, approvedRecipient: async () => ({ enabled: false, scopeApproved: true, channels: ['email'] }) }, 'mock', 'c2')).rejects.toThrow('disabled');
  });
});
