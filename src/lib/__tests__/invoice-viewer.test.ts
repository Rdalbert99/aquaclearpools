// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountInvoiceViewer } from '@/invoice-viewer';

const EP = 'https://tbqqigqkbogibwumjyol.supabase.co/functions/v1/invoice-pdf';
const TOKEN = 'A'.repeat(31) + '_';
let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'; root = document.getElementById('root')!;
  history.replaceState(null, '', '/invoice#' + TOKEN);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
});
const flush = () => new Promise(r => setTimeout(r, 0));

describe('branded invoice viewer', () => {
  it('rejects any other endpoint', async () => {
    await expect(mountInvoiceViewer(root, 'https://evil.example/x', TOKEN)).rejects.toThrow('invalid_endpoint');
  });
  it('strips the token from the URL and does not fetch on load', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    await mountInvoiceViewer(root, EP, TOKEN);
    expect(location.hash).toBe(''); expect(location.pathname).toBe('/invoice'); expect(f).not.toHaveBeenCalled();
  });
  it('invalid token shows reopen guidance without a button', async () => {
    await mountInvoiceViewer(root, EP, 'short');
    expect(root.querySelector('button')).toBeNull(); expect(root.textContent).toContain('reopen the original invoice link');
  });
  it('good PDF: token only in text body, credentials omitted, no redirects; repeated clicks fetch once', async () => {
    const f = vi.fn(async () => new Response(new Blob([new Uint8Array(500)]), { headers: { 'content-type': 'application/pdf' } }));
    vi.stubGlobal('fetch', f);
    await mountInvoiceViewer(root, EP, TOKEN);
    const b = root.querySelector('button')!; b.click(); b.click(); await flush(); await flush();
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(EP); expect(init).toMatchObject({ method: 'POST', body: TOKEN, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error' });
    expect(root.querySelector('a')?.getAttribute('href')).toBe('blob:x');
  });
  it.each([[404, 'application/pdf'], [200, 'text/html']])('expired/revoked/wrong type (%s %s) shows unavailable and allows retry', async (status, type) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(200), { status, headers: { 'content-type': type } })));
    await mountInvoiceViewer(root, EP, TOKEN);
    root.querySelector('button')!.click(); await flush(); await flush();
    expect(root.textContent).toContain('unavailable or has expired'); expect(root.querySelector('button')!.disabled).toBe(false);
  });
});
