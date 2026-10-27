/** Import ONLY from isolated /invoice bootstrap BEFORE analytics/router/auth imports. */
type Style = Partial<CSSStyleDeclaration>;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, style: Style, text?: string) => {
  const e = document.createElement(tag); Object.assign(e.style, style); if (text) e.textContent = text; return e;
};
const BRAND = '#0056a6';
const buttonStyle: Style = { display: 'block', width: '100%', boxSizing: 'border-box', padding: '14px 16px', marginTop: '24px', border: '0', borderRadius: '10px', background: BRAND, color: '#ffffff', font: '600 16px/1.2 system-ui, -apple-system, sans-serif', cursor: 'pointer', textAlign: 'center', textDecoration: 'none' };

export async function mountInvoiceViewer(root: HTMLElement, endpoint: string, initialToken?: string) {
  const fixedEndpoint = 'https://tbqqigqkbogibwumjyol.supabase.co/functions/v1/invoice-pdf';
  if (endpoint !== fixedEndpoint) throw Error('invalid_endpoint');
  const token = initialToken ?? location.hash.slice(1);
  // Remove capability from history immediately; no storage, cookie or analytics.
  history.replaceState(null, '', '/invoice');
  document.title = 'Your invoice | Aqua Clear Pools';
  const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.prepend(meta);
  Object.assign(document.body.style, { margin: '0', background: '#eef5fb', color: '#10243a', font: '16px/1.5 system-ui, -apple-system, sans-serif' });
  root.replaceChildren();
  const main = el('main', { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', boxSizing: 'border-box' });
  const card = el('section', { width: '100%', maxWidth: '420px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,56,110,0.12)', padding: '32px 24px', boxSizing: 'border-box', textAlign: 'center' });
  const logo = el('img', { width: '96px', height: '96px', objectFit: 'contain' }); logo.src = '/aqua-clear-logo-256.webp'; logo.alt = ''; logo.referrerPolicy = 'no-referrer';
  const h = el('h1', { margin: '12px 0 4px', fontSize: '22px', color: BRAND }, 'Aqua Clear Pools');
  const p = el('p', { margin: '0', color: '#4a5d70' }, 'Your private invoice link');
  const button = el('button', buttonStyle, 'Open invoice PDF'); button.type = 'button';
  const status = el('p', { minHeight: '24px', margin: '16px 0 0', color: '#4a5d70', fontSize: '14px' }); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  card.append(logo, h, p, button, status); main.append(card); root.append(main);
  let objectUrl: string | null = null; let busy = false;
  addEventListener('pagehide', (event: PageTransitionEvent) => { if (!event.persisted && objectUrl) URL.revokeObjectURL(objectUrl); });
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) { button.remove(); status.textContent = 'Please reopen the original invoice link from your message.'; return; }
  button.onclick = async () => {
    if (busy) return; busy = true; button.disabled = true; button.style.opacity = '0.6'; status.textContent = 'Opening your invoice…';
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: token, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error' });
      if (!response.ok || response.headers.get('content-type') !== 'application/pdf') throw Error('unavailable');
      const pdf = await response.blob(); if (pdf.size < 100 || pdf.size > 2_000_000) throw Error('unavailable');
      if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = URL.createObjectURL(pdf);
      const link = el('a', buttonStyle, 'View or download your invoice PDF'); link.href = objectUrl; link.download = 'Aqua-Clear-Invoice.pdf'; link.rel = 'noreferrer';
      button.replaceWith(link);
      status.textContent = 'Your invoice is ready. This link is private but can be forwarded.';
    } catch { status.textContent = 'This invoice link is unavailable or has expired.'; button.disabled = false; button.style.opacity = '1'; busy = false; }
  };
}
