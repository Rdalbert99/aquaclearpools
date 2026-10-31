import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installHomepageAnalytics, referralCategory, trackHomepage, parseReport } from '../website-analytics';
import { validEvent, validReport } from '../../../supabase/functions/website-analytics/validation';

const backend = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: backend } }));
vi.mock('recharts', () => ({ ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>, LineChart: () => null, Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null }));
import Analytics from '@/pages/admin/Analytics';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); backend.invoke.mockReset(); });
const report = (days = 30) => ({ days, today:'2026-10-31', asOf:'2026-10-31T18:00:00Z', trackingStartedAt:'2026-10-31T12:00:00Z', rows:[] });

describe('homepage-only analytics', () => {
  it('sends only fixed hostname categories, never raw query or fragment', () => {
    expect(referralCategory('https://www.google.com/search?q=private#secret')).toBe('search');
    expect(referralCategory('https://facebook.com/private')).toBe('social');
    expect(referralCategory('https://getaquaclear.com/invoice#secret')).toBe('internal');
    expect(referralCategory('https://google.com.evil.test/')).toBe('referral');
    expect(referralCategory('')).toBe('direct');
  });
  it('rejects unknown event, category, page and extra fields', () => {
    const v = { page:'/', event:'page_view', referral:'direct' };
    expect(validEvent(v)).toBe(true);
    for (const value of [{ ...v,event:'login' },{ ...v,referral:'google' },{ ...v,page:'/invoice' },{ ...v,page:'/?x=1' },{ ...v,ref:'https://private.test' },null]) expect(validEvent(value)).toBe(false);
    expect(validReport({ action:'report',days:7 })).toBe(true);
    expect(validReport({ action:'report',days:8 })).toBe(false);
    expect(validReport({ action:'report',days:7,actor:'admin' })).toBe(false);
  });
  it('coalesces StrictMode cleanup/remount, counts later mount and one click per activation without cancelling call/text', async () => {
    vi.stubGlobal('window', { location:{ pathname:'/' } });
    vi.stubGlobal('document', { referrer:'' });
    class Target { constructor(public href:string) {} closest() { return this; } getAttribute() { return this.href; } }
    vi.stubGlobal('Element',Target);
    const listeners = new Set<(e: unknown) => void>();
    const root = { contains:() => true,addEventListener:(_n:string,f:(e:unknown)=>void) => listeners.add(f),removeEventListener:(_n:string,f:(e:unknown)=>void) => listeners.delete(f) } as unknown as HTMLElement;
    const send = vi.fn();
    const stop = installHomepageAnalytics(root,send); stop();
    const stop2 = installHomepageAnalytics(root,send);
    await Promise.resolve(); expect(send.mock.calls).toEqual([['page_view','direct']]);
    const preventDefault = vi.fn();
    for (const href of ['tel:6014470399','sms:6014470399']) for (const f of listeners) f({ target:new Target(href),preventDefault });
    expect(send.mock.calls).toEqual([['page_view','direct'],['call_click','direct'],['text_click','direct']]);
    expect(preventDefault).not.toHaveBeenCalled();
    stop2(); expect(listeners.size).toBe(0);
    const stop3 = installHomepageAnalytics(root,send); await Promise.resolve(); stop3();
    expect(send.mock.calls.filter(([event]) => event==='page_view')).toHaveLength(2);
  });
  it('never installs on portals, auth, admin, profile or invoice, and skips localhost/preview transport', async () => {
    const send = vi.fn();
    for (const pathname of ['/invoice','/admin','/tech','/client','/profile','/commercial/portal','/auth/login']) {
      vi.stubGlobal('window',{ location:{ pathname,origin:'https://getaquaclear.com' } });
      installHomepageAnalytics({} as HTMLElement,send)();
    }
    expect(send).not.toHaveBeenCalled();
    const fetcher = vi.fn(); vi.stubGlobal('fetch',fetcher);
    for (const origin of ['http://localhost:8080','https://aquaclear-pools.lovable.app']) {
      vi.stubGlobal('window',{ location:{ pathname:'/',origin } }); trackHomepage('page_view','direct');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses one no-referrer credential-free request, no retry even if fetch rejects', async () => {
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY','eyJ.public.test');
    vi.stubGlobal('window',{ location:{ pathname:'/',origin:'https://getaquaclear.com' } });
    const fetcher = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch',fetcher);
    trackHomepage('call_click','search'); await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const options = fetcher.mock.calls[0][1];
    expect(JSON.parse(options.body)).toEqual({ event:'call_click',referral:'search',page:'/' });
    expect(options).toMatchObject({ credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error' });
    vi.unstubAllEnvs();
  });
  it('fails closed on malformed report, never treats an error as zero', () => {
    expect(parseReport(report(),30).rows).toEqual([]);
    expect(() => parseReport({ error:'unavailable' },30)).toThrow();
    expect(() => parseReport(report(7),30)).toThrow();
    expect(() => parseReport({ ...report(), rows:[{ day:'2026-10-31',event:'page_view',referral:'direct',count:-1 }] },30)).toThrow();
  });
  it('shows unavailable on failure and refresh recovers to a genuine empty report', async () => {
    backend.invoke.mockResolvedValueOnce({ error:new Error('denied'),data:null }).mockResolvedValueOnce({ error:null,data:report() });
    let tree: ReactTestRenderer | undefined;
    await act(async () => { tree=create(<Analytics />); });
    expect(tree?.root.findByProps({ role:'alert' }).children.join('')).toContain('unavailable');
    await act(async () => { tree?.root.findAllByType('button').find(b => b.children.some(c => c==='Refresh'))?.props.onClick(); });
    expect(JSON.stringify(tree?.toJSON())).toContain('No homepage events');
    await act(async () => tree?.unmount());
  });
  it('ignores stale range replies and replies after unmount', async () => {
    let resolveOld: ((v:unknown)=>void) | undefined;
    backend.invoke.mockImplementationOnce(() => new Promise(r => { resolveOld=r; })).mockResolvedValueOnce({ data:report(7),error:null });
    let tree: ReactTestRenderer | undefined;
    await act(async () => { tree=create(<Analytics />); });
    await act(async () => { tree?.root.findAllByType('button').find(b => b.children.join('')==='7 days')?.props.onClick(); });
    await act(async () => { resolveOld?.({ data:report(30),error:null }); });
    expect(tree?.root.findAllByType('button').find(b => b.children.join('')==='7 days')?.props['aria-pressed']).toBe(true);
    expect(tree?.root.findAllByProps({ role:'alert' })).toHaveLength(0);
    await act(async () => tree?.unmount());
  });
});