import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({ value: { user: { email: 'a@x.test' }, signOut: vi.fn(), isAdmin: true, isTech: false, isClient: false } as Record<string, unknown> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth.value }));
vi.mock('@/integrations/supabase/client', () => { const q: Record<string, unknown> = { is: async () => ({ count: 0 }) }; q.select = () => q; return { supabase: { from: () => q } }; });
vi.mock('@/components/notifications/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('@/components/pwa/RefreshButton', () => ({ RefreshButton: () => null, useRefreshApp: () => ({ refresh: vi.fn(), busy: false }) }));
const Pass = vi.hoisted(() => ({ children }: { children?: unknown }) => children as never);
vi.mock('@/components/ui/sheet', () => ({ Sheet: Pass, SheetTrigger: Pass, SheetContent: ({ children, style }: React.PropsWithChildren<{ style?: React.CSSProperties }>) => <div data-sheet style={style}>{children}</div> }));
vi.mock('@/components/ui/dropdown-menu', () => ({ DropdownMenu: Pass, DropdownMenuTrigger: Pass, DropdownMenuContent: Pass, DropdownMenuItem: Pass, DropdownMenuLabel: Pass, DropdownMenuSeparator: () => null }));
(globalThis as Record<string, unknown>).__BUILD_ID__ = '2026-10-27T00:00:00Z';
vi.mock('@/releaseNotes', () => ({ APP_VERSION: 'test' }));
import { Navbar } from '@/components/layout/Navbar';

const render = async () => { let t!: ReactTestRenderer; await act(async () => { t = create(<MemoryRouter><Navbar /></MemoryRouter>); }); return t; };
const linkLabels = (t: ReactTestRenderer, within?: (n: { type: unknown }) => boolean) => {
  const root = within ? t.root.findAll(n => within(n as never))[0] : t.root;
  return root.findAll(n => n.type === 'a').map(a => ({ href: a.props.href as string, text: JSON.stringify(a.children) }));
};

describe('admin navigation grouping', () => {
  it('only Billing, Mailjet Test and Telnyx Status sit under Advanced > Testing, Billing relabelled Practice Billing', async () => {
    const t = await render();
    const details = t.root.findAll(n => n.type === 'details');
    expect(details.length).toBe(2);
    const testing = details[0].findAll(n => n.type === 'a').map(a => a.props.href).sort();
    expect(testing).toEqual(['/admin/billing', '/admin/mailjet-test', '/admin/telnyx-status']);
    const billing = details[0].findAll(n => n.type === 'a' && n.props.href === '/admin/billing')[0];
    expect(JSON.stringify(billing.children)).toContain('Practice Billing');
    const summaries = t.root.findAll(n => n.type === 'summary').map(s => s.children.join(''));
    expect(summaries).toEqual(['Advanced', 'Testing']);
  });
  it('Invoice Delivery stays in the main mobile menu, outside Advanced', async () => {
    const t = await render();
    const sheetNav = t.root.findAll(n => n.type === 'nav' && n.props.className?.includes('shrink-0'))[0];
    const mainHrefs = sheetNav.children.filter((c): c is never => typeof c !== 'string')
      .flatMap((c: { type: unknown; findAll: (p: (n: { type: unknown; props: Record<string, unknown> }) => boolean) => { props: Record<string, unknown> }[] }) => c.type === 'details' ? [] : c.findAll(n => n.type === 'a').map(a => a.props.href));
    expect(mainHrefs).toContain('/admin/invoice-delivery');
    expect(mainHrefs).not.toContain('/admin/billing');
    expect(mainHrefs).not.toContain('/admin/mailjet-test');
  });
  it('toolbar and menu use device safe-area insets and the menu scrolls', async () => {
    const t = await render();
    const top = t.root.findAll(n => n.type === 'nav')[0];
    expect(top.props.style.paddingTop).toBe('env(safe-area-inset-top, 0px)');
    const sheet = t.root.findAll(n => n.props['data-sheet'])[0];
    expect(sheet.props.style.paddingBottom).toContain('safe-area-inset-bottom');
    expect(t.root.findAll(n => typeof n.props.className === 'string' && n.props.className.includes('overflow-y-auto')).length).toBeGreaterThan(0);
    void linkLabels;
  });
  it('non-admins get no Advanced section', async () => {
    auth.value = { ...auth.value, isAdmin: false, isTech: true };
    const t = await render();
    expect(t.root.findAll(n => n.type === 'details').length).toBe(0);
    expect(t.root.findAll(n => n.type === 'a' && n.props.href === '/admin/billing').length).toBe(0);
  });
});
