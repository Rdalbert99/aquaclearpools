// Isolate bearer-capability route before importing router/auth/analytics/SW code.
if (window.location.pathname === '/invoice') {
  const token = window.location.hash.slice(1);
  window.history.replaceState(null, '', '/invoice');
  const head = document.head;
  const meta = (name: string, content: string, httpEquiv = false) => {
    const m = document.createElement('meta');
    if (httpEquiv) m.httpEquiv = name; else m.name = name;
    m.content = content; head.prepend(m);
  };
  meta('referrer', 'no-referrer');
  meta('robots', 'noindex, nofollow, noarchive');
  // Route-only defense in depth (hosting headers cannot be configured; frame-ancestors is ignored in meta).
  meta('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src https://tbqqigqkbogibwumjyol.supabase.co/functions/v1/invoice-pdf; base-uri 'none'; form-action 'none'", true);
  void import('./invoice-viewer').then(({ mountInvoiceViewer }) =>
    mountInvoiceViewer(document.getElementById('root')!,
      'https://tbqqigqkbogibwumjyol.supabase.co/functions/v1/invoice-pdf', token)
  ).catch(() => { document.getElementById('root')!.textContent = 'Please reopen your invoice link.'; });
} else {
  void import('./app-bootstrap');
}
export {};
